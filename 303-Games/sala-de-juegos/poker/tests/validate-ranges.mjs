// Validador de rangos preflop para 6-max cash 100 bb.
// Uso: node validate-ranges.mjs ruta/ranges.json
// Comprueba formato, coherencia y porcentajes razonables. No demuestra que sea GTO exacto:
// detecta tablas imposibles o claramente equivocadas.
import fs from 'node:fs';

const RANKS = 'AKQJT98765432';
const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// Las 169 manos: parejas, suited (s) y offsuit (o), con sus combinaciones
const HANDS = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
  if (i === j) HANDS.push({ h: RANKS[i] + RANKS[j], combos: 6, pair: true, r: i });
  else if (i < j) {
    HANDS.push({ h: RANKS[i] + RANKS[j] + 's', combos: 4, hi: i, lo: j });
    HANDS.push({ h: RANKS[i] + RANKS[j] + 'o', combos: 12, hi: i, lo: j });
  }
}
const TOTAL = 1326;

const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const errors = [], warnings = [], report = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

// Frecuencia de una acción (0 si no aparece). La que falta hasta 1 es "fold".
const freq = (chart, hand, act) => (chart[hand] && chart[hand][act]) || 0;
const cont = (chart, hand) => Object.values(chart[hand] || {}).reduce((a, b) => a + b, 0);
const pct = (chart, fn) => HANDS.reduce((s, x) => s + x.combos * fn(chart, x.h), 0) / TOTAL * 100;

// ---------- 1. Qué tablas deben existir ----------
const expected = [];
for (const p of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) expected.push([`RFI_${p}`, ['raise']]);
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  expected.push([`VS_OPEN_${POS[b]}_vs_${POS[a]}`, ['call', '3bet']]);     // héroe en b, abre a
  expected.push([`VS_3BET_${POS[a]}_vs_${POS[b]}`, ['call', '4bet']]);     // héroe abrió en a, 3-bet de b
}
if (!data.charts) err('Falta la clave "charts"');
const charts = data.charts || {};
for (const [name, acts] of expected) {
  const c = charts[name];
  if (!c) { err(`Falta la tabla ${name}`); continue; }
  for (const x of HANDS) {
    const entry = c[x.h];
    if (entry === undefined) continue;                          // ausente = fold 100 %
    for (const [k, v] of Object.entries(entry)) {
      if (!acts.includes(k)) err(`${name} ${x.h}: acción "${k}" no permitida (usa ${acts.join('/')})`);
      if (typeof v !== 'number' || v < 0 || v > 1) err(`${name} ${x.h}: frecuencia ${v} fuera de [0,1]`);
    }
    if (cont(c, x.h) > 1.0001) err(`${name} ${x.h}: las frecuencias suman más de 1`);
  }
  for (const k of Object.keys(c)) if (!HANDS.some((x) => x.h === k)) err(`${name}: mano desconocida "${k}"`);
}
for (const k of Object.keys(charts)) if (!expected.some(([n]) => n === k)) warn(`Tabla no esperada: ${k}`);
if (errors.length) { finish(); }

// ---------- 2. Porcentajes razonables ----------
const band = (name, value, lo, hi) => {
  report.push(`${name.padEnd(24)} ${value.toFixed(1).padStart(5)} %   (esperado ${lo}-${hi} %)`);
  if (value < lo || value > hi) err(`${name}: ${value.toFixed(1)} % fuera del rango esperado ${lo}-${hi} %`);
};
const RFI_BANDS = { UTG: [13, 20], HJ: [17, 25], CO: [24, 33], BTN: [38, 52], SB: [33, 52] };
for (const p of Object.keys(RFI_BANDS)) band(`RFI_${p}`, pct(charts[`RFI_${p}`], (c, h) => freq(c, h, 'raise')), ...RFI_BANDS[p]);

