// One-time shrink of legacy avatars (see scripts/avatar-migration/README.md).
//
//   node scripts/migrateAvatars.mjs <preview.csv> [--out <dir>] [--size 128|192]
//
// Reads the CSV exported from scripts/avatar-migration/preview.sql, downloads
// each oversized public avatar, converts it to a small square WebP and writes
// everything the operator needs into the output folder. It never talks to the
// database and needs no Supabase key: the operator uploads the files and runs
// the generated SQL by hand.

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Papa from 'papaparse';
import sharp from 'sharp';
import {
  OUTPUT_MAX_BYTES,
  buildApplySql,
  buildCheckSql,
  buildRollbackSql,
  publicAvatarUrl,
  selectCandidates,
} from './avatar-migration/lib.mjs';

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const QUALITIES = [82, 76, 70, 62, 55];
const ALLOWED_SIZES = [128, 192];
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function parseArgs(argv) {
  const args = { csv: null, out: null, size: 128 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--size') args.size = Number(argv[++i]);
    else if (!args.csv) args.csv = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.csv) {
    throw new Error('Usage: node scripts/migrateAvatars.mjs <preview.csv> [--out <dir>] [--size 128|192]');
  }
  if (!ALLOWED_SIZES.includes(args.size)) {
    throw new Error(`--size must be one of ${ALLOWED_SIZES.join(', ')}`);
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

async function download(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      // A missing object will not appear on retry.
      if (res.status === 404 || res.status === 400) {
        throw Object.assign(new Error(`object missing (HTTP ${res.status})`), { final: true });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (err.final || attempt === MAX_RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('Exhausted retries');
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const parsed = Papa.parse(fs.readFileSync(args.csv, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (!parsed.meta.fields?.includes('id') || !parsed.meta.fields.includes('avatar_url')) {
    throw new Error('CSV must come from preview.sql (needs id, avatar_url, size_bytes columns)');
  }

  const { candidates, skipped } = selectCandidates(parsed.data);
  const uploadDir = path.join(args.out, 'upload');
  fs.mkdirSync(uploadDir, { recursive: true });

  const results = skipped.map((s) => ({
    profileId: s.profileId,
    oldUrl: s.avatarUrl,
    status: 'skipped',
    error: s.reason,
    timestamp: new Date().toISOString(),
  }));
  const migrated = [];

  for (const [index, c] of candidates.entries()) {
    const label = `[${index + 1}/${candidates.length}] ${c.profileId}`;
    const base = {
      profileId: c.profileId,
      oldUrl: c.avatarUrl,
      oldObjectName: c.objectName,
      oldSize: c.sizeBytes,
    };
    try {
      const source = await download(c.avatarUrl);
      const output = await convert(source, args.size);
      const newObjectName = `${c.profileId}/avatar-${crypto.randomUUID()}.webp`;
      fs.mkdirSync(path.join(uploadDir, c.profileId), { recursive: true });
      fs.writeFileSync(path.join(uploadDir, newObjectName), output);

      const entry = {
        ...base,
        oldSize: source.length,
        newUrl: publicAvatarUrl(c.origin, newObjectName),
        newObjectName,
        newSize: output.length,
        status: 'converted',
        error: null,
        timestamp: new Date().toISOString(),
      };
      migrated.push(entry);
      results.push(entry);
      console.log(`${label} ${formatBytes(source.length)} -> ${formatBytes(output.length)}`);
    } catch (err) {
      results.push({ ...base, status: 'failed', error: err.message, timestamp: new Date().toISOString() });
      console.warn(`${label} FAILED: ${err.message}`);
    }
  }

  fs.writeFileSync(path.join(args.out, 'mapping.json'), `${JSON.stringify(results, null, 2)}\n`);
  if (migrated.length > 0) {
    fs.writeFileSync(path.join(args.out, 'apply.sql'), buildApplySql(migrated));
    fs.writeFileSync(path.join(args.out, 'check.sql'), buildCheckSql(migrated));
    fs.writeFileSync(path.join(args.out, 'rollback.sql'), buildRollbackSql());
  }

  const oldBytes = migrated.reduce((sum, m) => sum + m.oldSize, 0);
  const newBytes = migrated.reduce((sum, m) => sum + m.newSize, 0);
  const failed = results.filter((r) => r.status === 'failed');
  const reduction = oldBytes > 0 ? ((1 - newBytes / oldBytes) * 100).toFixed(1) : '0.0';

  console.log('');
  console.log(`Scanned:   ${parsed.data.length}`);
  console.log(`Skipped:   ${skipped.length}`);
  console.log(`Converted: ${migrated.length}`);
  console.log(`Failed:    ${failed.length}`);
  console.log(`Old bytes: ${formatBytes(oldBytes)}`);
  console.log(`New bytes: ${formatBytes(newBytes)} (${reduction}% smaller)`);
  console.log(`Output:    ${args.out}`);
  for (const s of skipped) console.log(`  skipped ${s.profileId || '(no id)'}: ${s.reason}`);
  for (const f of failed) console.log(`  failed  ${f.profileId}: ${f.error}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
