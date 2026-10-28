// One-time shrink of legacy avatars (see scripts/avatar-migration/README.md).
//
//   node scripts/migrateAvatars.mjs                       preview, no writes
//   node scripts/migrateAvatars.mjs --apply [--size 192]  convert, upload, switch
//   node scripts/migrateAvatars.mjs --rollback <mapping.json>
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
// .env.local and never prints them. The service-role client is needed to
// update other members' profiles. Old Storage objects are never deleted.

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import {
  OUTPUT_MAX_BYTES,
  isCandidateSize,
  partitionProfiles,
  publicAvatarUrl,
} from './avatar-migration/lib.mjs';

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const QUALITIES = [82, 76, 70, 62, 55];
const ALLOWED_SIZES = [128, 192];
const IMMUTABLE_CACHE_SECONDS = '31536000';
const PAGE_SIZE = 1000;
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function parseArgs(argv) {
  const args = { mode: 'preview', size: 128, out: null, mapping: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.mode = 'apply';
    else if (arg === '--rollback') {
      args.mode = 'rollback';
      args.mapping = argv[++i];
    } else if (arg === '--size') args.size = Number(argv[++i]);
    else if (arg === '--out') args.out = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!ALLOWED_SIZES.includes(args.size)) {
    throw new Error(`--size must be one of ${ALLOWED_SIZES.join(', ')}`);
  }
  if (args.mode === 'rollback' && !args.mapping) {
    throw new Error('Usage: node scripts/migrateAvatars.mjs --rollback <mapping.json>');
  }
  if (!args.out) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    args.out = path.join(os.homedir(), 'Downloads', `avatar-migration-${stamp}`);
  }
  args.out = path.resolve(args.out);
  // The mapping holds profile ids and URLs; keep it out of git.
  if (!path.relative(REPO_ROOT, args.out).startsWith('..')) {
    throw new Error('--out must be outside the repository');
  }
  return args;
}

function connect() {
  const envFile = path.join(REPO_ROOT, '.env.local');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { supabase, origin: new URL(url).origin };
}

async function withRetries(fn) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (err.final || attempt === MAX_RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('Exhausted retries');
}

function final(message) {
  return Object.assign(new Error(message), { final: true });
}

