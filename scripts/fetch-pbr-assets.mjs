import { execFile } from 'node:child_process';
import { mkdir, readdir, copyFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const DIRECT_FILES = [
  {
    url: 'https://dl.polyhaven.com/file/ph-assets/HDRIs/hdr/2k/glasshouse_interior_2k.hdr',
    dest: 'hdri/studio_atelier.hdr',
  },
  // Poly Haven Herringbone Parquet (2K JPG)
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/herringbone_parquet/herringbone_parquet_diff_2k.jpg',
    dest: 'textures/parquet/diff.jpg',
  },
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/herringbone_parquet/herringbone_parquet_nor_gl_2k.jpg',
    dest: 'textures/parquet/nor_gl.jpg',
  },
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/herringbone_parquet/herringbone_parquet_rough_2k.jpg',
    dest: 'textures/parquet/rough.jpg',
  },
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/herringbone_parquet/herringbone_parquet_ao_2k.jpg',
    dest: 'textures/parquet/ao.jpg',
  },
  // Poly Haven Clean Fine Plaster (2K JPG)
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/plaster_grey_04/plaster_grey_04_diff_2k.jpg',
    dest: 'textures/plaster/diff.jpg',
  },
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/plaster_grey_04/plaster_grey_04_nor_gl_2k.jpg',
    dest: 'textures/plaster/nor_gl.jpg',
  },
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/plaster_grey_04/plaster_grey_04_rough_2k.jpg',
    dest: 'textures/plaster/rough.jpg',
  },
  {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/plaster_grey_04/plaster_grey_04_ao_2k.jpg',
    dest: 'textures/plaster/ao.jpg',
  },
];

const ZIP_BUNDLES = [
  {
    name: 'marble',
    url: 'https://ambientcg.com/get?file=Marble012_2K-JPG.zip',
    destDir: 'textures/marble',
    mapMatchers: [
      { out: 'diff.jpg', pattern: /_Color\.(jpg|jpeg|png)$/i },
      { out: 'nor_gl.jpg', pattern: /_NormalGL\.(jpg|jpeg|png)$/i },
      { out: 'rough.jpg', pattern: /_Roughness\.(jpg|jpeg|png)$/i },
      { out: 'ao.jpg', pattern: /_AmbientOcclusion\.(jpg|jpeg|png)$/i },
    ],
  },
  {
    name: 'steel',
    url: 'https://ambientcg.com/get?file=Metal009_2K-JPG.zip',
    destDir: 'textures/steel',
    mapMatchers: [
      { out: 'diff.jpg', pattern: /_Color\.(jpg|jpeg|png)$/i },
      { out: 'nor_gl.jpg', pattern: /_NormalGL\.(jpg|jpeg|png)$/i },
      { out: 'rough.jpg', pattern: /_Roughness\.(jpg|jpeg|png)$/i },
      { out: 'ao.jpg', pattern: /_AmbientOcclusion\.(jpg|jpeg|png)$/i },
      { out: 'metal.jpg', pattern: /_Metalness\.(jpg|jpeg|png)$/i },
    ],
  },
];

async function isValidNonEmpty(filePath, minBytes = 10_240) {
  try {
    const s = await stat(filePath);
    return s.isFile() && s.size >= minBytes;
  } catch {
    return false;
  }
}

async function downloadToBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (atelier-pbr-fetcher)' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} downloading ${url}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(timer);
  }
}

async function ensureDirectFile(entry) {
  const absDest = path.join(PUBLIC_DIR, entry.dest);
  if (await isValidNonEmpty(absDest)) {
    const s = await stat(absDest);
    console.log(`[skip] ${entry.dest} (${(s.size / 1024).toFixed(0)} KB)`);
    return;
  }
  await mkdir(path.dirname(absDest), { recursive: true });
  console.log(`[fetch] ${entry.dest} <- ${entry.url}`);
  const buf = await downloadToBuffer(entry.url);
  if (buf.byteLength < 10_240) {
    throw new Error(`Downloaded payload too small (${buf.byteLength} bytes) for ${entry.url}`);
  }
  await writeFile(absDest, buf);
  console.log(`[saved] ${entry.dest} (${(buf.byteLength / 1024).toFixed(0)} KB)`);
}

async function extractZipBundle(zipPath, extractDir) {
  await mkdir(extractDir, { recursive: true });
  if (process.platform === 'win32') {
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
      ],
      { windowsHide: true }
    );
  } else {
    await execFileAsync('unzip', ['-o', zipPath, '-d', extractDir]);
  }
}

async function ensureZipBundle(bundle) {
  const absDir = path.join(PUBLIC_DIR, bundle.destDir);
  await mkdir(absDir, { recursive: true });

  const requiredOutputs = ['diff.jpg', 'nor_gl.jpg', 'rough.jpg'];
  const allRequiredReady = (
    await Promise.all(requiredOutputs.map((f) => isValidNonEmpty(path.join(absDir, f))))
  ).every(Boolean);

  if (allRequiredReady) {
    const files = await readdir(absDir);
    console.log(`[skip] ${bundle.destDir}/ (${files.join(', ')})`);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `atelier-pbr-${bundle.name}-${Date.now()}`);
  const zipPath = path.join(tmpDir, `${bundle.name}.zip`);
  const extractDir = path.join(tmpDir, 'extracted');

  try {
    await mkdir(tmpDir, { recursive: true });
    console.log(`[fetch] ${bundle.name} zip <- ${bundle.url}`);
    const buf = await downloadToBuffer(bundle.url);
    if (buf.byteLength < 100_000) {
      throw new Error(`Zip payload too small (${buf.byteLength} bytes) for ${bundle.url}`);
    }
    await writeFile(zipPath, buf);
    await extractZipBundle(zipPath, extractDir);

    const extracted = await readdir(extractDir);
    console.log(`[zip] ${bundle.name} entries: ${extracted.join(', ')}`);

    for (const matcher of bundle.mapMatchers) {
      const match = extracted.find((fn) => matcher.pattern.test(fn));
      if (!match) {
        console.log(`[info] ${bundle.name}: optional/absent map for ${matcher.out}`);
        continue;
      }
      const destPath = path.join(absDir, matcher.out);
      await copyFile(path.join(extractDir, match), destPath);
      const s = await stat(destPath);
      console.log(`[saved] ${bundle.destDir}/${matcher.out} (${(s.size / 1024).toFixed(0)} KB)`);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  for (const entry of DIRECT_FILES) {
    await ensureDirectFile(entry);
  }
  for (const bundle of ZIP_BUNDLES) {
    await ensureZipBundle(bundle);
  }
  console.log('\n[done] All HDRI & 2K scanned PBR assets ready under public/');
}

main().catch((err) => {
  console.error('[fetch-pbr-assets failed]', err);
  process.exit(1);
});
