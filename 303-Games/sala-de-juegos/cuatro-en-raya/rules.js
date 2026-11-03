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
function chooseMove(board,player=2,difficulty='medio',random=Math.random){
 const moves=legalMoves(board);if(!moves.length)return -1;
 // La victoria inmediata siempre tiene prioridad; después se bloquea la amenaza.
 for(const col of moves){const b=board.map(row=>row.slice());drop(b,col,player);if(hasWon(b,player))return col;}
 const opp=player===1?2:1;
 for(const col of moves){const b=board.map(row=>row.slice());drop(b,col,opp);if(hasWon(b,opp))return col;}
 if(difficulty==='facil'&&random()<0.25)return moves[Math.floor(random()*moves.length)];
 const depth=difficulty==='dificil'?8:difficulty==='facil'?2:5;
 let best=-Infinity,choice=moves[0];
 for(const col of moves){const b=board.map(row=>row.slice());drop(b,col,player);const score=minimax(b,depth-1,-Infinity,Infinity,false,player);if(score>best){best=score;choice=col;}}
 return choice;
}
return{ROWS,COLS,CENTER,createBoard,legalMoves,drop,winningLine,hasWon,full,evaluate,minimax,chooseMove};
});
