/* Interfaz y marcadores de sesión de 4 en raya. */
(() => {
'use strict';
const $=id=>document.getElementById(id),R=window.CuatroRules;
let board,player=1,starter=1,mode='cpu',difficulty='medio',finished=false,busy=false,stats={wins:0,losses:0,draws:0},streak=0;
function bestRead(){try{return JSON.parse(localStorage.getItem('cuatro-en-raya-best')||'{}')}catch(_){return{}}}
function bestWrite(v){try{localStorage.setItem('cuatro-en-raya-best',JSON.stringify(v))}catch(_){}}
function render(){
 const root=$('board');root.replaceChildren();const animate=lastMove;
 for(let c=0;c<7;c++){
  const b=document.createElement('button');b.type='button';b.className='column';b.dataset.col=c;b.setAttribute('aria-label','Columna '+(c+1));b.disabled=finished||busy||board[0][c]!==0;
  for(let r=0;r<6;r++){const cell=document.createElement('span');cell.className='cell'+(board[r][c]===1?' red':board[r][c]===2?' yellow':'');if(winning?.some(([rr,cc])=>rr===r&&cc===c))cell.classList.add('winning');if(animate&&animate.row===r&&animate.col===c)cell.classList.add('drop');b.append(cell);}
  root.append(b);
 }
 lastMove=null;
 $('turn').textContent=player===1?'Rojo':'Amarillo';$('wins').textContent=stats.wins;$('losses').textContent=stats.losses;$('draws').textContent=stats.draws;
}
let winning=null,lastMove=null;
function updateBest(){const best=bestRead();$('best').innerHTML=['facil','medio','dificil'].map(k=>'<div><dt>'+({facil:'Fácil',medio:'Medio',dificil:'Difícil'}[k])+'</dt><dd>'+(best[k]||0)+'</dd></div>').join('')}
function newGame(){
 board=R.createBoard();lastMove=null;player=starter;starter=starter===1?2:1;finished=false;busy=false;winning=null;$('overlay').hidden=true;
 $('message').textContent=mode==='cpu'&&player===2?'El ordenador empieza.':'Turno de '+(player===1?'Rojo':'Amarillo')+'.';render();
 if(mode==='cpu'&&player===2)computerTurn();
}
function endGame(winner){
 finished=true;winning=winner?R.winningLine(board,winner):null;
 if(winner===1){if(mode==='cpu'){stats.wins++;streak++;}else{stats.wins++;streak++;}}
 else if(winner===2){if(mode==='cpu')stats.losses++;else stats.losses++;streak=0;}
 else{stats.draws++;streak=0;}
 if(mode==='cpu'&&winner===1){const best=bestRead();best[difficulty]=Math.max(best[difficulty]||0,streak);bestWrite(best);updateBest();}
 // El mensaje de estado también refleja el final (antes seguía diciendo "pensando…")
 $('message').textContent=winner?(mode==='cpu'?(winner===1?'¡Has ganado!':'Gana el ordenador.'):(winner===1?'Gana Rojo.':'Gana Amarillo.')):'Empate: el tablero está lleno.';
 $('result-title').textContent=winner?'¡Cuatro en raya!':'¡Empate!';
 $('result').textContent=winner?(winner===1?'Gana Rojo':'Gana Amarillo'):'El tablero está lleno.'; $('overlay').hidden=false;render();
}
function play(col){
 if(finished||busy)return;
 const row=R.drop(board,col,player);if(row<0)return;lastMove={row,col};
 const winner=R.hasWon(board,player);if(winner){endGame(player);return;}if(R.full(board)){endGame(0);return;}
 player=player===1?2:1;render();
 $('message').textContent=mode==='cpu'&&player===2?'El ordenador está pensando…':'Turno de '+(player===1?'Rojo':'Amarillo')+'.';
 if(mode==='cpu'&&player===2)computerTurn();
}
function computerTurn(){
 if(finished)return;busy=true;render();
 const id=Date.now();
 if(window.Worker){
  try{const worker=new Worker('ai-worker.js');worker.onmessage=e=>{if(e.data.id!==id)return;worker.terminate();busy=false;play(e.data.column);};worker.onerror=()=>{worker.terminate();busy=false;play(R.chooseMove(board,2,difficulty));};worker.postMessage({board,player:2,difficulty,id});return;}catch(_){}
 }
 busy=false;play(R.chooseMove(board,2,difficulty));
}
$('board').addEventListener('click',e=>{const col=e.target.closest('.column');if(col)play(+col.dataset.col)});
$('new').addEventListener('click',newGame);$('again').addEventListener('click',newGame);
$('mode').addEventListener('change',()=>{mode=$('mode').value;$('difficulty-label').hidden=mode==='local';newGame()});
$('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;newGame()});
document.addEventListener('keydown',e=>{if(/^[1-7]$/.test(e.key)&&!e.repeat){const col=+e.key-1;if(!finished&&!busy)play(col)}});
updateBest();newGame();
})();
