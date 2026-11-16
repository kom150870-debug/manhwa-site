const now=()=>Math.floor(Date.now()/1000);
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function validBirthDate(value,today=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value&&date.getUTCFullYear()>=1900&&value<=today.toISOString().slice(0,10);
}
export function ageFromBirthDate(value,today=new Date()){
 if(!validBirthDate(value,today))return null;
 const [year,month,day]=value.split('-').map(Number);
 return today.getUTCFullYear()-year-((today.getUTCMonth()+1<month||(today.getUTCMonth()+1===month&&today.getUTCDate()<day))?1:0);
}
const isAdmin=(req,env)=>!!env.VIP_ADMIN_EMAIL&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.VIP_ADMIN_EMAIL.toLowerCase();
const profileFor=(env,uid)=>env.DB.prepare('SELECT user_id, display_name, birth_date FROM profiles WHERE user_id = ?').bind(uid).first();
export function purchaseXp(price,months){const rate=({1:10,3:8,6:6,9:5,12:5})[months]||0;return {xpRate:rate,purchaseXp:Math.floor(price*rate/100)}}
export function vipTiers(base=5000){return [[1,0],[3,10],[6,20],[9,30],[12,40]].map(([months,discount])=>{const price=Math.round(base*months*(100-discount)/100);return {months,discount,original:base*months,price,savings:base*months-price,...purchaseXp(price,months)}})}

async function planFor(env){const row=await env.DB.prepare('SELECT price, days, bank, account, account_name FROM vip_settings WHERE id = 1').first();const base=row?.price>0?row.price:5000;return {price:base,days:30,bank:row?.bank||'',account:row?.account||'',account_name:row?.account_name||'',paymentReady:!!(row?.bank&&row?.account&&row?.account_name),tiers:vipTiers(base)}}
// Calendar-month expiry in Mongolia time. Clamp month-end dates to the last valid day.
function calendarExpirySql(){
 const base="MAX(COALESCE((SELECT expires_at FROM vip_memberships WHERE user_id=r.user_id),0),?1)";
 const day="MIN(CAST(strftime('%d',"+base+",'unixepoch','+8 hours') AS INTEGER),CAST(strftime('%d',"+base+",'unixepoch','+8 hours','start of month','+'||r.months||' months','+1 month','-1 day') AS INTEGER))-1";
 return "CAST(strftime('%s',datetime("+base+",'unixepoch','+8 hours','start of month','+'||r.months||' months','+'||("+day+")||' days'),'+'||strftime('%H',"+base+",'unixepoch','+8 hours')||' hours','+'||strftime('%M',"+base+",'unixepoch','+8 hours')||' minutes','+'||strftime('%S',"+base+",'unixepoch','+8 hours')||' seconds','-8 hours') AS INTEGER)";
}

