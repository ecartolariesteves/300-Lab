// Pruebas de pushfold.json: estructura y coherencia de las tablas de push/fold.
// Uso (desde poker/): node tests/test-pushfold.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, '..', 'pushfold.json'), 'utf8'));

const RANKS = 'AKQJT98765432';
const HANDS = [];
for (let i = 0; i < 13; i++)
  for (let j = 0; j < 13; j++) {
    if (i === j) HANDS.push({ h: RANKS[i] + RANKS[j], combos: 6 });
    else if (i < j) {
      HANDS.push({ h: RANKS[i] + RANKS[j] + 's', combos: 4 });
      HANDS.push({ h: RANKS[i] + RANKS[j] + 'o', combos: 12 });
    }
  }
const VALID = new Set(HANDS.map((x) => x.h));
const COMBOS = Object.fromEntries(HANDS.map((x) => [x.h, x.combos]));
const pct = (list) => (list.reduce((s, h) => s + COMBOS[h], 0) / 1326) * 100;
const PUSHERS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
const POS = [...PUSHERS, 'BB'];

// 1. Estructura: 12 stacks (4-15 bb) × 5 posiciones, y una tabla de pago por cada jugador detrás
assert.deepEqual(data.stacks, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
assert.equal(data.ante, 0.125);
for (const S of data.stacks)
  for (const p of PUSHERS) {
    const push = data.push[`${p}_${S}`];
    assert.ok(Array.isArray(push), `falta push ${p}_${S}`);
    for (const h of push) assert.ok(VALID.has(h), `mano desconocida ${h} en ${p}_${S}`);
    assert.equal(new Set(push).size, push.length, `manos repetidas en ${p}_${S}`);
    for (const c of POS.slice(POS.indexOf(p) + 1)) assert.ok(Array.isArray(data.call[`${c}_vs_${p}_${S}`]), `falta call ${c}_vs_${p}_${S}`);
  }
assert.equal(Object.keys(data.push).length, 60);
assert.equal(Object.keys(data.call).length, 180);

// 2. Manos obvias: AA, KK y AK siempre se empujan y se pagan; 72o nunca desde UTG con 10 bb o más
for (const S of data.stacks)
  for (const p of PUSHERS) {
    for (const h of ['AA', 'KK', 'AKs']) assert.ok(data.push[`${p}_${S}`].includes(h), `${p}_${S} debe empujar ${h}`);
    for (const c of POS.slice(POS.indexOf(p) + 1)) for (const h of ['AA', 'KK']) assert.ok(data.call[`${c}_vs_${p}_${S}`].includes(h), `${c} debe pagar con ${h} contra ${p}_${S}`);
  }
for (const S of [10, 12, 15]) assert.ok(!data.push[`UTG_${S}`].includes('72o'), `UTG_${S} no debe empujar 72o`);
assert.ok(pct(data.push.SB_4) > 80, 'Con 4 bb la SB empuja más del 80 %');

// 3. Coherencia: cuanto más tarde la posición, más ancho el rango (tolerancia de 1,5 puntos por ruido).
for (const S of data.stacks)
  for (let i = 0; i < PUSHERS.length - 1; i++) {
    const a = pct(data.push[`${PUSHERS[i]}_${S}`]), b = pct(data.push[`${PUSHERS[i + 1]}_${S}`]);
    assert.ok(b + 1.5 >= a, `${S} bb: ${PUSHERS[i + 1]} (${b.toFixed(1)} %) empuja menos que ${PUSHERS[i]} (${a.toFixed(1)} %)`);
  }

// 4. Cuanto más corto el stack, más ancho el rango de push (tolerancia de 1,5 puntos)
for (const p of PUSHERS)
  for (let S = 5; S <= 15; S++) {
    const shorter = pct(data.push[`${p}_${S - 1}`]), longer = pct(data.push[`${p}_${S}`]);
    assert.ok(shorter + 1.5 >= longer, `${p}: con ${S - 1} bb (${shorter.toFixed(1)} %) empuja menos que con ${S} bb (${longer.toFixed(1)} %)`);
  }

// 5. Parejas: una pareja más alta se juega siempre que se juega una más baja (en push y en call)
const pairs = HANDS.filter((x) => x.h[0] === x.h[1]).map((x) => x.h);
for (const [name, list] of [...Object.entries(data.push), ...Object.entries(data.call)])
  for (let i = 1; i < pairs.length; i++)
    if (list.includes(pairs[i])) assert.ok(list.includes(pairs[i - 1]), `${name}: juega ${pairs[i]} pero no ${pairs[i - 1]}`);

// 6. Suited juega al menos lo mismo que offsuit
for (const [name, list] of [...Object.entries(data.push), ...Object.entries(data.call)])
  for (const h of list) if (h.endsWith('o')) assert.ok(list.includes(h.slice(0, 2) + 's'), `${name}: juega ${h} pero no ${h.slice(0, 2)}s`);

// 7. Rangos de referencia con 10 bb (valores del modelo, ±3 puntos)
const near = (v, target, msg) => assert.ok(Math.abs(v - target) <= 3, `${msg}: ${v.toFixed(1)} % (esperado ~${target} %)`);
near(pct(data.push.UTG_10), 21, 'UTG empuja con 10 bb');
near(pct(data.push.BTN_10), 42, 'BTN empuja con 10 bb');
near(pct(data.push.SB_10), 69, 'SB empuja con 10 bb');
near(pct(data.call.BB_vs_SB_10), 51, 'BB paga contra SB con 10 bb');

console.log('✔ Push/fold: 60 tablas de push y 180 de call (4-15 bb), coherentes por posición, stack, parejas y suited');
