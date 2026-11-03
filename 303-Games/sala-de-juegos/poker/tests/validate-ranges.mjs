// Validador de rangos preflop para 6-max cash 100 bb (v2: incluye comprobaciones por posición).
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

// ---------- 4. Estrategia distinta según la posición (v2) ----------
// Una tabla real cambia según quién abre, quién resube y quién tiene posición.
const callPct = (c) => pct(c, (cc, h) => freq(cc, h, 'call'));
const contPct = (c) => pct(c, cont);
let entries = 0, mixed = 0;
for (const [name, c] of Object.entries(charts)) {
  for (const [h, acts] of Object.entries(c)) {
    let sum = 0;
    for (const v of Object.values(acts)) {
      sum += v;
      if (Math.abs(v * 20 - Math.round(v * 20)) > 1e-6) err(`${name} ${h}: frecuencia ${v} no es múltiplo de 0,05 (usa valores redondeados)`);
    }
    const pos = Object.values(acts).filter((v) => v > 0.001).length;
    if (sum > 0.001) { entries++; if (pos > 1 || sum < 0.999) mixed++; }
  }
}
report.push(`Manos con estrategia mixta: ${(mixed / entries * 100).toFixed(0)} % (máximo 50 %)`);
if (mixed / entries > 0.5) err(`Demasiadas manos mixtas (${(mixed / entries * 100).toFixed(0)} %): las estrategias reales tienen muchas acciones puras`);

for (let a = 0; a < 5; a++) {
  const heroes = POS.slice(a + 1);
  // Contra la misma apertura, cada posición necesita su propia tabla
  for (let i = 0; i < heroes.length; i++) for (let j = i + 1; j < heroes.length; j++) {
    const x = charts[`VS_OPEN_${heroes[i]}_vs_${POS[a]}`], y = charts[`VS_OPEN_${heroes[j]}_vs_${POS[a]}`];
    if (JSON.stringify(x) === JSON.stringify(y)) err(`VS_OPEN_${heroes[i]}_vs_${POS[a]} y VS_OPEN_${heroes[j]}_vs_${POS[a]} son idénticas`);
  }
  for (let i = 0; i < heroes.length; i++) for (let j = i + 1; j < heroes.length; j++) {
    const x = charts[`VS_3BET_${POS[a]}_vs_${heroes[i]}`], y = charts[`VS_3BET_${POS[a]}_vs_${heroes[j]}`];
    if (JSON.stringify(x) === JSON.stringify(y)) err(`VS_3BET_${POS[a]}_vs_${heroes[i]} y VS_3BET_${POS[a]}_vs_${heroes[j]} son idénticas`);
  }
  // La SB juega casi siempre 3-bet o fold; la BB defiende sobre todo pagando
  const sb = charts[`VS_OPEN_SB_vs_${POS[a]}`];
  if (sb && contPct(sb) > 0 && callPct(sb) / contPct(sb) > 0.35)
    err(`VS_OPEN_SB_vs_${POS[a]}: paga el ${(callPct(sb) / contPct(sb) * 100).toFixed(0)} % de lo que continúa (máximo 35 %: la SB juega 3-bet o fold)`);
  const bb = charts[`VS_OPEN_BB_vs_${POS[a]}`];
  if (callPct(bb) / contPct(bb) < 0.55)
    err(`VS_OPEN_BB_vs_${POS[a]}: solo paga el ${(callPct(bb) / contPct(bb) * 100).toFixed(0)} % de lo que defiende (mínimo 55 %)`);
}
// Cuanto más tarde la posición, más se continúa contra la misma apertura (UTG y HJ)
for (const opener of ['UTG', 'HJ']) {
  const order = ['HJ', 'CO', 'BTN'].filter((p) => POS.indexOf(p) > POS.indexOf(opener));
  for (let i = 0; i < order.length - 1; i++) {
    const e = contPct(charts[`VS_OPEN_${order[i]}_vs_${opener}`]), l = contPct(charts[`VS_OPEN_${order[i + 1]}_vs_${opener}`]);
    if (l + 1 < e) err(`VS_OPEN_${order[i + 1]}_vs_${opener} continúa menos (${l.toFixed(1)} %) que ${order[i]} (${e.toFixed(1)} %)`);
  }
}
// La BB defiende más cuanto más tarde (y más amplio) abre el rival
for (let i = 0; i < 4; i++) {
  const e = contPct(charts[`VS_OPEN_BB_vs_${POS[i]}`]), l = contPct(charts[`VS_OPEN_BB_vs_${POS[i + 1]}`]);
  if (l + 1 < e) err(`VS_OPEN_BB_vs_${POS[i + 1]} defiende menos (${l.toFixed(1)} %) que contra ${POS[i]} (${e.toFixed(1)} %)`);
}
// Contra un 3-bet de las ciegas el abridor tiene posición: defiende al menos lo mismo y paga más
for (const opener of ['UTG', 'HJ', 'CO']) {
  const ip = charts[`VS_3BET_${opener}_vs_BB`], oop = charts[`VS_3BET_${opener}_vs_BTN`];
  if (contPct(ip) + 1 < contPct(oop)) err(`VS_3BET_${opener}: defiende menos contra la BB (en posición) que contra el BTN (sin posición)`);
  if (callPct(ip) + 0.5 < callPct(oop)) err(`VS_3BET_${opener}: paga menos contra la BB (en posición) que contra el BTN (sin posición)`);
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
