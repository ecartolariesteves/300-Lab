// Pruebas de los perfiles de rival (profiles.js)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('../profiles.js');

// Generador con semilla para que las pruebas sean deterministas
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. Modo mixto: 2 GTO, 1 Roca, 1 Station y 1 Maníaco; con la misma semilla, el mismo reparto
const mix = P.assign('mixto', seeded(7));
assert.deepEqual([...mix].sort(), ['gto', 'gto', 'maniaco', 'roca', 'station']);
assert.deepEqual(P.assign('mixto', seeded(7)), mix, 'misma semilla, mismo reparto');
assert.deepEqual(P.assign('roca'), ['roca', 'roca', 'roca', 'roca', 'roca']);
// Con muchas semillas, el Maníaco cae alguna vez en cada asiento (no está fijo)
const seats = new Set();
for (let s = 1; s < 200; s++) seats.add(P.assign('mixto', seeded(s)).indexOf('maniaco'));
assert.equal(seats.size, 5, 'el maníaco puede sentarse en cualquier asiento');

// 2. Postflop con la misma equity y las mismas pot odds: la Roca foldea donde el Station paga
const facing = { equity: 0.3, potOdds: 0.33, due: 5, random: () => 0.99 };
assert.equal(P.decidePostflop('roca', facing).action, 'fold');
assert.equal(P.decidePostflop('station', facing).action, 'call');
assert.equal(P.decidePostflop('gto', facing).action, 'fold');

// 3. Faroles: en 1.000 decisiones con equity 0,10 sin apuesta delante, el Maníaco farolea y la Roca nunca
const bluffs = (profile, street = 'river') => {
  const rnd = seeded(42);
  let n = 0;
  for (let i = 0; i < 1000; i++) if (P.decidePostflop(profile, { equity: 0.1, due: 0, street, random: rnd }).action === 'bet') n++;
  return n;
};
const maniac = bluffs('maniaco'), rock = bluffs('roca'), station = bluffs('station'), gto = bluffs('gto');
assert.equal(rock, 0, 'la roca no farolea');
assert.equal(station, 0, 'el station no farolea');
assert.ok(maniac > 250 && maniac < 350, 'el maníaco farolea ~30 %: ' + maniac);
assert.ok(gto > 85 && gto < 160, 'el GTO farolea ~12 % en el river: ' + gto);
assert.ok(bluffs('gto', 'turn') < gto, 'el GTO farolea con aire menos en el turn que en el river');

// 4. Con manos muy fuertes, el GTO a veces sube y la Roca solo paga
assert.equal(P.decidePostflop('gto', { equity: 0.9, potOdds: 0.25, due: 4, random: () => 0.1 }).action, 'raise');
assert.equal(P.decidePostflop('roca', { equity: 0.9, potOdds: 0.25, due: 4, random: () => 0.1 }).action, 'call');

// 4b. GTO equilibrado: el mismo tamaño para valor y para farol en cada calle
const value = P.decidePostflop('gto', { equity: 0.9, due: 0, street: 'turn', random: () => 0.99 });
const bluff = P.decidePostflop('gto', { equity: 0.1, due: 0, street: 'turn', random: () => 0.01 });
assert.equal(value.action, 'bet');
assert.equal(bluff.action, 'bet');
assert.equal(value.share, bluff.share, 'el tamaño no delata la mano');
assert.equal(P.decidePostflop('gto', { equity: 0.9, due: 0, street: 'flop' }).share, 0.33);
// Semifarol: con proyecto en el turn apuesta a menudo; con la misma equity sin proyecto, pasa
assert.equal(P.decidePostflop('gto', { equity: 0.35, due: 0, street: 'turn', draw: true, random: () => 0.3 }).action, 'bet');
assert.equal(P.decidePostflop('gto', { equity: 0.35, due: 0, street: 'turn', draw: false, random: () => 0.3 }).action, 'check');
// En el river un proyecto fallado ya no es semifarol
assert.equal(P.decidePostflop('gto', { equity: 0.35, due: 0, street: 'river', draw: true, random: () => 0.3 }).action, 'check');
// Con proyecto paga un poco por debajo de las pot odds (odds implícitas); sin proyecto, no
assert.equal(P.decidePostflop('gto', { equity: 0.3, potOdds: 0.33, due: 5, street: 'flop', draw: true, random: () => 0.9 }).action, 'call');
assert.equal(P.decidePostflop('gto', { equity: 0.3, potOdds: 0.33, due: 5, street: 'flop', draw: false, random: () => 0.9 }).action, 'fold');
// Apuesta de continuación: el agresor preflop apuesta en el flop con más manos que quien no lo es
const cbets = (aggressor) => { const rnd = seeded(5); let n = 0; for (let i = 0; i < 1000; i++) if (P.decidePostflop('gto', { equity: 0.3, due: 0, street: 'flop', aggressor, random: rnd }).action === 'bet') n++; return n; };
assert.ok(cbets(true) > 300 && cbets(false) < 100, 'c-bet: ' + cbets(true) + ' frente a ' + cbets(false));

