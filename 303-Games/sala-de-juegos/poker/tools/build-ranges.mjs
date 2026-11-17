// Construye ranges.json a partir de rangos escritos en notación de póker.
// Uso: node tools/build-ranges.mjs ranges.json
// Notación: "22+", "77-TT", "A2s+", "K9s+", "ATo+", "KQo", "T9s", "A5s-A2s"; ":0.5" = frecuencia.
//
// Método (v2): la forma de cada rango (qué manos y en qué proporción) está escrita a mano siguiendo
// la estructura típica de las soluciones de solver, y después se ESCALA automáticamente para que la
// frecuencia total de cada acción coincida con la de una referencia publicada:
//   BeyondGTO, "6-max cash GTO preflop" (NL500, 100 bb, con rake; aperturas 2,5 bb y SB 3 bb).
// Las manos al 100 % (núcleo de valor) no se escalan. El resultado NO es la salida exacta de un solver:
// las frecuencias globales están calibradas, el reparto mano a mano es aproximado.
import fs from 'node:fs';

const R = 'AKQJT98765432';
const idx = (c) => R.indexOf(c);

// Expande un token como "A2s+" o "77-TT" a la lista de manos de 169
function expand(token) {
  const t = token.trim();
  if (!t) return [];
  let m;
  if ((m = t.match(/^([AKQJT2-9])\1\+$/))) { const out = []; for (let i = idx(m[1]); i >= 0; i--) out.push(R[i] + R[i]); return out; }
  if ((m = t.match(/^([AKQJT2-9])\1-([AKQJT2-9])\2$/))) {
    const [a, b] = [idx(m[1]), idx(m[2])].sort((x, y) => x - y); const out = [];
    for (let i = a; i <= b; i++) out.push(R[i] + R[i]); return out;
  }
  if ((m = t.match(/^([AKQJT2-9])\1$/))) return [t];
  if ((m = t.match(/^([AKQJT2-9])([AKQJT2-9])([so])\+$/))) {
    const hi = idx(m[1]), lo = idx(m[2]), out = [];
    for (let j = lo; j > hi; j--) out.push(m[1] + R[j] + m[3]); return out;
  }
  if ((m = t.match(/^([AKQJT2-9])([AKQJT2-9])([so])-([AKQJT2-9])([AKQJT2-9])\3$/))) {
    if (m[1] !== m[4]) throw new Error('Rango no soportado: ' + t);
    const [a, b] = [idx(m[2]), idx(m[5])].sort((x, y) => x - y), out = [];
    for (let j = a; j <= b; j++) out.push(m[1] + R[j] + m[3]); return out;
  }
  if ((m = t.match(/^([AKQJT2-9])([AKQJT2-9])([so])$/))) {
    if (idx(m[1]) >= idx(m[2])) throw new Error('Orden de cartas incorrecto: ' + t);
    return [t];
  }
  throw new Error('No entiendo el token: ' + t);
}

// "A2s+, KTs:0.5" → { A2s: 1, …, KTs: 0.5 }. Si una mano se repite, gana la última.
function parse(str) {
  const out = {};
  for (const raw of str.split(',')) {
    if (!raw.trim()) continue;
    const [tok, f] = raw.split(':');
    const v = f === undefined ? 1 : Number(f);
    for (const h of expand(tok)) out[h] = v;
  }
  return out;
}

const charts = {};
const round = (v) => Math.round(v * 20) / 20;

// Tabla con dos acciones: primero la agresiva y luego la pasiva; la pasiva se recorta para que sumen ≤ 1
function two(aggrName, aggr, passName, pass, limit) {
  const a = parse(aggr), p = parse(pass), out = {};
  for (const h of new Set([...Object.keys(a), ...Object.keys(p)])) {
    let av = a[h] || 0, pv = p[h] || 0;
    const cap = limit ? (limit[h] || 0) : 1;                 // no se defiende más de lo que se abre
    if (av > cap) av = cap;
    if (av + pv > cap) pv = Math.max(0, cap - av);
    av = round(av); pv = round(pv);
    const e = {};
    if (av > 0) e[aggrName] = av;
    if (pv > 0) e[passName] = pv;
    if (Object.keys(e).length) out[h] = e;
  }
  return out;
}
const rfi = (str) => Object.fromEntries(Object.entries(parse(str)).map(([h, v]) => [h, { raise: round(v) }]));


