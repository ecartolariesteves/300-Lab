// Pruebas del entrenador: explicaciones preflop y lectura de la mano postflop
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../coach.js');
const E = require('../evaluation.js');
const ranges = require('../ranges.json');

// Combinaciones y tamaño de rango
assert.equal(C.combos('AA'), 6); assert.equal(C.combos('AKs'), 4); assert.equal(C.combos('AKo'), 12);
const all = Object.fromEntries(Array.from({ length: 169 }, (_, k) => [E.handAt(Math.floor(k / 13), k % 13), { raise: 1 }]));
assert.ok(Math.abs(C.rangeStats(all, 'Apertura').raise - 1) < 1e-9, 'Todas las manos = 100\u00a0%');
const utg = C.rangeStats(ranges.charts.RFI_UTG, 'Apertura').raise, btn = C.rangeStats(ranges.charts.RFI_BTN, 'Apertura').raise;
assert.ok(utg > 0.1 && utg < 0.22 && btn > 0.35 && btn < 0.6, `UTG abre ${utg}, BTN abre ${btn}`);

// Por qué: BTN contra apertura de CO con 99 (call 70\u00a0%, 3-bet 0\u00a0%)
const chart = ranges.charts.VS_OPEN_BTN_vs_CO;
const freq = E.frequencies(chart, '99', 'Contra apertura');
const why = C.whyPreflop({ spot: 'Contra apertura', hand: '99', heroPos: 'BTN', villainPos: 'CO', chart, freq, chosen: 'fold', due: 2.5, pot: 4, equity: 0.55, villainRange: 0.27 });
const text = why.join('\n');
assert.match(text, /Pagar cuesta 2,5 bb para un bote final de 6,5 bb: necesitas al menos 38\u00a0%/);
assert.match(text, /posición contra CO/);
assert.match(text, /Call: tienes precio/);
assert.match(text, /trío/);
assert.match(text, /Has foldeado una mano que la referencia juega/);
assert.match(text, /Manos parecidas → /);
// 3-bet de farol con A5s desde la BB contra BTN, y apertura
const f2 = E.frequencies(ranges.charts.VS_OPEN_BB_vs_BTN, 'A5s', 'Contra apertura');
assert.match(C.whyPreflop({ spot: 'Contra apertura', hand: 'A5s', heroPos: 'BB', villainPos: 'BTN', chart: ranges.charts.VS_OPEN_BB_vs_BTN, freq: f2, chosen: '3bet', due: 1.5, pot: 4, equity: 0.45 }).join(' '), /3-bet como farol: el As bloquea/);
assert.match(C.whyPreflop({ spot: 'Apertura', hand: '72o', heroPos: 'UTG', chart: ranges.charts.RFI_UTG, freq: E.frequencies(ranges.charts.RFI_UTG, '72o', 'Apertura'), chosen: 'fold' }).join(' '), /Quedan 5 jugadores por hablar/);

// Lectura de la mano postflop
const read = (h, b) => C.readHand(h.split(' '), b.split(' '));
assert.match(read('As Kd', 'Ah 7c 2s').label, /Top pair.*kicker Rey/); assert.equal(read('As Kd', 'Ah 7c 2s').strength, 'buena');
assert.equal(read('Qs Qd', 'Jh 7c 2s').strength, 'fuerte'); assert.match(read('Qs Qd', 'Jh 7c 2s').label, /Overpair/);
assert.match(read('7s 7d', 'Kh 7c 2s').label, /Set/);
assert.match(read('Ks 7d', 'Kh 7c 2s').label, /Dobles parejas/);
assert.match(read('8s 6s', 'Js 4s 8d 6d').label, /Dobles parejas/, 'Pantallazo: 8♠6♠ en J4 8 6');
const fd = read('As 6s', 'Js 4s 9d'); assert.equal(fd.outs, 9); assert.match(fd.draws[0].name, /color al As/); assert.ok(Math.abs(fd.hit - 0.35) < 0.01, 'color en el flop ≈ 35\u00a0%');
const oesd = read('9h 8c', 'Th 7d 2s'); assert.equal(oesd.outs, 8); assert.match(oesd.draws[0].name, /abierto/);
const gut = read('9h 8c', 'Jh 7d 2s'); assert.equal(gut.outs, 4); assert.match(gut.draws[0].name, /gutshot: Diez/);
const combo = read('9s 8s', 'Ts 7s 2d'); assert.equal(combo.outs, 15, 'Color + escalera abierta = 15 outs');
assert.equal(read('Ac Kd', '7h 5c 2s').strength, 'aire'); assert.equal(read('Ac Kd', '7h 5c 2s').outs, 6, 'Dos overcards = 6 outs');
assert.match(read('Ac Qd', 'Kh Jc Ts').label, /Escalera al As/);
assert.equal(read('Ac 3c', 'Kc 8c 4c').strength, 'monstruo');
assert.equal(read('2h 3d', 'Kh Kc 8s').strength, 'aire', 'La pareja de la mesa no es tuya');
assert.equal(read('As 2d', '3h 4c 9s Kd').draws[0].outs, 4, 'Rueda: A2 con 3 4 → gutshot al 5');
// AJo en el BTN contra CO: la equity bruta supera el precio, pero se foldea (explicación coherente)
const ajo = C.whyPreflop({ spot: 'Contra apertura', hand: 'AJo', heroPos: 'BTN', villainPos: 'CO', chart, freq: E.frequencies(chart, 'AJo', 'Contra apertura'), chosen: 'fold', due: 2.5, pot: 4, equity: 0.57, villainRange: 0.3 }).join(' ');
assert.match(ajo, /equity bruta \(57\u00a0%\) supera el precio/); assert.match(ajo, /squeeze/); assert.doesNotMatch(ajo, /se acerca/);
// Call con equity por debajo del precio: se explica con las pot odds implícitas
const imp = C.whyPreflop({ spot: 'Contra apertura', hand: '65s', heroPos: 'BB', villainPos: 'BTN', chart: ranges.charts.VS_OPEN_BB_vs_BTN, freq: E.frequencies(ranges.charts.VS_OPEN_BB_vs_BTN, '65s', 'Contra apertura'), chosen: 'call', due: 1.5, pot: 4, equity: 0.25 }).join(' ');
assert.match(imp, /implícitas/); assert.doesNotMatch(imp, /tienes precio \(/);
console.log('✔ Entrenador: rangos, explicación preflop (precio, equity, posición, valor/farol, vecinas) y lectura postflop (manos, proyectos, outs)');
