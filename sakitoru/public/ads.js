/* Real ad requests are disabled until the owner configures approved GAM units. */
(()=>{
 const STORE='mur-ad-session',CAP='mur-interstitial-requested';
 let config=null,slots=[],serial=0,loading=null,servicesReady=false;
 let activity={chapters:[],breakDue:false};
 try{const saved=JSON.parse(sessionStorage.getItem(STORE));if(Array.isArray(saved?.chapters))activity={chapters:saved.chapters.filter(x=>typeof x==='string').slice(-200),breakDue:saved.breakDue===true}}catch{}
 const save=()=>{try{sessionStorage.setItem(STORE,JSON.stringify(activity))}catch{}};
 const page=()=>location.hash.slice(1).split('/')[0]||'home';
 function eligible(){if(!config?.enabled||typeof accountState==='undefined'||accountState.loading||accountState.error||accountState.vip?.active)return false;const p=page();if(['home','catalog','videos'].includes(p))return true;if(p==='read'){const [,sid]=location.hash.slice(1).split('/');return !!state.series.find(s=>s.id===sid&&!s.mature)&&activity.breakDue}return false}
 function beforeRoute(){serial++;document.querySelectorAll('.mur-ad-placement').forEach(el=>el.remove());const old=slots;slots=[];if(window.googletag?.cmd&&old.length)window.googletag.cmd.push(()=>window.googletag.destroySlots(old))}
 function gpt(){if(loading)return loading;loading=new Promise((resolve,reject)=>{window.googletag=window.googletag||{cmd:[]};const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src='https://securepubads.g.doubleclick.net/tag/js/gpt.js';script.onload=resolve;script.onerror=()=>{loading=null;script.remove();reject(Error('ad_service_unavailable'))};document.head.append(script)});return loading}
 function interstitialAllowed(){try{return Date.now()-Number(localStorage.getItem(CAP)||0)>=config.cooldownSeconds*1000}catch{return false}}
 async function refresh(){const ticket=++serial;if(!eligible())return;try{await gpt();if(ticket!==serial||!eligible())return;
  window.googletag.cmd.push(()=>{
   if(ticket!==serial||!eligible())return;
   const p=page(),id='mur-ad-'+ticket,wrapper=document.createElement('section');wrapper.className='mur-ad-placement';wrapper.setAttribute('aria-label','Зар сурталчилгаа');const label=document.createElement('small');label.textContent='Зар сурталчилгаа';const box=document.createElement('div');box.id=id;wrapper.append(label,box);
   const target=p==='read'?document.querySelector('.reader-controls'):document.querySelector('#app .container');if(!target)return;if(p==='read')target.before(wrapper);else target.prepend(wrapper);
   const available=target.clientWidth||Math.max(200,window.innerWidth-50),sizes=[[300,250],[250,250],[200,200]].filter(s=>s[0]<=available);
   if(!sizes.length){wrapper.remove();return}
   const tag=window.googletag,slot=tag.defineSlot(config.displayUnit,sizes,id)?.addService(tag.pubads());if(!slot){wrapper.remove();return}slots.push(slot);
   tag.pubads().addEventListener('slotRenderEnded',event=>{if(event.slot===slot){if(event.isEmpty)wrapper.remove();if(p==='read'&&!event.isEmpty){activity.breakDue=false;save()}}});
   if(config.interstitialUnit&&interstitialAllowed()){
    const full=tag.defineOutOfPageSlot(config.interstitialUnit,tag.enums.OutOfPageFormat.INTERSTITIAL);
    if(full){full.addService(tag.pubads());slots.push(full);tag.setConfig({interstitial:{triggers:{endOfArticle:p==='read',inactivity:false,navBar:false,unhideWindow:false,continueReading:false}}});try{localStorage.setItem(CAP,String(Date.now()))}catch{}if(!servicesReady){tag.enableServices();servicesReady=true}tag.display(full)}
   }
   if(!servicesReady){tag.enableServices();servicesReady=true}tag.display(id);
  });
 }catch{/* Ad blockers, no fill, or provider failure never block navigation. */}}
 function chapterCompleted(sid,cid){if(!config?.enabled||!sid||!cid||accountState?.vip?.active||state.series.find(s=>s.id===sid)?.mature)return;const key=sid+'/'+cid;if(activity.chapters.includes(key))return;activity.chapters.push(key);if(activity.chapters.length%config.chapterInterval===0){activity.breakDue=true;save();beforeRoute();refresh()}else save()}
 async function reloadConfig(){beforeRoute();try{const r=await fetch('/api/ads/config',{cache:'no-store'});config=r.ok?await r.json():null}catch{config=null}refresh()}
 window.MurAds={beforeRoute,refresh,chapterCompleted,reloadConfig};reloadConfig();
})();