/* ---------- Ajuste: escala un rango para clavar una frecuencia objetivo ---------- */
// Une dos rangos: si una mano está en los dos, se queda el mayor peso
function merge(base, extra) {
  const a = parse(base), b = parse(extra || '');
  for (const [h, v] of Object.entries(b)) a[h] = Math.max(a[h] || 0, v);
  return a;
}
// Pesos × k (las manos a 1 se quedan a 1) → texto en notación
const scaled = (w, k) => Object.entries(w).map(([h, v]) => h + ':' + (v >= 1 ? 1 : Math.min(1, round(v * k)))).join(', ');
const COMBOS = (h) => (h.length === 2 ? 6 : h[2] === 's' ? 4 : 12);
// % de la acción sobre el total de manos (sin limit) o sobre el rango de apertura (con limit)
function share(chart, act, limit) {
  let t = 0, tot = 0;
  for (const [h, e] of Object.entries(chart)) t += COMBOS(h) * (e[act] || 0);
  if (!limit) return (100 * t) / 1326;
  for (const [h, v] of Object.entries(limit)) tot += COMBOS(h) * v;
  return (100 * t) / tot;
}
// Busca k por bisección para que `act` tenga la frecuencia `target`; mk(k) construye la tabla
function fitK(mk, act, target, limit) {
  let lo = 0.05, hi = 8;
  for (let i = 0; i < 40; i++) {
    const k = (lo + hi) / 2;
    if (share(mk(k), act, limit) < target) lo = k; else hi = k;
  }
  return (lo + hi) / 2;
}
// Quita mezclas residuales: una acción por debajo del 15 % se elimina y una mano que continúa el 85 % o más
// pasa a continuar siempre (la diferencia se suma a la acción mayoritaria). Las tablas reales tienen
// muchas acciones puras; las mezclas quedan para las manos frontera.
function purify(chart, limit) {
  for (const [h, e] of Object.entries(chart)) {
    const cap = limit ? (limit[h] || 0) : 1;
    for (const k of Object.keys(e)) if (e[k] < 0.15 && cap >= 0.5) delete e[k];
    const ks = Object.keys(e);
    if (!ks.length) { delete chart[h]; continue; }
    const sum = ks.reduce((t, k) => t + e[k], 0), main = ks.reduce((a, b) => (e[a] >= e[b] ? a : b));
    if (sum >= cap - 0.15 + 1e-9 && sum < cap) e[main] = round(e[main] + cap - sum);
  }
  return chart;
}
// Tabla de dos acciones ajustada: primero la agresiva (tiene prioridad), luego la pasiva
function fitted(aggrName, wA, tA, passName, wP, tP, limit) {
  const mk = (sA, sP) => purify(two(aggrName, sA, passName, sP, limit), limit);
  const kA = fitK((k) => mk(scaled(wA, k), ''), aggrName, tA, limit);
  const sA = scaled(wA, kA);
  const kP = fitK((k) => mk(sA, scaled(wP, k)), passName, tP, limit);
  return mk(sA, scaled(wP, kP));
}

/* ---------- 1. Aperturas (raise o fold) ---------- */
const RFI = {
  UTG: '22:0.5, 33+, A2s+, KTs+, K9s:0.5, QTs+, Q9s:0.25, JTs, J9s:0.25, T9s, 98s:0.5, 87s:0.25, 76s:0.25, ATo+, KJo+, KTo:0.25, QJo:0.5',
  HJ:  '22+, A2s+, K8s+, K7s:0.5, Q9s+, Q8s:0.25, J9s+, T9s, T8s:0.5, 98s, 87s:0.75, 76s:0.5, 65s:0.5, A9o+, A8o:0.25, KTo+, QJo, QTo:0.5, JTo:0.5',
  CO:  '22+, A2s+, K5s+, K4s:0.5, Q8s+, Q7s:0.5, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s:0.75, A8o+, A7o:0.5, A5o:0.5, KTo+, K9o:0.5, QTo+, JTo, T9o:0.25',
  BTN: '22+, A2s+, K2s+, Q4s+, Q3s:0.5, Q2s:0.25, J6s+, J5s:0.25, T6s+, 96s+, 85s+, 75s+, 74s:0.5, 64s+, 53s+, 43s:0.25, A2o+, K9o+, K8o:0.75, K7o:0.25, Q9o+, Q8o:0.25, J9o+, J8o:0.25, T8o:0.75, T9o, 98o:0.75, 87o:0.25',
  SB:  '22+, A2s+, K2s+, Q5s+, Q4s:0.5, J7s+, J6s:0.5, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, 53s:0.5, A2o+, K9o+, K8o:0.5, Q9o+, J9o+, T9o, 98o:0.5',
};
for (const [p, s] of Object.entries(RFI)) charts['RFI_' + p] = rfi(s);

/* ---------- 2. Contra apertura (3-bet / call) ---------- */
// Frecuencias objetivo [3-bet %, call %] sobre el total de manos (BeyondGTO NL500, 100 bb).
// La referencia llama LJ a la primera posición: aquí es UTG.
const TARGET_OPEN = {
  HJ_vs_UTG: [6.4, 4.1], CO_vs_UTG: [6.6, 5.3], CO_vs_HJ: [8.0, 5.3],
  BTN_vs_UTG: [6.8, 7.1], BTN_vs_HJ: [8.2, 7.8], BTN_vs_CO: [10.4, 8.8],
  SB_vs_UTG: [6.1, 5.2], SB_vs_HJ: [7.4, 5.3], SB_vs_CO: [9.1, 4.5], SB_vs_BTN: [13.2, 5.2],
  BB_vs_UTG: [6.0, 21.5], BB_vs_HJ: [7.5, 23.1], BB_vs_CO: [10.4, 26.3], BB_vs_BTN: [13.4, 31.7], BB_vs_SB: [16.9, 38.7],
};


