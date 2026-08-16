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
import { listCohorts, importRoster, importMatches } from "@/lib/portal/store";
import type {
  ImportResult,
  MatchImportResult,
  MatchRowInput,
  RosterRowInput,
} from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

function parseParticipantRole(value: string): RosterRowInput["participant_role"] {
  const normalized = value.trim().toLowerCase();
  return normalized === "mentor" || normalized === "mentee" ? normalized : null;
}

function parseBoolean(value: string): boolean {
  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
}

function identityLabel(
  row: Pick<
    RosterRowInput,
    "participant_role" | "is_admin" | "is_volunteer"
  >,
): string {
  return [
    row.participant_role,
    row.is_admin ? "admin" : null,
    row.is_volunteer ? "volunteer" : null,
  ].filter(Boolean).join(" + ");
}

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

  // --- Match import ---
  const matchFileRef = React.useRef<HTMLInputElement>(null);
  const [matchRows, setMatchRows] = React.useState<MatchRowInput[]>([]);
  const [matchFileName, setMatchFileName] = React.useState("");
  const [matchParseError, setMatchParseError] = React.useState("");

  const matchMutation = useMutation({
    mutationFn: () => importMatches(cohortId, matchRows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "matches"] });
    },
  });
  const matchResult: MatchImportResult | undefined = matchMutation.data;

  const handleMatchFile = (file: File) => {
    setMatchParseError("");
    matchMutation.reset();
    setMatchFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = (res.meta.fields ?? []).map((f) => f.toLowerCase());
        const required = ["mentor_id", "mentee_id"];
        const missing = required.filter((c) => !fields.includes(c));
        if (missing.length) {
          setMatchParseError(`CSV 缺少必需的列：${missing.join("、")}`);
          setMatchRows([]);
          return;
        }
        const parsed: MatchRowInput[] = res.data.map((r) => {
          const lower: Record<string, string> = {};
          Object.keys(r).forEach((k) => (lower[k.toLowerCase()] = r[k]));
          return {
            mentor_id: lower.mentor_id ?? "",
            mentee_id: lower.mentee_id ?? "",
          };
        });
        setMatchRows(parsed);
      },
      error: (err) => setMatchParseError(`解析失败：${err.message}`),
    });
  };

  const loadMatchSample = () => {
    setMatchParseError("");
    matchMutation.reset();
    setMatchFileName("示例配对.csv");
    setMatchRows([
      { mentor_id: "mentor-2", mentee_id: "mentee-5" },
      { mentor_id: "mentor-1", mentee_id: "mentee-1" },
      { mentor_id: "mentor-x", mentee_id: "mentee-2" },
    ]);
  };

  if (!currentUser?.is_admin) {
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
        const required = [
          "email",
          "full_name",
          "participant_role",
          "is_admin",
          "is_volunteer",
        ];
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
            participant_role: parseParticipantRole(lower.participant_role ?? ""),
            is_admin: parseBoolean(lower.is_admin ?? ""),
            is_volunteer: parseBoolean(lower.is_volunteer ?? ""),
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
      { email: "new.mentor@example.com", full_name: "新导师·韩雪", participant_role: "mentor", is_admin: false, is_volunteer: false },
      { email: "new.mentee@example.com", full_name: "新学员·许文", participant_role: "mentee", is_admin: false, is_volunteer: false },
      { email: "new.admin@example.com", full_name: "新管理员", participant_role: null, is_admin: true, is_volunteer: false },
      { email: "new.volunteer@example.com", full_name: "新志愿者", participant_role: null, is_admin: false, is_volunteer: true },
    ]);
  };

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        名单导入
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        上传 CSV 文件批量导入成员。文件需包含列：
        <code> email, full_name, participant_role, is_admin, is_volunteer</code>。
        participant_role 可填写 mentor、mentee 或留空；两个标记填写 true 或 false。
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
                  <TableCell>{identityLabel(r)}</TableCell>
                  <TableCell>
                    <Chip size="small" color="success" label="已导入" />
                  </TableCell>
                </TableRow>
              ))}
              {result.skipped.map((s, i) => (
                <TableRow key={`s-${i}`}>
                  <TableCell>{s.row.email}</TableCell>
                  <TableCell>{s.row.full_name}</TableCell>
                  <TableCell>{identityLabel(s.row)}</TableCell>
                  <TableCell>
                    <Chip size="small" color="warning" label={`跳过：${s.reason}`} />
                  </TableCell>
                </TableRow>
              ))}
              {result.errors.map((e, i) => (
                <TableRow key={`e-${i}`}>
                  <TableCell>{e.row.email}</TableCell>
                  <TableCell>{e.row.full_name}</TableCell>
                  <TableCell>{identityLabel(e.row)}</TableCell>
                  <TableCell>
                    <Chip size="small" color="error" label={`错误：${e.reason}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" fontWeight={800} gutterBottom>
        导入配对结果
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        项目中期完成师友配对后，上传配对表建立导师与学员的对应关系。文件需包含列：
        <code> mentor_id, mentee_id</code>（使用成员 ID）。
        <br />
        上传后，导师即可在「进度跟踪」中为自己的学员记录交流，成员名单也会显示配对关系。
      </Typography>

      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Stack spacing={2}>
          <input
            ref={matchFileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleMatchFile(file);
              e.target.value = "";
            }}
          />
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => matchFileRef.current?.click()}
            >
              选择配对 CSV
            </Button>
            <Button variant="text" onClick={loadMatchSample}>
              载入示例配对
            </Button>
            {matchFileName && (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                已选择：{matchFileName}（{matchRows.length} 行）
              </Typography>
            )}
          </Stack>

          {matchParseError && <Alert severity="error">{matchParseError}</Alert>}

          {matchRows.length > 0 && (
            <Box>
              <Button
                variant="contained"
                color="secondary"
                disabled={matchMutation.isPending}
                onClick={() => matchMutation.mutate()}
              >
                导入 {matchRows.length} 条配对
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>

      {matchResult && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Chip color="success" label={`成功导入 ${matchResult.added.length}`} />
            <Chip color="warning" label={`跳过 ${matchResult.skipped.length}`} />
            <Chip color="error" label={`错误 ${matchResult.errors.length}`} />
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>导师 ID</TableCell>
                <TableCell>学员 ID</TableCell>
                <TableCell>结果</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matchResult.added.map((m) => (
                <TableRow key={`ma-${m.id}`}>
                  <TableCell>{m.mentor_id}</TableCell>
                  <TableCell>{m.mentee_id}</TableCell>
                  <TableCell>
                    <Chip size="small" color="success" label="已导入" />
                  </TableCell>
                </TableRow>
              ))}
              {matchResult.skipped.map((s, i) => (
                <TableRow key={`ms-${i}`}>
                  <TableCell>{s.row.mentor_id}</TableCell>
                  <TableCell>{s.row.mentee_id}</TableCell>
                  <TableCell>
                    <Chip size="small" color="warning" label={`跳过：${s.reason}`} />
                  </TableCell>
                </TableRow>
              ))}
              {matchResult.errors.map((e, i) => (
                <TableRow key={`me-${i}`}>
                  <TableCell>{e.row.mentor_id}</TableCell>
                  <TableCell>{e.row.mentee_id}</TableCell>
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
