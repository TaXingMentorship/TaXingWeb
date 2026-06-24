"use client";

import * as React from "react";
import Papa from "papaparse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { listCohorts, importRoster } from "@/lib/portal/store";
import type { ImportResult, RosterRowInput } from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export default function AdminImportPage() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [cohortId, setCohortId] = React.useState("");
  const [rows, setRows] = React.useState<RosterRowInput[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [parseError, setParseError] = React.useState("");

  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
  });

  React.useEffect(() => {
    if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);

  const importMutation = useMutation({
    mutationFn: () => importRoster(cohortId, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "profiles"] });
    },
  });

  const result: ImportResult | undefined = importMutation.data;

  if (currentUser?.role !== "admin") {
    return <Alert severity="error">仅管理员可访问名单导入。</Alert>;
  }

  const handleFile = (file: File) => {
    setParseError("");
    importMutation.reset();
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = (res.meta.fields ?? []).map((f) => f.toLowerCase());
        const required = ["email", "full_name", "role"];
        const missing = required.filter((c) => !fields.includes(c));
        if (missing.length) {
          setParseError(`CSV 缺少必需的列：${missing.join("、")}`);
          setRows([]);
          return;
        }
        const parsed: RosterRowInput[] = res.data.map((r) => {
          const lower: Record<string, string> = {};
          Object.keys(r).forEach((k) => (lower[k.toLowerCase()] = r[k]));
          return {
            email: lower.email ?? "",
            full_name: lower.full_name ?? "",
            role: lower.role ?? "",
          };
        });
        setRows(parsed);
      },
      error: (err) => setParseError(`解析失败：${err.message}`),
    });
  };

  const loadSample = () => {
    setParseError("");
    importMutation.reset();
    setFileName("示例数据.csv");
    setRows([
      { email: "new.mentor@example.com", full_name: "新导师·韩雪", role: "mentor" },
      { email: "new.mentee@example.com", full_name: "新学员·许文", role: "mentee" },
      { email: "bad-email", full_name: "格式错误", role: "mentee" },
      { email: "wrong.role@example.com", full_name: "角色错误", role: "teacher" },
      { email: "wangjing@example.com", full_name: "王静", role: "mentor" },
    ]);
  };

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        名单导入
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        上传 CSV 文件批量导入导师与学员。文件需包含列：
        <code> email, full_name, role</code>（role 为 mentor 或 mentee）。
        <br />
        原型演示中不会真正发送邮件，导入的成员会直接出现在成员目录里。
      </Typography>

      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Stack spacing={2}>
          <TextField
            select
            label="导入到项目"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            sx={{ maxWidth: 320 }}
          >
            {(cohorts ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => fileRef.current?.click()}
            >
              选择 CSV 文件
            </Button>
            <Button variant="text" onClick={loadSample}>
              载入示例数据
            </Button>
            {fileName && (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                已选择：{fileName}（{rows.length} 行）
              </Typography>
            )}
          </Stack>

          {parseError && <Alert severity="error">{parseError}</Alert>}

          {rows.length > 0 && (
            <Box>
              <Button
                variant="contained"
                color="secondary"
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                导入 {rows.length} 行
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>

      {result && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Chip color="success" label={`成功导入 ${result.added.length}`} />
            <Chip color="warning" label={`跳过 ${result.skipped.length}`} />
            <Chip color="error" label={`错误 ${result.errors.length}`} />
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>邮箱</TableCell>
                <TableCell>姓名</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>结果</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.added.map((r) => (
                <TableRow key={`a-${r.id}`}>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>
                    <Chip size="small" color="success" label="已导入" />
                  </TableCell>
                </TableRow>
              ))}
              {result.skipped.map((s, i) => (
                <TableRow key={`s-${i}`}>
                  <TableCell>{s.row.email}</TableCell>
                  <TableCell>{s.row.full_name}</TableCell>
                  <TableCell>{s.row.role}</TableCell>
                  <TableCell>
                    <Chip size="small" color="warning" label={`跳过：${s.reason}`} />
                  </TableCell>
                </TableRow>
              ))}
              {result.errors.map((e, i) => (
                <TableRow key={`e-${i}`}>
                  <TableCell>{e.row.email}</TableCell>
                  <TableCell>{e.row.full_name}</TableCell>
                  <TableCell>{e.row.role}</TableCell>
                  <TableCell>
                    <Chip size="small" color="error" label={`错误：${e.reason}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