// Forma de cada rango [3-bet, call]. El ajuste conserva las proporciones y escala hasta el objetivo.
const BASE_OPEN = {
  /* ---- En posición: 3-bet lineal-polarizado y call con parejas y suited ---- */
  HJ_vs_UTG: [
    'QQ+, JJ:0.6, TT:0.3, AKs, AKo:0.85, AQs:0.6, AJs:0.35, KQs:0.55, KJs:0.25, A5s:0.65, A4s:0.5, A3s:0.2, AQo:0.2',
    'JJ:0.4, TT:0.55, 99:0.55, 88:0.45, 77:0.3, 66:0.15, AKo:0.15, AQs:0.4, AJs:0.5, ATs:0.3, KQs:0.4, KJs:0.4, KTs:0.15, QJs:0.4, JTs:0.35, T9s:0.1, AQo:0.25',
  ],
  CO_vs_UTG: [
    'QQ+, JJ:0.6, TT:0.3, AKs, AKo:0.85, AQs:0.6, AJs:0.4, KQs:0.6, KJs:0.3, A5s:0.7, A4s:0.55, A3s:0.25, QJs:0.15, AQo:0.2',
    'JJ:0.4, TT:0.6, 99:0.6, 88:0.5, 77:0.4, 66:0.2, AKo:0.15, AQs:0.4, AJs:0.6, ATs:0.4, KQs:0.4, KJs:0.5, KTs:0.25, QJs:0.5, QTs:0.15, JTs:0.45, T9s:0.15, AQo:0.3',
  ],
  CO_vs_HJ: [
    'JJ+, TT:0.5, 99:0.15, AKs, AKo, AQs:0.75, AJs:0.5, ATs:0.25, KQs:0.7, KJs:0.4, KTs:0.2, A5s:0.8, A4s:0.7, A3s:0.4, A2s:0.2, QJs:0.25, JTs:0.15, AQo:0.45, KQo:0.1, 76s:0.1, 65s:0.1',
    'TT:0.5, 99:0.75, 88:0.65, 77:0.5, 66:0.35, 55:0.2, AQs:0.25, AJs:0.5, ATs:0.5, A9s:0.15, KQs:0.3, KJs:0.55, KTs:0.4, QJs:0.6, QTs:0.3, JTs:0.6, T9s:0.3, 98s:0.15, AQo:0.35, AJo:0.1',
  ],
  BTN_vs_UTG: [
    'QQ+, JJ:0.55, TT:0.25, AKs, AKo:0.8, AQs:0.55, AJs:0.35, KQs:0.55, KJs:0.25, A5s:0.7, A4s:0.55, A3s:0.3, QJs:0.15, JTs:0.1, AQo:0.2',
    'JJ:0.45, TT:0.75, 99:0.85, 88:0.75, 77:0.65, 66:0.5, 55:0.35, 44:0.2, AKo:0.2, AQs:0.45, AJs:0.65, ATs:0.6, A9s:0.2, KQs:0.45, KJs:0.75, KTs:0.5, QJs:0.75, QTs:0.4, JTs:0.75, T9s:0.5, 98s:0.3, 87s:0.15, AQo:0.45, AJo:0.1, KQo:0.1',
  ],
  BTN_vs_HJ: [
    'JJ+, TT:0.5, 99:0.2, AKs, AKo, AQs:0.75, AJs:0.5, ATs:0.25, KQs:0.7, KJs:0.45, KTs:0.25, A5s:0.85, A4s:0.75, A3s:0.45, A2s:0.25, QJs:0.3, JTs:0.2, AQo:0.45, KQo:0.15, 76s:0.15, 65s:0.15',
    'TT:0.5, 99:0.8, 88:0.85, 77:0.8, 66:0.65, 55:0.5, 44:0.35, 33:0.2, AQs:0.25, AJs:0.5, ATs:0.7, A9s:0.4, A8s:0.15, KQs:0.3, KJs:0.55, KTs:0.65, K9s:0.2, QJs:0.7, QTs:0.6, Q9s:0.15, JTs:0.75, J9s:0.3, T9s:0.65, 98s:0.45, 87s:0.3, 76s:0.2, AQo:0.5, AJo:0.3, KQo:0.35',
  ],
  BTN_vs_CO: [
    'TT+, 99:0.4, 88:0.15, AKs, AQs, AJs:0.7, ATs:0.45, A9s:0.15, AKo, AQo:0.7, AJo:0.25, KQs:0.85, KJs:0.6, KTs:0.4, K9s:0.2, KQo:0.35, QJs:0.45, QTs:0.3, JTs:0.35, T9s:0.25, A5s, A4s:0.85, A3s:0.6, A2s:0.4, 98s:0.15, 87s:0.15, 76s:0.2, 65s:0.2, 54s:0.1',
    '99:0.6, 88:0.85, 77:0.9, 66:0.8, 55:0.7, 44:0.55, 33:0.45, 22:0.35, AJs:0.3, ATs:0.55, A9s:0.6, A8s:0.4, A7s:0.25, A6s:0.15, KQs:0.15, KJs:0.4, KTs:0.6, K9s:0.4, QJs:0.55, QTs:0.65, Q9s:0.35, JTs:0.65, J9s:0.5, T9s:0.7, T8s:0.25, 98s:0.6, 97s:0.15, 87s:0.5, 76s:0.4, 65s:0.3, AQo:0.3, AJo:0.45, KQo:0.45, KJo:0.15',
  ],
  /* ---- SB: casi todo 3-bet; un call pequeño con parejas medias y suited ---- */
  SB_vs_UTG: [
    'QQ+, JJ:0.75, TT:0.55, 99:0.4, 88:0.25, AKs, AKo:0.9, AQs:0.7, AJs:0.4, KQs:0.6, KJs:0.2, A5s:0.65, A4s:0.5, A3s:0.2, AQo:0.25',
    'JJ:0.25, TT:0.35, 99:0.4, 88:0.45, 77:0.45, 66:0.35, 55:0.2, AKo:0.1, AQs:0.3, AJs:0.5, ATs:0.4, KQs:0.35, KJs:0.45, KTs:0.2, QJs:0.45, QTs:0.15, JTs:0.4, T9s:0.15, AQo:0.15',
  ],
  SB_vs_HJ: [
    'JJ+, TT:0.75, 99:0.55, 88:0.45, 77:0.35, 66:0.15, AKs, AKo, AQs:0.8, AJs:0.55, ATs:0.25, KQs:0.75, KJs:0.4, KTs:0.15, A5s:0.8, A4s:0.65, A3s:0.3, QJs:0.25, JTs:0.15, AQo:0.5, KQo:0.15',
    'TT:0.25, 99:0.4, 88:0.45, 77:0.45, 66:0.45, 55:0.3, 44:0.15, AQs:0.2, AJs:0.45, ATs:0.5, A9s:0.15, KQs:0.25, KJs:0.5, KTs:0.4, QJs:0.55, QTs:0.3, JTs:0.5, T9s:0.3, 98s:0.15, AQo:0.2',
  ],
  SB_vs_CO: [
    'TT+, 99:0.75, 88:0.6, 77:0.45, 66:0.25, AKs, AQs, AJs:0.8, ATs:0.5, AKo, AQo:0.75, AJo:0.3, KQs:0.9, KJs:0.65, KTs:0.4, KQo:0.35, QJs:0.5, QTs:0.25, JTs:0.4, T9s:0.2, A5s:0.9, A4s:0.8, A3s:0.5, A2s:0.3, 76s:0.1, 65s:0.1',
    '99:0.25, 88:0.35, 77:0.45, 66:0.5, 55:0.4, 44:0.25, AJs:0.2, ATs:0.4, A9s:0.3, KQs:0.1, KJs:0.3, KTs:0.4, QJs:0.4, QTs:0.45, JTs:0.5, T9s:0.4, 98s:0.25, 87s:0.1, AQo:0.15, AJo:0.15',
  ],
  SB_vs_BTN: [
    '99+, 88:0.8, 77:0.65, 66:0.45, 55:0.25, AKs, AQs, AJs, ATs:0.9, A9s:0.65, A8s:0.4, AKo, AQo, AJo:0.7, ATo:0.3, KQs, KJs:0.9, KTs:0.7, K9s:0.45, KQo:0.8, KJo:0.35, QJs:0.8, QTs:0.6, Q9s:0.3, JTs:0.9, J9s:0.35, T9s:0.55, 98s:0.35, 87s:0.3, 76s:0.3, 65s:0.25, A5s:0.9, A4s:0.85, A3s:0.7, A2s:0.55, A7s:0.3, A6s:0.2',
    '88:0.2, 77:0.35, 66:0.45, 55:0.45, 44:0.35, 33:0.25, 22:0.15, A9s:0.3, K8s:0.3, Q8s:0.25, J8s:0.25, 97s:0.25, 86s:0.2, 75s:0.15, 54s:0.25, A8s:0.4, A7s:0.35, A6s:0.3, KTs:0.25, K9s:0.35, QTs:0.35, Q9s:0.4, J9s:0.45, T9s:0.4, T8s:0.25, 98s:0.45, 87s:0.4, 76s:0.35, 65s:0.3, ATo:0.1',
  ],
  /* ---- BB: mucho call (cierra la acción con descuento) y 3-bet polarizado ---- */
  BB_vs_UTG: [
    'QQ+, JJ:0.4, AKs, AKo:0.75, AQs:0.45, AJs:0.15, KQs:0.35, A5s:0.75, A4s:0.6, A3s:0.3, A2s:0.15, K9s:0.1, QJs:0.1, 76s:0.15, 65s:0.15, 54s:0.1',
    'JJ:0.6, TT, 99, 88, 77, 66, 55, 44, 33, 22, AKo:0.25, AQs:0.55, AJs:0.85, ATs, A9s, A8s, A7s:0.8, A6s:0.75, A5s:0.25, A4s:0.4, A3s:0.6, A2s:0.6, KQs:0.65, KJs, KTs, K9s:0.8, K8s:0.5, K7s:0.35, K6s:0.3, QJs:0.9, QTs, Q9s:0.75, Q8s:0.3, JTs, J9s:0.85, J8s:0.3, T9s, T8s:0.6, 98s:0.85, 97s:0.3, 87s:0.8, 86s:0.15, 76s:0.75, 65s:0.65, 54s:0.5, AQo, AJo:0.75, ATo:0.25, KQo:0.8, KJo:0.3',
  ],
  BB_vs_HJ: [
    'QQ+, JJ:0.55, TT:0.15, AKs, AKo:0.8, AQs:0.55, AJs:0.25, KQs:0.45, KJs:0.15, A5s:0.8, A4s:0.7, A3s:0.4, A2s:0.25, K9s:0.15, QJs:0.15, Q9s:0.1, J9s:0.1, 76s:0.2, 65s:0.2, 54s:0.15',
    'JJ:0.45, TT:0.85, 99, 88, 77, 66, 55, 44, 33, 22, AKo:0.2, AQs:0.45, AJs:0.75, ATs, A9s, A8s, A7s, A6s, A5s:0.2, A4s:0.3, A3s:0.6, A2s:0.75, KQs:0.55, KJs:0.85, KTs, K9s:0.85, K8s:0.65, K7s:0.5, K6s:0.4, K5s:0.3, QJs:0.85, QTs, Q9s:0.9, Q8s:0.5, JTs, J9s:0.9, J8s:0.5, T9s, T8s:0.8, 98s, 97s:0.5, 87s, 86s:0.35, 76s:0.8, 75s:0.2, 65s:0.8, 54s:0.65, AQo, AJo:0.9, ATo:0.5, KQo:0.9, KJo:0.55, QJo:0.3, KTo:0.15',
  ],
  BB_vs_CO: [
    'QQ+, JJ:0.7, TT:0.35, 99:0.15, AKs, AQs:0.7, AJs:0.4, ATs:0.15, AKo, AQo:0.35, KQs:0.6, KJs:0.3, KTs:0.15, A5s:0.9, A4s:0.8, A3s:0.6, A2s:0.4, K9s:0.25, K8s:0.15, Q9s:0.2, QJs:0.2, J9s:0.2, T8s:0.15, 97s:0.15, 86s:0.15, 76s:0.25, 65s:0.25, 54s:0.2, AJo:0.1, KQo:0.1',
    'JJ:0.3, TT:0.65, 99:0.85, 88, 77, 66, 55, 44, 33, 22, AQs:0.3, AJs:0.6, ATs:0.85, A9s, A8s, A7s, A6s, A5s:0.1, A4s:0.2, A3s:0.4, A2s:0.6, KQs:0.4, KJs:0.7, KTs:0.85, K9s:0.75, K8s:0.85, K7s:0.75, K6s:0.6, K5s:0.5, K4s:0.3, QJs:0.8, QTs, Q9s:0.8, Q8s:0.7, Q7s:0.25, JTs, J9s:0.8, J8s:0.7, J7s:0.2, T9s, T8s:0.85, T7s:0.35, 98s, 97s:0.7, 96s:0.2, 87s, 86s:0.6, 76s:0.75, 75s:0.4, 65s:0.75, 64s:0.2, 54s:0.7, 53s:0.15, AQo:0.65, AJo:0.9, ATo:0.75, A9o:0.2, KQo:0.9, KJo:0.75, KTo:0.35, QJo:0.6, QTo:0.2, JTo:0.4',
  ],
  BB_vs_BTN: [
    'JJ+, TT:0.6, 99:0.35, 88:0.15, AKs, AQs, AJs:0.6, ATs:0.35, A9s:0.15, AKo, AQo:0.7, AJo:0.3, KQs:0.75, KJs:0.5, KTs:0.35, K9s:0.3, K8s:0.2, K7s:0.15, KQo:0.3, QJs:0.4, QTs:0.3, Q9s:0.3, Q8s:0.15, JTs:0.35, J9s:0.3, J8s:0.2, T9s:0.3, T8s:0.25, 98s:0.25, 97s:0.2, 87s:0.25, 86s:0.15, 76s:0.3, 65s:0.3, 54s:0.3, A5s, A4s:0.9, A3s:0.7, A2s:0.6, A8s:0.15, A7s:0.15, KJo:0.15, QJo:0.1',
    'TT:0.4, 99:0.65, 88:0.85, 77, 66, 55, 44, 33, 22, AJs:0.4, ATs:0.65, A9s:0.85, A8s:0.85, A7s:0.85, A6s, A4s:0.1, A3s:0.3, A2s:0.4, KQs:0.25, KJs:0.5, KTs:0.65, K9s:0.7, K8s:0.8, K7s:0.85, K6s, K5s, K4s:0.85, K3s:0.7, K2s:0.6, QJs:0.6, QTs:0.7, Q9s:0.7, Q8s:0.85, Q7s:0.75, Q6s:0.6, Q5s:0.4, Q4s:0.25, JTs:0.65, J9s:0.7, J8s:0.8, J7s:0.7, J6s:0.35, T9s:0.7, T8s:0.75, T7s:0.8, T6s:0.3, 98s:0.75, 97s:0.8, 96s:0.5, 87s:0.75, 86s:0.8, 85s:0.35, 76s:0.7, 75s:0.75, 74s:0.2, 65s:0.7, 64s:0.6, 54s:0.7, 53s:0.4, 43s:0.25, AQo:0.3, AJo:0.7, ATo:0.9, A9o:0.75, A8o:0.55, A7o:0.35, A6o:0.15, A5o:0.35, A4o:0.2, KQo:0.7, KJo:0.85, KTo:0.8, K9o:0.45, K8o:0.15, QJo:0.9, QTo:0.75, Q9o:0.35, JTo:0.8, J9o:0.35, T9o:0.5, 98o:0.2',
  ],
  BB_vs_SB: [
    '99+, 88:0.6, 77:0.4, 66:0.2, AKs, AQs, AJs, ATs:0.7, A9s:0.4, A8s:0.25, AKo, AQo, AJo:0.6, ATo:0.3, KQs, KJs:0.75, KTs:0.55, K9s:0.4, K8s:0.3, K7s:0.25, KQo:0.65, KJo:0.35, KTo:0.15, QJs:0.6, QTs:0.45, Q9s:0.35, Q8s:0.2, QJo:0.2, JTs:0.5, J9s:0.4, J8s:0.25, T9s:0.45, T8s:0.35, 98s:0.4, 97s:0.25, 87s:0.4, 86s:0.2, 76s:0.4, 65s:0.4, 54s:0.35, A5s, A4s, A3s:0.8, A2s:0.7, A7s:0.3, A6s:0.3, K6s:0.2, K5s:0.2, Q7s:0.15, J7s:0.1, T7s:0.15, 75s:0.15, 64s:0.15, 53s:0.15',
    '88:0.4, 77:0.6, 66:0.8, 55, 44, 33, 22, ATs:0.3, A9s:0.6, A8s:0.75, A7s:0.7, A6s:0.7, A3s:0.2, A2s:0.3, KJs:0.25, KTs:0.45, K9s:0.6, K8s:0.7, K7s:0.75, K6s:0.8, K5s:0.8, K4s, K3s, K2s:0.9, QJs:0.4, QTs:0.55, Q9s:0.65, Q8s:0.8, Q7s:0.85, Q6s, Q5s:0.9, Q4s:0.75, Q3s:0.6, Q2s:0.5, JTs:0.5, J9s:0.6, J8s:0.75, J7s:0.9, J6s:0.8, J5s:0.6, J4s:0.4, T9s:0.55, T8s:0.65, T7s:0.85, T6s:0.7, T5s:0.3, 98s:0.6, 97s:0.75, 96s:0.75, 95s:0.3, 87s:0.6, 86s:0.8, 85s:0.6, 76s:0.6, 75s:0.85, 74s:0.4, 65s:0.6, 64s:0.85, 63s:0.3, 54s:0.65, 53s:0.85, 43s:0.6, 42s:0.2, ATo:0.7, A9o:0.85, A8o:0.8, A7o:0.7, A6o:0.6, A5o:0.75, A4o:0.6, A3o:0.45, A2o:0.3, KJo:0.65, KTo:0.85, K9o:0.8, K8o:0.55, K7o:0.4, K6o:0.25, QJo:0.8, QTo:0.85, Q9o:0.7, Q8o:0.35, JTo:0.85, J9o:0.7, J8o:0.3, T9o:0.75, T8o:0.4, 98o:0.5, 97o:0.15, 87o:0.35, 76o:0.2',
  ],
};

