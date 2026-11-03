import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const R=require('../rules.js');
function boardWith(moves){const b=R.createBoard();for(const [c,p] of moves)R.drop(b,c,p);return b;}
function boardWithCells(cells){const b=R.createBoard();for(const [r,c,p] of cells)b[r][c]=p;return b;}
for(const cells of [
 [[5,0,1],[5,1,1],[5,2,1],[5,3,1]],
 [[2,4,2],[3,4,2],[4,4,2],[5,4,2]],
 [[2,0,1],[3,1,1],[4,2,1],[5,3,1]],
 [[2,6,2],[3,5,2],[4,4,2],[5,3,2]]
]){
 const b=boardWithCells(cells);assert.ok(R.winningLine(b,1)||R.winningLine(b,2));
}
let win=boardWith([[0,2],[6,1],[1,2],[6,1],[2,2],[5,1]]);
assert.equal(R.chooseMove(win,2,'medio'),3);assert.equal(R.chooseMove(win,2,'dificil'),3);
let block=boardWith([[0,1],[6,2],[1,1],[6,2],[2,1]]);
assert.equal(R.chooseMove(block,2,'medio'),3);assert.equal(R.chooseMove(block,2,'dificil'),3);
// Posición de media partida SIN victorias ni bloqueos inmediatos: obliga a buscar de verdad a profundidad 8
const mid=boardWith([[3,1],[3,2],[2,1],[4,2],[4,1],[2,2],[3,1],[5,2]]);
for(const c of R.legalMoves(mid))for(const p of [1,2]){const b=mid.map(r=>r.slice());R.drop(b,c,p);assert.ok(!R.hasWon(b,p),'La posición de rendimiento no debe tener jugadas inmediatas');}
const start=performance.now();const move=R.chooseMove(mid,2,'dificil');const elapsed=performance.now()-start;
assert.ok(move>=0&&move<7);assert.ok(elapsed<500,'IA difícil tardó '+elapsed.toFixed(1)+' ms');
console.log('✔ 4 en raya: victorias horizontales/verticales/diagonales, IA gana y bloquea; difícil '+elapsed.toFixed(1)+' ms');
