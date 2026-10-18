import {createServer} from 'node:http';
import {mkdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
import {database,bucket} from './local-db.mjs';
mkdirSync('.local',{recursive:true});const env={DB:database('.local/app.sqlite'),BUCKET:bucket('.local/photos')};
const port=Number(process.env.PORT||8771);
createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const response=await worker.fetch(new Request('http://localhost:'+port+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Server error');}}).listen(port,'127.0.0.1',()=>console.log('Local: http://localhost:'+port));