// Manos de peso bajo que se añaden para que la escala tenga dónde crecer sin saturar el núcleo
const EXTRA3 = {
  ip:  'AQo:0.3, AJo:0.15, KQo:0.25, KJo:0.1, KJs:0.3, KTs:0.2, QJs:0.25, QTs:0.15, JTs:0.2, T9s:0.15, 98s:0.1, 87s:0.1, 76s:0.12, 65s:0.12, 54s:0.08, A3s:0.3, A2s:0.25, K9s:0.1, A9s:0.08, ATs:0.25',
  sb:  'AQo:0.35, AJo:0.2, KQo:0.3, KJo:0.15, QJo:0.08, KJs:0.35, KTs:0.25, QJs:0.3, QTs:0.2, JTs:0.25, T9s:0.2, 98s:0.15, 87s:0.12, 76s:0.12, 65s:0.12, 54s:0.1, A3s:0.35, A2s:0.3, K9s:0.15, A9s:0.12, ATs:0.3, 99:0.3, 88:0.25, 77:0.2',
  bb:  'AQo:0.3, AJo:0.15, KQo:0.2, KJo:0.1, KJs:0.25, KTs:0.15, QJs:0.2, QTs:0.15, JTs:0.2, T9s:0.15, 98s:0.12, 87s:0.15, 76s:0.18, 65s:0.18, 54s:0.15, A3s:0.4, A2s:0.3, K9s:0.15, K8s:0.1, Q9s:0.1, J9s:0.1, T8s:0.08, 97s:0.08, 86s:0.08, 75s:0.06, 64s:0.06, TT:0.25, 99:0.15',
};
const EXTRAC = {
  ip:  '55:0.12, 44:0.08, 33:0.05, 22:0.05, A9s:0.2, A8s:0.15, A7s:0.1, K9s:0.2, Q9s:0.15, J9s:0.2, T9s:0.3, 98s:0.25, 87s:0.2, 76s:0.15, 65s:0.12, AJo:0.15, KQo:0.15, KJo:0.08, QJo:0.05',
  sb:  '55:0.25, 44:0.2, 33:0.15, 22:0.1, A9s:0.2, A8s:0.15, K9s:0.2, Q9s:0.15, J9s:0.2, T9s:0.25, 98s:0.2, 87s:0.15, 76s:0.12, AJo:0.1, KQo:0.1',
  bb:  'Q7s:0.2, Q6s:0.15, Q5s:0.1, J7s:0.2, T7s:0.2, 96s:0.15, 85s:0.15, 74s:0.1, 63s:0.08, 53s:0.15, 43s:0.12, A9o:0.12, A8o:0.08, A7o:0.06, A5o:0.12, K9o:0.15, Q9o:0.12, J9o:0.12, T9o:0.15, 98o:0.08, K5s:0.2, K4s:0.15, K3s:0.12, K2s:0.1, A6o:0.1, A4o:0.08, A3o:0.06, A2o:0.05, K8o:0.1, K7o:0.06, Q8o:0.08, J8o:0.08, T8o:0.1, 97o:0.06, 87o:0.08, 76o:0.06, 65o:0.05, J5s:0.1, T6s:0.12, 95s:0.1, 84s:0.08, 73s:0.06, 52s:0.08, 42s:0.06, 32s:0.05, Q4s:0.1, Q3s:0.08, Q2s:0.06, J6s:0.12',
};
const kind = (hero) => (hero === 'SB' ? 'sb' : hero === 'BB' ? 'bb' : 'ip');

