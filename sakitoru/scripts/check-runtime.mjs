import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"mur",modules:true,scriptPath:'dist/cloudflare/cloudflare.js',compatibilityDate:'2026-11-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['MEDIA'],bindings:{ADMIN_USER_ID:''}}]}));
try{
 const db=await mf.getD1Database('DB');
 for(const name of readdirSync('migrations').sort()){const statements=readFileSync('migrations/'+name,'utf8').replaceAll('--> statement-breakpoint','').split(';').map(x=>x.trim()).filter(Boolean);await db.batch(statements.map(sql=>db.prepare(sql)))}
 const res=await mf.dispatchFetch('https://mur.test/api/auth/register',{method:'POST',headers:{Origin:'https://mur.test','Content-Type':'application/json'},body:JSON.stringify({username:'runtime_test',password:'OnlyLocalRuntimeTest-2026'})});
 assert.equal(res.status,201,await res.clone().text());const cookie=res.headers.get('set-cookie').split(';')[0];
 const account=await mf.dispatchFetch('https://mur.test/api/account',{headers:{cookie}});assert.equal(account.status,200);assert.equal((await account.json()).signedIn,true);
 console.log('Workerd runtime: registration, password hashing, secure session and D1 account read passed.');
}finally{await mf.dispose()}