for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  const name = `VS_OPEN_${POS[b]}_vs_${POS[a]}`, c = charts[name];
  const total = pct(c, cont);
  const [lo, hi] = POS[b] === 'BB'
    ? (POS[a] === 'BTN' ? [50, 80] : POS[a] === 'SB' ? [55, 85] : POS[a] === 'CO' ? [38, 65] : [25, 50])
    : (POS[a] === 'UTG' ? [4, 16] : POS[a] === 'HJ' ? [5, 18] : POS[a] === 'CO' ? [7, 24] : [9, 30]);
  band(name, total, lo, hi);
  const rfi = charts[`RFI_${POS[a]}`];
  // Todo lo que continúa contra una apertura debería ser como mínimo tan fuerte como lo que entra en un 3-bet de valor
  for (const h of ['AA', 'KK', 'QQ', 'AKs']) if (cont(c, h) < 0.99) err(`${name}: ${h} nunca debería foldear`);
}

for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  const name = `VS_3BET_${POS[a]}_vs_${POS[b]}`, c = charts[name], rfi = charts[`RFI_${POS[a]}`];
  // Solo puedes enfrentarte a un 3-bet con manos que abres: no puede continuar más que su frecuencia de apertura
  for (const x of HANDS) if (cont(c, x.h) > freq(rfi, x.h, 'raise') + 0.02)
    err(`${name} ${x.h}: continúa ${cont(c, x.h).toFixed(2)} pero solo abre ${freq(rfi, x.h, 'raise').toFixed(2)}`);
  // Defensa contra 3-bet: entre el 35 % y el 75 % del rango de apertura
  const opened = pct(rfi, (cc, h) => freq(cc, h, 'raise'));
  const defended = pct(c, cont);
  const share = opened ? defended / opened * 100 : 0;
  band(`${name} (defensa)`, share, 35, 75);
  for (const h of ['AA', 'KK', 'AKs']) if (cont(c, h) < 0.99) err(`${name}: ${h} nunca debería foldear contra 3-bet`);
}

// ---------- 3. Coherencia ----------
// Las premium siempre abren; las peores manos nunca abren fuera del BTN/SB
for (const p of ['UTG', 'HJ', 'CO', 'BTN', 'SB']) {
  const c = charts[`RFI_${p}`];
  for (const h of ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQs']) if (freq(c, h, 'raise') < 0.99) err(`RFI_${p}: ${h} debería abrirse siempre`);
  for (const h of ['72o', '82o', '32o', '42o']) if (freq(c, h, 'raise') > 0.01) err(`RFI_${p}: ${h} no debería abrirse`);
}
// Las posiciones tardías abren al menos lo mismo que las tempranas (tolerancia 0,15)
const order = ['UTG', 'HJ', 'CO', 'BTN'];
for (let i = 0; i < order.length - 1; i++) for (const x of HANDS) {
  const early = freq(charts[`RFI_${order[i]}`], x.h, 'raise'), late = freq(charts[`RFI_${order[i + 1]}`], x.h, 'raise');
  if (late + 0.15 < early) err(`${x.h}: abre ${early} desde ${order[i]} pero solo ${late} desde ${order[i + 1]}`);
}
// Suited juega al menos lo mismo que offsuit; parejas más altas, al menos lo mismo que las más bajas
for (const [name, c] of Object.entries(charts)) {
  for (const x of HANDS) if (x.h.endsWith('o')) {
    const s = x.h.slice(0, 2) + 's';
    if (cont(c, s) + 0.1 < cont(c, x.h)) err(`${name}: ${x.h} juega más (${cont(c, x.h).toFixed(2)}) que ${s} (${cont(c, s).toFixed(2)})`);
  }
  const pairs = HANDS.filter((x) => x.pair);
  for (let i = 0; i < pairs.length - 1; i++)
    if (cont(c, pairs[i].h) + 0.15 < cont(c, pairs[i + 1].h)) err(`${name}: ${pairs[i + 1].h} juega más que ${pairs[i].h}`);
}

finish();
function finish() {
  if (report.length) console.log(report.join('\n'));
  warnings.forEach((w) => console.log('AVISO:', w));
  if (errors.length) {
    console.log(`\n✘ ${errors.length} errores:`); errors.slice(0, 40).forEach((e) => console.log(' -', e));
    process.exit(1);
  }
  console.log(`\n✔ Rangos válidos: ${Object.keys(charts).length} tablas`);
  process.exit(0);
}