const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  const opener = POS[a], hero = POS[b], key = `${hero}_vs_${opener}`;
  const [t3, tc] = TARGET_OPEN[key], [s3, sc] = BASE_OPEN[key];
  charts['VS_OPEN_' + key] = fitted('3bet', merge(s3, EXTRA3[kind(hero)]), t3, 'call', merge(sc, EXTRAC[kind(hero)]), tc);
}

/* ---------- 3. Contra 3-bet (4-bet / call) ---------- */
// Objetivo [4-bet %, call %] sobre el rango con el que se abrió. Referencia (3-bets de 6,25-7,5 bb):
// el abridor foldea 19-33 %, paga 56-66 % y hace 4-bet 9-16 %; SB contra BB: fold 47 %, call 38 %, 4-bet 16 %.
// Nuestro 3-bet es algo mayor (3x en posición = 7,5 bb, 4x sin posición = 10 bb), así que se foldea un poco más.
function target3(opener, three) {
  if (opener === 'SB') return [16, 38];                       // SB contra BB, sin posición
  // Cuantos más jugadores quedan por hablar detrás del que resube (pueden hacer cold 4-bet),
  // menos se paga: 1 punto por jugador (BB 0, SB 1, BTN 2, CO 3, HJ 4)
  const behind = 5 - POS.indexOf(three);
  const blind = three === 'SB' || three === 'BB';             // el abridor tiene posición
  if (blind) return opener === 'BTN' ? [12, 48 - behind] : [12, 56 - behind];   // el BTN abre muy amplio: más fold
  if (opener === 'UTG' && three === 'HJ') return [10, 50];    // el 3-bet más fuerte
  return opener === 'CO' ? [12, 54 - behind] : [11, 54 - behind];
}
// 4-bet: valor + algún farol con ases suited. Más amplio contra 3-bets de posiciones tardías.
const V4 = {
  tight: 'KK+, QQ:0.5, AKs, AKo:0.6, A5s:0.4, A4s:0.3, A3s:0.1, KQs:0.05',
  mid:   'QQ+, JJ:0.3, AKs, AKo:0.75, AQs:0.3, A5s:0.5, A4s:0.4, A3s:0.25, A2s:0.15, KJs:0.1, K9s:0.08, QJs:0.05, 76s:0.05, 65s:0.05',
  wide:  'QQ+, JJ:0.5, TT:0.25, AKs, AKo, AQs:0.5, AQo:0.3, AJs:0.15, A5s:0.6, A4s:0.5, A3s:0.4, A2s:0.3, K9s:0.15, K8s:0.1, K5s:0.12, K4s:0.1, Q9s:0.1, J9s:0.08, T8s:0.06, 76s:0.1, 65s:0.1, 54s:0.08, KJo:0.12, QJo:0.06, A9o:0.06, A5o:0.08',
};
// Call sin posición (el 3-bet viene de una posición posterior que no es ciega)
const CALL_OOP = 'QQ, AKo, JJ, TT, 99:0.9, 88:0.75, 77:0.6, 66:0.4, 55:0.25, AQs:0.9, AJs, ATs:0.75, A9s:0.3, KQs, KJs:0.8, KTs:0.5, QJs:0.8, QTs:0.4, JTs:0.75, T9s:0.5, 98s:0.3, AQo:0.75, AJo:0.3, KQo:0.4';
// Call en posición (el 3-bet viene de SB o BB): más parejas, suited y broadways
const CALL_IP3 = 'QQ, AKo, JJ, TT, 99, 88, 77:0.8, 66:0.6, 55:0.4, AQs, AJs, ATs, A9s:0.5, KQs, KJs, KTs:0.7, QJs, QTs:0.6, JTs, T9s:0.7, 98s:0.5, 87s:0.4, AQo:0.75, AJo:0.5, KQo:0.5';
// El BTN y la SB abren muy amplio: defienden con más manos jugables
const CALL_CO = ', 66:0.6, 55:0.4, 44:0.25, A7s:0.3, A6s:0.3, K8s:0.3, T8s:0.3, KJo:0.3, QJo:0.25, A9s:0.5, A8s:0.4, K9s:0.5, Q9s:0.4, J9s:0.5, T9s:0.7, 98s:0.5, 87s:0.4, 76s:0.3, AJo:0.5, KQo:0.5, ATo:0.25';
const CALL_LATE = ', 88, 77:0.9, 66:0.8, 55:0.6, 44:0.5, 33:0.4, 22:0.3, A9s:0.8, A8s:0.7, A7s:0.6, A6s:0.5, K9s:0.8, K8s:0.5, K7s:0.4, K6s:0.3, Q9s:0.8, Q8s:0.5, J9s:0.8, J8s:0.4, T9s, T8s:0.7, 97s:0.6, 98s:0.8, 87s:0.7, 86s:0.4, 76s:0.6, 75s:0.3, 65s:0.6, 54s:0.5, AJo:0.75, ATo:0.6, A9o:0.3, KQo:0.8, KJo:0.6, KTo:0.4, QJo:0.6, QTo:0.3, JTo:0.5';

