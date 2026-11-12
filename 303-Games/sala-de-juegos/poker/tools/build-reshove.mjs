/* Genera poker/reshove.json: resubida all-in (reshove) contra una apertura, con 16-25 bb.

   Modelo (documentado también en el JSON):
   - 6-max, todos con el mismo stack efectivo S (16..25 bb), ciegas 0,5/1 y ante de 0,125 bb por jugador.
   - Un jugador abre a 2,2 bb (2,5 bb desde la SB) con su rango de apertura de referencia (RFI de ranges.json).
     Esas tablas son de 100 bb: con 16-25 bb, la apertura real sería algo más estrecha. Es una aproximación.
   - Un jugador detrás va all-in o foldea; el que abrió paga o foldea. Los demás foldean (sin overcalls).
   - EV en fichas (chip EV), sin ICM. Equilibrio entre la resubida y el call del que abrió
     (juego ficticio), con el rango de apertura fijo.

   Uso: node tools/build-reshove.mjs [muestras por enfrentamiento, por defecto 8000]  (alrededor de un minuto) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HANDS, N, EQ, COMPAT, buildEquity } from './equity-matrix.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = Number(process.argv[2]) || 8000;
const ranges = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'ranges.json'), 'utf8'));

const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const ANTE = 0.125;
const OPEN_TO = (pos) => (pos === 'SB' ? 2.5 : 2.2);
const blind = (pos) => (pos === 'SB' ? 0.5 : pos === 'BB' ? 1 : 0);
const DEAD = 6 * ANTE + 1.5; // antes y ciegas de toda la mesa

// Peso de cada mano en el rango de apertura (frecuencia de "raise" de la tabla RFI)
function openWeights(pos) {
  const chart = ranges.charts['RFI_' + pos];
  return HANDS.map((h) => (chart[h.name] && chart[h.name].raise) || 0);
}

// Equity de g contra un rango con pesos, descontando las cartas que comparten
function equityVs(g, weights) {
  let w = 0, e = 0;
  for (let h = 0; h < N; h++) {
    if (!weights[h]) continue;
    const ww = weights[h] * COMPAT[g][h];
    w += ww;
    e += ww * EQ[g][h];
  }
  return { equity: w ? e / w : 0, weight: w };
}

function solve(S, opener, shover) {
  const open = openWeights(opener);
  const openTotal = equityVs(0, open); // solo para comprobar que hay rango
  if (!openTotal.weight && !open.some((v) => v)) throw new Error('Sin rango de apertura en ' + opener);
  const committedOpener = ANTE + OPEN_TO(opener); // incluye su ciega si es la SB
  const postedShover = ANTE + blind(shover);
  const potBefore = DEAD + OPEN_TO(opener) - blind(opener);
  const potCalled = 2 * S + DEAD - (ANTE + blind(opener)) - postedShover;
  const shoveSum = new Float64Array(N);
  const callSum = new Float64Array(N);
  const ITER = 150;
  let shove = new Array(N).fill(1);
  let call = new Array(N).fill(1);
  for (let it = 0; it < ITER; it++) {
    const shoveAvg = it ? Array.from(shoveSum, (v) => v / it) : shove;
    const callAvg = it ? Array.from(callSum, (v) => v / it) : call;
    // Mejor respuesta del que paga (solo con manos de su rango de apertura)
    call = HANDS.map((_, h) => {
      if (!open[h]) return 0;
      const { equity } = equityVs(h, shoveAvg);
      return equity * potCalled > S - committedOpener ? 1 : 0;
    });
    // Mejor respuesta del que resube: rango de apertura que paga = apertura × call
    const callers = open.map((w, h) => w * callAvg[h]);
    shove = HANDS.map((_, g) => {
      const all = equityVs(g, open).weight;
      const { equity, weight } = equityVs(g, callers);
      const pCall = all ? weight / all : 0;
      const ev = (1 - pCall) * (S - postedShover + potBefore) + pCall * equity * potCalled;
      return ev > S - postedShover ? 1 : 0;
    });
    shove.forEach((v, h) => (shoveSum[h] += v));
    call.forEach((v, h) => (callSum[h] += v));
  }
  return {
    shove: Array.from(shoveSum, (v) => (v / ITER >= 0.5 ? 1 : 0)),
    call: Array.from(callSum, (v) => (v / ITER >= 0.5 ? 1 : 0)),
  };
}

const list = (range) => HANDS.filter((_, g) => range[g]).map((h) => h.name);
const share = (range) => range.reduce((s, on, g) => s + (on ? HANDS[g].combos.length : 0), 0) / 1326;

console.time('equity');
buildEquity(SAMPLES);
console.timeEnd('equity');

const out = { reshove: {}, call: {}, stacks: [] };
for (let S = 16; S <= 25; S++) {
  out.stacks.push(S);
  for (let a = 0; a < 5; a++) {
    for (let b = a + 1; b < 6; b++) {
      const r = solve(S, POS[a], POS[b]);
      out.reshove[`${POS[b]}_vs_${POS[a]}_${S}`] = list(r.shove);
      out.call[`${POS[a]}_vs_${POS[b]}_${S}`] = list(r.call);
      if (S % 4 === 0 && (b === 5 || b === a + 1))
        console.log(`${S} bb  ${POS[b]} contra ${POS[a]}: resube ${(share(r.shove) * 100).toFixed(1)} % · paga ${(share(r.call) * 100).toFixed(1)} %`);
    }
  }
}

const model =
  'Resubida all-in contra una apertura, 6-max, stacks iguales de 16 a 25 bb, ciegas 0,5/1 y ante 0,125 bb. ' +
  'Apertura a 2,2 bb (2,5 desde la SB) con los rangos RFI de 100 bb de ranges.json (aproximación: con estos stacks se abre algo más estrecho). ' +
  'Solo el que abre y el que resube; el resto foldea. EV en fichas, sin ICM. Equilibrio aproximado entre resubida y call. ' +
  'Generado con tools/build-reshove.mjs: no se edita a mano.';
const block = (obj) => '{\n' + Object.entries(obj).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n }';
const text = '{\n "version": 1,\n "model": ' + JSON.stringify(model) + ',\n "ante": ' + ANTE + ',\n "openTo": 2.2,\n "openToSB": 2.5,\n "stacks": ' +
  JSON.stringify(out.stacks) + ',\n "reshove": ' + block(out.reshove) + ',\n "call": ' + block(out.call) + '\n}\n';
const file = path.join(HERE, '..', 'reshove.json');
fs.writeFileSync(file, text);
console.log('✔ Escrito', file);
