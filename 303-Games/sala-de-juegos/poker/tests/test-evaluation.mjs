// Pruebas de la evaluación de decisiones preflop
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../evaluation.js');
const ranges = require('../ranges.json');

// Tabla de prueba: BB contra BTN con una mano de 3-bet al 100 % y otra de call al 100 %
const chart = { AA: { '3bet': 1 }, '76s': { call: 1 }, AJo: { call: 0.7, '3bet': 0.3 } };
const ctx = (o) => ({ chart, spot: 'Contra apertura', heroPos: 'BB', villainPos: 'BTN', raiseTo: 2.5, ...o });

assert.equal(E.evaluatePreflop(ctx({ hand: 'AA', action: 'raise', sizeTo: 10 })).score, 100, '3-bet a 10 bb (4×): 100');
assert.equal(E.evaluatePreflop(ctx({ hand: 'AA', action: 'raise', sizeTo: 7.5 })).score, 60, '3-bet a 7,5 bb (3×): demasiado pequeño, 60');
assert.equal(E.evaluatePreflop(ctx({ hand: 'AA', action: 'raise', sizeTo: 8.75 })).score, 85, '3-bet a 8,75 bb (3,5×): aceptable, 85');
assert.equal(E.evaluatePreflop(ctx({ hand: '76s', action: 'call' })).score, 100, 'Call con una mano de call al 100 %');
assert.equal(E.evaluatePreflop(ctx({ hand: '76s', action: 'raise', sizeTo: 10 })).score, 0, '3-bet con una mano de call puro: 0');
// Mixta: AJo call 70 %, 3-bet 30 % → 3-bet = 43 de acción; con tamaño perfecto sigue en 43
const mix = E.evaluatePreflop(ctx({ hand: 'AJo', action: 'raise', sizeTo: 10 }));
assert.equal(mix.actionScore, 43); assert.equal(mix.score, 43); assert.equal(mix.sizing.factor, 1);

// Nombres de las acciones: el botón envía 'raise' y la tabla usa raise / 3bet / 4bet
assert.equal(E.chartAction('raise', 'Apertura'), 'raise');
assert.equal(E.chartAction('raise', 'Contra apertura'), '3bet');
assert.equal(E.chartAction('raise', 'Contra 3-bet'), '4bet');
assert.equal(E.chartAction('allin', 'Contra 3-bet'), '4bet');

// Limp desde CO: la referencia no limpea
const limp = E.evaluatePreflop({ chart: ranges.charts.RFI_CO, hand: 'A5s', spot: 'Apertura', heroPos: 'CO', villainPos: null, action: 'limp' });
assert.equal(limp.score, 0); assert.match(limp.note, /no limpea desde CO/);

// Con los rangos reales: abrir AA desde CO a 2,5 bb es 100; a 4 bb, 60
const open = (sizeTo) => E.evaluatePreflop({ chart: ranges.charts.RFI_CO, hand: 'AA', spot: 'Apertura', heroPos: 'CO', villainPos: null, raiseTo: 1, action: 'raise', sizeTo }).score;
assert.equal(open(2.5), 100); assert.equal(open(4), 60);

// Manos dudosas: mixtas o en el borde del rango
assert.equal(E.isDoubtful(ranges.charts.RFI_UTG, 'AA', 'Apertura'), false, 'AA desde UTG no es dudosa');
assert.equal(E.isDoubtful(ranges.charts.RFI_UTG, '72o', 'Apertura'), false, '72o desde UTG no es dudosa');
assert.equal(E.isDoubtful(ranges.charts.RFI_UTG, '54o', 'Apertura'), false, '54o desde UTG no es dudosa aunque 55 juegue');
assert.equal(E.isDoubtful(ranges.charts.RFI_UTG, '32o', 'Apertura'), false, '32o desde UTG no es dudosa');
// Todas las manos dudosas de UTG: o mixtas, o en el borde con una vecina del mismo tipo
const dudosas = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) { const h = E.handAt(i, j); if (E.isDoubtful(ranges.charts.RFI_UTG, h, 'Apertura')) dudosas.push(h); }
assert.ok(dudosas.length > 5 && dudosas.length < 60, 'UTG: entre 5 y 60 manos dudosas (' + dudosas.length + ')');
assert.ok(!dudosas.some((h) => h.endsWith('o') && '5432'.includes(h[0])), 'Ninguna offsuit baja es dudosa desde UTG');

// Ayudas postflop
assert.ok(Math.abs(E.bluffBreakeven(7.5, 10) - 7.5 / 17.5) < 1e-12, 'Farol de 75 % del bote: el rival debe foldear 42,9 %');
assert.equal(E.spr(90, 6), 15);
assert.ok(Math.abs(E.potOdds(5, 15) - 0.25) < 1e-12);
console.log('✔ Evaluación: acción × tamaño, mixtas, nombres de acciones, limp, manos dudosas y ayudas postflop');
