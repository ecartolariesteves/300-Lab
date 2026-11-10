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
const RANKS = 'AKQJT98765432';

// ---------- Las 169 manos y sus combinaciones concretas ----------
// Carta = rango (0 = 2 … 12 = A) * 4 + palo
const HANDS = [];
for (let i = 0; i < 13; i++) {
  for (let j = 0; j < 13; j++) {
    const hi = 12 - i;
    const lo = 12 - j;
    if (i === j) HANDS.push({ name: RANKS[i] + RANKS[j], combos: pairCombos(hi) });
    else if (i < j) {
      HANDS.push({ name: RANKS[i] + RANKS[j] + 's', combos: suitedCombos(hi, lo) });
      HANDS.push({ name: RANKS[i] + RANKS[j] + 'o', combos: offsuitCombos(hi, lo) });
    }
  }
}
function pairCombos(r) {
  const out = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([r * 4 + a, r * 4 + b]);
  return out;
}
function suitedCombos(h, l) {
  return [0, 1, 2, 3].map((s) => [h * 4 + s, l * 4 + s]);
}
function offsuitCombos(h, l) {
  const out = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([h * 4 + a, l * 4 + b]);
  return out;
}
const N = HANDS.length;
const TOTAL_COMBOS = 1326;

// ---------- Evaluador rápido de 7 cartas (entero comparable) ----------
const STRAIGHTS = [];
for (let top = 12; top >= 4; top--) {
  let m = 0;
  for (let k = 0; k < 5; k++) m |= 1 << (top - k);
  STRAIGHTS.push([m, top]);
}
STRAIGHTS.push([(1 << 12) | 0b1111, 3]); // A-2-3-4-5
function straightTop(mask) {
  for (const [m, top] of STRAIGHTS) if ((mask & m) === m) return top;
  return -1;
}
const counts = new Int8Array(13);
const suitCount = new Int8Array(4);
const suitMask = new Int32Array(4);
function eval7(cards) {
  counts.fill(0);
  suitCount.fill(0);
  suitMask.fill(0);
  let mask = 0;
  for (const c of cards) {
    const r = c >> 2;
    const s = c & 3;
    counts[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    mask |= 1 << r;
  }
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      const sf = straightTop(suitMask[s]);
      if (sf >= 0) return 8e6 + sf;
      let v = 0;
      let n = 0;
      for (let r = 12; r >= 0 && n < 5; r--) if (suitMask[s] & (1 << r)) { v = v * 13 + r; n++; }
      return 5e6 + v;
    }
  }
  let quad = -1, trip1 = -1, trip2 = -1, pair1 = -1, pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quad = r;
    else if (counts[r] === 3) { if (trip1 < 0) trip1 = r; else if (trip2 < 0) trip2 = r; }
    else if (counts[r] === 2) { if (pair1 < 0) pair1 = r; else if (pair2 < 0) pair2 = r; }
  }
  const kick = (n, ...skip) => {
    let v = 0;
    for (let r = 12; r >= 0 && n > 0; r--) if (counts[r] && !skip.includes(r)) { v = v * 13 + r; n--; }
    return v;
  };
  if (quad >= 0) return 7e6 + quad * 13 + kick(1, quad);
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) return 6e6 + trip1 * 13 + Math.max(trip2, pair1);
  const st = straightTop(mask);
  if (st >= 0) return 4e6 + st;
  if (trip1 >= 0) return 3e6 + trip1 * 169 + kick(2, trip1);
  if (pair1 >= 0 && pair2 >= 0) return 2e6 + pair1 * 169 + pair2 * 13 + kick(1, pair1, pair2);
  if (pair1 >= 0) return 1e6 + pair1 * 2197 + kick(3, pair1);
  return kick(5);
}

// ---------- Matriz de equity 169 × 169 (Monte Carlo con semilla) ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// compat[a][b]: combinaciones de b compatibles con cada combinación de a (media)
const EQ = Array.from({ length: N }, () => new Float64Array(N));
const COMPAT = Array.from({ length: N }, () => new Float64Array(N));
function buildEquity() {
  const rnd = mulberry32(20261110);
  const seven = new Array(7);
  const used = new Uint8Array(52);
  for (let a = 0; a < N; a++) {
    for (let b = a; b < N; b++) {
      // Parejas de combinaciones sin cartas repetidas
      const pairs = [];
      for (const ca of HANDS[a].combos)
        for (const cb of HANDS[b].combos)
          if (ca[0] !== cb[0] && ca[0] !== cb[1] && ca[1] !== cb[0] && ca[1] !== cb[1]) pairs.push([ca, cb]);
      COMPAT[a][b] = pairs.length / HANDS[a].combos.length;
      COMPAT[b][a] = pairs.length / HANDS[b].combos.length;
      if (!pairs.length) continue;
      let win = 0;
      for (let s = 0; s < SAMPLES; s++) {
        const [ca, cb] = pairs[(rnd() * pairs.length) | 0];
        used.fill(0);
        used[ca[0]] = used[ca[1]] = used[cb[0]] = used[cb[1]] = 1;
        let n = 0;
        while (n < 5) {
          const c = (rnd() * 52) | 0;
          if (used[c]) continue;
          used[c] = 1;
          seven[2 + n] = c;
          n++;
        }
        seven[0] = ca[0];
        seven[1] = ca[1];
        const va = eval7(seven);
        seven[0] = cb[0];
        seven[1] = cb[1];
        const vb = eval7(seven);
        win += va > vb ? 1 : va === vb ? 0.5 : 0;
      }
      EQ[a][b] = win / SAMPLES;
      EQ[b][a] = 1 - EQ[a][b];
    }
  }
}

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
buildEquity();
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
