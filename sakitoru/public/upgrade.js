/* Reader enhancements. No AI or paid API calls. */
(()=>{'use strict';
const get=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}};
document.body.dataset.readerTone=get('mur-reader-tone','night');
function enhance(){const box=document.querySelector('.reader-settings');if(!box||box.querySelector('#mur-reader-tone'))return;
const en=document.documentElement.lang==='en';
const select=document.createElement('select');select.id='mur-reader-tone';select.className='reader-theme';select.setAttribute('aria-label',en?'Reading background':'Унших дэвсгэр');
for(const [v,m,e] of [['night','Шөнийн','Night'],['black','Хар','Black'],['paper','Цаасан','Paper']]){const o=new Option(en?e:m,v);select.add(o)}select.value=document.body.dataset.readerTone;
select.addEventListener('change',()=>{document.body.dataset.readerTone=select.value;try{localStorage.setItem('mur-reader-tone',select.value)}catch{}});box.append(select);
const full=document.createElement('button');full.className='chip';full.id='mur-fullscreen';full.textContent=en?'⛶ Full screen':'⛶ Бүтэн дэлгэц';full.hidden=!document.fullscreenEnabled;full.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{}});box.append(full);
document.querySelectorAll('.reader-panel img').forEach(img=>{img.decoding='async';img.addEventListener('error',()=>{if(img.parentElement.querySelector('.mur-image-error'))return;const note=document.createElement('div');note.className='mur-image-error';note.textContent=en?'Image could not load. Check your connection.':'Зураг ачаалсангүй. Интернет холболтоо шалгаарай.';const retry=document.createElement('button');retry.textContent=en?'Retry':'Дахин ачаалах';retry.addEventListener('click',()=>{note.remove();const src=img.src;img.removeAttribute('src');img.src=src});note.append(retry);img.after(note)})});
}
new MutationObserver(enhance).observe(document.querySelector('#app'),{childList:true});enhance();
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('is-reading')||e.altKey||e.ctrlKey||e.metaKey||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
if(!['ArrowRight','ArrowLeft'].includes(e.key))return;const select=document.querySelector('#reader-page');if(!select||!select.options.length)return;const next=Math.max(0,Math.min(select.options.length-1,Number(select.value)+(e.key==='ArrowRight'?1:-1)));e.preventDefault();select.value=String(next);select.dispatchEvent(new Event('change',{bubbles:true}));});
})();
