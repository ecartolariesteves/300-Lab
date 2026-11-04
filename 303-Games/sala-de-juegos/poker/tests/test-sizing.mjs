// Pruebas de los tamaños de referencia preflop
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Z = createRequire(import.meta.url)('../sizing.js');
const eq = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

// Posición postflop
assert.equal(Z.inPosition('BTN', 'BB'), true, 'BTN tiene posición sobre la BB');
assert.equal(Z.inPosition('BB', 'SB'), true, 'La BB tiene posición sobre la SB');
assert.equal(Z.inPosition('SB', 'BTN'), false, 'La SB no tiene posición sobre el BTN');
assert.equal(Z.inPosition('BB', 'BTN'), false, 'La BB no tiene posición sobre el BTN');

// Aperturas
eq(Z.reference('open', 'CO').ref, 2.5, 'Apertura CO'); eq(Z.reference('open', 'SB').ref, 3, 'Apertura SB');
assert.equal(Z.sizingFactor('open', 'UTG', null, 1, 2.5).factor, 1);
assert.equal(Z.sizingFactor('open', 'UTG', null, 1, 2).factor, 0.85, '2 bb desde UTG es aceptable');
assert.equal(Z.sizingFactor('open', 'UTG', null, 1, 4).factor, 0.6, '4 bb desde UTG es demasiado');

// 3-bets: en posición 3×, sin posición 4×, BB contra SB 3×
eq(Z.reference('3bet', 'BTN', 'CO', 2.5).ref, 7.5, 'BTN contra CO: 7,5 bb');
eq(Z.reference('3bet', 'SB', 'BTN', 2.5).ref, 10, 'SB contra BTN: 10 bb');
eq(Z.reference('3bet', 'BB', 'BTN', 2.5).ref, 10, 'BB contra BTN: 10 bb');
eq(Z.reference('3bet', 'BB', 'SB', 3).ref, 9, 'BB contra SB: 9 bb (3× de 3 bb)');
assert.equal(Z.sizingFactor('3bet', 'BB', 'BTN', 2.5, 7.5).verdict, 'Tamaño demasiado pequeño', 'BB 3× contra BTN es pequeño');
assert.equal(Z.sizingFactor('3bet', 'BB', 'BTN', 2.5, 8.75).factor, 0.85, 'BB 3,5× contra BTN es aceptable');

// 4-bets
eq(Z.reference('4bet', 'BTN', 'SB', 10).ref, 22, 'BTN 4-bet contra 3-bet de la SB: 22 bb');
eq(Z.reference('4bet', 'CO', 'BTN', 7.5).ref, 18.75, 'CO 4-bet contra BTN (sin posición): 2,5×');
assert.equal(Z.sizingFactor('4bet', 'BTN', 'SB', 10, 100).factor, 0.6, 'All-in de 100 bb como 4-bet: demasiado grande');

// Nota combinada
assert.equal(Z.combinedScore(100, 0.85), 85); assert.equal(Z.combinedScore(43, 0.6), 26);

// Botones
assert.deepEqual(Z.presets('open', 'CO'), [2, 2.5, 3]);
assert.deepEqual(Z.presets('open', 'SB'), [2.5, 3, 3.5]);
assert.deepEqual(Z.presets('3bet', 'BB', 'BTN', 2.5), [6.3, 7.5, 8.8, 10, 11.3]);
assert.deepEqual(Z.presets('4bet', 'BTN', 'SB', 10, 100), [22, 25, 100]);
console.log('✔ Tamaños preflop: referencias, bandas, posición, nota combinada y botones');
