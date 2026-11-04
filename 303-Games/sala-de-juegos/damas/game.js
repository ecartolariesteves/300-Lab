/* Interfaz de Damas: selección legal, animación de captura y marcadores. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),R=window.DamasRules;
  let board,player=1,starter=1,selected=null,moves=[],busy=false,mode='cpu',difficulty='medio',variant='espanolas',quiet=0,stats={wins:0,losses:0,draws:0},streak=0,lastMove=null,worker=null;
  function readBest(){try{return JSON.parse(localStorage.getItem('damas-best')||'{}')}catch(_){return {}}}
  function writeBest(value){try{localStorage.setItem('damas-best',JSON.stringify(value))}catch(_){}}
  function renderBest(){const best=readBest();$('best').innerHTML=['facil','medio','dificil'].map(k=>'<div><dt>'+({facil:'Fácil',medio:'Medio',dificil:'Difícil'}[k])+'</dt><dd>'+(best[k]||0)+'</dd></div>').join('')}
  function render(){
    const root=$('board');root.replaceChildren();
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const button=document.createElement('button');button.type='button';button.className='square '+((r+c)%2?'dark':'light');
      button.dataset.row=r;button.dataset.col=c;button.setAttribute('aria-label','Fila '+(r+1)+', columna '+(c+1));
      if(selected&&selected[0]===r&&selected[1]===c)button.classList.add('selected');
      if(moves.some(m=>m.to[0]===r&&m.to[1]===c))button.classList.add('legal');
      if(lastMove&&lastMove.some(p=>p[0]===r&&p[1]===c))button.classList.add('last');
      const piece=board[r][c];
      if(piece){const disc=document.createElement('span');disc.className='piece '+(piece.player===1?'white':'black')+(piece.king?' king':'');button.append(disc);}
      root.append(button);
    }
    $('turn').textContent=player===1?'Blancas':'Negras';
    $('wins').textContent=stats.wins;$('losses').textContent=stats.losses;$('draws').textContent=stats.draws;
  }
  function newGame(){
    if(worker){worker.terminate();worker=null;}
    board=R.createBoard();player=starter;starter=3-starter;selected=null;moves=[];busy=false;quiet=0;lastMove=null;$('result').textContent='';
    $('message').textContent='Turno de '+(player===1?'blancas':'negras')+'. Selecciona una ficha.';
    render();if(mode==='cpu'&&player===2)computerTurn();
  }
  function selectSquare(r,c){
    if(busy)return;
    const piece=board[r][c];
    if(selected){
      const candidates=moves.filter(m=>m.to[0]===r&&m.to[1]===c);
      if(candidates.length){playMove(candidates[0]);return;}
    }
    if(piece&&piece.player===player){
      selected=[r,c];
      moves=R.legalMoves(board,player,variant).filter(m=>m.from[0]===r&&m.from[1]===c);
      $('message').textContent=moves.some(m=>m.captures.length)?'Captura obligatoria: elige uno de los destinos resaltados.':'Elige un destino resaltado.';
    }else{selected=null;moves=[];}
    render();
  }
  function playMove(move){
    const before=board;
    board=R.applyMove(board,move);
    lastMove=[move.from,...move.path];
    if(move.captures.length||!move.king)quiet=0;else quiet++;
    selected=null;moves=[];render();
    if(move.path.length>1){
      let step=0;
      const path=[move.from,...move.path];
      const flash=()=>{
        lastMove=[path[step],path[step+1]];
        render();step++;
        if(step<path.length-1)setTimeout(flash,180);
        else finishTurn(before,move);
      };
      setTimeout(flash,100);
    }else finishTurn(before,move);
  }
  function finishTurn(before,move){
    const winner=R.winner(board,3-player,variant);
    if(winner){endGame(winner);return;}
    if(quiet>=40){endGame(0);return;}
    player=3-player;render();
    $('message').textContent='Turno de '+(player===1?'blancas':'negras')+'.';
    if(mode==='cpu'&&player===2)computerTurn();
  }
  function endGame(winner){
    busy=false;
    if(winner===1){stats.wins++;if(mode==='cpu'){streak++;const best=readBest();best[difficulty]=Math.max(best[difficulty]||0,streak);writeBest(best);renderBest();}}
    else if(winner===2){stats.losses++;streak=0;}else{stats.draws++;streak=0;}
    $('result').textContent=winner===1?'¡Ganan las blancas!':winner===2?'¡Ganan las negras!':'Empate.';
    $('message').textContent=$('result').textContent+' Pulsa Nueva partida para volver a jugar.';
    render();
  }
  function computerTurn(){
    if(worker){worker.terminate();worker=null;}
    busy=true;$('message').textContent='El ordenador está pensando…';
    const id=Date.now();
    if(difficulty==='dificil'&&window.Worker){
      try{
        worker=new Worker('ai-worker.js');
        worker.onmessage=e=>{if(e.data.id!==id)return;const move=e.data.move;worker.terminate();worker=null;busy=false;if(move)playMove(move);};
        worker.onerror=()=>{worker.terminate();worker=null;busy=false;const move=R.chooseMove(board,2,difficulty,variant);if(move)playMove(move);};
        worker.postMessage({board,player:2,difficulty,variant,id});return;
      }catch(_){}
    }
    busy=false;const move=R.chooseMove(board,2,difficulty,variant);if(move)playMove(move);
  }
  $('board').addEventListener('click',e=>{const sq=e.target.closest('.square');if(sq)selectSquare(+sq.dataset.row,+sq.dataset.col);});
  $('board').addEventListener('keydown',e=>{
    const square=e.target.closest('.square');
    if(!square)return;
    const row=+square.dataset.row,col=+square.dataset.col;
    const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
    if(!delta)return;
    e.preventDefault();
    const nextRow=Math.max(0,Math.min(7,row+delta[0]));
    const nextCol=Math.max(0,Math.min(7,col+delta[1]));
    $('board').querySelector('[data-row="'+nextRow+'"][data-col="'+nextCol+'"]')?.focus();
  });
  $('board').addEventListener('keydown',e=>{
    const square=e.target.closest('.square');
    if(!square)return;
    const row=+square.dataset.row,col=+square.dataset.col;
    const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
    if(!delta)return;
    e.preventDefault();
    const nextRow=Math.max(0,Math.min(7,row+delta[0]));
    const nextCol=Math.max(0,Math.min(7,col+delta[1]));
    $('board').querySelector('[data-row="'+nextRow+'"][data-col="'+nextCol+'"]')?.focus();
  });
  $('new').addEventListener('click',newGame);
  $('mode').addEventListener('change',()=>{mode=$('mode').value;$('level-label').hidden=mode==='local';newGame();});
  $('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;streak=0;newGame();});
  $('variant').addEventListener('change',()=>{variant=$('variant').value;newGame();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){selected=null;moves=[];render();}
  });
  renderBest();newGame();
})();
