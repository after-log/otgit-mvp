import {readFile,writeFile,mkdir,readdir,rm,cp} from 'node:fs/promises';
import path from 'node:path';
const assets={};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml'};
async function scan(dir,prefix=''){for(const item of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,item.name),url=prefix+'/'+item.name;if(item.isDirectory())await scan(full,url);else assets[url]={data:(await readFile(full)).toString('base64'),type:types[path.extname(full)]||'application/octet-stream'};}}
await scan('public');await writeFile('worker/assets.js','export const assets='+JSON.stringify(assets)+';');
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const source=(await readFile('worker/index.js','utf8')).replace("import { assets } from './assets.js';",'const assets='+JSON.stringify(assets)+';');
await writeFile('dist/server/index.js',source);await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Worker, assets, and database migrations.');
