/* Genera poker/pushfold.json: tablas de push/fold (all-in o fold) para stacks cortos.

   Modelo (documentado también en el JSON):
   - 6-max, todos con el mismo stack efectivo S (4..15 bb), ciegas 0,5/1 y ante de 0,125 bb por jugador.
   - Spot: nadie ha entrado antes que tú (first-in). Tú vas all-in o foldeas.
   - Los que quedan detrás pagan o foldean. Simplificación: si alguien paga, el resto foldea
     (sin overcalls), como hacen la mayoría de calculadoras de push/fold sencillas.
   - EV en fichas (chip EV), sin ICM. Equilibrio de Nash aproximado por iteración de mejor respuesta.
   - Equity mano contra mano por Monte Carlo con semilla fija, respetando las cartas bloqueadas.

   Uso: node tools/build-pushfold.mjs [muestras por enfrentamiento, por defecto 6000]
   Tarda alrededor de un minuto. El resultado es determinista. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = Number(process.argv[2]) || 6000;

import { HANDS, N, TOTAL_COMBOS, EQ, COMPAT, buildEquity } from './equity-matrix.mjs';

// ---------- Equilibrio push/fold ----------
const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
// PF_ANTE y PF_STACKS solo sirven para comprobaciones (p. ej. heads-up sin ante): no cambian el archivo oficial
const ANTE = process.env.PF_ANTE !== undefined ? Number(process.env.PF_ANTE) : 0.125;
const posted = (pos) => ANTE + (pos === 'SB' ? 0.5 : pos === 'BB' ? 1 : 0);
const POT = 6 * ANTE + 1.5;

// Equity de la mano h contra un rango (vector 0/1 de las 169), ponderada por combinaciones compatibles
function equityVs(h, range) {
  let w = 0, e = 0;
  for (let g = 0; g < N; g++) if (range[g]) { w += COMPAT[h][g]; e += COMPAT[h][g] * EQ[h][g]; }
  return w ? e / w : 0.5;
}
const share = (range) => range.reduce((s, on, g) => s + (on ? HANDS[g].combos.length : 0), 0) / TOTAL_COMBOS;

function solve(S, pusher) {
  const iP = POS.indexOf(pusher);
  const callers = POS.slice(iP + 1);
  let push = new Array(N).fill(1);
  let calls = callers.map(() => new Array(N).fill(0));
  // Media de las estrategias a lo largo de las iteraciones (juego ficticio), para que converja
  const pushSum = new Float64Array(N);
  const callSum = callers.map(() => new Float64Array(N));
  const ITER = 150;
  for (let it = 0; it < ITER; it++) {
    const pushAvg = it ? Array.from(pushSum, (v) => v / it) : push;
    const callAvg = it ? callSum.map((c) => Array.from(c, (v) => v / it)) : calls;
    // Mejor respuesta de cada jugador que puede pagar, contra el rango medio del que empuja
    calls = callers.map((pos) => {
      const pot = 2 * S + POT - posted(pusher) - posted(pos);
      return HANDS.map((_, g) => {
        let w = 0, e = 0;
        for (let h = 0; h < N; h++) if (pushAvg[h] > 0) { const ww = pushAvg[h] * COMPAT[g][h]; w += ww; e += ww * EQ[g][h]; }
        const eq = w ? e / w : 0;
        return eq * pot > S - posted(pos) ? 1 : 0;
      });
    });
    // Mejor respuesta del que empuja contra los rangos medios de pago
    const cShare = callAvg.map((c) => c.reduce((s, v, g) => s + v * HANDS[g].combos.length, 0) / TOTAL_COMBOS);
    push = HANDS.map((_, h) => {
      let pFoldSoFar = 1, ev = 0;
      callers.forEach((pos, j) => {
        const pCall = pFoldSoFar * cShare[j];
        if (pCall > 0) {
          let w = 0, e = 0;
          for (let g = 0; g < N; g++) if (callAvg[j][g] > 0) { const ww = callAvg[j][g] * COMPAT[h][g]; w += ww; e += ww * EQ[h][g]; }
          const pot = 2 * S + POT - posted(pusher) - posted(pos);
          ev += pCall * (w ? e / w : 0.5) * pot;
        }
        pFoldSoFar *= 1 - cShare[j];
      });
      ev += pFoldSoFar * (S - posted(pusher) + POT);
      return ev > S - posted(pusher) ? 1 : 0;
    });
    push.forEach((v, h) => (pushSum[h] += v));
    calls.forEach((c, j) => c.forEach((v, g) => (callSum[j][g] += v)));
  }
  // Rango final: manos que se juegan en más de la mitad de las iteraciones finales (estrategia media)
  const finalPush = Array.from(pushSum, (v) => (v / ITER >= 0.5 ? 1 : 0));
  const finalCalls = callSum.map((c) => Array.from(c, (v) => (v / ITER >= 0.5 ? 1 : 0)));
  return { push: finalPush, calls: Object.fromEntries(callers.map((p, j) => [p, finalCalls[j]])) };
}

const list = (range) => HANDS.filter((_, g) => range[g]).map((h) => h.name);

console.time('equity');
buildEquity(SAMPLES);
console.timeEnd('equity');

const out = {
  version: 1,
  model:
    'Push/fold 6-max, stacks iguales, ciegas 0,5/1 y ante 0,125 bb por jugador. Spot first-in: nadie ha entrado antes. ' +
    'Si alguien paga, el resto foldea (sin overcalls). EV en fichas, sin ICM. Equilibrio de Nash aproximado (juego ficticio). ' +
    'Con menos de 4 bb los botes multiway son lo normal y este modelo no sirve: esos spots van sin evaluar. ' +
    'Generado con tools/build-pushfold.mjs: no se edita a mano.',
  ante: ANTE,
  stacks: [],
  push: {},
  call: {},
};
const STACKS = process.env.PF_STACKS ? process.env.PF_STACKS.split(',').map(Number) : Array.from({ length: 12 }, (_, i) => i + 4);
for (const S of STACKS) {
  out.stacks.push(S);
  for (const pusher of POS.slice(0, 5)) {
    const r = solve(S, pusher);
    out.push[`${pusher}_${S}`] = list(r.push);
    for (const [caller, range] of Object.entries(r.calls)) out.call[`${caller}_vs_${pusher}_${S}`] = list(range);
    const pct = (x) => (share(x) * 100).toFixed(1).padStart(5);
    console.log(`${String(S).padStart(2)} bb ${pusher.padEnd(3)} push ${pct(r.push)} %  ·  BB paga ${pct(r.calls.BB)} %`);
  }
}
if (process.env.PF_ANTE === undefined && !process.env.PF_STACKS) {
  const file = path.join(HERE, '..', 'pushfold.json');
  // Una línea por tabla: el archivo queda pequeño y legible en los diffs
  const block = (obj) => '{\n' + Object.entries(obj).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n }';
  const text = '{\n "version": 1,\n "model": ' + JSON.stringify(out.model) + ',\n "ante": ' + out.ante +
    ',\n "stacks": ' + JSON.stringify(out.stacks) + ',\n "push": ' + block(out.push) + ',\n "call": ' + block(out.call) + '\n}\n';
  fs.writeFileSync(file, text);
  console.log('✔ Escrito', file);
} else console.log('Modo comprobación: no se escribe pushfold.json');