async function accessFor(env,uid){const p=await profileFor(env,uid);if(!p)return {allowed:false,reason:'profile_required'};if(ageFromBirthDate(p.birth_date)<18)return {allowed:false,reason:'age_restricted'};const vip=await env.DB.prepare('SELECT expires_at FROM vip_memberships WHERE user_id = ?').bind(uid).first();return vip?.expires_at>now()?{allowed:true,expiresAt:vip.expires_at}:{allowed:false,reason:'vip_required'}}
async function body(req){if(Number(req.headers.get('content-length')||0)>4096)throw Error('body');const text=await req.text();if(text.length>4096)throw Error('body');return JSON.parse(text)}
export async function membershipApi(req,env){
 const path=new URL(req.url).pathname;if(!path.startsWith('/api/'))return null;
 if(path==='/api/ads/config'&&req.method==='GET'){if(!env.DB)return json({enabled:false});try{const row=await env.DB.prepare('SELECT enabled,display_unit,interstitial_unit FROM ad_settings WHERE id=1').first();return json({enabled:row?.enabled===1,displayUnit:row?.display_unit||'',interstitialUnit:row?.interstitial_unit||'',chapterInterval:5,cooldownSeconds:600})}catch{return json({enabled:false})}}
 const uid=req.headers.get('oai-authenticated-user-id');
 if(!uid)return json({error:'sign_in_required',signedIn:false},401);
 if(!env.DB)return json({error:'storage_unavailable'},503);
 if(!['GET','POST'].includes(req.method))return json({error:'method_not_allowed'},405);
 if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'invalid_origin'},403);
 try{
  if(path==='/api/account'&&req.method==='GET'){
   const p=await profileFor(env,uid),vip=await env.DB.prepare('SELECT expires_at FROM vip_memberships WHERE user_id = ?').bind(uid).first();
   const pending=await env.DB.prepare("SELECT id,status,price,days,months,purchase_xp,created_at FROM vip_requests WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(uid).first();
   const xp=await env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS balance FROM xp_ledger WHERE user_id=?').bind(uid).first();
   let referral=null;
   if(p){await env.DB.prepare('INSERT INTO referral_codes (user_id,code) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING').bind(uid,crypto.randomUUID().replaceAll('-','')).run();const code=await env.DB.prepare('SELECT code FROM referral_codes WHERE user_id=?').bind(uid).first();const total=await env.DB.prepare('SELECT COUNT(*) AS total FROM referrals WHERE inviter_id=?').bind(uid).first();const paid=await env.DB.prepare("SELECT COUNT(*) AS total FROM xp_ledger WHERE user_id=? AND reason='paid_referral'").bind(uid).first();referral={code:code.code,registered:Number(total.total),rewarded:Number(paid.total),rewardXp:1000}}
   return json({signedIn:true,referral,xp:{balance:Number(xp?.balance||0)},isAdmin:isAdmin(req,env),profile:p?{displayName:p.display_name,birthDate:p.birth_date,age:ageFromBirthDate(p.birth_date)}:null,vip:{active:!!vip&&vip.expires_at>now(),expiresAt:vip?.expires_at||null},pending,plan:await planFor(env)});
  }
  if(path==='/api/account/register'&&req.method==='POST'){
   const d=await body(req),name=String(d.displayName||'').trim();if(!name||name.length>80||!validBirthDate(d.birthDate)||d.accepted!==true)return json({error:'invalid_profile'},400);
   // Declared date is fixed at registration. This is an age declaration, not ID verification.
   if(await profileFor(env,uid))return json({error:'profile_exists'},409);
   let inviter=null;const referralCode=String(d.referralCode||'').trim();
   if(referralCode){if(!/^[a-f0-9]{32}$/.test(referralCode))return json({error:'invalid_referral'},400);inviter=await env.DB.prepare('SELECT user_id FROM referral_codes WHERE code=?').bind(referralCode).first();if(!inviter||inviter.user_id===uid)return json({error:'invalid_referral'},400)}
   const statements=[env.DB.prepare('INSERT INTO profiles (user_id,display_name,birth_date,created_at) VALUES (?,?,?,?)').bind(uid,name,d.birthDate,now())];if(inviter)statements.push(env.DB.prepare('INSERT INTO referrals (invitee_id,inviter_id,created_at) VALUES (?,?,?)').bind(uid,inviter.user_id,now()));await env.DB.batch(statements);return json({created:true},201);
  }
  if((path==='/api/vip/access'||path==='/api/age/access')&&req.method==='GET'){
   const access=await accessFor(env,uid);return json(access,access.allowed?200:403);
  }
  if(path==='/api/xp/redeem'&&req.method==='POST'){
   const p=await profileFor(env,uid);if(!p)return json({error:'profile_required'},403);if(ageFromBirthDate(p.birth_date)<18)return json({error:'age_restricted'},403);
   const d=await body(req),reward=({vip3:{cost:1000,days:3,months:0},vip7:{cost:2300,days:7,months:0},vipMonth:{cost:10000,days:0,months:1}})[d.reward];
   if(!reward||!/^[a-f0-9-]{36}$/i.test(d.requestId||''))return json({error:'invalid_redemption'},400);
   const prior=await env.DB.prepare('SELECT user_id,cost,days,months FROM xp_redemptions WHERE id=?').bind(d.requestId).first();
   if(prior){if(prior.user_id!==uid||prior.cost!==reward.cost||prior.days!==reward.days||prior.months!==reward.months)return json({error:'redemption_conflict'},409);return json({redeemed:true,duplicate:true})}
   const stamp=now(),token=crypto.randomUUID(),base="MAX(COALESCE((SELECT expires_at FROM vip_memberships WHERE user_id=r.user_id),0),?1)";
   await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO xp_redemptions (id,user_id,cost,days,months,apply_token,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(amount),0) FROM xp_ledger WHERE user_id=?)>=?').bind(d.requestId,uid,reward.cost,reward.days,reward.months,token,stamp,uid,reward.cost),
    env.DB.prepare("INSERT OR IGNORE INTO xp_ledger (id,user_id,amount,reason,created_at) SELECT 'redeem:'||id,user_id,-cost,'vip_redemption',? FROM xp_redemptions WHERE id=? AND user_id=? AND apply_token=?").bind(stamp,d.requestId,uid,token),
    env.DB.prepare('INSERT INTO vip_memberships (user_id,expires_at,updated_at) SELECT r.user_id,CASE WHEN r.months>0 THEN '+calendarExpirySql()+' ELSE '+base+'+(r.days*86400) END,?2 FROM xp_redemptions r WHERE r.id=?3 AND r.user_id=?4 AND r.apply_token=?5 ON CONFLICT(user_id) DO UPDATE SET expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(stamp,stamp,d.requestId,uid,token)
   ]);
   const saved=await env.DB.prepare('SELECT user_id FROM xp_redemptions WHERE id=?').bind(d.requestId).first();if(!saved||saved.user_id!==uid)return json({error:'insufficient_xp'},402);return json({redeemed:true});
  }
  if(path==='/api/vip/request'&&req.method==='POST'){
   const p=await profileFor(env,uid);if(!p)return json({error:'profile_required'},403);if(ageFromBirthDate(p.birth_date)<18)return json({error:'age_restricted'},403);
   const plan=await planFor(env);if(!plan.paymentReady)return json({error:'payment_not_configured'},503);
   const d=await body(req),tier=plan.tiers.find(t=>t.months===d.months);if(!tier||d.price!==tier.price)return json({error:'plan_changed'},409);
   const existing=await env.DB.prepare("SELECT id FROM vip_requests WHERE user_id = ? AND status = 'pending'").bind(uid).first();if(existing)return json({id:existing.id},200);
   const id=crypto.randomUUID();
   await env.DB.prepare("INSERT INTO vip_requests (id,user_id,status,price,days,months,purchase_xp,created_at) SELECT ?,?,'pending',?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM vip_requests WHERE user_id = ? AND status = 'pending')").bind(id,uid,tier.price,tier.months*30,tier.months,tier.purchaseXp,now(),uid).run();
   const pending=await env.DB.prepare("SELECT id FROM vip_requests WHERE user_id = ? AND status = 'pending'").bind(uid).first();return json({id:pending.id},201);
  }
  if(path.startsWith('/api/admin/')){
   if(!isAdmin(req,env))return json({error:'admin_required'},403);
   if(path==='/api/admin/ads'&&req.method==='GET')return json({settings:await env.DB.prepare('SELECT enabled,display_unit,interstitial_unit FROM ad_settings WHERE id=1').first()});
   if(path==='/api/admin/ads'&&req.method==='POST'){
    const d=await body(req),valid=v=>typeof v==='string'&&(v===''||/^\/\d{1,20}\/[A-Za-z0-9_./-]{1,160}$/.test(v));
    if(typeof d.enabled!=='boolean'||!valid(d.displayUnit)||!valid(d.interstitialUnit)||(d.enabled&&!d.displayUnit)||(d.enabled&&d.confirmed!==true))return json({error:'invalid_ad_config'},400);
    await env.DB.prepare('INSERT INTO ad_settings (id,enabled,display_unit,interstitial_unit,updated_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,display_unit=excluded.display_unit,interstitial_unit=excluded.interstitial_unit,updated_at=excluded.updated_at').bind(d.enabled?1:0,d.displayUnit,d.interstitialUnit,now()).run();return json({saved:true});
   }
   if(path==='/api/admin/vip'&&req.method==='GET')return json({plan:await planFor(env),requests:(await env.DB.prepare('SELECT r.id,r.status,r.price,r.days,r.months,r.purchase_xp,r.created_at,p.display_name FROM vip_requests r LEFT JOIN profiles p ON p.user_id=r.user_id ORDER BY r.created_at DESC LIMIT 100').all()).results});
   if(path==='/api/admin/vip/plan'&&req.method==='POST'){
    const d=await body(req);if(!Number.isInteger(d.price)||d.price<1||d.price>10000000||!Number.isInteger(d.days)||d.days<1||d.days>366||!['bank','account','accountName'].every(k=>typeof d[k]==='string'&&d[k].trim().length>0&&d[k].length<=120))return json({error:'invalid_plan'},400);
    await env.DB.prepare('INSERT INTO vip_settings (id,price,days,bank,account,account_name,updated_at) VALUES (1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET price=excluded.price,days=excluded.days,bank=excluded.bank,account=excluded.account,account_name=excluded.account_name,updated_at=excluded.updated_at').bind(d.price,d.days,d.bank.trim(),d.account.trim(),d.accountName.trim(),now()).run();return json({saved:true});
   }
   if(path==='/api/admin/vip/review'&&req.method==='POST'){
    const d=await body(req);if(!['approve','reject'].includes(d.action)||typeof d.id!=='string'||(d.action==='approve'&&d.paymentConfirmed!==true))return json({error:'invalid_review'},400);
    const r=await env.DB.prepare("SELECT user_id,days,months FROM vip_requests WHERE id = ? AND status='pending'").bind(d.id).first();if(!r)return json({error:'request_not_pending'},409);
    if(d.action==='approve'){
     const p=await profileFor(env,r.user_id);if(!p||ageFromBirthDate(p.birth_date)<18)return json({error:'age_restricted'},403);
     const stamp=now();
     await env.DB.batch([
      env.DB.prepare("INSERT INTO vip_memberships (user_id,expires_at,updated_at) SELECT r.user_id,"+calendarExpirySql()+",?2 FROM vip_requests r WHERE r.id=?3 AND r.status='pending' ON CONFLICT(user_id) DO UPDATE SET expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(stamp,stamp,d.id),
      env.DB.prepare("INSERT OR IGNORE INTO xp_ledger (id,user_id,amount,reason,created_at) SELECT 'purchase:'||id,user_id,purchase_xp,'vip_purchase',? FROM vip_requests WHERE id=? AND status='pending' AND purchase_xp>0").bind(stamp,d.id),
      env.DB.prepare("INSERT OR IGNORE INTO xp_ledger (id,user_id,amount,reason,created_at) SELECT 'referral:'||r.user_id,f.inviter_id,1000,'paid_referral',? FROM vip_requests r JOIN referrals f ON f.invitee_id=r.user_id WHERE r.id=? AND r.status='pending' AND r.price>0 AND f.inviter_id<>r.user_id AND NOT EXISTS (SELECT 1 FROM vip_requests old WHERE old.user_id=r.user_id AND old.status='approved')").bind(stamp,d.id),
      env.DB.prepare("UPDATE vip_requests SET status='approved',reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").bind(stamp,uid,d.id)
     ]);
    }else await env.DB.prepare("UPDATE vip_requests SET status='rejected',reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").bind(now(),uid,d.id).run();
    return json({saved:true});
   }
  }
  // The retired Veriff/selfie routes cannot grant access.
  return json({error:'not_found'},404);
 }catch{return json({error:'request_failed'},400)}
}
