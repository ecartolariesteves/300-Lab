// Comprueba la tabla contra casillas conocidas de la estrategia básica (4-8 barajas, S17, DAS)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const S = createRequire(import.meta.url)('../strategy.js');
const cases = [
  // [mano, crupier, acción, nota]
  [['10', '6'], '10', 'H', '16 contra 10: pedir'], [['10', '6'], '6', 'S', '16 contra 6: plantarse'],
  [['10', '2'], '2', 'H', '12 contra 2: pedir'], [['10', '2'], '4', 'S', '12 contra 4: plantarse'],
  [['6', '5'], 'A', 'H', '11 contra As (S17): pedir'], [['6', '5'], '10', 'D', '11 contra 10: doblar'],
  [['5', '4'], '2', 'H', '9 contra 2: pedir'], [['5', '4'], '3', 'D', '9 contra 3: doblar'],
  [['A', '7'], '2', 'S', 'A7 contra 2: plantarse'], [['A', '7'], '3', 'D', 'A7 contra 3: doblar'],
  [['A', '7'], '9', 'H', 'A7 contra 9: pedir'], [['A', '6'], '2', 'H', 'A6 contra 2: pedir'],
  [['A', '8'], '6', 'S', 'A8 contra 6 (S17): plantarse'], [['A', '2'], '4', 'H', 'A2 contra 4: pedir'],
  [['9', '9'], '7', 'S', '9,9 contra 7: plantarse'], [['9', '9'], '8', 'P', '9,9 contra 8: separar'],
  [['8', '8'], 'A', 'P', '8,8 contra As: separar'], [['A', 'A'], '10', 'P', 'A,A: separar siempre'],
  [['K', 'Q'], '6', 'S', '10,10: no separar nunca'], [['5', '5'], '9', 'D', '5,5 es un 10: doblar'],
  [['4', '4'], '5', 'P', '4,4 contra 5: separar (DAS)'], [['4', '4'], '4', 'H', '4,4 contra 4: pedir'],
  [['2', '2'], '7', 'P', '2,2 contra 7: separar'], [['6', '6'], '7', 'H', '6,6 contra 7: pedir']
];
for (const [hand, up, want, note] of cases) assert.equal(S.bestAction(hand, up), want, note);
// Con tres cartas no se puede doblar: D pasa a pedir y Ds a plantarse
assert.equal(S.bestAction(['3', '4', '4'], '6'), 'H', '11 de tres cartas: pedir');
assert.equal(S.bestAction(['A', '3', '4'], '4'), 'S', 'A7 de tres cartas contra 4: plantarse');
// Totales
assert.deepEqual(S.handTotal(['A', 'A', '9']), { total: 21, soft: true });
assert.deepEqual(S.handTotal(['A', '9', '5']), { total: 15, soft: false });
// Todas las filas tienen 10 columnas y solo códigos válidos
for (const table of [S.HARD, S.SOFT, S.PAIRS]) for (const r of Object.values(table)) {
  assert.equal(r.length, 10);
  for (const c of r) assert.ok(['H', 'S', 'D', 'Ds', 'P'].includes(c));
}
console.log(`✔ Estrategia básica: ${cases.length + 4} casillas comprobadas contra la referencia`);
