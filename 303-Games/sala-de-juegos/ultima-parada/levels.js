// Prototipo: generador + solucionador de "Última Parada"
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|a)^t;return((t^t>>>14)>>>0)/4294967296}}
const DIRS={N:[-1,0],S:[1,0],E:[0,1],W:[0,-1]};
const CAP=3;

function cellsOf(b){const out=[];for(let k=0;k<b.len;k++)out.push(b.horiz?[b.r,b.c+k]:[b.r+k,b.c]);return out;}
function front(b){const cs=cellsOf(b);return (b.dir==='N'||b.dir==='W')?cs[0]:cs[cs.length-1];}
// ¿Puede salir? Todas las casillas desde su frente hasta el borde, libres
function canExit(b,occ,W,H){const [dr,dc]=DIRS[b.dir];let [r,c]=front(b);r+=dr;c+=dc;
  while(r>=0&&r<H&&c>=0&&c<W){if(occ[r*W+c]!==-1)return false;r+=dr;c+=dc;}return true;}

function genLayout(rnd,W,H,nBuses,colors){
  const occ=new Array(W*H).fill(-1),buses=[];
  let tries=0;
  while(buses.length<nBuses&&tries++<2000){
    const horiz=rnd()<0.5,len=rnd()<0.6?2:3;
    const r=Math.floor(rnd()*(horiz?H:H-len+1)),c=Math.floor(rnd()*(horiz?W-len+1:W));
    const b={r,c,horiz,len,dir:horiz?(rnd()<0.5?'E':'W'):(rnd()<0.5?'N':'S'),color:0};
    if(cellsOf(b).some(([y,x])=>occ[y*W+x]!==-1))continue;
    const id=buses.length;buses.push(b);cellsOf(b).forEach(([y,x])=>occ[y*W+x]=id);
  }
  // Colores repartidos de forma equilibrada
  const cols=[];for(let i=0;i<buses.length;i++)cols.push(i%colors);
  for(let i=cols.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[cols[i],cols[j]]=[cols[j],cols[i]];}
  buses.forEach((b,i)=>b.color=cols[i]);
  return {buses,occ};
}

// Orden de salida al azar (sacar un bus nunca bloquea a otro: si este falla, el tablero está bloqueado)
function randomExitOrder(rnd,buses,W,H){
  const occ=new Array(W*H).fill(-1);buses.forEach((b,i)=>cellsOf(b).forEach(([y,x])=>occ[y*W+x]=i));
  const left=new Set(buses.map((_,i)=>i)),order=[];
  while(left.size){const ex=[...left].filter(i=>canExit(buses[i],occ,W,H));if(!ex.length)return null;
    const i=ex[Math.floor(rnd()*ex.length)];order.push(i);left.delete(i);cellsOf(buses[i]).forEach(([y,x])=>occ[y*W+x]=-1);}
  return order;
}

// Cola: pasajeros en el orden de salida, luego mezclados dentro de una ventana
function buildQueue(rnd,buses,order,mix){
  const q=[];order.forEach(i=>{for(let k=0;k<CAP;k++)q.push(buses[i].color);});
  for(let i=0;i<q.length;i++){const j=Math.min(q.length-1,i+Math.floor(rnd()*(mix+1)));[q[i],q[j]]=[q[j],q[i]];}
  return q;
}

