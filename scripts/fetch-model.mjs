// Downloads the embedding model (pinned revision, verified) and copies the ONNX Runtime WebAssembly files
// into public/, so that the extension works offline and never loads code from a CDN.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = 'Xenova/multilingual-e5-small';
const REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';
// sha256 for large (LFS) files, git blob sha1 for small ones, as published by the Hugging Face Hub.
const FILES = {
  'config.json': { size: 658, gitOid: '4104f38273cc595fd9500fd243124e9f6cf383dc' },
  'tokenizer_config.json': { size: 443, gitOid: '059214673d9d6d2ee319411e2ffec8c024b816d5' },
  'special_tokens_map.json': { size: 167, gitOid: 'e0b1d18ecd0ae4ff1d47bd297d910c0cf83e504b' },
  'tokenizer.json': { size: 17082730, sha256: '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39' },
  'onnx/model_quantized.onnx': { size: 118308185, sha256: 'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193' },
};
const ORT_FILES = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];

function verify(file, expected) {
  const data = fs.readFileSync(file);
  if (data.length !== expected.size) return false;
  if (expected.sha256) return createHash('sha256').update(data).digest('hex') === expected.sha256;
  const blob = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  return blob === expected.gitOid;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  let shown = 0;
  for await (const chunk of res.body) {
    out.write(chunk);
    received += chunk.length;
    if (total > 5e6 && received - shown > total / 10) {
      shown = received;
      process.stdout.write(`  ${Math.round((received / total) * 100)}%`);
    }
  }
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  if (total > 5e6) process.stdout.write('\n');
  fs.renameSync(tmp, dest);
}

const modelDir = path.join(ROOT, 'public', 'models', MODEL);
for (const [name, expected] of Object.entries(FILES)) {
  const dest = path.join(modelDir, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && verify(dest, expected)) {
    console.log(`✓ ${name} (already present)`);
    continue;
  }
  console.log(`↓ ${name} (${(expected.size / 1e6).toFixed(1)} MB)`);
  await download(`https://huggingface.co/${MODEL}/resolve/${REVISION}/${name}`, dest);
  if (!verify(dest, expected)) {
    fs.rmSync(dest);
    throw new Error(`Integrity check failed for ${name}`);
  }
  console.log(`✓ ${name} verified`);
}

// ONNX Runtime Web: the exact version used by @huggingface/transformers.
function packageDir(name, fromFile) {
  let dir = path.dirname(createRequire(fromFile).resolve(name));
  while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== name) {
    const up = path.dirname(dir);
    if (up === dir) throw new Error(`Cannot locate package ${name}`);
    dir = up;
  }
  return dir;
}
const transformersDir = packageDir('@huggingface/transformers', path.join(ROOT, 'package.json'));
const ortDir = packageDir('onnxruntime-web', path.join(transformersDir, 'package.json'));
const ortVersion = JSON.parse(fs.readFileSync(path.join(ortDir, 'package.json'), 'utf8')).version;
const ortOut = path.join(ROOT, 'public', 'ort');
fs.mkdirSync(ortOut, { recursive: true });
for (const f of ORT_FILES) fs.copyFileSync(path.join(ortDir, 'dist', f), path.join(ortOut, f));
console.log(`✓ onnxruntime-web ${ortVersion}: ${ORT_FILES.join(', ')}`);
