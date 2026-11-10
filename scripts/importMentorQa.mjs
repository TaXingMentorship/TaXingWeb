// One-time import of the 答疑组活动汇总 workbook into profiles.qa_topic / qa_intro.
//
//   node scripts/importMentorQa.mjs <workbook.xlsx>            preview, no writes
//   node scripts/importMentorQa.mjs <workbook.xlsx> --apply    write
//
// Needs migration 0052 applied before --apply (the preview works without it).
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
// and never prints them.
//
// Every sheet after the two summary sheets is one 答疑组. A sheet is matched to
// the season's mentor_groups by name, each row's mentor to a member of THAT
// group by nickname (case- and space-insensitive, plus ALIASES below). Rows
// that do not match are listed and skipped. Only empty fields are written, so a
// re-run never overwrites what a mentor has since edited on 我的资料.

import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

const COHORT_NAME = '2026秋季';
const SUMMARY_SHEETS = 2;
// Sheet name -> group name, where the sheet's name differs from the group's.
const SHEET_TO_GROUP = {
  '软工 组1': '软件工程与系统开发类 1',
  '软工 组2': '软件工程与系统开发类 2',
  '智能制造 组1': '智能制造 / 工业工程 /硬件/医疗健康',
  '人工智能 组1': '人工智能 / 算法工程 / AIGC技术类 1',
  '人工智能 组2': '人工智能 / 算法工程 / AIGC技术类 2',
  '人工智能 组3': '人工智能 / 算法工程 / AIGC技术类 3',
  '产品经理 组1': '产品经理与产品策略类 1',
  '产品经理 组2': '产品经理与产品策略类 2',
  '产品经理 组3': '产品经理与产品策略类 3',
  '智能制造 组2': '智能制造 / 工业工程 /硬件/医疗健康 2',
  '智能制造 组3': '智能制造 / 工业工程 /硬件/医疗健康 3',
  '智能制造 组4': '智能制造 / 工业工程 /硬件/医疗健康 4',
  '市场营销类': '市场营销 / 运营 / 品牌管理类',
};
// Nickname in the sheet -> nickname on the site, confirmed by the organiser.
const ALIASES = {
  'Lisa Feng': 'Lisa',
  Astrid: 'Astrid77',
  '橙子🍊': '橙子',
  Crystal: 'Crystal He',
};

const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();
const text = (v) => {
  if (v == null) return '';
  if (v.richText) return v.richText.map((t) => t.text).join('');
  if (v.text) return text(v.text);
  if (v.result !== undefined) return String(v.result);
  return typeof v === 'object' ? '' : String(v);
};
const clean = (s) => s.replace(/\r\n/g, '\n').trim();

const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file) {
  console.error('usage: node scripts/importMentorQa.mjs <workbook.xlsx> [--apply]');
  process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) process.env[line.slice(0, i)] ??= line.slice(i + 1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const [cohort] = must(await db.from('cohorts').select('id').eq('name', COHORT_NAME), 'cohort');
if (!cohort) throw new Error(`no cohort named「${COHORT_NAME}」`);
const groups = must(await db.from('mentor_groups').select('id,name').eq('cohort_id', cohort.id), 'groups');
const members = must(
  await db.from('mentor_group_members').select('group_id,profile_id').eq('cohort_id', cohort.id),
  'members',
);
const profiles = must(await db.from('profiles').select('id,full_name'), 'profiles');
const nameOf = new Map(profiles.map((p) => [p.id, p.full_name]));
let existing = new Map();
if (apply) {
  const rows = must(await db.from('profiles').select('id,qa_topic,qa_intro'), 'qa columns (is 0052 applied?)');
  existing = new Map(rows.map((r) => [r.id, r]));
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);

const plan = [];
const problems = [];
const seenProfiles = new Set();
for (const ws of wb.worksheets.slice(SUMMARY_SHEETS)) {
  const sheet = ws.name.trim();
  const groupName = SHEET_TO_GROUP[sheet] ?? sheet;
  const group = groups.find((g) => norm(g.name) === norm(groupName));
  if (!group) {
    problems.push(`sheet「${sheet}」: no matching group`);
    continue;
  }
  const inGroup = members
    .filter((m) => m.group_id === group.id)
    .map((m) => ({ id: m.profile_id, name: nameOf.get(m.profile_id) ?? '' }));
  let started = false;
  ws.eachRow((row) => {
    const nick = clean(text(row.getCell(1).value));
    if (!started) {
      started = nick === 'mentor';
      return;
    }
    if (!nick || nick.startsWith('示例')) return;
    const siteName = ALIASES[nick] ?? nick;
    const hit = inGroup.find((m) => norm(m.name) === norm(siteName));
    if (!hit) {
      problems.push(`${sheet} / ${nick}: no member of「${group.name}」`);
      return;
    }
    seenProfiles.add(hit.id);
    plan.push({
      sheet,
      nick,
      id: hit.id,
      qa_topic: clean(text(row.getCell(3).value)),
      qa_intro: clean(text(row.getCell(4).value)),
    });
  });
}

const missing = members.filter((m) => !seenProfiles.has(m.profile_id)).map((m) => nameOf.get(m.profile_id));
let writes = 0;
for (const p of plan) {
  const patch = {};
  const have = existing.get(p.id);
  for (const k of ['qa_topic', 'qa_intro']) {
    if (p[k] && !(have?.[k] ?? '').trim()) patch[k] = p[k];
  }
  const empty = ['qa_topic', 'qa_intro'].filter((k) => !p[k]);
  console.log(
    `${p.sheet.padEnd(14)} ${p.nick.padEnd(12)} topic=${p.qa_topic.length} intro=${p.qa_intro.length}` +
      (empty.length ? `  (empty in sheet: ${empty.join(', ')})` : ''),
  );
  if (apply && Object.keys(patch).length) {
    must(await db.from('profiles').update(patch).eq('id', p.id), `update ${p.nick}`);
    writes++;
  }
}
console.log(`\n${plan.length} rows matched, ${problems.length} unmatched`);
for (const m of problems) console.log('  UNMATCHED', m);
if (missing.length) console.log(`group members with no row in the workbook: ${missing.join(', ')}`);
console.log(apply ? `\nupdated ${writes} profiles` : '\npreview only — pass --apply to write');
