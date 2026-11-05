// Builds the offices into public/ (that folder is what Vercel serves; there is no build step on Vercel).
//   npm ci && node build.mjs
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'public');

fs.rmSync(path.join(out, 'assets'), { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  outdir: path.join(out, 'assets'),
  entryNames: '[name]-[hash]',
  chunkNames: '[name]-[hash]',
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning',
});

const entry = Object.keys(result.metafile.outputs).find((f) => result.metafile.outputs[f].entryPoint);
const entryUrl = 'assets/' + path.basename(entry);
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8').replace('%%ENTRY%%', entryUrl);
fs.writeFileSync(path.join(out, 'index.html'), html);

for (const [file, info] of Object.entries(result.metafile.outputs)) {
  console.log(`${path.basename(file).padEnd(30)} ${(info.bytes / 1024).toFixed(0).padStart(6)} KB`);
}
