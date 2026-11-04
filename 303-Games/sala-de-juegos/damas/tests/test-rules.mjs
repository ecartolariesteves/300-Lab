import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const R = createRequire(import.meta.url)('../rules.js');
const empty = () => Array.from({length:8},()=>Array(8).fill(null));
const piece = (player,king=false) => ({player,king});

// Captura obligatoria y regla de la mayoría.
let b=empty();
b[5][0]=piece(1);b[4][1]=piece(2);b[2][3]=piece(2);b[4][5]=piece(2);
let moves=R.legalMoves(b,1,'espanolas');
assert.ok(moves.length>0 && moves.every(m=>m.captures.length===2));
assert.equal(moves.length,1);

// Dama voladora: puede capturar y aterrizar varias casillas después.
b=empty();b[5][0]=piece(1,true);b[3][2]=piece(2);
moves=R.legalMoves(b,1,'espanolas');
assert.ok(moves.some(m=>m.from[0]===5&&m.from[1]===0&&m.captures.length===1&&m.to[0]===2&&m.to[1]===3));

// Peón español no captura hacia atrás; brasileño sí.
b=empty();b[3][2]=piece(1);b[4][3]=piece(2);
assert.equal(R.legalMoves(b,1,'espanolas').filter(m=>m.captures.length).length,0);
assert.ok(R.legalMoves(b,1,'brasilenas').some(m=>m.captures.length===1));

// Coronación al final del turno, no durante una captura continuada.
b=empty();b[4][1]=piece(1);b[3][2]=piece(2);b[1][4]=piece(2);
moves=R.legalMoves(b,1,'espanolas');
assert.ok(moves.some(m=>m.captures.length===2&&m.to[0]===0));
const promoted=R.applyMove(b,moves.find(m=>m.captures.length===2&&m.to[0]===0));
assert.equal(promoted[0][5]?.king,true);

// Profundidad 6 en una posición de media partida sin capturas obligatorias.
b=empty();
for(const [r,c] of [[5,0],[5,4],[6,1],[6,5],[7,2],[2,1],[2,5],[1,2],[1,6],[0,3]]) b[r][c]=null;
for(const [r,c] of [[5,0],[5,4],[6,1],[6,5],[7,2]]) b[r][c]=piece(1);
for(const [r,c] of [[2,1],[2,5],[1,2],[1,6],[0,3]]) b[r][c]=piece(2);
assert.equal(R.legalMoves(b,1,'espanolas').some(m=>m.captures.length),false);
const start=performance.now();
const choice=R.chooseMove(b,1,'dificil','espanolas');
const elapsed=performance.now()-start;
assert.ok(choice && elapsed<500,'IA difícil tardó '+elapsed.toFixed(1)+' ms');
console.log('✔ Damas: captura obligatoria, mayoría, dama voladora, variantes, coronación; IA '+elapsed.toFixed(1)+' ms');
