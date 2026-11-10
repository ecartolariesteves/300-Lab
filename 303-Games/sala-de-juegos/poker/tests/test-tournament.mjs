// Pruebas del Sit & Go (tournament.js)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const T = createRequire(import.meta.url)('../tournament.js');

// 1. Niveles
assert.deepEqual(T.levelAt(1, 10), { level: 1, sb: 10, bb: 20, ante: 0 });
assert.deepEqual(T.levelAt(10, 10), { level: 1, sb: 10, bb: 20, ante: 0 });
assert.deepEqual(T.levelAt(11, 10), { level: 2, sb: 15, bb: 30, ante: 0 });
assert.deepEqual(T.levelAt(31, 10), { level: 4, sb: 50, bb: 100, ante: 12 });
assert.deepEqual(T.levelAt(111, 10), { level: 12, sb: 800, bb: 1600, ante: 200 });
assert.deepEqual(T.levelAt(121, 10), { level: 13, sb: 1200, bb: 2400, ante: 300 }, 'después del 12, ×1,5');
assert.equal(T.levelAt(7, 6).level, 2, 'con 6 manos por nivel, la 7 ya es nivel 2');
assert.equal(T.levelAt(16, 15).level, 2);

// 2. Posiciones con 6, 5, 4, 3 y 2 jugadores
function stateWith(aliveIds, button) {
  const s = T.create(['gto', 'gto', 'roca', 'station', 'maniaco'], 10, () => 0);
  s.players.forEach((p) => { p.alive = aliveIds.includes(p.id); });
  s.button = button;
  return s;
}
assert.deepEqual(T.seating(stateWith([0, 1, 2, 3, 4, 5], 0)), { 0: 'BTN', 1: 'SB', 2: 'BB', 3: 'UTG', 4: 'HJ', 5: 'CO' });
assert.deepEqual(T.seating(stateWith([0, 1, 2, 3, 4, 5], 4)), { 4: 'BTN', 5: 'SB', 0: 'BB', 1: 'UTG', 2: 'HJ', 3: 'CO' });
assert.deepEqual(T.seating(stateWith([0, 1, 3, 4, 5], 0)), { 0: 'BTN', 1: 'SB', 3: 'BB', 4: 'HJ', 5: 'CO' }, '5 jugadores: sin UTG');
assert.deepEqual(T.seating(stateWith([0, 2, 4, 5], 2)), { 2: 'BTN', 4: 'SB', 5: 'BB', 0: 'CO' }, '4 jugadores');
assert.deepEqual(T.seating(stateWith([1, 3, 5], 5)), { 5: 'BTN', 1: 'SB', 3: 'BB' }, '3 jugadores');
assert.deepEqual(T.seating(stateWith([0, 3], 3)), { 3: 'SB', 0: 'BB' }, 'heads-up: el botón es la SB');
assert.deepEqual(T.seating(stateWith([0, 3], 0)), { 0: 'SB', 3: 'BB' });
const moving = stateWith([0, 2, 5], 2);
T.moveButton(moving);
assert.equal(moving.button, 5, 'el botón salta a los asientos vacíos');
T.moveButton(moving);
assert.equal(moving.button, 0);

// 3. Stack efectivo
assert.equal(T.effectiveStack(12, [30, 8]), 12, 'el menor entre el tuyo y el mayor de detrás');
assert.equal(T.effectiveStack(12, [5, 8]), 8);
assert.equal(T.effectiveStack(12, []), 12);

// 4. Las fichas se conservan: 200 manos simuladas con resultados aleatorios en bb
let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const s = T.create(['gto', 'gto', 'roca', 'station', 'maniaco'], 10, rnd);
assert.equal(s.players.reduce((a, p) => a + p.chips, 0), 9000);
for (let hand = 1; hand <= 200 && !s.finished; hand++) {
  const { bb } = T.levelAt(hand, s.perLevel);
  const live = T.alive(s);
  const start = Object.fromEntries(s.players.map((p) => [p.id, p.chips]));
  const stacks = Object.fromEntries(s.players.map((p) => [p.id, p.chips / bb]));
  // Un bote: dos jugadores al azar se juegan hasta el menor de sus stacks
  const a = live[Math.floor(rnd() * live.length)], b = live.filter((p) => p !== a)[Math.floor(rnd() * (live.length - 1))];
  const risk = Math.min(stacks[a.id], stacks[b.id]) * (rnd() < 0.3 ? 1 : rnd());
  const [win, lose] = rnd() < 0.5 ? [a, b] : [b, a];
  stacks[win.id] += risk;
  stacks[lose.id] -= risk;
  T.settleChips(s, stacks, bb);
  assert.equal(s.players.reduce((x, p) => x + p.chips, 0), 9000, 'fichas totales en la mano ' + hand);
  T.eliminate(s, start);
  T.moveButton(s);
}
// Puestos: cada eliminado tiene un puesto distinto
const places = s.players.filter((p) => p.place).map((p) => p.place);
assert.equal(new Set(places).size, places.length, 'puestos sin repetir');

// 5. Dos eliminados en la misma mano: queda mejor quien empezó con más fichas
const e = T.create(['gto', 'gto', 'roca', 'station', 'maniaco'], 10, () => 0);
e.players[4].alive = false; e.players[4].place = 6;
e.players[1].chips = 0; e.players[2].chips = 0;
T.eliminate(e, { 1: 300, 2: 900 });
assert.equal(e.players[1].place, 5);
assert.equal(e.players[2].place, 4);
assert.equal(T.prize(1), 65);
assert.equal(T.prize(3), 0);
console.log('✔ Torneo: niveles, posiciones de 6 a 2 jugadores, botón, stack efectivo, fichas conservadas y puestos');