// 4c. Estrechar el rango del héroe: 100 combinaciones con fuerza 0,00-0,99
const combos = Array.from({ length: 100 }, (_, i) => ({ cards: ['c' + i, 'd' + i], weight: 1 }));
const strength = combos.map((_, i) => i / 100);
const strongest = (list, k) => list.slice().sort((a, b) => Number(b.cards[0].slice(1)) - Number(a.cards[0].slice(1))).slice(0, k);
const afterBig = P.narrowRange(combos, strength, 'bet', 1);
const afterSmall = P.narrowRange(combos, strength, 'bet', 0.33);
assert.ok(afterBig.length < afterSmall.length, 'una apuesta grande estrecha más que una pequeña');
assert.ok(afterBig.some((c) => c.cards[0] === 'c99') && !afterBig.some((c) => c.cards[0] === 'c40'), 'se queda lo fuerte y quita lo medio');
assert.ok(afterBig.some((c) => c.cards[0] === 'c2' && c.weight === 0.5), 'deja algo de farol con medio peso');
const afterCall = P.narrowRange(combos, strength, 'call');
assert.equal(afterCall.length, 70, 'al pagar se quita el 30 % más débil');
assert.ok(!afterCall.some((c) => c.cards[0] === 'c0'));
const afterRaise = P.narrowRange(combos, strength, 'raise');
assert.ok(afterRaise.filter((c) => c.weight === 1).length <= 35);
assert.equal(P.narrowRange([], [], 'bet').length, 0);
assert.equal(strongest(afterCall, 1)[0].cards[0], 'c99');

// 5. Preflop
assert.equal(P.decidePreflop('gto', { hand: 'A5s', spot: 'Apertura', freq: { raise: 1 } }), 'chart');
assert.equal(P.decidePreflop('roca', { hand: 'A5s', spot: 'Apertura', inRfiUtg: false }), 'fold', 'la roca no abre A5s si no está en UTG');
assert.equal(P.decidePreflop('roca', { hand: 'QQ', spot: 'Contra apertura', inRfiUtg: true, freq: { '3bet': 1 } }), 'raise');
assert.equal(P.decidePreflop('roca', { hand: 'TT', spot: 'Contra apertura', inRfiUtg: true, freq: { '3bet': 0.5, call: 0.5 } }), 'call', 'la roca paga en vez de resubir');
assert.equal(P.decidePreflop('station', { hand: 'K9o', spot: 'Contra apertura', inRfiBtn: true, freq: {} }), 'call', 'el station paga con rango de BTN');
assert.equal(P.decidePreflop('station', { hand: 'K9o', spot: 'Apertura', inRfiBtn: true, random: () => 0.1 }), 'limp');
assert.equal(P.decidePreflop('maniaco', { hand: 'K9o', spot: 'Apertura', inRfiBtn: true }), 'raise', 'el maníaco abre como desde el botón');
assert.equal(P.decidePreflop('maniaco', { hand: 'JTs', spot: 'Contra apertura', freq: { call: 1 }, random: () => 0.3 }), 'raise', 'convierte el call en 3-bet');
assert.equal(P.decidePreflop('maniaco', { hand: 'JTs', spot: 'Contra apertura', freq: { call: 1 }, random: () => 0.9 }), 'call');

// 6. Ninguna función recibe las cartas del héroe: los parámetros son solo los del bot y la situación
for (const fn of [P.decidePreflop, P.decidePostflop]) {
  const src = fn.toString();
  assert.ok(!/hero/i.test(src.slice(0, src.indexOf('{'))), 'la firma no menciona al héroe');
  assert.ok(!/heroCards|hero\.cards/.test(src), 'no usa las cartas del héroe');
}

// 7. Push/fold por perfil
assert.deepEqual(P.pushFoldStacks('gto', 10), { push: 10, call: 10 });
assert.deepEqual(P.pushFoldStacks('roca', 14), { push: 15, call: 15 });
assert.deepEqual(P.pushFoldStacks('station', 5), { push: 5, call: 4 });
assert.deepEqual(P.pushFoldStacks('maniaco', 6), { push: 4, call: 6 });

// 8. Líneas explotadoras
assert.match(P.exploitLine('maniaco', true), /pagar más ligero/);
assert.match(P.exploitLine('roca', true), /foldea manos medias/);
assert.equal(P.exploitLine('gto', true), '');
assert.deepEqual(P.reshoveStacks('roca', 24), { shove: 25, call: 25 });
assert.deepEqual(P.reshoveStacks('maniaco', 17), { shove: 16, call: 17 });
console.log('✔ Perfiles: reparto mixto, GTO equilibrado (tamaño único, semifaroles, c-bet), rango del héroe estrechado, faroles, push/fold y resubida');