// Manos jugables de peso bajo (solo cuentan si están en el rango de apertura): dan margen a la escala
const CALL3_EXTRA = '22:0.25, 33:0.3, 44:0.35, 55:0.4, 66:0.45, A9s:0.4, A8s:0.35, A7s:0.3, A6s:0.3, A3s:0.2, A2s:0.2, KTs:0.5, K9s:0.4, K8s:0.25, K7s:0.2, K6s:0.15, QTs:0.5, Q9s:0.4, Q8s:0.25, J9s:0.4, J8s:0.25, T8s:0.35, 97s:0.3, 87s:0.35, 86s:0.2, 76s:0.35, 75s:0.15, 65s:0.35, 54s:0.3, 64s:0.15, 53s:0.1, AJo:0.35, ATo:0.3, A9o:0.15, KQo:0.4, KJo:0.3, KTo:0.2, QJo:0.3, QTo:0.2, JTo:0.25, T9o:0.1';
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  const opener = POS[a], three = POS[b];
  const blind3 = three === 'SB' || three === 'BB';
  const ip = blind3 && opener !== 'SB';                        // la SB contra la BB no tiene posición
  const late = opener === 'BTN' || opener === 'SB';
  const v4 = late ? 'wide' : opener === 'CO' || b - a > 1 ? 'mid' : 'tight';
  let call = (ip ? CALL_IP3 : CALL_OOP) + (late ? CALL_LATE : opener === 'CO' ? CALL_CO : '');
  call = merge(call, CALL3_EXTRA);                             // relleno de peso bajo para la escala
  const open = Object.fromEntries(Object.entries(charts['RFI_' + opener]).map(([h, e]) => [h, e.raise]));
  const [t4, tc] = target3(opener, three);
  charts[`VS_3BET_${opener}_vs_${three}`] = fitted('4bet', parse(V4[v4]), t4, 'call', call, tc, open);
}

const out = {
  version: 1,                 // formato del fichero (el mismo que aceptan los rangos importados)
  edition: 2,                 // edición de las tablas de referencia: al cambiar, se recalculan las notas guardadas
  name: 'Referencia 6-max · 100 bb (calibrada)',
  notes: 'Rangos construidos a mano con la estructura típica de solver y calibrados para que la frecuencia global de cada acción coincida con la referencia publicada de BeyondGTO (6-max NL500, 100 bb, con rake; apertura 2,5 bb, SB 3 bb). Frente a 3-bet se foldea algo más que en la referencia porque aquí el 3-bet es de 3x en posición y 4x sin posición. No es la salida exacta de un solver: el reparto mano a mano es aproximado y las manos frontera admiten mezcla.',
  charts,
};
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1) + '\n');
console.log('Escrito', Object.keys(charts).length, 'tablas en', process.argv[2]);
