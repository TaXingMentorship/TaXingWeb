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
import { listCohorts, importMatches } from "@/lib/portal/store";
import type { MatchImportResult, MatchRowInput } from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import MemberImportSection from "@/components/portal/MemberImportSection";
import { portalCopy } from "@/data/portalCopy";

export default function AdminImportPage() {
  const { currentUser } = usePortalSession();
  const queryClient = useQueryClient();
  const [cohortId, setCohortId] = React.useState("");

  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
  });

  React.useEffect(() => {
    if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);

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

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {portalCopy.memberImport.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {portalCopy.memberImport.subtitle}
      </Typography>

      <MemberImportSection />

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
          {/* Matches belong to one season, unlike the member import where each
              row carries its own — a pairing only means anything inside the
              cohort both people are in. */}
          <TextField
            select
            label="导入到季度"
            value={cohortId}
            onChange={(event) => setCohortId(event.target.value)}
            sx={{ maxWidth: 320 }}
          >
            {(cohorts ?? []).map((cohort) => (
              <MenuItem key={cohort.id} value={cohort.id}>
                {cohort.name}
              </MenuItem>
            ))}
          </TextField>
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
      )}    </Box>
  );
}
