// Build a Cloudflare Workers entry for `wrangler deploy`.
// Text files (HTML/CSS/JS) stay inlined so the Worker keeps sending its security headers.
// Images and fonts are served from Cloudflare static assets (wrangler.jsonc → assets.directory),
// which keeps the Worker bundle under the 3 MB free-plan limit.
// Without an R2 binding, photos are stored in the D1 table `photos` (drizzle/0001_photos.sql).
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const inline = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const assets = {};
async function scan(dir, prefix = '') {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name), url = prefix + '/' + item.name;
    if (item.isDirectory()) await scan(full, url);
    else if (inline[path.extname(full)]) assets[url] = { data: (await readFile(full)).toString('base64'), type: inline[path.extname(full)] };
  }
}
await scan('public');

let source = await readFile('worker/index.js', 'utf8');
const swaps = [
  ["export default {async fetch(req,env){", "const d1Bucket=db=>({async put(key,data){await db.prepare('INSERT OR REPLACE INTO photos (key,data,created_at) VALUES (?,?,?)').bind(key,data,Date.now()).run();},async get(key){const row=await db.prepare('SELECT data FROM photos WHERE key=?').bind(key).first();return row?{body:new Uint8Array(row.data)}:null;}});\nexport default {async fetch(req,env){if(!env.BUCKET&&env.DB)env={...env,BUCKET:d1Bucket(env.DB)};"],
  ["import { assets } from './assets.js';", 'const assets=' + JSON.stringify(assets) + ';'],
  ["if(!asset)return new Response('Not found',{status:404});", "if(!asset)return env.ASSETS?env.ASSETS.fetch(req):new Response('Not found',{status:404});"],
];
for (const [from, to] of swaps) {
  if (!source.includes(from)) throw new Error('build-cloudflare: worker/index.js changed, could not find: ' + from);
  source = source.replace(from, to);
}
await mkdir('dist/cloudflare', { recursive: true });
await writeFile('dist/cloudflare/index.js', source);
console.log('Built Cloudflare Worker (' + Object.keys(assets).length + ' inlined text files).');