// Simulación de la parada: estado = {gone(mask), qi, bays:[{color,filled}]}
function board(state,queue){ // embarque automático
  let changed=true;
  while(changed&&state.qi<queue.length){changed=false;const col=queue[state.qi];
    const bay=state.bays.find(b=>b.color===col&&b.filled<CAP);
    if(bay){bay.filled++;state.qi++;changed=true;}
    state.bays=state.bays.filter(b=>b.filled<CAP);}
}
function solve(lv,limit=200000){
  const {buses,W,H,queue,bays}=lv;const n=buses.length;const seen=new Set();let explored=0;
  function key(s){return s.gone+'|'+s.qi+'|'+s.bays.map(b=>b.color+':'+b.filled).sort().join(',');}
  function dfs(s){
    if(s.qi===queue.length)return true;
    if(++explored>limit)return false;
    const k=key(s);if(seen.has(k))return false;seen.add(k);
    if(s.bays.length>=bays)return false;           // parada llena y nadie embarca: atasco
    const occ=new Array(W*H).fill(-1);
    buses.forEach((b,i)=>{if(!(s.gone&(1<<i)))cellsOf(b).forEach(([y,x])=>occ[y*W+x]=i);});
    for(let i=0;i<n;i++){
      if(s.gone&(1<<i)||!canExit(buses[i],occ,W,H))continue;
      const t={gone:s.gone|(1<<i),qi:s.qi,bays:s.bays.map(b=>({...b})).concat([{color:buses[i].color,filled:0}])};
      board(t,queue);
      if(dfs(t))return true;
    }
    return false;
  }
  const ok=dfs({gone:0,qi:0,bays:[]});return {ok,explored};
}
// Dificultad: % de partidas al azar (eligiendo cualquier bus que pueda salir) que acaban en atasco
function difficulty(lv,rnd,trials=200){
  let fails=0;
  for(let t=0;t<trials;t++){
    const s={gone:0,qi:0,bays:[]};let stuck=false;
    while(s.qi<lv.queue.length){
      if(s.bays.length>=lv.bays){stuck=true;break;}
      const occ=new Array(lv.W*lv.H).fill(-1);
      lv.buses.forEach((b,i)=>{if(!(s.gone&(1<<i)))cellsOf(b).forEach(([y,x])=>occ[y*lv.W+x]=i);});
      const ex=lv.buses.map((b,i)=>i).filter(i=>!(s.gone&(1<<i))&&canExit(lv.buses[i],occ,lv.W,lv.H));
      if(!ex.length){stuck=true;break;}
      const i=ex[Math.floor(rnd()*ex.length)];s.gone|=1<<i;s.bays.push({color:lv.buses[i].color,filled:0});board(s,lv.queue);
    }
    if(stuck)fails++;
  }
  return fails/trials;
}
function params(level,relax=0){ // la dificultad crece con el nivel y se estabiliza en el 100
  const t=Math.min(1,(level-1)/99);
  return {W:6+Math.round(t*2),H:7+Math.round(t*2),nBuses:Math.round(6+t*8)-relax,
          colors:Math.min(5,3+Math.floor(level/25)),bays:(level<10?5:4)+(relax>0?1:0),mix:Math.max(1,Math.round(2+t*3)-relax)};
}
const targetDifficulty=(level)=>Math.min(0.7,0.05+level*0.0065); // nivel 1 ~ 5 %, nivel 100 ~ 70 %
function generateLevel(level){
  const target=targetDifficulty(level);let best=null;
  for(let relax=0;relax<=2&&!best;relax++){   // plan B: si no sale ninguno, relajamos los parámetros
  const p=params(level,relax);
  for(let attempt=0;attempt<60;attempt++){
    const rnd=mulberry32(level*1000+attempt*7+relax*100003);
    const {buses}=genLayout(rnd,p.W,p.H,p.nBuses,p.colors);
    if(buses.length<p.nBuses)continue;
    const order=randomExitOrder(rnd,buses,p.W,p.H);if(!order)continue;
    const queue=buildQueue(rnd,buses,order,p.mix);
    const lv={W:p.W,H:p.H,buses,queue,bays:p.bays};
    const {ok,explored}=solve(lv);if(!ok)continue;
    const d=difficulty(lv,mulberry32(level));
    const cand={...lv,attempt,explored,difficulty:d,gap:Math.abs(d-target)};
    if(!best||cand.gap<best.gap)best=cand;
    if(cand.gap<=0.08)break;
  }
  }
  return best;
}

// En el navegador: window.Levels; en Node (pruebas): module.exports
const Levels = { generateLevel, solve, canExit, cellsOf, board, CAP };
if (typeof module !== 'undefined') module.exports = Levels; else window.Levels = Levels;