async function download(url) {
  return withRetries(async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // A missing object will not appear on retry.
    if (res.status === 404 || res.status === 400) throw final(`object missing (HTTP ${res.status})`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
}

async function listProfiles(supabase) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .not('avatar_url', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Reading profiles failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

/** Storage metadata only, so measuring sizes costs no egress. */
async function objectSize(supabase, objectName) {
  return withRetries(async () => {
    const { data, error } = await supabase.storage.from('avatars').info(objectName);
    if (error) {
      const status = error.status ?? error.statusCode;
      if (String(status) === '404' || /not.?found/i.test(error.message)) throw final('object missing');
      throw new Error(error.message);
    }
    return Number(data.size);
  });
}

async function findCandidates(supabase, origin) {
  const profiles = await listProfiles(supabase);
  const { avatars, skipped } = partitionProfiles(profiles, origin);
  const candidates = [];
  let smallCount = 0;
  for (const avatar of avatars) {
    try {
      const sizeBytes = await objectSize(supabase, avatar.objectName);
      if (isCandidateSize(sizeBytes)) candidates.push({ ...avatar, sizeBytes });
      else smallCount += 1;
    } catch (err) {
      skipped.push({ profileId: avatar.profileId, avatarUrl: avatar.avatarUrl, reason: err.message });
    }
  }
  candidates.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return { profileCount: profiles.length, candidates, skipped, smallCount };
}

async function convert(source, size) {
  // rotate() with no argument applies the EXIF orientation.
  const image = sharp(source, { failOn: 'error' })
    .rotate()
    .resize(size, size, { fit: 'cover', position: 'centre' });

  let output = null;
  for (const quality of QUALITIES) {
    try {
      output = await image.clone().webp({ quality }).toBuffer();
    } catch (err) {
      throw new Error(`unreadable image: ${err.message}`);
    }
    if (output.length <= OUTPUT_MAX_BYTES) break;
  }

  const meta = await sharp(output).metadata();
  if (meta.format !== 'webp' || meta.width !== size || meta.height !== size) {
    throw new Error(`unexpected output ${meta.format} ${meta.width}x${meta.height}`);
  }
  if (output.length > OUTPUT_MAX_BYTES) {
    throw new Error(`output still ${output.length} bytes`);
  }
  return output;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function printSkipped(skipped) {
  for (const s of skipped) console.log(`  skipped ${s.profileId || '(no id)'}: ${s.reason}`);
}

async function preview({ supabase, origin }) {
  const { profileCount, candidates, skipped, smallCount } = await findCandidates(supabase, origin);
  const total = candidates.reduce((sum, c) => sum + c.sizeBytes, 0);
  console.log(`Profiles with an avatar: ${profileCount}`);
  console.log(`Already small (<= 100 KB): ${smallCount}`);
  console.log(`To shrink: ${candidates.length} avatars, ${formatBytes(total)} in total`);
  for (const c of candidates) console.log(`  ${c.profileId}  ${formatBytes(c.sizeBytes)}`);
  printSkipped(skipped);
  console.log('\nNothing was changed. Run again with --apply to shrink these avatars.');
}

async function migrateOne({ supabase, origin }, candidate, size) {
  const source = await download(candidate.avatarUrl);
  const output = await convert(source, size);

  const newObjectName = `${candidate.profileId}/avatar-${crypto.randomUUID()}.webp`;
  await withRetries(async () => {
    const { error } = await supabase.storage.from('avatars').upload(newObjectName, output, {
      contentType: 'image/webp',
      cacheControl: IMMUTABLE_CACHE_SECONDS,
    });
    if (error) throw new Error(`upload failed: ${error.message}`);
  });
  const newUrl = publicAvatarUrl(origin, newObjectName);
  const uploaded = await download(newUrl);
  if (uploaded.length !== output.length) throw new Error('uploaded object does not read back');

  const result = { oldSize: source.length, newUrl, newObjectName, newSize: output.length };

  // Compare-and-set: a member who changed their avatar meanwhile keeps theirs.
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: newUrl })
    .eq('id', candidate.profileId)
    .eq('avatar_url', candidate.avatarUrl)
    .select('id');
  if (error) return { ...result, status: 'orphan', error: `profile update failed: ${error.message}` };
  if (data.length === 0) return { ...result, status: 'orphan', error: 'avatar changed meanwhile; left as is' };
  return { ...result, status: 'migrated', error: null };
}

async function apply(conn, args) {
  const { candidates, skipped } = await findCandidates(conn.supabase, conn.origin);
  fs.mkdirSync(args.out, { recursive: true });
  const mappingPath = path.join(args.out, 'mapping.json');
  const results = [];
  const save = () => fs.writeFileSync(mappingPath, `${JSON.stringify(results, null, 2)}\n`);

  for (const [index, c] of candidates.entries()) {
    const label = `[${index + 1}/${candidates.length}] ${c.profileId}`;
    const base = {
      profileId: c.profileId,
      oldUrl: c.avatarUrl,
      oldObjectName: c.objectName,
      oldSize: c.sizeBytes,
    };
    let entry;
    try {
      entry = { ...base, ...(await migrateOne(conn, c, args.size)) };
    } catch (err) {
      entry = { ...base, status: 'failed', error: err.message };
    }
    entry.timestamp = new Date().toISOString();
    results.push(entry);
    save();
    if (entry.status === 'migrated') {
      console.log(`${label} ${formatBytes(entry.oldSize)} -> ${formatBytes(entry.newSize)}`);
    } else {
      console.warn(`${label} ${entry.status.toUpperCase()}: ${entry.error}`);
    }
  }
  save();

  const migrated = results.filter((r) => r.status === 'migrated');
  const problems = results.filter((r) => r.status !== 'migrated');
  const oldBytes = migrated.reduce((sum, m) => sum + m.oldSize, 0);
  const newBytes = migrated.reduce((sum, m) => sum + m.newSize, 0);
  const reduction = oldBytes > 0 ? ((1 - newBytes / oldBytes) * 100).toFixed(1) : '0.0';

  console.log('');
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Migrated:   ${migrated.length}`);
  console.log(`Failed:     ${problems.filter((r) => r.status === 'failed').length}`);
  console.log(`Orphaned:   ${problems.filter((r) => r.status === 'orphan').length} (new file uploaded, profile not switched)`);
  console.log(`Old bytes:  ${formatBytes(oldBytes)}`);
  console.log(`New bytes:  ${formatBytes(newBytes)} (${reduction}% smaller)`);
  console.log(`Mapping:    ${mappingPath}`);
  printSkipped(skipped);
  for (const p of problems) console.log(`  ${p.status} ${p.profileId}: ${p.error}`);
  console.log(`\nTo undo: node scripts/migrateAvatars.mjs --rollback "${mappingPath}"`);
  if (problems.length > 0) process.exitCode = 1;
}

async function rollback({ supabase }, args) {
  const entries = JSON.parse(fs.readFileSync(args.mapping, 'utf8'));
  let restored = 0;
  let untouched = 0;
  for (const e of entries.filter((entry) => entry.status === 'migrated')) {
    // Only profiles still showing the migrated avatar; later changes stay.
    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_url: e.oldUrl })
      .eq('id', e.profileId)
      .eq('avatar_url', e.newUrl)
      .select('id');
    if (error) {
      console.warn(`  ${e.profileId} FAILED: ${error.message}`);
      process.exitCode = 1;
    } else if (data.length === 0) {
      untouched += 1;
      console.log(`  ${e.profileId}: avatar changed since migration; left as is`);
    } else {
      restored += 1;
    }
  }
  console.log(`Restored ${restored} avatars; ${untouched} left as is.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const conn = connect();
  if (args.mode === 'preview') await preview(conn);
  else if (args.mode === 'apply') await apply(conn, args);
  else await rollback(conn, args);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
