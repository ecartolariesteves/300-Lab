/* Reglas y búsqueda minimax de 4 en raya; solo consulta el tablero visible. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.CuatroRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const ROWS=6,COLS=7,CENTER=[3,2,4,1,5,0,6];
const createBoard=()=>Array.from({length:ROWS},()=>Array(COLS).fill(0));
function legalMoves(board){return CENTER.filter(c=>board[0][c]===0);}
function drop(board,col,player){if(!Number.isInteger(col)||col<0||col>=COLS||board[0][col]!==0)return -1;for(let r=ROWS-1;r>=0;r--)if(!board[r][col]){board[r][col]=player;return r;}return -1;}
function winningLine(board,player){
 for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c]===player){
  for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
   const cells=[];for(let k=0;k<4;k++){const rr=r+dr*k,cc=c+dc*k;if(rr<0||rr>=ROWS||cc<0||cc>=COLS||board[rr][cc]!==player)break;cells.push([rr,cc]);}
   if(cells.length===4)return cells;
  }
 }
 return null;
}
const hasWon=(board,p)=>!!winningLine(board,p);
const full=board=>board[0].every(Boolean);
function evaluate(board,player){
 const opp=player===1?2:1;let score=0;
 for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c]===player)score+=(3-Math.abs(3-c))*4;
 const windows=[];
 for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
  if(c<=COLS-4)windows.push([[r,c],[r,c+1],[r,c+2],[r,c+3]]);
  if(r<=ROWS-4)windows.push([[r,c],[r+1,c],[r+2,c],[r+3,c]]);
  if(r<=ROWS-4&&c<=COLS-4)windows.push([[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]]);
  if(r<=ROWS-4&&c>=3)windows.push([[r,c],[r+1,c-1],[r+2,c-2],[r+3,c-3]]);
 }
 for(const w of windows){let mine=0,theirs=0,empty=0;for(const [r,c] of w){if(board[r][c]===player)mine++;else if(board[r][c]===opp)theirs++;else empty++;}
  if(mine===4)score+=100000;else if(mine===3&&empty===1)score+=120;else if(mine===2&&empty===2)score+=12;
  if(theirs===3&&empty===1)score-=150;else if(theirs===2&&empty===2)score-=10;
 }
 return score;
}
function terminalScore(board,player,depth){if(hasWon(board,player))return 100000+depth;if(hasWon(board,player===1?2:1))return -100000-depth;return 0;}
function minimax(board,depth,alpha,beta,maximizing,player){
 const opp=player===1?2:1;
 if(hasWon(board,player))return 100000+depth;
 if(hasWon(board,opp))return -100000-depth;
 if(depth===0||full(board))return evaluate(board,player);
 const moves=legalMoves(board);
 if(maximizing){let best=-Infinity;for(const col of moves){const b=board.map(row=>row.slice());drop(b,col,player);best=Math.max(best,minimax(b,depth-1,alpha,beta,false,player));alpha=Math.max(alpha,best);if(beta<=alpha)break;}return best;}
 let best=Infinity;for(const col of moves){const b=board.map(row=>row.slice());drop(b,col,opp);best=Math.min(best,minimax(b,depth-1,alpha,beta,true,player));beta=Math.min(beta,best);if(beta<=alpha)break;}return best;
}
/* ---------- Búsqueda rápida para la IA ----------
   El tablero se copia a un array plano de 42 casillas y se juega/deshace en el sitio.
   Solo se comprueba la victoria alrededor de la última ficha (no todo el tablero),
   así el modo Difícil (profundidad 8) responde en pocos cientos de milisegundos. */
const WIN=1000000;
const WINDOWS=(()=>{const out=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
  if(c<=COLS-4)out.push([0,1,2,3].map(k=>r*COLS+c+k));
  if(r<=ROWS-4)out.push([0,1,2,3].map(k=>(r+k)*COLS+c));
  if(r<=ROWS-4&&c<=COLS-4)out.push([0,1,2,3].map(k=>(r+k)*COLS+c+k));
  if(r<=ROWS-4&&c>=3)out.push([0,1,2,3].map(k=>(r+k)*COLS+c-k));}return out;})();
// ¿La ficha recién puesta en idx forma 4 en raya?
function winsAt(cells,idx,p){
  const r0=Math.floor(idx/COLS),c0=idx%COLS;
  for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
    let n=1;
    for(const s of [1,-1]){let r=r0+dr*s,c=c0+dc*s;while(r>=0&&r<ROWS&&c>=0&&c<COLS&&cells[r*COLS+c]===p){n++;r+=dr*s;c+=dc*s;}}
    if(n>=4)return true;
  }
  return false;
}
// Misma evaluación que evaluate(): centro + ventanas de 4 casillas
function evaluateFlat(cells,player){
  const opp=3-player;let score=0;
  for(let i=0;i<cells.length;i++)if(cells[i]===player)score+=(3-Math.abs(3-i%COLS))*4;
  for(const w of WINDOWS){let mine=0,theirs=0;for(const i of w){if(cells[i]===player)mine++;else if(cells[i]===opp)theirs++;}
    const empty=4-mine-theirs;
    if(mine===3&&empty===1)score+=120;else if(mine===2&&empty===2)score+=12;
    if(theirs===3&&empty===1)score-=150;else if(theirs===2&&empty===2)score-=10;}
  return score;
}
// Negamax con poda alfa-beta: la puntuación siempre es desde el punto de vista de quien mueve
function negamax(cells,heights,depth,alpha,beta,side){
  let any=false;
  if(depth===0)return evaluateFlat(cells,side);
  for(const c of CENTER){
    const r=heights[c];if(r<0)continue;any=true;
    const idx=r*COLS+c;cells[idx]=side;heights[c]--;
    let v;
    if(winsAt(cells,idx,side))v=WIN+depth;              // ganar antes vale más
    else v=-negamax(cells,heights,depth-1,-beta,-alpha,3-side);
    cells[idx]=0;heights[c]++;
    if(v>alpha)alpha=v;
    if(alpha>=beta)break;
  }
  return any?alpha:0;                                    // tablero lleno: empate
}
function chooseMove(board,player=2,difficulty='medio',random=Math.random){
 const moves=legalMoves(board);if(!moves.length)return -1;
 // La victoria inmediata siempre tiene prioridad; después se bloquea la amenaza.
 for(const col of moves){const b=board.map(row=>row.slice());drop(b,col,player);if(hasWon(b,player))return col;}
 const opp=player===1?2:1;
 for(const col of moves){const b=board.map(row=>row.slice());drop(b,col,opp);if(hasWon(b,opp))return col;}
 if(difficulty==='facil'&&random()<0.25)return moves[Math.floor(random()*moves.length)];
 const depth=difficulty==='dificil'?8:difficulty==='facil'?2:5;
 const cells=new Int8Array(ROWS*COLS),heights=new Int8Array(COLS).fill(-1);
 for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){cells[r*COLS+c]=board[r][c];if(board[r][c]===0)heights[c]=r;}
 let best=-Infinity,choice=moves[0],alpha=-Infinity;
 for(const col of moves){
  const r=heights[col],idx=r*COLS+col;cells[idx]=player;heights[col]--;
  const score=-negamax(cells,heights,depth-1,-Infinity,-alpha,opp);
  cells[idx]=0;heights[col]++;
  if(score>best){best=score;choice=col;}
  if(score>alpha)alpha=score;
 }
 return choice;
}
return{ROWS,COLS,CENTER,createBoard,legalMoves,drop,winningLine,hasWon,full,evaluate,minimax,chooseMove};
});
