import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handle} from '../worker/cloudflare.mjs';
import {database} from '../scripts/local-d1.mjs';

test('Cloudflare: independent login, owner permissions, manual VIP, content, recovery',async()=>{
 const env={DB:database(),ADMIN_USER_ID:'',ASSETS:{fetch:()=>new Response('asset')}},base='https://mur.test';let cookie='';
 async function call(path,data,extra={}){const headers={...(cookie?{cookie}:{}),...(data?{'Content-Type':'application/json',origin:base}:{}),...extra};const res=await handle(new Request(base+path,{method:data?'POST':'GET',headers,...(data?{body:JSON.stringify(data)}:{})}),env);const body=await res.json();const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return {status:res.status,body}}
 assert.equal((await call('/api/account',null,{'oai-authenticated-user-id':'fake','oai-authenticated-user-email':'owner@mur.internal'})).status,401);
 assert.equal((await call('/api/auth/register',{username:'owner',password:'a-long-test-password'},{origin:'https://evil.test'})).status,403);
 const registration=await call('/api/auth/register',{username:'owner',password:'a-long-test-password'});assert.equal(registration.status,201);const ownerCookie=cookie;env.ADMIN_USER_ID=registration.body.userId;
 assert.equal((await call('/api/account')).body.isAdmin,true);
 assert.equal((await call('/api/account/register',{displayName:'Owner',birthDate:'1995-01-01',accepted:true})).status,201);
 assert.equal((await call('/api/admin/vip/plan',{price:5000,days:30,bank:'TEST BANK',account:'TEST-ONLY',accountName:'TEST'})).status,200);
 const catalog={revision:0,series:[{id:'test',mn:'Story',genres:['fantasy'],cover:'art/cover-0.svg',chapters:[]}],videos:[]};assert.equal((await call('/api/admin/content',catalog)).status,200);assert.equal((await call('/api/admin/content',catalog)).status,409);
 const member=await call('/api/auth/register',{username:'reader',password:'another-long-password'});assert.equal(member.status,201);const memberCookie=cookie;assert.equal((await call('/api/account')).body.isAdmin,false);
 assert.equal((await call('/api/admin/vip/plan',{price:1,days:30,bank:'bad',account:'bad',accountName:'bad'},{'oai-authenticated-user-email':'owner@mur.internal'})).status,403);
 assert.equal((await call('/api/account/register',{displayName:'Reader',birthDate:'1998-01-01',accepted:true})).status,201);
 assert.equal((await call('/api/vip/request',{price:1,months:1})).status,409);
 const request=await call('/api/vip/request',{price:5000,months:1});assert.equal(request.status,201);assert.equal((await call('/api/account')).body.vip.active,false);
 cookie=ownerCookie;assert.equal((await call('/api/admin/vip/review',{id:request.body.id,action:'approve'})).status,400);
 assert.equal((await call('/api/admin/vip/review',{id:request.body.id,action:'approve',paymentConfirmed:true})).status,200);
 assert.equal((await call('/api/admin/vip/review',{id:request.body.id,action:'approve',paymentConfirmed:true})).status,409);
 cookie=memberCookie;assert.equal((await call('/api/account')).body.vip.active,true);
 assert.equal((await call('/api/auth/recover',{username:'reader',password:'replacement-password',recoveryCode:'wrong'})).status,401);
 assert.equal((await call('/api/auth/recover',{username:'reader',password:'replacement-password',recoveryCode:member.body.recoveryCode})).status,200);
 cookie=memberCookie;assert.equal((await call('/api/account')).status,401);
 assert.equal((await call('/api/auth/login',{username:'reader',password:'replacement-password'})).status,200);
 cookie=ownerCookie;assert.equal((await call('/api/admin/users',{id:member.body.userId,suspended:true})).status,200);
 assert.equal((await call('/api/auth/login',{username:'reader',password:'replacement-password'})).status,401);
 env.DB.sql.close();
});
test('private chapter metadata and media stay inaccessible without VIP',async()=>{
 const id='11111111-1111-4111-8111-111111111111',url='/api/media/'+id,DB=database();
 const env={DB,ADMIN_USER_ID:'owner',MEDIA:{get:async()=>({body:new Uint8Array([1]),httpMetadata:{contentType:'image/png'}})}};
 await DB.prepare('INSERT INTO site_content(id,value,revision) VALUES(1,?,1)').bind(JSON.stringify({series:[{id:'secret',mn:'Private',cover:'art/cover-0.svg',mature:true,chapters:[{id:'one',pages:[{url}]}]}],videos:[]})).run();
 const response=await handle(new Request('https://mur.test/api/content'),env);assert.equal((await response.json()).series[0].chapters.length,0);
 assert.equal((await handle(new Request('https://mur.test'+url),env)).status,404);
 assert.equal((await handle(new Request('https://mur.test/api/admin/upload',{method:'POST',headers:{origin:'https://mur.test','Content-Type':'image/png'},body:'not-image'}),env)).status,403);
 DB.sql.close();
});
