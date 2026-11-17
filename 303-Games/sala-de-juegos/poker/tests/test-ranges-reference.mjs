// Comprueba que las tablas contra apertura y contra 3-bet reproducen las frecuencias de la referencia
// publicada (BeyondGTO, 6-max NL500, 100 bb, con rake; apertura 2,5 bb y SB 3 bb).
// Uso: node tests/test-ranges-reference.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const { charts } = JSON.parse(fs.readFileSync(new URL('../ranges.json', import.meta.url), 'utf8'));
const combos = (h) => (h.length === 2 ? 6 : h[2] === 's' ? 4 : 12);
const share = (chart, act) => Object.entries(chart).reduce((t, [h, e]) => t + combos(h) * (e[act] || 0), 0) / 13.26;
const opened = (pos) => share(charts['RFI_' + pos], 'raise');

// [3-bet %, call %] sobre el total de manos, copiados de la referencia (su LJ es nuestro UTG)
const REF = {
  HJ_vs_UTG: [6.4, 4.1], CO_vs_UTG: [6.6, 5.3], CO_vs_HJ: [8.0, 5.3],
  BTN_vs_UTG: [6.8, 7.1], BTN_vs_HJ: [8.2, 7.8], BTN_vs_CO: [10.4, 8.8],
  SB_vs_UTG: [6.1, 5.2], SB_vs_HJ: [7.4, 5.3], SB_vs_CO: [9.1, 4.5], SB_vs_BTN: [13.2, 5.2],
  BB_vs_UTG: [6.0, 21.5], BB_vs_HJ: [7.5, 23.1], BB_vs_CO: [10.4, 26.3], BB_vs_BTN: [13.4, 31.7], BB_vs_SB: [16.9, 38.7],
};
for (const [spot, [r3, rc]] of Object.entries(REF)) {
  const c = charts['VS_OPEN_' + spot];
  const t3 = share(c, '3bet'), tc = share(c, 'call');
  assert.ok(Math.abs(t3 - r3) <= 0.6, `${spot}: 3-bet ${t3.toFixed(1)} % (referencia ${r3} %)`);
  assert.ok(Math.abs(tc - rc) <= Math.max(1, rc * 0.04), `${spot}: call ${tc.toFixed(1)} % (referencia ${rc} %)`);
}

// Contra 3-bet, sobre el rango de apertura. Referencia: fold 19-33 %, call 56-66 %, 4-bet 9-16 %
// (SB contra BB: fold 47 %, call 38 %, 4-bet 16 %). Aquí el 3-bet es mayor (3x / 4x), así que se
// admite algo más de fold.
const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  const name = `VS_3BET_${POS[a]}_vs_${POS[b]}`, c = charts[name], o = opened(POS[a]);
  const f4 = (100 * share(c, '4bet')) / o, fc = (100 * share(c, 'call')) / o, ff = 100 - f4 - fc;
  const msg = `${name}: 4-bet ${f4.toFixed(1)} %, call ${fc.toFixed(1)} %, fold ${ff.toFixed(1)} %`;
  assert.ok(f4 >= 9 && f4 <= 17, msg);
  if (POS[a] === 'SB') assert.ok(Math.abs(fc - 38) <= 2 && Math.abs(ff - 47) <= 3, msg);
  else assert.ok(fc >= 45 && fc <= 62 && ff >= 25 && ff <= 43, msg);
}

// Manos concretas que sirven de control para el estudio
const f = (chart, h, act) => (charts[chart][h] || {})[act] || 0;
// 77 en la SB contra HJ: mezcla real entre 3-bet y call; el 3-bet no es un error
assert.ok(f('VS_OPEN_SB_vs_HJ', '77', '3bet') >= 0.3, '77 SB vs HJ debe tener un 3-bet importante');
// La SB contra BTN resube mucho: A5s, JTs y KQo sobre todo 3-bet (referencia: 88 %, 91 %, 77 %)
for (const h of ['A5s', 'JTs', 'KQo']) assert.ok(f('VS_OPEN_SB_vs_BTN', h, '3bet') >= 0.7, `SB vs BTN ${h}`);
// Ante un 3-bet nunca se foldean QQ+ ni AK
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) for (const h of ['AA', 'KK', 'QQ', 'AKs', 'AKo']) {
  const e = charts[`VS_3BET_${POS[a]}_vs_${POS[b]}`][h] || {};
  assert.ok((e['4bet'] || 0) + (e.call || 0) >= 0.99, `VS_3BET_${POS[a]}_vs_${POS[b]} ${h} no debe foldear`);
}
// Con un jugador más por hablar detrás del que resube se paga algo menos: vs SB ≤ vs BB
for (const o of ['UTG', 'HJ', 'CO', 'BTN'])
  assert.ok(share(charts[`VS_3BET_${o}_vs_SB`], 'call') <= share(charts[`VS_3BET_${o}_vs_BB`], 'call') + 0.05, `${o}: paga más contra SB que contra BB`);

console.log('✔ Referencia preflop: 15 spots contra apertura y 15 contra 3-bet dentro de tolerancia');
