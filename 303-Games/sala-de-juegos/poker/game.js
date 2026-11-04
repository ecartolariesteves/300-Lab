/* Mesa de Estudio: interfaz, bots y evaluación didáctica. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const POS = ['UTG','HJ','CO','BTN','SB','BB'];
const FROM_BUTTON = ['BTN','SB','BB','UTG','HJ','CO'];
const RANKS = 'AKQJT98765432';
const STORAGE_RANGES = 'poker-ranges-custom';
const STORAGE_STATS = 'poker-stats';
const STORAGE_SIZING = 'poker-sizing';
const SIZING = window.PokerSizing;
const BETTING = window.PokerBetting;
const EVALUATION = window.PokerEvaluation;
let sizingConfig = SIZING.config();
const REQUIRED = [];
for(let a=0;a<5;a++)for(let b=a+1;b<6;b++){
  REQUIRED.push('VS_OPEN_'+POS[b]+'_vs_'+POS[a]);
  REQUIRED.push('VS_3BET_'+POS[a]+'_vs_'+POS[b]);
}
for(const p of POS.slice(0,5))REQUIRED.push('RFI_'+p);
let referenceRanges = null;
let ranges = null;
let rangeSource = 'Referencia aproximada 6-max · 100 bb';
let stats = loadStats();
let game = null;
let training = null;
let feedbackMode = 'immediate';
let sessionDecisions = 0;
const fullRangeChart = (() => { const chart={}; for(let i=0;i<13;i++)for(let j=0;j<13;j++){const hand=i===j?RANKS[i]+RANKS[j]:i<j?RANKS[i]+RANKS[j]+'s':RANKS[j]+RANKS[i]+'o';chart[hand]={call:1};} return chart; })();

function safeGet(key){try{return localStorage.getItem(key);}catch(_){return null;}}
function safeSet(key,value){try{localStorage.setItem(key,value);}catch(_){/* El juego sigue aunque el navegador bloquee el almacenamiento. */}}
function loadSizingConfig(){
  try{return SIZING.config(JSON.parse(safeGet(STORAGE_SIZING)||'{}'));}catch(_){return SIZING.config();}
}
function readSizingFields(){
  const value={open:Number($('size-open').value),openSB:Number($('size-open-sb').value),threeBetIP:Number($('size-3bet-ip').value),threeBetOOP:Number($('size-3bet-oop').value),fourBet:Number($('size-4bet').value),betSmall:Number($('size-bet-small').value)/100,betLarge:Number($('size-bet-large').value)/100};
  return SIZING.config(value);
}
function renderSizingFields(){
  const ids={'size-open':'open','size-open-sb':'openSB','size-3bet-ip':'threeBetIP','size-3bet-oop':'threeBetOOP','size-4bet':'fourBet','size-bet-small':'betSmall','size-bet-large':'betLarge'};
  for(const [id,key] of Object.entries(ids))$(id).value=key.startsWith('bet')?Math.round(sizingConfig[key]*100):sizingConfig[key];
}
function saveSizing(){
  const message=$('sizing-message');
  try{sizingConfig=readSizingFields();safeSet(STORAGE_SIZING,JSON.stringify(sizingConfig));message.className='settings-message';message.textContent='Tamaños guardados y aplicados a las próximas decisiones.';}
  catch(error){message.className='settings-message error';message.textContent='No se han guardado: '+error.message;}
}
function resetSizing(){sizingConfig=SIZING.config();safeSet(STORAGE_SIZING,JSON.stringify(sizingConfig));renderSizingFields();$('sizing-message').textContent='Tamaños de referencia restaurados.';}
function loadStats(){
  try{const s=JSON.parse(safeGet(STORAGE_STATS)||'null');if(s&&Array.isArray(s.decisions)&&Array.isArray(s.hands))return s;}catch(_){}
  return {decisions:[],hands:[],result:0};
}
function saveStats(){safeSet(STORAGE_STATS,JSON.stringify(stats));}
function validateRanges(data){
  if(!data||data.version!==1||!data.charts||typeof data.charts!=='object')throw new Error('El JSON debe incluir version: 1 y charts.');
  if(Object.keys(data.charts).length!==35)throw new Error('Se necesitan exactamente 35 tablas.');
  const missing=REQUIRED.filter(k=>!data.charts[k]);
  if(missing.length)throw new Error('Faltan tablas: '+missing.slice(0,4).join(', ')+(missing.length>4?'…':''));
  for(const name of REQUIRED){
    const chart=data.charts[name];
    if(!chart||typeof chart!=='object'||Array.isArray(chart))throw new Error(name+': tabla no válida.');
    const allowed=name.startsWith('RFI_')?['raise']:name.startsWith('VS_OPEN_')?['call','3bet']:['call','4bet'];
    for(const [hand,acts] of Object.entries(chart)){
      if(!/^(AA|KK|QQ|JJ|TT|99|88|77|66|55|44|33|22|[AKQJT98765432]{2}[so])$/.test(hand))throw new Error(name+': mano no válida '+hand);
      if(!acts||typeof acts!=='object'||Array.isArray(acts))throw new Error(name+' '+hand+': acciones no válidas.');
      let sum=0;
      for(const [action,value] of Object.entries(acts)){
        if(!allowed.includes(action)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)throw new Error(name+' '+hand+': frecuencia/acción incorrecta.');
        sum+=value;
      }
      if(sum>1.0001)throw new Error(name+' '+hand+': las frecuencias superan 1.');
    }
  }
  return true;
}
async function initRanges(){
  try{
    const response=await fetch('ranges.json');if(!response.ok)throw new Error('No se pudo leer ranges.json');
    referenceRanges=await response.json();validateRanges(referenceRanges);ranges=referenceRanges;
  }catch(error){$('range-source').textContent='Error al cargar rangos';$('range-message').textContent=error.message;return;}
  try{
    const custom=JSON.parse(safeGet(STORAGE_RANGES)||'null');
    if(custom){validateRanges(custom);ranges=custom;rangeSource='Rangos propios · '+(custom.name||'sin nombre');}
  }catch(_){safeSet(STORAGE_RANGES,'');}
  $('range-source').textContent=rangeSource;
}
function positionOf(seat){return FROM_BUTTON[(seat-game.button+6)%6];}
function seatForPosition(pos){return game.players.find(p=>p.pos===pos);}
function makeCard(card){
  const el=document.createElement('span');el.className='playing-card '+('hd'.includes(card[1])?'red':'black');
  el.innerHTML='<span>'+card[0]+'</span><span class="suit">'+({s:'♠',h:'♥',d:'♦',c:'♣'}[card[1]])+'</span>';
  el.setAttribute('aria-label',card[0]+' '+({s:'picas',h:'corazones',d:'diamantes',c:'tréboles'}[card[1]]));
  return el;
}
function handKey(cards){
  const a=cards[0][0],b=cards[1][0],i=RANKS.indexOf(a),j=RANKS.indexOf(b);
  if(i===j)return a+b;
  const high=i<j?a:b,low=i<j?b:a;
  return high+low+(cards[0][1]===cards[1][1]?'s':'o');
}
function categoryOf(hand){
  if(hand.length===2)return 'pareja';
  if(hand[0]==='A'&&hand.endsWith('s'))return 'As suited';
  if('AKQJT'.includes(hand[0])&&'AKQJT'.includes(hand[1]))return 'broadways';
  if(hand.endsWith('s')&&Math.abs(RANKS.indexOf(hand[0])-RANKS.indexOf(hand[1]))<=2)return 'suited connectors';
  if(hand.endsWith('s'))return 'suited';
  return 'offsuit débil';
}
function explainHand(hand,pos){
  const cat=categoryOf(hand);
  const lines={
    'pareja':'Las parejas conservan valor por sus opciones de ligar trío; cuanto más alta, más cómoda es la continuación.',
    'As suited':'Las manos suited con As tienen bloqueador y buena jugabilidad; desde posiciones tardías se pueden abrir con más frecuencia.',
    'broadways':'Las broadways conectan bien con muchas mesas y dominan parte del rango rival cuando ligan pareja alta.',
    'suited connectors':'Los conectores suited ganan valor por su jugabilidad y posibilidades de escalera y color, sobre todo en posición.',
    'suited':'El palo común añade proyectos de color y mejora la jugabilidad postflop.',
    'offsuit débil':'Las manos offsuit débiles suelen realizar peor su equity y necesitan una razón posicional para entrar.'
  };
  return (lines[cat]||lines['offsuit débil'])+' Desde '+pos+', el rango de referencia refleja la posición relativa y las manos que quedan por actuar.';
}
function getSpotChart(pos){
  if(game.calls>0)return null;
  if(game.raiseCount===0)return pos==='BB'?null:ranges.charts['RFI_'+pos];
  if(game.raiseCount===1)return ranges.charts['VS_OPEN_'+pos+'_vs_'+game.lastRaiserPos]||null;
  if(game.raiseCount===2&&game.firstRaiserPos===pos)return ranges.charts['VS_3BET_'+game.firstRaiserPos+'_vs_'+game.lastRaiserPos]||null;
  return null;
}
function getSpotName(pos){
  if(game.calls>0)return 'Sin evaluar · spot fuera de las tablas';
  if(game.raiseCount===0)return 'Apertura';
  if(game.raiseCount===1)return 'Contra apertura';
  if(game.raiseCount===2&&game.firstRaiserPos===pos)return 'Contra 3-bet';
  return 'Sin evaluar · spot fuera de las tablas';
}
function frequencies(chart,hand,spot){
  const entry=chart&&chart[hand]||{};
  const allowed=spot==='Apertura'?['raise']:spot==='Contra apertura'?['call','3bet']:['call','4bet'];
  const out={fold:Math.max(0,1-allowed.reduce((s,a)=>s+(entry[a]||0),0))};
  for(const a of allowed)out[a]=entry[a]||0;
  return out;
}
// Los botones envían 'raise', pero en las tablas la subida se llama raise (apertura), 3bet o 4bet según el spot
function chartAction(action,spot){
  if(action!=='raise'&&action!=='allin')return action;
  return spot==='Contra apertura'?'3bet':spot==='Contra 3-bet'?'4bet':'raise';
}
function evaluatePreflop(action,chart,hand,spot){
  action=chartAction(action,spot);
  if(!chart)return {evaluated:false,score:null,verdict:'Sin evaluar · spot fuera de las tablas',freq:{fold:1}};
  const freq=frequencies(chart,hand,spot),result=EVALUATION.actionScore(action,freq);
  return {evaluated:true,score:result.score,verdict:result.verdict,freq};
}
function verdictClass(verdict){return verdict==='Correcta'?'':verdict==='Error'?'error':'warn';}
function renderRangeGrid(container,chart,cards){
  container.replaceChildren();
  const hero=cards?handKey(cards):null;
  for(let i=0;i<13;i++)for(let j=0;j<13;j++){
    const hand=i===j?RANKS[i]+RANKS[j]:i<j?RANKS[i]+RANKS[j]+'s':RANKS[j]+RANKS[i]+'o';
    const entry=chart&&chart[hand]||{},sum=Object.values(entry).reduce((a,b)=>a+b,0);
    const cell=document.createElement('span');cell.className='range-cell';
    if(sum>0){
      const acts=Object.keys(entry).filter(k=>entry[k]>0);
      if(acts.length>1)cell.classList.add('mixed');
      else if(acts[0]==='call')cell.classList.add('call');
      else if(acts[0]==='raise'||acts[0]==='3bet')cell.classList.add('raise');
      else if(acts[0]==='4bet')cell.classList.add('raise4');
    }
    if(hand===hero)cell.classList.add('hero-hand');
    cell.textContent=hand;cell.title=hand+': '+Object.entries(entry).map(([a,v])=>a+' '+Math.round(v*100)+'%').join(' · ')+(sum<1?' · fold '+Math.round((1-sum)*100)+'%':'');
    container.append(cell);
  }
}
function showPreflopFeedback(target,chart,hand,pos,spot,action){
  const result=evaluatePreflop(action,chart,hand,spot);
  if(!result.evaluated){target.hidden=false;target.className='feedback warn';target.innerHTML='<p><strong>'+result.verdict+'</strong></p><p>Esta situación no está cubierta por las tablas de referencia.</p>';return result;}
  const ref=Object.entries(result.freq).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([a,v])=>a.toUpperCase()+' '+Math.round(v*100)+'%').join(' · ')||'Fold 100%';
  target.hidden=false;target.className='feedback '+verdictClass(result.verdict);
  target.innerHTML='<p><strong>Desde '+pos+' con '+hand+' · Referencia: '+ref+' · Tu acción: '+chartAction(action,spot).toUpperCase()+' → '+result.verdict+' ('+result.score+'/100)</strong></p><p>'+explainHand(hand,pos)+'</p><p class="source">Rangos de referencia aproximados (6-max, 100 bb). No son la salida exacta de un solver.</p>';
  return result;
}
function saveDecision(d){
  sessionDecisions++;
  stats.decisions.push(d);if(stats.decisions.length>5000)stats.decisions.splice(0,stats.decisions.length-5000);saveStats();renderStats();
}
function cardSummary(cards){return cards.map(c=>c[0]+({s:'♠',h:'♥',d:'♦',c:'♣'}[c[1]])).join(' ');}
function renderSeat(p,active){
  const el=$('seat-'+p.id);el.className='seat seat-'+p.id+(p.folded?' folded':'')+(active?' active':'');
  const dealer=p.pos==='BTN'?'<span class="dealer">D</span>':'';
  const cards=p.id===0?'<span class="seat-cards">'+p.cards.map(c=>'<span class="playing-card '+('hd'.includes(c[1])?'red':'black')+'">'+c[0]+({s:'♠',h:'♥',d:'♦',c:'♣'}[c[1]])+'</span>').join('')+'</span>':p.folded?'':'<span class="seat-cards">'+(game.finished?p.cards.map(c=>'<span class="playing-card '+('hd'.includes(c[1])?'red':'black')+'">'+c[0]+({s:'♠',h:'♥',d:'♦',c:'♣'}[c[1]])+'</span>').join(''):'▧ ▧')+'</span>';
  el.innerHTML=dealer+'<strong>'+(p.id===0?'TÚ':('Rival '+p.id))+' · '+p.pos+'</strong><span>'+ (p.folded?'Fold':p.allin?'All-in':p.stack.toFixed(1)+' bb')+'</span><span>En mesa '+p.bet.toFixed(1)+' bb</span>'+cards;
}
function renderTable(activeId=null){
  if(!game)return;
  game.players.forEach(p=>renderSeat(p,p.id===activeId));
  const board=$('board');board.replaceChildren();
  if(game.board.length)game.board.forEach(c=>board.append(makeCard(c)));
  else{const empty=document.createElement('span');empty.className='board-empty';empty.textContent='Mesa';board.append(empty);}

  $('pot').textContent=game.pot.toFixed(1)+' bb';$('hand-number').textContent=game.handNo;
  $('hand-result').textContent=(game.lastResult>=0?'+':'')+game.lastResult.toFixed(1)+' bb';
}
function preflopTarget(p){
  return SIZING.preflopTarget({position:p.pos,raises:game.raiseCount,currentBet:game.currentBet,heroBet:p.bet,stack:p.stack,config:sizingConfig});
}
function addActionButton(label,action,target,primary=false){
  const b=document.createElement('button');b.type='button';b.className='action-btn'+(primary?' primary':'');b.textContent=label;
  b.addEventListener('click',()=>heroAction(action,target));$('actions').append(b);
}
function renderActions(){
  $('actions').replaceChildren();$('action-prompt').textContent='Tu decisión · '+game.players[0].pos+' · '+game.street.toUpperCase();
  const p=game.players[0],facing=game.currentBet>p.bet+0.0001;
  const legal=BETTING.legalActions({player:p,currentBet:game.currentBet,lastRaiseSize:game.lastRaiseSize,street:game.street});
  if(game.street==='preflop'){
    if(facing){
      addActionButton('Fold','fold');
      if(legal.includes('call'))addActionButton('Call '+Math.min(p.stack,game.currentBet-p.bet).toFixed(1)+' bb','call',null,true);
      if(game.raiseCount>=3){if(legal.includes('allin'))addActionButton('All-in · '+(p.stack+p.bet).toFixed(1)+' bb','allin',null,true);}
      else if(legal.includes('raise')){const t=preflopTarget(p);addActionButton((game.raiseCount===1?'3-bet ':game.raiseCount===2?'4-bet ':'Raise ')+t.toFixed(1)+' bb','raise',t,true);}
      else if(legal.includes('allin'))addActionButton('All-in · '+(p.stack+p.bet).toFixed(1)+' bb','allin',null,true);
    }else{
      if(legal.includes('check'))addActionButton('Check','check',null,true);
      else addActionButton('Fold','fold');
      if(legal.includes('raise')){const t=preflopTarget(p);addActionButton('Raise '+t.toFixed(1)+' bb','raise',t,true);}
      else if(legal.includes('allin'))addActionButton('All-in · '+(p.stack+p.bet).toFixed(1)+' bb','allin',null,true);
    }
  }else if(facing){
    addActionButton('Fold','fold');
    if(legal.includes('call'))addActionButton('Call '+Math.min(p.stack,game.currentBet-p.bet).toFixed(1)+' bb','call',null,true);
    if(legal.includes('raise')){const t=game.currentBet+(game.currentBet-p.bet)*3;addActionButton('Raise 3× · '+t.toFixed(1)+' bb','raise',t,true);}
    else if(legal.includes('allin'))addActionButton('All-in · '+(p.stack+p.bet).toFixed(1)+' bb','allin',null,true);
  }else{
    addActionButton('Check','check',null,true);
    if(legal.includes('bet')){
      const targets=SIZING.postflopTargets({pot:game.pot,heroBet:p.bet,stack:p.stack,config:sizingConfig});
      for(let i=0;i<targets.length;i++){const pct=i===0?sizingConfig.betSmall:sizingConfig.betLarge;addActionButton('Bet '+Math.round(pct*100)+'% · '+(targets[i]-p.bet).toFixed(1)+' bb','bet',targets[i],true);}
    }
    if(legal.includes('allin'))addActionButton('All-in','allin',null);
  }
}
function getPending(){
  const order=game.street==='preflop'?['UTG','HJ','CO','BTN','SB','BB']:['SB','BB','UTG','HJ','CO','BTN'];
  return order.map(pos=>seatForPosition(pos)).filter(p=>p&&!p.folded&&!p.allin&&(!game.acted.has(p.id)||p.bet+0.0001<game.currentBet));
}
function currentLive(){return game.players.filter(p=>!p.folded);}
function pay(p,amount){
  const actual=Math.max(0,Math.min(p.stack,amount));p.stack-=actual;p.bet+=actual;p.contribution+=actual;game.pot+=actual;
  if(p.stack<0.0001){p.stack=0;p.allin=true;}
}
function applyAction(p,action,target){
  const check=BETTING.validateAction({action,target,player:p,currentBet:game.currentBet,lastRaiseSize:game.lastRaiseSize,street:game.street});
  if(!check.ok){if(p.id===0)$('table-status').textContent=check.reason;return false;}
  if(action==='fold'){p.folded=true;p.lastAction='Fold';}
  else if(action==='check'){p.lastAction='Check';game.acted.add(p.id);}
  else if(action==='call'){const due=Math.max(0,game.currentBet-p.bet);pay(p,due);p.lastAction=p.allin?'Call · all-in':'Call';if(game.street==='preflop')game.calls++;game.acted.add(p.id);}
  else if(action==='raise'||action==='bet'||action==='allin'){
    const to=action==='allin'?p.bet+p.stack:target;
    const before=game.currentBet;pay(p,Math.max(0,to-p.bet));
    if(p.bet>before+0.0001){
      const raiseSize=p.bet-before,fullRaise=raiseSize+0.0001>=Math.max(game.lastRaiseSize,0.01);
      game.currentBet=p.bet;game.raiseCount++;
      if(game.raiseCount===1)game.firstRaiserPos=p.pos;
      game.lastRaiserPos=p.pos;game.lastRaiseTo=p.bet;
      if(fullRaise){game.lastRaiseSize=raiseSize;game.acted=new Set([p.id]);}
      else game.acted.add(p.id);
    }else game.acted.add(p.id);
    p.lastAction=action==='allin'?'All-in':(game.street==='preflop'?(game.raiseCount===1?'Open':game.raiseCount===2?'3-bet':game.raiseCount===3?'4-bet':'Subida'):'Bet/Raise');
  }
  if(p.id===0)game.heroActions.push({street:game.street,action,hand:handKey(p.cards)});
  return true;
}
function actionRange(chart,action){const out={};for(const [hand,actions] of Object.entries(chart||{})){if(actions[action]>0)out[hand]={[action]:actions[action]};}return out;}
function pickAction(chart,hand,spot){
  const freq=frequencies(chart,hand,spot);let n=Math.random(),acc=0;
  for(const [a,v] of Object.entries(freq)){acc+=v;if(n<=acc)return a;}
  return 'fold';
}
function botPreflop(p){
  const pos=p.pos,hand=handKey(p.cards);let chart=null,spot='';
  if(game.calls>0){
    const premium=['AA','KK','QQ','AKs'].includes(hand);
    if(premium){const chart=ranges.charts['VS_OPEN_'+pos+'_vs_'+game.lastRaiserPos]||null;p.rangeChart=actionRange(chart,'3bet');return 'raise';}
    return 'fold';
  }
  if(game.raiseCount===0){chart=ranges.charts['RFI_'+pos]||null;spot='Apertura';}
  else if(game.raiseCount===1){chart=ranges.charts['VS_OPEN_'+pos+'_vs_'+game.lastRaiserPos]||null;spot='Contra apertura';}
  else if(game.raiseCount===2&&game.firstRaiserPos===pos){chart=ranges.charts['VS_3BET_'+game.firstRaiserPos+'_vs_'+game.lastRaiserPos]||null;spot='Contra 3-bet';}
  if(!chart){if(game.raiseCount===0&&pos==='BB'&&p.bet===game.currentBet)return 'check';return 'fold';}
  const action=pickAction(chart,hand,spot);if(action!=='fold')p.rangeChart=actionRange(chart,action);
  if(action==='raise')return 'raise';
  if(action==='3bet'||action==='4bet')return 'raise';
  if(action==='call')return p.bet<game.currentBet?'call':'check';
  return 'fold';
}
function botPostflop(p){
  const hero=game.players[0],board=game.board;
  // Si ya has foldeado, los bots solo pasan hasta el showdown
  if(hero.folded)return game.currentBet>p.bet?'call':'check';
  // Los bots no ven tus cartas: calculan su equity contra el rango con el que has llegado hasta aquí
  const heroRange=PokerEngine.expandChart(game.heroRange||fullRangeChart,[...p.cards,...board]);
  const eq=PokerEngine.equity(p.cards,heroRange,board,240,game.handNo*71+p.id);
  const due=Math.max(0,game.currentBet-p.bet);
  if(due>0){
    const odds=due/(game.pot+due);
    if(eq>odds+0.04)return 'call';
    return 'fold';
  }
  if(eq>.78)return 'bet75';
  if(eq>.62)return 'bet33';
  if(eq<.18&&Math.random()<.04)return 'bet33';
  return 'check';
}
function botAction(p){
  let action,target=null;
  if(game.street==='preflop'){
    action=botPreflop(p);
    if(action==='raise'){
      target=preflopTarget(p);
      if(target>=p.bet+p.stack-0.0001)action='allin';
    }
  }else{
    action=botPostflop(p);
    if(action==='bet33'||action==='bet75'){
      const pct=action==='bet33'?sizingConfig.betSmall:sizingConfig.betLarge;
      target=Math.min(p.bet+p.stack,p.bet+Math.max(.1,game.pot*pct));
      action=target>=p.bet+p.stack-0.0001?'allin':'bet';
    }
  }
  if(!applyAction(p,action,target))applyAction(p,game.currentBet>p.bet?'fold':'check');
}
function heroChartContext(){
  const hero=game.players[0],pos=hero.pos,spot=getSpotName(pos),chart=getSpotChart(pos);
  return {pos,spot,chart,hand:handKey(hero.cards)};
}
function equityAsync(hero,range,board,iterations,seed){
  return new Promise((resolve)=>{
    if(typeof Worker==='undefined'||typeof Blob==='undefined'){resolve(PokerEngine.equity(hero,range,board,iterations,seed));return;}
    let worker,url;
    const fallback=()=>{if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);resolve(PokerEngine.equity(hero,range,board,iterations,seed));};
    try{
      const engineUrl=new URL('engine.js',location.href).href;
      const source='importScripts('+JSON.stringify(engineUrl)+');self.onmessage=(event)=>{const d=event.data;self.postMessage(PokerEngine.equity(d.hero,d.range,d.board,d.iterations,d.seed));};';
      url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      worker=new Worker(url);
      worker.onmessage=(event)=>{worker.terminate();URL.revokeObjectURL(url);resolve(event.data);};
      worker.onerror=fallback;
      worker.postMessage({hero,range,board,iterations,seed});
    }catch(_){fallback();}
  });
}
async function evaluatePostflop(action,target){
  const hero=game.players[0],opponents=game.players.filter(p=>p.id!==0&&!p.folded);
  const rangePlayer=opponents.find(p=>p.rangeChart)||opponents[0];
  const chart=rangePlayer&&rangePlayer.rangeChart||fullRangeChart;
  const dead=[...hero.cards,...game.board];
  const villainRange=PokerEngine.expandChart(chart,dead);
  const equity=await equityAsync(hero.cards,villainRange,game.board,4000,game.handNo*101+game.board.length);
  const due=Math.max(0,game.currentBet-hero.bet);
  let sizing=null;
  if(action==='bet'&&Number.isFinite(target)){
    const increment=target-hero.bet;
    const refs=[game.pot*sizingConfig.betSmall,game.pot*sizingConfig.betLarge];
    const reference=refs.sort((a,b)=>Math.abs(a-increment)-Math.abs(b-increment))[0];
    sizing=EVALUATION.sizingScore(increment,reference,{tolerance:0.35});
  }
  if(due<=0)return {equity,scored:false,sizing};
  const potOdds=due/(game.pot+due);
  if(action==='raise'||action==='allin'||action==='bet')return {equity,potOdds,scored:false,due,sizing};
  let expected='Límite';
  if(equity>potOdds+.03)expected='Call';
  else if(equity<potOdds-.03)expected='Fold';
  let score=50;
  if(expected==='Límite')score=50;
  else score=(action.toLowerCase()==='call'&&expected==='Call')||(action==='fold'&&expected==='Fold')?100:0;
  const verdict=score===100?'Correcta':score===50?'Límite':'Imprecisa';
  return {equity,potOdds,expected,score,verdict,scored:true,due,sizing};
}
function showPostFeedback(result,action){
  const box=$('feedback');box.hidden=false;
  if(!result.scored){
    box.className='feedback';box.innerHTML='<p><strong>Equity estimada: '+(result.equity*100).toFixed(1)+'%</strong></p><p>'+(result.due?'La regla de referencia puntúa call o fold; las subidas no se puntúan.':'Información orientativa: al apostar tú no se puntúa esta decisión.')+'</p>'+(result.sizing&&result.sizing.evaluated?'<p>Tamaño: '+result.sizing.verdict+' · '+result.sizing.score+'/100.</p>':'')+'<p class="source">Cálculo de equity frente a pot odds (no es GTO).</p>';return;
  }
  box.className='feedback '+(result.score===100?'':result.score===0?'error':'warn');
  box.innerHTML='<p><strong>'+result.verdict+' · '+result.score+'/100</strong></p><p>Equity: '+(result.equity*100).toFixed(1)+'% · Pot odds: '+(result.potOdds*100).toFixed(1)+'% · Necesitas pagar '+result.due.toFixed(1)+' bb.</p><p>Referencia simplificada: '+result.expected+'.</p>'+(result.sizing&&result.sizing.evaluated?'<p>Tamaño: '+result.sizing.verdict+' · '+result.sizing.score+'/100.</p>':'')+'<p class="source">Cálculo de equity frente a pot odds (no es GTO).</p>';
}
async function heroAction(action,target){
  if(!game||game.finished||game.busy)return;
  const legal=BETTING.validateAction({action,target,player:game.players[0],currentBet:game.currentBet,lastRaiseSize:game.lastRaiseSize,street:game.street});
  if(!legal.ok){$('table-status').textContent=legal.reason;return;}
  game.busy=true;$('new-hand').disabled=true;
  const hero=game.players[0];
  if(game.street==='preflop'){
    const ctx=heroChartContext();
    if(ctx.chart){
      const result=evaluatePreflop(action,ctx.chart,ctx.hand,ctx.spot);
      if(feedbackMode==='immediate')showPreflopFeedback($('feedback'),ctx.chart,ctx.hand,ctx.pos,ctx.spot,action);
      else $('feedback').hidden=true;
      const d={type:'preflop',pos:ctx.pos,spot:ctx.spot,hand:ctx.hand,category:categoryOf(ctx.hand),action:chartAction(action,ctx.spot),score:result.score,verdict:result.verdict};
      // Rango con el que los bots te ponen postflop: las manos que juegan tu acción en esta tabla
      game.heroRange=actionRange(ctx.chart,chartAction(action,ctx.spot));
      if(action==='raise'&&Number.isFinite(target)){const expected=SIZING.preflopTarget({position:hero.pos,raises:game.raiseCount,currentBet:game.currentBet,heroBet:hero.bet,stack:hero.stack,config:sizingConfig});const sized=EVALUATION.sizingScore(target,expected);d.sizingScore=sized.score;d.actionScore=result.score;}
      game.decisions.push(d);if(feedbackMode==='immediate')saveDecision(d);
      game.lastPreflop={chart:ctx.chart,hand:ctx.hand,pos:ctx.pos,spot:ctx.spot,cards:hero.cards};
      $('range-panel').hidden=feedbackMode!=='immediate';$('range-label').textContent=ctx.spot+' · '+ctx.pos;renderRangeGrid($('range-grid'),ctx.chart,hero.cards);
    }else{
      const d={type:'preflop',pos:ctx.pos,spot:ctx.spot,hand:ctx.hand,category:categoryOf(ctx.hand),action,score:null,verdict:'Sin evaluar · spot fuera de las tablas'};
      game.decisions.push(d);
      if(feedbackMode==='immediate'){$('feedback').hidden=false;$('feedback').className='feedback warn';$('feedback').textContent=d.verdict;}
      else $('feedback').hidden=true;
    }
  }else{
    $('actions').querySelectorAll('button').forEach(b=>b.disabled=true);
    $('action-prompt').textContent='Calculando equity…';
    const result=await evaluatePostflop(action,target);
    if(feedbackMode==='immediate')showPostFeedback(result,action);
    else $('feedback').hidden=true;
    if(result.scored||result.sizing?.evaluated){const d={type:'postflop',pos:hero.pos,spot:game.street,hand:handKey(hero.cards),category:categoryOf(handKey(hero.cards)),action,score:result.scored?result.score:null,actionScore:result.scored?result.score:null,sizingScore:result.sizing?.score??null,verdict:result.verdict||result.sizing.verdict};game.decisions.push(d);if(feedbackMode==='immediate')saveDecision(d);}
  }
  game.busy=false;$('new-hand').disabled=false;
  $('actions').replaceChildren();$('action-prompt').textContent='Decisión registrada · los rivales continúan…';
  applyAction(hero,action,target);
  renderTable();advance();
}
function startHand(){
  game={button:game?((game.button+1)%6):0,handNo:game?game.handNo+1:1,lastResult:0,finished:false,street:'preflop',pot:0,currentBet:1,lastRaiseSize:1,raiseCount:0,calls:0,firstRaiserPos:null,lastRaiserPos:null,lastRaiseTo:1,acted:new Set(),board:[],runout:[],players:[],decisions:[],heroActions:[],heroRange:null};
  const deal=PokerEngine.deal();
  game.players=Array.from({length:6},(_,id)=>({id,pos:FROM_BUTTON[(id-game.button+6)%6],cards:deal.hands[id],stack:100,bet:0,contribution:0,folded:false,allin:false,rangeChart:null,lastAction:''}));
  game.runout=deal.board;
  pay(seatForPosition('SB'),.5);pay(seatForPosition('BB'),1);
  game.currentBet=1;
  $('new-hand').disabled=false;$('feedback').hidden=true;$('range-panel').hidden=true;$('hand-summary').hidden=true;
  $('table-status').textContent='Preflop · botón en '+game.players[0].pos+' · ciegas 0,5/1 bb';
  renderTable();advance();
}
function finishByFold(winner){
  winner.stack+=game.pot;
  finishHand(winner.id===0?'Ganas: todos foldean.':'Pierdes: '+(winner.id===0?'':'el rival gana el bote al foldear tú.'),winner.id===0?game.pot-game.players[0].contribution:-game.players[0].contribution);
}
function showdown(){
  const live=currentLive();let best=null,winners=[];
  for(const p of live){const score=PokerEngine.evaluate7([...p.cards,...game.board]);const cmp=best?PokerEngine.compare(score,best):1;if(cmp>0){best=score;winners=[p];}else if(cmp===0)winners.push(p);}
  const share=game.pot/winners.length;winners.forEach(p=>p.stack+=share);
  const heroWin=winners.some(p=>p.id===0),hero=game.players[0];
  const net=(heroWin?share:0)-hero.contribution;
  const name=best?best.name:'showdown';
  finishHand((heroWin?'¡Ganas! ':'Gana '+(winners[0].id===0?'Tú':'Rival '+winners[0].id)+' · ')+name+'.',net);
}
function finishHand(message,net){
  game.finished=true;game.lastResult=net;stats.result+=net;
  const summary={number:game.handNo,result:net,position:game.players[0].pos,hand:cardSummary(game.players[0].cards),board:cardSummary(game.board),message,decisions:game.decisions.map(d=>d.pos+' '+d.hand+' '+d.action+' → '+(d.score==null?d.verdict:d.verdict+' '+d.score+'/100'))};
  stats.hands.unshift(summary);stats.hands=stats.hands.slice(0,200);saveStats();renderStats();
  $('table-status').textContent=message;
  $('hand-summary').hidden=false;
  $('hand-summary').textContent=message+' Resultado: '+(net>=0?'+':'')+net.toFixed(1)+' bb · Próxima mano: pulsa «Nueva mano».';
  $('actions').replaceChildren();$('action-prompt').textContent='Mano terminada.';
  if(feedbackMode==='end'&&game.decisions.length){
    const lines=game.decisions.map(d=>d.pos+' · '+d.hand+' · '+d.action+' → '+(d.score==null?d.verdict:d.verdict+' '+d.score+'/100'));
    $('feedback').hidden=false;$('feedback').className='feedback';$('feedback').innerHTML='<strong>Resumen de decisiones</strong><p>'+lines.join('</p><p>')+'</p>';
    game.decisions.forEach(saveDecision);
    if(game.lastPreflop){$('range-panel').hidden=false;$('range-label').textContent=game.lastPreflop.spot+' · '+game.lastPreflop.pos;renderRangeGrid($('range-grid'),game.lastPreflop.chart,game.lastPreflop.cards);}
  }
  renderTable();$('hand-number').textContent=game.handNo;
}
function nextStreet(){
  if(game.street==='river'){showdown();return;}
  if(game.street==='preflop'){game.street='flop';game.board=game.runout.slice(0,3);}
  else if(game.street==='flop'){game.street='turn';game.board=game.runout.slice(0,4);}
  else{game.street='river';game.board=game.runout.slice(0,5);}
  game.players.forEach(p=>p.bet=0);game.currentBet=0;game.lastRaiseSize=0;game.raiseCount=0;game.firstRaiserPos=null;game.lastRaiserPos=null;game.acted=new Set();
  $('feedback').hidden=true;$('range-panel').hidden=true;
  $('table-status').textContent=game.street.toUpperCase()+' · Bote '+game.pot.toFixed(1)+' bb';
  renderTable();advance();
}
function advance(){
  if(!game||game.finished)return;
  let guard=0;
  while(guard++<80){
    const live=currentLive();
    if(live.length===1){finishByFold(live[0]);return;}
    const pending=getPending();
    if(!pending.length){if(live.every(p=>p.allin)){if(game.street==='river')showdown();else nextStreet();return;}nextStreet();return;}
    const actor=pending[0];
    if(actor.id===0){renderTable(0);renderActions();return;}
    botAction(actor);renderTable();
  }
  $('table-status').textContent='La mano se ha detenido para evitar un bucle. Inicia otra mano.';
  $('actions').replaceChildren();
}
function startTraining(){
  const spot=$('training-spot').value,requested=$('training-position').value;
  let pos=requested==='random'?null:requested,opener=null,threeBettor=null,chart=null,label='';
  const random=(a)=>a[Math.floor(Math.random()*a.length)];
  if(spot==='rfi'){
    if(!pos)pos=random(POS.slice(0,5));if(pos==='BB'){pos='BTN';$('training-position').value=pos;}
    chart=ranges.charts['RFI_'+pos];label='Apertura · '+pos+' · nadie ha entrado';
  }else if(spot==='open'){
    if(!pos)pos=random(POS.slice(1));
    const idx=POS.indexOf(pos);if(idx===0){pos='HJ';$('training-position').value=pos;}
    const candidates=POS.slice(0,POS.indexOf(pos));opener=random(candidates);
    chart=ranges.charts['VS_OPEN_'+pos+'_vs_'+opener];label='Contra apertura · '+pos+' vs '+opener;
  }else{
    if(!pos)pos=random(POS.slice(0,5));if(pos==='BB'){pos='BTN';$('training-position').value=pos;}
    const idx=POS.indexOf(pos);threeBettor=random(POS.slice(idx+1));
    chart=ranges.charts['VS_3BET_'+pos+'_vs_'+threeBettor];label='Contra 3-bet · '+pos+' vs '+threeBettor;
  }
  const deal=PokerEngine.deal();const cards=deal.hands[0];const hand=handKey(cards);
  const trainingSpot=spot==='rfi'?'Apertura':spot==='open'?'Contra apertura':'Contra 3-bet';
  training={spot,pos,opener,threeBettor,chart,cards,hand,label,done:false};
  $('training-spot-label').textContent=label;
  $('training-cards').replaceChildren(...cards.map(makeCard));
  $('training-actions').replaceChildren();
  const options=spot==='rfi'?['fold','raise']:['fold','call',spot==='open'?'3bet':'4bet'];
  const openPosition=spot==='open'?training.opener:training.pos;
  const openSize=openPosition==='SB'?sizingConfig.openSB:sizingConfig.open;
  const threeBetPosition=spot==='open'?training.pos:training.threeBettor;
  const threeBetSize=openSize*(['SB','BB'].includes(threeBetPosition)?sizingConfig.threeBetOOP:sizingConfig.threeBetIP);
  const fourBetSize=threeBetSize*sizingConfig.fourBet;
  for(const a of options){const b=document.createElement('button');b.type='button';b.className='action-btn'+(a!=='fold'?' primary':'');b.textContent=({fold:'Fold',call:'Call',raise:training.pos==='SB'?'Raise 3 bb':'Raise 2,5 bb','3bet':'3-bet '+threeBetSize.toFixed(1)+' bb','4bet':'4-bet '+fourBetSize.toFixed(1)+' bb'})[a];b.addEventListener('click',()=>answerTraining(a));$('training-actions').append(b);}
  $('training-feedback').hidden=true;$('training-range-panel').hidden=true;$('next-training').hidden=true;
}
function answerTraining(action){
  if(!training||training.done)return;training.done=true;
  const result=evaluatePreflop(action,training.chart,training.hand,training.spot==='rfi'?'Apertura':training.spot==='open'?'Contra apertura':'Contra 3-bet');
  const box=$('training-feedback');box.hidden=false;
  const ref=Object.entries(result.freq).filter(([,v])=>v>0).map(([a,v])=>a.toUpperCase()+' '+Math.round(v*100)+'%').join(' · ');
  box.className='feedback '+verdictClass(result.verdict);
  box.innerHTML='<p><strong>'+training.pos+' con '+training.hand+' · Referencia: '+(ref||'Fold 100%')+' · Tu acción: '+action.toUpperCase()+' → '+result.verdict+' ('+(result.score??0)+'/100)</strong></p><p>'+explainHand(training.hand,training.pos)+'</p><p class="source">Rangos de referencia aproximados (6-max, 100 bb). No son la salida exacta de un solver.</p>';
  renderRangeGrid($('training-range-grid'),training.chart,training.cards);
  $('training-range-label').textContent=training.label;$('training-range-panel').hidden=false;
  $('training-actions').replaceChildren();$('next-training').hidden=false;
  saveDecision({type:'preflop',pos:training.pos,spot:training.spot==='rfi'?'Apertura':training.spot==='open'?'Contra apertura':'Contra 3-bet',hand:training.hand,category:categoryOf(training.hand),action,score:result.score,verdict:result.verdict});
}
function avg(items){return items.length?items.reduce((s,x)=>s+x.score,0)/items.length:null;}
function tableRows(el,rows){
  if(!rows.length){el.innerHTML='<p class="muted">Aún no hay datos suficientes.</p>';return;}
  el.innerHTML='<table class="stats-table"><tbody>'+rows.map(([a,b])=>'<tr><td>'+a+'</td><td>'+b+'</td></tr>').join('')+'</tbody></table>';
}
function renderStats(){
  const pre=stats.decisions.filter(d=>d.type==='preflop'&&d.score!=null),post=stats.decisions.filter(d=>d.type==='postflop'&&d.score!=null);
  $('stat-decisions').textContent=stats.decisions.length;$('stat-session').textContent=sessionDecisions;
  $('stat-pre').textContent=avg(pre)==null?'—':avg(pre).toFixed(1)+'/100';
  $('stat-post').textContent=avg(post)==null?'—':avg(post).toFixed(1)+'/100';
  const sizing=stats.decisions.filter(d=>d.sizingScore!=null).map(d=>({score:d.sizingScore}));
  $('stat-sizing').textContent=avg(sizing)==null?'—':avg(sizing).toFixed(1)+'/100';
  $('stat-result').textContent=(stats.result>=0?'+':'')+stats.result.toFixed(1)+' bb';
  const byPos=POS.map(p=>[p,avg(pre.filter(d=>d.pos===p))]).filter(x=>x[1]!=null).map(([p,v])=>[p,v.toFixed(1)+'/100']);
  const bySpot=['Apertura','Contra apertura','Contra 3-bet'].map(s=>[s,avg(pre.filter(d=>d.spot===s||d.spot===s.toLowerCase()))]).filter(x=>x[1]!=null).map(([s,v])=>[s,v.toFixed(1)+'/100']);
  tableRows($('stats-position'),byPos);tableRows($('stats-spot'),bySpot);
  const groups=new Map();
  for(const d of pre){const k=d.pos+' · '+d.spot+' · '+d.category;const g=groups.get(k)||[];g.push(d);groups.set(k,g);}
  const leaks=[...groups.entries()].filter(([,g])=>g.length>=5).map(([k,g])=>[k,avg(g),g.length]).sort((a,b)=>a[1]-b[1]).slice(0,5);
  $('stats-leaks').innerHTML=leaks.length?'<table class="stats-table"><tbody>'+leaks.map(([k,v,n])=>'<tr><td>'+k+' ('+n+')</td><td>'+v.toFixed(1)+'/100</td></tr>').join('')+'</tbody></table>':'<p class="muted">Necesitas al menos cinco decisiones del mismo tipo para detectar una fuga.</p>';
  $('stats-history').innerHTML=stats.hands.length?stats.hands.map(h=>'<li>Mano '+h.number+' · '+h.position+' · '+h.hand+' · '+h.message+' ('+(h.result>=0?'+':'')+h.result.toFixed(1)+' bb)'+(h.decisions&&h.decisions.length?'<br><span class="muted">'+h.decisions.join(' · ')+'</span>':'')+'</li>').join(''):'<li>Aún no has terminado ninguna mano.</li>';
}
function setTab(name){
  document.querySelectorAll('.tab').forEach(b=>{const on=b.dataset.tab===name;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
  document.querySelectorAll('.view').forEach(v=>{const on=v.id==='view-'+name;v.hidden=!on;v.classList.toggle('active',on);});
}
function importRanges(){
  const msg=$('range-message');try{const data=JSON.parse($('range-json').value);validateRanges(data);safeSet(STORAGE_RANGES,JSON.stringify(data));ranges=data;rangeSource='Rangos propios · '+(data.name||'sin nombre');$('range-source').textContent=rangeSource;msg.className='settings-message';msg.textContent='Rangos validados e importados. Se usarán en las próximas decisiones.';}
  catch(e){msg.className='settings-message error';msg.textContent='No se han importado: '+e.message;}
}
function restoreRanges(){safeSet(STORAGE_RANGES,'');ranges=referenceRanges;rangeSource='Referencia aproximada 6-max · 100 bb';$('range-source').textContent=rangeSource;$('range-message').textContent='Rangos de referencia restaurados.';}
function bind(){
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('new-hand').addEventListener('click',startHand);
  $('deal-training').addEventListener('click',startTraining);
  $('next-training').addEventListener('click',startTraining);
  $('import-ranges').addEventListener('click',importRanges);
  $('restore-ranges').addEventListener('click',restoreRanges);
  $('range-file').addEventListener('change',async e=>{const f=e.target.files[0];if(f)$('range-json').value=await f.text();});
  $('feedback-mode').addEventListener('change',e=>{feedbackMode=e.target.value;});
  $('save-sizing').addEventListener('click',saveSizing);
  $('reset-sizing').addEventListener('click',resetSizing);
  // Confirmación en dos pasos dentro de la página (sin confirm(), que algunos navegadores bloquean)
  let clearArmed=null;
  $('clear-stats').addEventListener('click',()=>{
    const b=$('clear-stats');
    if(!clearArmed){b.dataset.label=b.textContent;b.textContent='Pulsa otra vez para borrarlo todo';clearArmed=setTimeout(()=>{b.textContent=b.dataset.label;clearArmed=null;},4000);return;}
    clearTimeout(clearArmed);clearArmed=null;b.textContent=b.dataset.label;
    stats={decisions:[],hands:[],result:0};saveStats();renderStats();
  });
  document.addEventListener('keydown',e=>{
    if(e.target.matches('input,textarea,select'))return;
    const key=e.key.toLowerCase();
    if(key==='f')$('actions').querySelector('[data-action="fold"]')?.click();
    if(key==='c')$('actions').querySelector('[data-action="call"],[data-action="check"]')?.click();
    if(key==='r')$('actions').querySelector('[data-action="raise"],[data-action="bet"]')?.click();
    if(key==='1')$('actions').querySelector('[data-action="bet"]')?.click();
    if(key==='2')$('actions').querySelectorAll('[data-action="bet"]')[1]?.click();
    if(key==='3')$('actions').querySelector('[data-action="allin"]')?.click();
  });
}
addActionButton=function(label,action,target,primary=false){const b=document.createElement('button');b.type='button';b.className='action-btn'+(primary?' primary':'');b.textContent=label;b.dataset.action=action;b.addEventListener('click',()=>heroAction(action,target));$('actions').append(b);};
async function boot(){
  sizingConfig=loadSizingConfig();renderSizingFields();bind();await initRanges();renderStats();if(ranges){startHand();startTraining();}
}
boot();
})();