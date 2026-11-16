// Development adapter, never deployed. Test credentials exist only in this local process.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {database} from './local-d1.mjs';
import {handle} from '../worker/cloudflare.mjs';
import {passwordHash,digest} from '../worker/auth.mjs';
const args=process.argv.slice(2),arg=(k,v)=>args.includes(k)?args[args.indexOf(k)+1]:v;
const DB=database(),store=new Map();
const env={DB,ADMIN_USER_ID:'preview-owner',MEDIA:{async put(k,v,m){store.set(k,{body:v,...m})},async get(k){return store.get(k)}},ASSETS:{async fetch(req){const url=new URL(req.url);const name=path.resolve('public','.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!name.startsWith(path.resolve('public')+path.sep))return new Response('Not found',{status:404});try{const data=await readFile(name),ext=path.extname(name);return new Response(data,{headers:{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[ext]||'application/octet-stream'}})}catch{return new Response('Not found',{status:404})}}}};
await DB.prepare('INSERT INTO auth_users(id,username,password_hash,salt,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind('preview-owner','preview_admin',await passwordHash('LocalPreviewOnly!2026','preview-salt'),'preview-salt',await digest('preview-only'),0).run();
await DB.prepare('INSERT INTO profiles(user_id,display_name,birth_date,created_at) VALUES(?,?,?,?)').bind('preview-owner','Туршилтын админ','1995-01-01',0).run();
http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const r=await handle(request,env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))}catch(err){console.error(err.message);res.writeHead(503);res.end('Local preview unavailable')}}).listen(Number(arg('--port','4173')),arg('--host','127.0.0.1'));
