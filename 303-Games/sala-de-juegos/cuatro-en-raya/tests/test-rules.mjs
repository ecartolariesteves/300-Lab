import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const R=require('../rules.js');
function boardWith(moves){const b=R.createBoard();for(const [c,p] of moves)R.drop(b,c,p);return b;}
for(const moves of [
 [[0,1],[1,1],[2,1],[3,1]],
 [[0,2],[0,2],[0,2],[0,2]],
 [[0,1],[1,2],[2,1],[1,2],[2,1],[2,2],[3,1],[3,2],[3,1],[3,2],[3,1]],
 [[3,1],[2,2],[2,1],[1,2],[1,1],[0,2],[1,1],[0,2],[0,1],[0,2],[0,1],[0,2]]
]){
 const b=boardWith(moves);assert.ok(R.winningLine(b,1)||R.winningLine(b,2));
}
let win=boardWith([[0,2],[6,1],[1,2],[6,1],[2,2],[5,1]]);
assert.equal(R.chooseMove(win,2,'medio'),3);assert.equal(R.chooseMove(win,2,'dificil'),3);
let block=boardWith([[0,1],[6,2],[1,1],[6,2],[2,1]]);
assert.equal(R.chooseMove(block,2,'medio'),3);assert.equal(R.chooseMove(block,2,'dificil'),3);
const mid=boardWith([[3,1],[2,2],[4,1],[3,2],[2,1],[4,2],[1,1],[5,2],[1,1],[5,2],[0,1],[6,2]]);
const start=performance.now();const move=R.chooseMove(mid,2,'dificil');const elapsed=performance.now()-start;
assert.ok(move>=0&&move<7);assert.ok(elapsed<500,'IA difícil tardó '+elapsed.toFixed(1)+' ms');
console.log('✔ 4 en raya: victorias horizontales/verticales/diagonales, IA gana y bloquea; difícil '+elapsed.toFixed(1)+' ms');
