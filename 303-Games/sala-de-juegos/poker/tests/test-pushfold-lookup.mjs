// Pruebas de la consulta de push/fold (pushfold.js) sobre pushfold.json
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const PF = createRequire(import.meta.url)('../pushfold.js');
const data = JSON.parse(fs.readFileSync(new URL('../pushfold.json', import.meta.url), 'utf8'));

// 1. Casos concretos (las respuestas se leen del JSON, no se escriben a mano)
const btn = PF.pushSpot(data, { stackBb: 10, playersBehind: 2, hand: 'A2o' });
assert.equal(btn.table, 'BTN_10');
assert.equal(btn.correct, data.push.BTN_10.includes('A2o') ? 'allin' : 'fold');
assert.equal(btn.correct, 'allin', 'BTN con 10 bb empuja A2o');
assert.equal(PF.pushSpot(data, { stackBb: 15, playersBehind: 5, hand: '72o' }).correct, 'fold');
const bb = PF.callSpot(data, { stackBb: 10, pusherBehind: 1, callerOffset: 1, hand: 'K2o' });
assert.equal(bb.table, 'BB_vs_SB_10');
assert.equal(bb.correct, data.call.BB_vs_SB_10.includes('K2o') ? 'call' : 'fold');

// 2. Redondeo y límites
assert.ok(PF.pushSpot(data, { stackBb: 3.4, playersBehind: 2, hand: 'AA' }).unevaluated, '3,4 bb: sin evaluar');
assert.equal(PF.pushSpot(data, { stackBb: 3.6, playersBehind: 2, hand: 'AA' }).table, 'BTN_4');
assert.equal(PF.pushSpot(data, { stackBb: 15.4, playersBehind: 2, hand: 'AA' }).table, 'BTN_15');
assert.ok(PF.pushSpot(data, { stackBb: 15.6, playersBehind: 2, hand: 'AA' }).unevaluated, '15,6 bb redondea a 16: sin evaluar');

// 3. Menos jugadores: la tabla de la posición con los mismos jugadores detrás
assert.equal(PF.pushSpot(data, { stackBb: 8, playersBehind: 3, hand: 'AA' }).table, 'CO_8', '4 jugadores: el primero usa CO');
assert.equal(PF.pushSpot(data, { stackBb: 8, playersBehind: 1, hand: 'AA' }).table, 'SB_8', 'heads-up: la SB');
assert.equal(PF.callSpot(data, { stackBb: 8, pusherBehind: 3, callerOffset: 3, hand: 'AA' }).table, 'BB_vs_CO_8');
assert.equal(PF.callSpot(data, { stackBb: 8, pusherBehind: 3, callerOffset: 1, hand: 'AA' }).table, 'BTN_vs_CO_8');

// 4. Fold equity: más jugadores detrás = menos fold equity; nunca fuera de [0, 1]
const fe = (behind) => PF.foldEquity(data, { stack: 10, pusherBehind: behind });
assert.ok(fe(5) < fe(2) && fe(2) < fe(1), 'UTG tiene menos fold equity que BTN y que SB');
for (let b = 1; b <= 5; b++) assert.ok(fe(b) > 0 && fe(b) < 1);
assert.equal(PF.callRanges(data, { stack: 10, pusherBehind: 2 }).map((r) => r.pos).join(','), 'SB,BB');

// 5. Manos dudosas: cambian de decisión entre S−2 y S+2
const pos = 'BTN', stack = 10;
for (const h of Object.keys(PF.toChart(data.push.BTN_8, 'raise'))) {
  const doubtful = PF.isDoubtfulPush(data, { stack, pos, hand: h });
  assert.equal(doubtful, data.push.BTN_8.includes(h) !== data.push.BTN_12.includes(h));
}
assert.equal(PF.isDoubtfulPush(data, { stack: 10, pos: 'BTN', hand: 'AA' }), false);
assert.ok(Math.abs(PF.share(['AA', 'AKs', 'AKo']) - 22 / 1326) < 1e-12);
console.log('✔ Consulta push/fold: tablas, redondeo, posiciones con menos jugadores, fold equity y manos dudosas');
