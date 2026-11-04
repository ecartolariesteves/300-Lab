// Pruebas de las reglas de apuesta
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const B = createRequire(import.meta.url)('../betting.js');
const player = (bet, stack) => ({ bet, stack });

// Subida mínima: apuesta actual + último incremento
assert.equal(B.minRaiseTo({ currentBet: 1, lastRaiseSize: 1 }), 2, 'Apertura mínima a 2 bb');
assert.equal(B.minRaiseTo({ currentBet: 2.5, lastRaiseSize: 1.5 }), 4, 'Tras abrir a 2,5 bb, mínimo 4 bb');
assert.equal(B.minRaiseTo({ currentBet: 10, lastRaiseSize: 7.5 }), 17.5, 'Tras un 3-bet a 10 bb, mínimo 17,5 bb');
assert.equal(B.minRaiseTo({ currentBet: 0, lastRaiseSize: 0 }), 1, 'Postflop, apuesta mínima 1 bb');

// Acciones legales
let l = B.legalActions({ player: player(0, 100), currentBet: 1, lastRaiseSize: 1, street: 'preflop', raiseCount: 0 });
assert.deepEqual(l.actions, ['fold', 'limp', 'raise', 'allin'], 'Preflop sin subidas: limp en lugar de call');
l = B.legalActions({ player: player(1, 99), currentBet: 1, lastRaiseSize: 1, street: 'preflop', raiseCount: 0 });
assert.deepEqual(l.actions, ['check', 'raise', 'allin'], 'BB tras limp: check, sin fold');
l = B.legalActions({ player: player(0, 100), currentBet: 2.5, lastRaiseSize: 1.5, street: 'preflop', raiseCount: 1 });
assert.deepEqual(l.actions, ['fold', 'call', 'raise', 'allin']); assert.equal(l.minTo, 4);
l = B.legalActions({ player: player(0, 50), currentBet: 0, lastRaiseSize: 0, street: 'flop' });
assert.deepEqual(l.actions, ['check', 'bet', 'allin'], 'Postflop sin apuesta: check o bet');
l = B.legalActions({ player: player(0, 3), currentBet: 10, lastRaiseSize: 7.5, street: 'preflop', raiseCount: 2 });
assert.deepEqual(l.actions, ['fold', 'call'], 'Sin stack para subir: solo fold o call (all-in al pagar)');

// Validación
const ok = (o) => B.validateAction({ player: player(0, 100), currentBet: 2.5, lastRaiseSize: 1.5, street: 'preflop', raiseCount: 1, ...o });
assert.equal(ok({ action: 'raise', target: 3.5 }).ok, false, 'Menos de la subida mínima');
assert.equal(ok({ action: 'raise', target: 4 }).ok, true);
assert.equal(ok({ action: 'raise', target: 120 }).ok, false, 'Más que el stack');
assert.equal(ok({ action: 'check' }).ok, false, 'No se puede pasar con una apuesta pendiente');
assert.equal(B.validateAction({ action: 'allin', target: 8, player: player(0, 8), currentBet: 6, lastRaiseSize: 5, street: 'preflop', raiseCount: 2 }).ok, true, 'All-in corto por debajo del mínimo');

// Tamaños postflop
const p = B.postflopPresets({ pot: 10, currentBet: 0, heroBet: 0, minTo: 1, maxTo: 100 });
assert.deepEqual(p.map((x) => x.to), [2.5, 3.3, 5, 7.5, 10, 12.5]);
const r = B.postflopPresets({ pot: 20, currentBet: 5, heroBet: 0, minTo: 10, maxTo: 100 });
assert.deepEqual(r.map((x) => x.to), [12.5, 15, 20]);
console.log('✔ Apuestas: subida mínima, acciones legales (limp, check), validación, all-in corto y tamaños postflop');
