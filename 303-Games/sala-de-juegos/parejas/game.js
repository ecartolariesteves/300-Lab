/* Interfaz de Parejas: turnos limitados a dos cartas y navegación accesible. */
(() => {
'use strict';
const $=id=>document.getElementById(id),R=window.ParejasRules;
const PATHS={
estrella:'<polygon points="50,5 61,37 95,37 67,57 78,91 50,70 22,91 33,57 5,37 39,37"/>',
luna:'<path d="M68 8A38 38 0 1 0 91 67 34 34 0 0 1 68 8Z"/>',
gota:'<path d="M50 5C38 26 17 48 17 67a33 33 0 0 0 66 0C83 48 62 26 50 5Z"/>',
rayo:'<polygon points="56,3 19,57 45,57 36,97 82,39 55,39"/>',
hoja:'<path d="M88 12C35 12 12 35 18 72c4 24 37 26 53 7C88 58 88 28 88 12Z"/><path d="M18 84 70 29" fill="none" stroke="white" stroke-width="5"/>',
ancla:'<path d="M50 9a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM50 29v59M31 48H14c0 23 16 38 36 38s36-15 36-38H69M14 48l-8 9m8-9 8 9m56-9 8 9m-8-9-8 9" fill="none" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
flor:'<path d="M50 50c-30-2-34-35-12-39 12-2 17 10 12 39Zm0 0c2-30 35-34 39-12 2 12-10 17-39 12Zm0 0c30 2 34 35 12 39-12 2-17-10-12-39Zm0 0c-2 30-35 34-39 12-2-12 10-17 39-12Z"/><circle cx="50" cy="50" r="9" fill="#fff"/>',
montana:'<path d="m5 85 29-47 16 24 14-18 31 41Z"/>',
corazon:'<path d="M50 88 13 51C-5 25 25 2 50 29 75 2 105 25 87 51Z"/>',
espiral:'<path d="M50 50c-25-27-48 7-23 26 30 23 63-15 41-45C39-7-9 33 17 76c25 40 86 20 78-23" fill="none" stroke-width="9" stroke-linecap="round"/>',
rombo:'<polygon points="50,4 91,50 50,96 9,50"/>',
campana:'<path d="M20 72h60l-8-12V43a22 22 0 0 0-44 0v17Zm22 8a8 8 0 0 0 16 0" />',
caracol:'<path d="M50 50m-38 0a38 38 0 1 0 76 0 38 38 0 1 0-76 0m0 0a26 26 0 1 0 52 0 26 26 0 1 0-52 0m0 0a14 14 0 1 0 28 0 14 14 0 1 0-28 0" fill="none" stroke-width="8"/>',
cometa:'<path d="m50 5 17 29 28 16-28 17-17 28-17-28L5 50l28-16Z"/><path d="m25 75-12 13m27-3-4 12" fill="none" stroke-width="6"/>',
corona:'<path d="m8 25 24 19 18-34 18 34 24-19-10 61H18Z"/>',
pez:'<path d="M8 50Q45 5 83 50 45 95 8 50Zm75 0 15-18v36Z"/><circle cx="38" cy="42" r="5" fill="#fff"/>',
hongo:'<path d="M9 48a41 41 0 0 1 82 0Z"/><path d="M42 48v33a9 9 0 0 0 18 0V48Z"/>',
sol:'<circle cx="50" cy="50" r="24"/><path d="M50 3v13m0 68v13M3 50h13m68 0h13M17 17l10 10m46 46 10 10m0-66L73 27M27 73 17 83" fill="none" stroke-width="8" stroke-linecap="round"/>'
};
let level='facil',cards=[],first=null,locked=false,attempts=0,seconds=0,timer=null,mismatchTimer=null,selected=0,started=false;
const fmt=n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
function bestRead(){try{return JSON.parse(localStorage.getItem('parejas-best')||'{}')}catch(_){return{}}}
function bestWrite(v){try{localStorage.setItem('parejas-best',JSON.stringify(v))}catch(_){}}
function startClock(){if(!timer)timer=setInterval(()=>{seconds++;$('timer').textContent=fmt(seconds)},1000)}
function icon(card){return '<svg viewBox="0 0 100 100" role="img" aria-label="'+card.id+'"><g fill="'+card.color+'" stroke="'+card.color+'" stroke-linejoin="round" stroke-linecap="round">'+PATHS[card.id]+'</g></svg>'}
function render(){
 const board=$('board');board.dataset.level=level;board.replaceChildren();
 cards.forEach((c,i)=>{
  const b=document.createElement('button');b.type='button';b.className='memory-card'+(c.matched?' matched':'');
  b.dataset.index=i;b.setAttribute('aria-pressed',String(c.revealed||c.matched));b.setAttribute('aria-label',(c.revealed||c.matched)?c.id:'Carta '+(i+1)+', boca abajo');
  b.setAttribute('aria-disabled',String(c.matched));b.tabIndex=i===selected?0:-1;
  b.innerHTML='<span class="card-inner"><span class="card-face card-back" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M50 12 88 50 50 88 12 50Z" fill="none" stroke="#f3efe2" stroke-width="5"/><circle cx="50" cy="50" r="18" fill="none" stroke="#f2a33a" stroke-width="5"/></svg></span><span class="card-face card-front">'+icon(c)+'</span></span>';
  board.append(b);
 });
 $('attempts').textContent=attempts;$('timer').textContent=fmt(seconds);
 $('found').textContent=cards.filter(c=>c.matched).length/2+' / '+R.SIZES[level];
}
function renderBest(){const best=bestRead();$('best').innerHTML=['facil','medio','dificil'].map((l)=>'<div><dt>'+({facil:'Fácil',medio:'Medio',dificil:'Difícil'}[l])+'</dt><dd>'+(best[l]??'—')+'</dd></div>').join('')}
function newGame(){
 if(timer)clearInterval(timer);if(mismatchTimer)clearTimeout(mismatchTimer);mismatchTimer=null;timer=null;cards=R.makeDeck(level);cards=cards.map(c=>({...c,revealed:false,matched:false}));
 first=null;locked=false;attempts=0;seconds=0;selected=0;started=false;$('overlay').hidden=true;$('message').textContent='Descubre dos cartas para encontrar una pareja.';render();
}
function finish(){
 if(!R.isWon(cards))return;clearInterval(timer);timer=null;
 const best=bestRead(),record=best[level]==null||attempts<best[level];if(record){best[level]=attempts;bestWrite(best);}
 const min=R.SIZES[level],stars=attempts<=min+2?3:attempts<=min*1.5?2:1;
 $('result').textContent='★'.repeat(stars)+'☆'.repeat(3-stars)+' · '+attempts+' intentos · '+fmt(seconds)+(record?' · Nuevo récord':'');
 $('overlay').hidden=false;renderBest();
}
function flip(index){
 if(locked||!cards[index]||cards[index].matched||cards[index].revealed)return;
 if(!started){started=true;startClock();}
 cards[index].revealed=true;
 if(first===null){first=index;$('message').textContent='Elige la segunda carta.';}
 else{
  attempts++;const a=cards[first],b=cards[index];first=null;
  if(R.isMatch(a,b)){a.matched=b.matched=true;$('message').textContent='¡Pareja encontrada!';}
  else{locked=true;$('message').textContent='No coinciden. ¡Recuerda sus dibujos!';}
 }
 render();
 if(locked){const mismatched=cards.map((c,i)=>c.revealed&&!c.matched?i:-1).filter(i=>i>=0);mismatchTimer=setTimeout(()=>{mismatched.forEach(i=>cards[i].revealed=false);locked=false;mismatchTimer=null;render();},800);}
 else finish();
}
$('board').addEventListener('click',e=>{const b=e.target.closest('.memory-card');if(b)flip(+b.dataset.index)});
$('board').addEventListener('keydown',e=>{
 const cols=level==='facil'?4:level==='medio'?5:6, total=cards.length;let next=selected;
 if(e.key==='ArrowRight')next=Math.min(total-1,selected+1);else if(e.key==='ArrowLeft')next=Math.max(0,selected-1);
 else if(e.key==='ArrowDown')next=Math.min(total-1,selected+cols);else if(e.key==='ArrowUp')next=Math.max(0,selected-cols);
 else if(e.key==='Enter'||e.key===' '){e.preventDefault();flip(selected);return;}else return;
 e.preventDefault();selected=next;render();$('board').children[selected]?.focus();
});
document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{level=b.dataset.level;document.querySelectorAll('[data-level]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));newGame()}));
$('new').addEventListener('click',newGame);$('again').addEventListener('click',newGame);
renderBest();newGame();
})();
