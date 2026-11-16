import {pbkdf2} from 'node:crypto';
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const stamp=()=>Math.floor(Date.now()/1000);
export const reply=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
// Standard PBKDF2-HMAC-SHA256 with a per-user random salt.
export function passwordHash(password,salt){return new Promise((resolve,reject)=>pbkdf2(password,salt,600000,32,'sha256',(err,key)=>err?reject(err):resolve(hex(key))))}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
export async function readJSON(req,max=4096){if(Number(req.headers.get('content-length')||0)>max)throw Error('too_large');const reader=req.body?.getReader();let text='',size=0;const decoder=new TextDecoder();if(!reader)throw Error('body');while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('too_large')}text+=decoder.decode(value,{stream:true})}return JSON.parse(text+decoder.decode())}
export async function identity(req,env){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)__Host-mur_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token||!env.DB)return null;return env.DB.prepare('SELECT u.id,u.username,u.suspended FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.suspended=0').bind(await digest(token),stamp()).first()}
export const owner=(u,env)=>!!u&&!!env.ADMIN_USER_ID&&u.id===env.ADMIN_USER_ID;
const cookie=(token,age)=>`__Host-mur_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
async function limited(env,key,max){const time=stamp();const r=await env.DB.prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count').bind(key,time+900,time,time).first();return r.count>max}
async function session(env,id){const token=random();await env.DB.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),id,stamp()+604800).run();return cookie(token,604800)}
export async function authApi(req,env){const path=new URL(req.url).pathname;if(!path.startsWith('/api/auth/'))return null;if(!env.DB)return reply({error:'storage_unavailable'},503);
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'invalid_origin'},403);
 if(path==='/api/auth/logout'){const token=req.headers.get('cookie')?.match(/__Host-mur_session=([a-f0-9]{64})/)?.[1];if(token)await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(token)).run();return reply({ok:true},200,{'Set-Cookie':cookie('',0)})}
 if(!['/api/auth/register','/api/auth/login','/api/auth/recover'].includes(path))return reply({error:'not_found'},404);
 if(await limited(env,'ip:'+await digest(req.headers.get('cf-connecting-ip')||'local'),30))return reply({error:'try_later'},429);
 let d;try{d=await readJSON(req)}catch{return reply({error:'invalid_input'},400)}
 const username=String(d.username||'').trim().toLowerCase(),password=String(d.password||'');
 if(!/^[a-z0-9_]{4,32}$/.test(username)||password.length<12||password.length>128)return reply({error:'invalid_credentials_format'},400);
 if(await limited(env,'user:'+await digest(username),10))return reply({error:'try_later'},429);
 const user=await env.DB.prepare('SELECT * FROM auth_users WHERE username=?').bind(username).first();
 if(path==='/api/auth/register'){
  if(user)return reply({error:'username_unavailable'},409);
  const id=crypto.randomUUID(),salt=random(),recovery=random(),hash=await passwordHash(password,salt);
  try{await env.DB.prepare('INSERT INTO auth_users(id,username,password_hash,salt,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind(id,username,hash,salt,await digest(recovery),stamp()).run()}catch{return reply({error:'username_unavailable'},409)}
  return reply({created:true,userId:id,recoveryCode:recovery},201,{'Set-Cookie':await session(env,id)});
 }
 if(path==='/api/auth/recover'){
  if(!user||user.suspended||!equal(await digest(String(d.recoveryCode||'')),user.recovery_hash))return reply({error:'invalid_recovery'},401);
  const salt=random(),recovery=random();await env.DB.batch([env.DB.prepare('UPDATE auth_users SET password_hash=?,salt=?,recovery_hash=? WHERE id=?').bind(await passwordHash(password,salt),salt,await digest(recovery),user.id),env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.id)]);
  return reply({recoveryCode:recovery,userId:user.id},200,{'Set-Cookie':await session(env,user.id)});
 }
 const hash=await passwordHash(password,user?.salt||'unknown-user-constant-salt');
 if(!user||user.suspended||!equal(hash,user.password_hash))return reply({error:'invalid_login'},401);
 return reply({ok:true,userId:user.id},200,{'Set-Cookie':await session(env,user.id)});
}
