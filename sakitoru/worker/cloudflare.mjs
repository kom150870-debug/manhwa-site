import {membershipApi} from './membership.mjs';
import {authApi,identity,owner,reply,readJSON} from './auth.mjs';
async function content(env){const row=await env.DB.prepare('SELECT value,revision FROM site_content WHERE id=1').first();return row?{...JSON.parse(row.value),revision:row.revision}:{series:[],videos:[],revision:0,empty:true}}
async function vip(req,env){const r=await membershipApi(new Request(new URL('/api/vip/access',req.url),{headers:req.headers}),env);return r?.ok===true}
function validContent(d){if(!Array.isArray(d.series)||!Array.isArray(d.videos)||!Number.isInteger(d.revision)||d.series.length>1000)return false;const ids=new Set();for(const s of d.series){if(!s||!/^[-\w]{1,80}$/.test(s.id)||ids.has(s.id)||typeof s.mn!=='string'||!Array.isArray(s.genres)||!Array.isArray(s.chapters))return false;ids.add(s.id);if(s.mature!==undefined&&typeof s.mature!=='boolean')return false;if(!safeImage(s.cover))return false;const chapters=new Set();for(const c of s.chapters){if(!c||!/^[-\w]{1,80}$/.test(c.id)||chapters.has(c.id)||!Array.isArray(c.pages))return false;chapters.add(c.id);for(const p of c.pages)if(!p||!safeImage(p.url)||(s.mature&&!p.url.startsWith('/api/media/')))return false}}return true}
function safeImage(s){return typeof s==='string'&&(/^(art\/[\w.-]+|\/api\/media\/[a-f0-9-]{36})$/.test(s)||/^https:\/\//.test(s))}
async function contentApi(req,env,u){const path=new URL(req.url).pathname;
 if(path==='/api/content'&&req.method==='GET'){const d=await content(env);if(!owner(u,env)&&!await vip(req,env))d.series=d.series.map(s=>s.mature?{...s,chapters:[]}:s);return reply(d)}
 if(path==='/api/admin/content'&&req.method==='POST'){
  if(!owner(u,env))return reply({error:'admin_required'},403);let d;try{d=await readJSON(req,900000)}catch{return reply({error:'content_too_large'},413)}if(!validContent(d))return reply({error:'invalid_content'},400);
  const serialized=JSON.stringify({series:d.series,videos:d.videos});const r=await env.DB.prepare('INSERT INTO site_content(id,value,revision) SELECT 1,?,1 WHERE ?=0 ON CONFLICT(id) DO UPDATE SET value=excluded.value,revision=site_content.revision+1 WHERE site_content.revision=? RETURNING revision').bind(serialized,d.revision,d.revision).first();
  // Existing rows with revision>0 need an UPDATE, because SELECT is empty.
  if(r)return reply({saved:true,revision:r.revision});
  const updated=await env.DB.prepare('UPDATE site_content SET value=?,revision=revision+1 WHERE id=1 AND revision=? RETURNING revision').bind(serialized,d.revision).first();return updated?reply({saved:true,revision:updated.revision}):reply({error:'content_conflict'},409);
 }
 if(path==='/api/admin/upload'&&req.method==='POST'){
  if(!owner(u,env))return reply({error:'admin_required'},403);if(!env.MEDIA)return reply({error:'media_unavailable'},503);
  const type=req.headers.get('content-type');if(!['image/png','image/jpeg','image/webp'].includes(type))return reply({error:'image_type'},400);
  if(Number(req.headers.get('content-length')||0)>8388608)return reply({error:'image_too_large'},413);
  const reader=req.body.getReader(),chunks=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8388608){await reader.cancel();return reply({error:'image_too_large'},413)}chunks.push(value)}
  const bytes=new Uint8Array(length);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}const valid=type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)return reply({error:'image_type'},400);
  const id=crypto.randomUUID();await env.MEDIA.put(id,bytes,{httpMetadata:{contentType:type}});return reply({url:'/api/media/'+id},201);
 }
 if(path.startsWith('/api/media/')&&['GET','HEAD'].includes(req.method)){
  if(!env.MEDIA)return reply({error:'media_unavailable'},503);const id=path.slice('/api/media/'.length);if(!/^[a-f0-9-]{36}$/.test(id))return reply({error:'not_found'},404);
  if(!owner(u,env)){const d=await content(env);const publicRef=d.series.some(s=>s.cover===path||(!s.mature&&s.chapters.some(c=>c.pages.some(p=>p.url===path))));const secretRef=d.series.some(s=>s.mature&&s.chapters.some(c=>c.pages.some(p=>p.url===path)));if((secretRef&&!await vip(req,env))||(!publicRef&&!secretRef))return reply({error:'not_found'},404)}
  const obj=await env.MEDIA.get(id);return obj?new Response(req.method==='HEAD'?null:obj.body,{headers:{'Content-Type':obj.httpMetadata.contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):reply({error:'not_found'},404);
 }
 if(path==='/api/admin/users'&&req.method==='GET'){if(!owner(u,env))return reply({error:'admin_required'},403);return reply({users:(await env.DB.prepare('SELECT u.id,u.username,u.suspended,p.display_name,v.expires_at FROM auth_users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN vip_memberships v ON v.user_id=u.id ORDER BY u.created_at DESC LIMIT 200').all()).results})}
 if(path==='/api/admin/users'&&req.method==='POST'){if(!owner(u,env))return reply({error:'admin_required'},403);const d=await readJSON(req);if(typeof d.id!=='string'||typeof d.suspended!=='boolean'||d.id===env.ADMIN_USER_ID)return reply({error:'invalid_input'},400);await env.DB.batch([env.DB.prepare('UPDATE auth_users SET suspended=? WHERE id=?').bind(d.suspended?1:0,d.id),env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(d.id)]);return reply({saved:true})}
 return null;
}
export async function handle(req,env){const path=new URL(req.url).pathname;
 if(path.startsWith('/api/')){
  if(!env.DB)return reply({error:'storage_unavailable'},503);
  if(!['GET','HEAD','POST'].includes(req.method))return reply({error:'method_not_allowed'},405);
  if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'invalid_origin'},403);
  const auth=await authApi(req,env);if(auth)return auth;
  const u=await identity(req,env),headers=new Headers(req.headers);
  // Never trust client-supplied Sites identity headers on a public Worker.
  for(const name of [...headers.keys()])if(name.startsWith('oai-'))headers.delete(name);
  if(u){headers.set('oai-authenticated-user-id',u.id);if(owner(u,env))headers.set('oai-authenticated-user-email','owner@mur.internal')}
  const trusted=new Request(req,{headers}),bound={...env,VIP_ADMIN_EMAIL:'owner@mur.internal'};
  const c=await contentApi(trusted,bound,u);if(c)return c;
  const response=await membershipApi(trusted,bound);
  if(path==='/api/account'&&response?.ok){const data=await response.json();return reply({...data,userId:u.id,username:u.username})}return response||reply({error:'not_found'},404);
 }
 return env.ASSETS.fetch(req);
}
export default {async fetch(req,env){try{return await handle(req,env)}catch{return reply({error:'service_unavailable'},503)}}};
