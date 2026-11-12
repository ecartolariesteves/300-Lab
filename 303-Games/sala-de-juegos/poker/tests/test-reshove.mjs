// Pruebas de reshove.json: resubida all-in contra una apertura con 16-25 bb.
// Uso (desde poker/): node tests/test-reshove.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('../reshove.json', import.meta.url), 'utf8'));

const RANKS = 'AKQJT98765432';
const COMBOS = {};
for (let i = 0; i < 13; i++)
  for (let j = 0; j < 13; j++) {
    if (i === j) COMBOS[RANKS[i] + RANKS[j]] = 6;
    else if (i < j) { COMBOS[RANKS[i] + RANKS[j] + 's'] = 4; COMBOS[RANKS[i] + RANKS[j] + 'o'] = 12; }
  }
const pct = (list) => (list.reduce((s, h) => s + COMBOS[h], 0) / 1326) * 100;
const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// 1. Estructura: 10 stacks × 15 parejas (abre, resube)
assert.deepEqual(data.stacks, [16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
assert.equal(Object.keys(data.reshove).length, 150);
assert.equal(Object.keys(data.call).length, 150);
for (const S of data.stacks)
  for (let a = 0; a < 5; a++)
    for (let b = a + 1; b < 6; b++) {
      const shove = data.reshove[`${POS[b]}_vs_${POS[a]}_${S}`], call = data.call[`${POS[a]}_vs_${POS[b]}_${S}`];
      assert.ok(shove && call, `faltan tablas ${POS[b]} contra ${POS[a]} con ${S} bb`);
      for (const h of [...shove, ...call]) assert.ok(COMBOS[h], 'mano desconocida ' + h);
      // AA y KK siempre resuben y siempre pagan; 72o nunca resube
      for (const h of ['AA', 'KK']) { assert.ok(shove.includes(h)); assert.ok(call.includes(h)); }
      assert.ok(!shove.includes('72o'));
    }

// 2. Contra aperturas más tardías (rangos más anchos) se resube más (tolerancia de 1,5 puntos)
for (const S of data.stacks)
  for (let a = 0; a < 3; a++) {
    const early = pct(data.reshove[`BB_vs_${POS[a]}_${S}`]), late = pct(data.reshove[`BB_vs_${POS[a + 1]}_${S}`]);
    assert.ok(late + 1.5 >= early, `${S} bb: la BB resube menos contra ${POS[a + 1]} que contra ${POS[a]}`);
  }

// 3. Con menos stack se resube igual o más (tolerancia de 1,5 puntos)
for (const key of ['BB_vs_BTN', 'SB_vs_BTN', 'BB_vs_CO', 'HJ_vs_UTG'])
  for (let S = 17; S <= 25; S++)
    assert.ok(pct(data.reshove[`${key}_${S - 1}`]) + 1.5 >= pct(data.reshove[`${key}_${S}`]), `${key}: menos stack, menos resubida en ${S} bb`);

// 4. Parejas ordenadas y suited ≥ offsuit
// Las parejas se construyen en orden (las claves '22'-'99' de un objeto se ordenarían como números)
const pairs = [...RANKS].map((r) => r + r);
for (const [name, list] of [...Object.entries(data.reshove), ...Object.entries(data.call)]) {
  for (let i = 1; i < pairs.length; i++) if (list.includes(pairs[i])) assert.ok(list.includes(pairs[i - 1]), `${name}: ${pairs[i]} sin ${pairs[i - 1]}`);
  for (const h of list) if (h.endsWith('o')) assert.ok(list.includes(h.slice(0, 2) + 's'), `${name}: ${h} sin ${h.slice(0, 2)}s`);
}

// 5. Valores del modelo con 20 bb (±3 puntos)
const near = (v, t, msg) => assert.ok(Math.abs(v - t) <= 3, `${msg}: ${v.toFixed(1)} % (esperado ~${t} %)`);
near(pct(data.reshove.BB_vs_BTN_20), 34, 'BB resube contra BTN');
near(pct(data.reshove.HJ_vs_UTG_20), 12, 'HJ resube contra UTG');
near(pct(data.call.BTN_vs_BB_20), 26, 'BTN paga la resubida de la BB');
console.log('✔ Resubida: 150 tablas de resubida y 150 de call (16-25 bb), coherentes por posición, stack, parejas y suited');
