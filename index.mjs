// organize-media-parallel.mjs
import { exiftool } from 'exiftool-vendored';
import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import cliProgress from 'cli-progress';
import pLimit from 'p-limit';

const INPUT_BASE = './recovery';
const OUTPUT_BASE = './organized';
const UNKNOWN_DIR = path.join(OUTPUT_BASE, 'unknown');
const CONCURRENCY = 4; 

const allowedExt = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp',
  'cr2', 'nef', 'arw', 'dng', 'orf', 'rw2',
  'heic', 'heif', 'tif', 'tiff',
  'mp4', 'mov', 'avi', 'mkv', 'wmv', 'mts', 'm2ts', '3gp', 'webm'
]);

async function moveWithNoOverwrite(src, destDir) {
  await fs.ensureDir(destDir);
  const baseName = path.basename(src);
  let destPath = path.join(destDir, baseName);
  let counter = 1;

  while (await fs.pathExists(destPath)) {
    const ext = path.extname(baseName);
    const name = path.basename(baseName, ext);
    destPath = path.join(destDir, `${name}_${counter++}${ext}`);
  }

  await fs.move(src, destPath);
  return destPath;
}

async function organizeOne(file) {
  try {
    const tags = await exiftool.read(file);
    const dateStr = tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate;

    let date;
    if (dateStr) {
      date = new Date(dateStr);
    } else {
      const stat = await fs.stat(file);
      date = stat?.mtime;
      if (!date) throw new Error('No valid date found');
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const destDir = path.join(OUTPUT_BASE, `${year}`, `${month}`);
    await moveWithNoOverwrite(file, destDir);
    return true;
  } catch {
    await moveWithNoOverwrite(file, UNKNOWN_DIR);
    return false;
  }
}

async function organizeMediaParallel() {
  console.log('🔍 Scanning files...');

  const allFiles = await fg(`${INPUT_BASE}/**/*`, {
    onlyFiles: true,
    caseSensitiveMatch: false,
    absolute: true
  });

  const mediaFiles = allFiles.filter(file => {
    const ext = path.extname(file).slice(1).toLowerCase();
    return allowedExt.has(ext);
  });

  console.log(`📁 Found ${mediaFiles.length} media files.`);
  console.log(`🚀 Running with ${CONCURRENCY} parallel tasks.`);

  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(mediaFiles.length, 0);

  const limit = pLimit(CONCURRENCY);

  const tasks = mediaFiles.map(file =>
    limit(() =>
      organizeOne(file).then(() => bar.increment())
    )
  );

  await Promise.all(tasks);
  bar.stop();
  await exiftool.end();
  console.log('✅ All media organized.');
}

organizeMediaParallel();
