// One-time split of the imported 答疑组自我介绍 into 「我是谁」 (qa_intro) and
// 「我能帮上什么」 (can_help, migration 0053).
//
//   node scripts/splitMentorCanHelp.mjs                    preview, no writes
//   node scripts/splitMentorCanHelp.mjs --apply [--backup <file.json>]
//
// A mentor is split only when their intro has a heading line / lead-in such as
// 「我能帮上什么」 or 「我能帮上的忙」; everything from there on becomes can_help and
// what came before stays as qa_intro. Anyone without the marker, or whose text
// would leave qa_intro empty, is left alone.
// Only mentors whose can_help is still empty are touched, so a re-run never
// overwrites later edits. --apply first saves the original intros to the backup
// file, and refuses to run if that file already exists. Reads .env.local; never prints the keys.

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const MARKER = /我能帮上什么|我能帮上的忙/;
const apply = process.argv.includes('--apply');
const bi = process.argv.indexOf('--backup');
const backupFile = bi > 0 ? process.argv[bi + 1] : 'mentor-qa-intro-backup.json';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) process.env[line.slice(0, i)] ??= line.slice(i + 1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Returns { intro, help } or null when there is no clear marker. */
export function splitIntro(text) {
  const m = MARKER.exec(text);
  if (!m) return null;
  // Pull the heading's own prefix (「2.」「【」「**」) into the cut when it is all that
  // precedes the marker on its line; otherwise cut right at the marker.
  const lineStart = text.lastIndexOf('\n', m.index) + 1;
  const before = text.slice(lineStart, m.index);
  const cut = /^[\s\d.、)）①-⑩【\[*#-]*(因此)?$/.test(before) ? lineStart : m.index;
  const intro = text.slice(0, cut).trim();
  let help = text.slice(cut);
  // Drop the heading itself, keep what follows it.
  help = help
    .replace(/^[\s\d.、)）①-⑩【\[*#-]*(因此)?\s*(我能帮上什么|我能帮上的忙)(包括|忙)?[】\]*]*\s*([（(][^）)\n]{0,12}[）)])?\s*[:：？?]?[*\s]*/, '')
    .trim();
  if (!help) return null;
  return { intro, help };
}

const rows = [];
{
  let res = await db.from('profiles').select('id,full_name,qa_intro,can_help').eq('participant_role', 'mentor');
  if (res.error) {
    // 0053 not applied yet: still preview from qa_intro alone.
    res = await db.from('profiles').select('id,full_name,qa_intro').eq('participant_role', 'mentor');
    if (apply) throw new Error('can_help column missing — apply migration 0053 first');
  }
  if (res.error) throw new Error(res.error.message);
  rows.push(...res.data);
}

const plan = [];
// The marker opens the text, so a split would leave qa_intro empty — and it is
// a required mentor field, which would block that mentor's next save. Left
// alone and listed for a manual edit instead.
const helpOnly = [];
for (const r of rows) {
  const text = (r.qa_intro ?? '').replace(/\r\n/g, '\n');
  if (!text.trim() || (r.can_help ?? '').trim()) continue;
  const s = splitIntro(text);
  if (s && !s.intro) helpOnly.push(r);
  else if (s) plan.push({ ...r, ...s, original: r.qa_intro });
}
plan.sort((a, b) => a.full_name.localeCompare(b.full_name));

for (const p of plan) {
  const flat = (t) => t.replace(/\n+/g, ' ⏎ ');
  console.log(`\n### ${p.full_name}  (intro ${p.intro.length} 字 / 帮助 ${p.help.length} 字)`);
  console.log('  介绍结尾 …' + flat(p.intro.slice(-40)));
  console.log('  帮助开头   ' + flat(p.help.slice(0, 70)) + (p.help.length > 70 ? '…' : ''));
}
const noMarker = rows.filter(
  (r) => (r.qa_intro ?? '').trim() && !plan.find((p) => p.id === r.id) && !helpOnly.includes(r) && !(r.can_help ?? '').trim(),
);
console.log(`\n将拆分 ${plan.length} 位；无标记、保持不动 ${noMarker.length} 位：${noMarker.map((r) => r.full_name).join('、')}`);
if (helpOnly.length) {
  console.log(`整段都是「我能帮上什么」、拆分后介绍为空，保持不动、需手动处理 ${helpOnly.length} 位：${helpOnly.map((r) => r.full_name).join('、')}`);
}

if (!apply) {
  console.log('\n预览 only — 加 --apply 才会写入');
} else if (plan.length === 0) {
  console.log('\n没有需要拆分的 mentor，未写入，也未改动备份文件');
} else {
  // Never replace an earlier backup: after a first --apply it is the only copy
  // of the original intros.
  if (fs.existsSync(backupFile)) {
    throw new Error(`${backupFile} already exists — pass --backup <new file> to keep the earlier backup`);
  }
  fs.writeFileSync(backupFile, JSON.stringify(plan.map((p) => ({ id: p.id, name: p.full_name, qa_intro: p.original })), null, 2));
  for (const p of plan) {
    const { error } = await db.from('profiles').update({ qa_intro: p.intro, can_help: p.help }).eq('id', p.id);
    if (error) throw new Error(`${p.full_name}: ${error.message}`);
  }
  console.log(`\n已写入 ${plan.length} 位，原文备份在 ${backupFile}`);
}
