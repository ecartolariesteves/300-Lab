/* Interfaz de Hundir la flota. La IA nunca recibe la flota del jugador. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),R=window.FlotaRules;
  const LABELS={5:'Portaaviones · 5',4:'Acorazado · 4',3:'Crucero · 3',2:'Destructor · 2'};
  let difficulty='dificil',ownFleet=[],enemyFleet=[],ownShots=R.emptyShots(),enemyShots=R.emptyShots();
  let remainingEnemy=[5,4,3,3,2],remainingOwn=[5,4,3,3,2],lastShots=0,phase='placing',selectedLength=5,vertical=false,turn='player',shotsLast=0,stats={wins:0,losses:0},worker=null;
  let manualShips=[],previewCells=[];
  function readBest(){try{return JSON.parse(localStorage.getItem('hundir-la-flota-best')||'{}')}catch(_){return {}}}
  function writeBest(value){try{localStorage.setItem('hundir-la-flota-best',JSON.stringify(value))}catch(_){}}
  function renderBest(){const best=readBest();$('best').innerHTML='<div><dt>Menos disparos</dt><dd>'+(best.shots??'—')+'</dd></div>'}
  function createGrid(id,clickable,small=false){
    const root=$(id);root.replaceChildren();
    const shots=id==='enemy-board'?ownShots:enemyShots;
    const fleet=id==='own-board'?ownFleet:enemyFleet;
    for(let r=0;r<10;r++)for(let c=0;c<10;c++){
      const b=document.createElement('button');b.type='button';b.className='cell';b.dataset.row=r;b.dataset.col=c;
      const state=shots[r][c];
      if(state===1)b.classList.add('miss');if(state===2)b.classList.add('hit');if(state===3)b.classList.add('sunk');
      if(id==='own-board'&&fleet.some(ship=>ship.cells.some(([rr,cc])=>rr===r&&cc===c)))b.classList.add('ship');
      if(id==='own-board'&&previewCells.some(([rr,cc])=>rr===r&&cc===c))b.classList.add('preview');
      b.disabled=!clickable||(id==='enemy-board'&&state!==0);
      root.append(b);
    }
  }
  function render(){
    createGrid('own-board',phase==='placing');
    createGrid('enemy-board',phase==='playing'&&turn==='player');
    $('own-count').textContent=ownFleet.length+' / 5 barcos';
    $('shots-count').textContent=shotsLast+' disparos';
    $('wins').textContent=stats.wins;
    $('losses').textContent=stats.losses;
    $('last-shots-readout').textContent=lastShots||'—';
    $('start').disabled=phase!=='placing'||ownFleet.length!==5||!R.isValidFleet(ownFleet);
    $('random').disabled=phase!=='placing';
    $('rotate').disabled=phase!=='placing';
    $('ship-picker').hidden=phase!=='placing';
  }
  function renderPicker(){
    const root=$('ship-picker');root.replaceChildren();
    const counts={};manualShips.forEach(ship=>counts[ship.length]=(counts[ship.length]||0)+1);
    for(const length of [5,4,3,2]){
      const max=length===3?2:1;
      for(let i=counts[length]||0;i<max;i++){
        const b=document.createElement('button');b.type='button';b.textContent=LABELS[length];b.setAttribute('aria-pressed',String(selectedLength===length));b.addEventListener('click',()=>{selectedLength=length;renderPicker();});root.append(b);
      }
    }
  }
  function randomPlacement(){
    ownFleet=R.placeRandom();
    manualShips=ownFleet.map(ship=>({...ship,cells:ship.cells.map(c=>c.slice())}));
    phase='placing';$('message').textContent='Flota colocada. Pulsa Empezar partida cuando estés listo.';
    renderPicker();render();
  }
  function newGame(){
    if(worker){worker.terminate();worker=null;}
    ownFleet=[];enemyFleet=[];ownShots=R.emptyShots();enemyShots=R.emptyShots();remainingEnemy=[5,4,3,3,2];remainingOwn=[5,4,3,3,2];
    phase='placing';turn='player';shotsLast=0;manualShips=[];previewCells=[];selectedLength=5;vertical=false;
    $('result').textContent='';
    $('message').textContent='Coloca tu flota. Elige un barco y una casilla.';
    renderPicker();render();
  }
  function placeManual(row,col){
    const count=manualShips.filter(s=>s.length===selectedLength).length;
    const max=selectedLength===3?2:1;
    if(count>=max){$('message').textContent='Ese barco ya está colocado.';return;}
    if(!R.validatePlacement(manualShips,selectedLength,row,col,vertical)){
      $('message').textContent='No cabe ahí o tocaría otro barco. Prueba otra casilla.';
      return;
    }
    const cells=Array.from({length:selectedLength},(_,i)=>vertical?[row+i,col]:[row,col+i]);
    manualShips.push({length:selectedLength,cells});
    ownFleet=manualShips.map(ship=>({length:ship.length,cells:ship.cells.map(c=>c.slice())}));
    const next=[5,4,3,3,2].find(length=>manualShips.filter(s=>s.length===length).length<(length===3?2:1));
    if(next)selectedLength=next;
    $('message').textContent=R.isValidFleet(ownFleet)?'Flota válida. Pulsa Empezar partida.':'Barcos colocados: '+ownFleet.length+' / 5.';
    renderPicker();render();
  }
  function startGame(){
    if(!R.isValidFleet(ownFleet)){ $('message').textContent='Completa una flota válida antes de empezar.';return;}
    enemyFleet=R.placeRandom();
    phase='playing';turn='player';$('message').textContent='Tu turno: dispara en el radar enemigo.';
    render();
  }
  function playerShot(row,col){
    if(phase!=='playing'||turn!=='player'||ownShots[row][col]!==0)return;
    const result=R.shoot(enemyFleet,ownShots,row,col);if(result.result==='invalid')return;
    ownShots=result.shots;shotsLast++;
    if(result.sunk)remainingEnemy.splice(remainingEnemy.indexOf(result.sunk),1);
    $('message').textContent=result.result==='water'?'Agua. Turno del ordenador.':result.result==='sunk'?'¡Barco hundido! Turno del ordenador.':'¡Tocado! Turno del ordenador.';
    if(result.won){endGame(true);return;}
    turn='cpu';render();setTimeout(computerShot,450);
  }
  function computerShot(){
    if(phase!=='playing')return;
    // La IA recibe exclusivamente sus disparos conocidos y los tamaños de barcos pendientes.
    const shots=enemyShots.map(row=>row.slice());
    const remaining=remainingOwn.slice();
    const seed=Math.floor(Math.random()*0xffffffff);
    const doShot=cell=>{
      if(!cell)return;
      const result=R.shoot(ownFleet,enemyShots,cell[0],cell[1]);
      enemyShots=result.shots;
      if(result.sunk)remainingOwn.splice(remainingOwn.indexOf(result.sunk),1);
      if(result.won){endGame(false);return;}
      turn='player';
      $('message').textContent='El ordenador ha disparado: '+(result.result==='water'?'agua':result.result==='sunk'?'¡barco hundido!':'¡tocado')+'. Tu turno.';
      render();
    };
    if(difficulty==='dificil'&&window.Worker){
      try{
        worker=new Worker('ai-worker.js');
        worker.onmessage=e=>{worker.terminate();worker=null;doShot(e.data.cell);};
        worker.onerror=()=>{worker.terminate();worker=null;doShot(R.chooseShot(shots,remaining,difficulty,R.seeded(seed)));};
        worker.postMessage({shots,remainingShips:remaining,difficulty,seed});return;
      }catch(_){}
    }
    doShot(R.chooseShot(shots,remaining,difficulty,R.seeded(seed)));
  }
  function endGame(won){
    phase='done';turn='done';lastShots=shotsLast;
    if(won){
      stats.wins++;
      const best=readBest();if(best.shots==null||shotsLast<best.shots){best.shots=shotsLast;writeBest(best);renderBest();}
      $('result').textContent='¡Has hundido toda la flota! Ganaste en '+shotsLast+' disparos.';
    }else{
      stats.losses++;
      $('result').textContent='Tu flota ha sido hundida. El ordenador gana.';
    }
    $('last-shots').textContent='Última partida: '+shotsLast+' disparos';
    $('message').textContent=$('result').textContent;
    render();
  }
  for(const id of ['own-board','enemy-board']){
    $(id).addEventListener('keydown',e=>{
      const cell=e.target.closest('.cell');
      if(!cell)return;
      const row=+cell.dataset.row,col=+cell.dataset.col;
      const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
      if(!delta)return;
      e.preventDefault();
      const nextRow=Math.max(0,Math.min(9,row+delta[0]));
      const nextCol=Math.max(0,Math.min(9,col+delta[1]));
      $(id).querySelector('[data-row="'+nextRow+'"][data-col="'+nextCol+'"]')?.focus();
    });
  }
  for(const id of ['own-board','enemy-board']){
    $(id).addEventListener('keydown',e=>{
      const cell=e.target.closest('.cell');
      if(!cell)return;
      const row=+cell.dataset.row,col=+cell.dataset.col;
      const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
      if(!delta)return;
      e.preventDefault();
      const nextRow=Math.max(0,Math.min(9,row+delta[0]));
      const nextCol=Math.max(0,Math.min(9,col+delta[1]));
      $(id).querySelector('[data-row="'+nextRow+'"][data-col="'+nextCol+'"]')?.focus();
    });
  }
  $('own-board').addEventListener('click',e=>{const cell=e.target.closest('.cell');if(!cell||phase!=='placing')return;placeManual(+cell.dataset.row,+cell.dataset.col);});
  $('enemy-board').addEventListener('click',e=>{const cell=e.target.closest('.cell');if(cell)playerShot(+cell.dataset.row,+cell.dataset.col);});
  $('random').addEventListener('click',randomPlacement);
  $('rotate').addEventListener('click',()=>{vertical=!vertical;$('message').textContent=vertical?'Orientación vertical.':'Orientación horizontal.';});
  $('start').addEventListener('click',startGame);
  $('new').addEventListener('click',newGame);
  $('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;});
  document.addEventListener('keydown',e=>{if(e.key==='r'||e.key==='R'){vertical=!vertical;}});
  renderBest();renderPicker();render();
})();
