// Construye ranges.json a partir de rangos escritos en notación de póker.
// Uso: node build-ranges.mjs salida.json
// Notación: "22+", "77-TT", "A2s+", "K9s+", "ATo+", "KQo", "T9s", "A5s-A2s"; ":0.5" = frecuencia.
// Son aproximaciones de referencia (6-max, 100 bb, sin rake, apertura 2,5 bb), no salida de solver.
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

/* ---------- 1. Aperturas (raise o fold) ---------- */
const RFI = {
  UTG: '22:0.5, 33+, A2s+, KTs+, K9s:0.5, QTs+, Q9s:0.25, JTs, J9s:0.25, T9s, 98s:0.5, 87s:0.25, 76s:0.25, ATo+, KJo+, KTo:0.25, QJo:0.5',
  HJ:  '22+, A2s+, K8s+, K7s:0.5, Q9s+, Q8s:0.25, J9s+, T9s, T8s:0.5, 98s, 87s:0.75, 76s:0.5, 65s:0.5, A9o+, A8o:0.25, KTo+, QJo, QTo:0.5, JTo:0.5',
  CO:  '22+, A2s+, K5s+, K4s:0.5, Q8s+, Q7s:0.5, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s:0.75, A8o+, A7o:0.5, A5o:0.5, KTo+, K9o:0.5, QTo+, JTo, T9o:0.25',
  BTN: '22+, A2s+, K2s+, Q4s+, Q3s:0.5, Q2s:0.5, J6s+, J5s:0.5, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s:0.5, A2o+, K8o+, K7o:0.5, K6o:0.5, Q9o+, Q8o:0.5, J9o+, J8o:0.5, T8o+, 98o, 97o:0.25, 87o:0.5',
  SB:  '22+, A2s+, K2s+, Q5s+, Q4s:0.5, J7s+, J6s:0.5, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, 53s:0.5, A2o+, K9o+, K8o:0.5, Q9o+, J9o+, T9o, 98o:0.5',
};
for (const [p, s] of Object.entries(RFI)) charts['RFI_' + p] = rfi(s);

/* ---------- 2. Contra apertura (3-bet / call) ---------- */
// 3-bet de valor + farol con ases suited, según lo amplio que sea el rango del abridor
const V3 = {
  UTG: 'QQ+, AKs, AKo:0.75, AQs:0.25, A5s:0.5, A4s:0.5',
  HJ:  'QQ+, JJ:0.25, AKs, AKo:0.85, AQs:0.5, KQs:0.25, A5s:0.6, A4s:0.6, A3s:0.3, KJs:0.25',
  CO:  'JJ+, TT:0.3, AQs+, AKo, AQo:0.4, AJs:0.3, KQs:0.4, A5s:0.7, A4s:0.7, A3s:0.5, A2s:0.3, K9s:0.3, QTs:0.3, J9s:0.3, T9s:0.25',
  BTN: 'TT+, 99:0.3, AJs+, ATs:0.5, AQo+, AJo:0.4, KQs, KJs:0.5, KQo:0.4, A5s:0.7, A4s:0.7, A3s:0.6, A2s:0.5, K9s:0.5, K5s:0.3, Q9s:0.4, J9s:0.4, T9s:0.4, 98s:0.3',
};
// Cold call en posición (HJ/CO/BTN): parejas medias, suited broadways y algún conector
const CALL_IP = {
  UTG: 'JJ:0.8, TT:0.8, 99:0.7, 88:0.5, 77:0.3, AQs:0.6, AJs:0.5, KQs:0.6, KJs:0.3, QJs:0.4, JTs:0.4, AQo:0.25',
  HJ:  'JJ:0.75, TT:0.8, 99:0.7, 88:0.6, 77:0.4, 66:0.25, AQs:0.5, AJs:0.6, ATs:0.3, KQs:0.6, KJs:0.4, QJs:0.5, JTs:0.5, T9s:0.25, AQo:0.3',
  CO:  'TT:0.7, 99:0.7, 88:0.7, 77:0.6, 66:0.4, 55:0.25, AJs:0.6, ATs:0.5, KQs:0.6, KJs:0.5, KTs:0.4, QJs:0.6, QTs:0.4, JTs:0.6, T9s:0.5, 98s:0.3, AQo:0.4, AJo:0.2',
};
// Extra para el BTN: es la mejor posición y paga algo más
const CALL_BTN_EXTRA = {
  UTG: '66:0.3, ATs:0.3, KTs:0.25, T9s:0.25',
  HJ:  '55:0.25, ATs:0.5, KTs:0.4, QTs:0.3, 98s:0.25',
  CO:  '44:0.25, A9s:0.3, K9s:0.25, J9s:0.3, 87s:0.25, KQo:0.3',
};
// La SB amplía el 3-bet y casi no paga (3-bet o fold)
const SB3 = {
  UTG: 'QQ+, JJ:0.6, TT:0.3, AKs, AKo, AQs:0.7, AJs:0.3, KQs:0.4, A5s:0.5, A4s:0.4',
  HJ:  'JJ+, TT:0.5, 99:0.25, AQs+, AKo, AQo:0.3, AJs:0.5, KQs:0.5, KJs:0.25, A5s:0.6, A4s:0.5, A3s:0.3',
  CO:  'TT+, 99:0.5, AJs+, ATs:0.6, AQo+, AJo:0.3, KQs, KJs:0.6, QJs:0.4, A5s:0.8, A4s:0.7, A3s:0.5, A2s:0.4, K9s:0.3, T9s:0.3',
  BTN: '99+, 88:0.6, 77:0.4, ATs+, A9s:0.6, AJo+, ATo:0.5, KTs+, KQo, KJo:0.4, QTs+, JTs:0.6, A5s, A4s, A3s:0.7, A2s:0.6, K9s:0.6, K8s:0.3, Q9s:0.4, J9s:0.4, T9s:0.5, 98s:0.4, 87s:0.3',
};
const SBCALL = {
  UTG: 'JJ:0.2, TT:0.3, 99:0.2, AQs:0.2',
  HJ:  'TT:0.25, 99:0.3, 88:0.2, AJs:0.2',
  CO:  '99:0.25, 88:0.3, 77:0.2, ATs:0.2',
  BTN: '88:0.25, 77:0.3, 66:0.3, 55:0.2',
};
// Defensa de la BB: mucho call (cierra la acción y ya ha puesto 1 bb) y un 3-bet polarizado
const BB3 = {
  UTG: 'QQ+, AKs, AKo:0.5, AQs:0.25, A5s:0.5, A4s:0.3',
  HJ:  'QQ+, JJ:0.3, AKs, AKo:0.6, AQs:0.4, A5s:0.5, A4s:0.4, KQs:0.2',
  CO:  'JJ+, TT:0.3, AQs+, AKo, AQo:0.3, KQs:0.3, A5s:0.6, A4s:0.5, A3s:0.3, K9s:0.2, 76s:0.2',
  BTN: 'TT+, 99:0.3, AJs+, AQo+, AJo:0.3, KQs, KJs:0.4, A5s:0.7, A4s:0.6, A3s:0.5, K9s:0.3, Q9s:0.3, J9s:0.3, T8s:0.3, 76s:0.3, 65s:0.3',
  SB:  '99+, 88:0.4, ATs+, AJo+, ATo:0.4, KTs+, KQo, KJo:0.4, QJs, QTs:0.5, JTs:0.5, A5s, A4s:0.8, A3s:0.6, A2s:0.5, K9s:0.5, K7s:0.3, Q9s:0.4, J9s:0.4, T9s:0.4, 87s:0.3, 76s:0.3, 65s:0.3',
};
const BBCALL = {
  UTG: '22+, A2s+, K6s+, K5s:0.5, K4s:0.5, Q8s+, Q7s:0.5, Q6s:0.5, J8s+, J7s:0.5, T8s+, T7s:0.5, 97s+, 96s:0.5, 87s, 86s:0.5, 85s:0.25, 76s, 75s:0.5, 65s, 64s:0.5, 54s, 53s:0.5, K3s:0.5, K2s:0.25, Q5s:0.25, J6s:0.25, AJo+, ATo, A9o:0.5, A8o:0.25, KJo+, KTo:0.75, K9o:0.25, QJo, QTo:0.5, JTo:0.75, T9o:0.25',
  HJ:  '22+, A2s+, K4s+, K3s:0.5, K2s:0.5, Q7s+, Q6s:0.5, Q5s:0.5, J7s+, J6s:0.5, T7s+, 96s+, 86s+, 85s:0.5, 75s+, 64s+, 53s+, 43s:0.25, ATo+, A9o, A8o:0.5, A5o:0.25, KTo+, K9o:0.5, QTo+, Q9o:0.25, JTo, J9o:0.25, T9o:0.5',
  CO:  '22+, A2s+, K2s+, Q4s+, Q3s:0.5, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A7o+, A5o, A6o:0.5, A4o:0.5, K9o+, K8o:0.5, Q9o+, J9o+, T9o, 98o, 87o:0.5',
  BTN: '22+, A2s+, K2s+, Q2s+, J4s+, J3s:0.5, T5s+, 95s+, 84s+, 74s+, 63s+, 52s+, 42s+, 32s:0.5, A2o+, K5o+, K4o:0.5, Q8o+, Q7o:0.5, J8o+, T8o+, 97o+, 87o, 86o:0.5, 76o:0.5, 65o:0.5',
  SB:  '22+, A2s+, K2s+, Q2s+, J2s+, T3s+, 94s+, 84s+, 73s+, 63s+, 52s+, 42s+, 32s, A2o+, K2o+, Q5o+, Q4o:0.5, J7o+, J6o:0.5, T7o+, 96o+, 86o+, 75o+, 65o, 54o:0.5',
};

const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  const opener = POS[a], hero = POS[b];
  let c;
  if (hero === 'BB') c = two('3bet', BB3[opener], 'call', BBCALL[opener]);
  else if (hero === 'SB') c = two('3bet', SB3[opener], 'call', SBCALL[opener]);
  else {
    const calls = CALL_IP[opener] + (hero === 'BTN' && CALL_BTN_EXTRA[opener] ? ', ' + CALL_BTN_EXTRA[opener] : '');
    // CO contra HJ y HJ contra UTG pagan algo menos que el BTN: recortamos el call fuera del BTN
    const factor = hero === 'HJ' ? 0.8 : hero === 'CO' ? 0.9 : 1;
    const callStr = factor === 1 ? calls : calls.replace(/:0\.(\d+)/g, (m, d) => ':' + round(Number('0.' + d) * factor));
    c = two('3bet', V3[opener], 'call', callStr);
  }
  charts[`VS_OPEN_${hero}_vs_${opener}`] = c;
}

/* ---------- 3. Contra 3-bet (4-bet / call) ---------- */
// 4-bet: valor + algún farol con ases suited. Más amplio contra 3-bets de posiciones tardías.
const V4 = {
  tight: 'KK+, QQ:0.5, AKs, AKo:0.6, A5s:0.4, A4s:0.25',
  mid:   'QQ+, JJ:0.3, AKs, AKo:0.75, AQs:0.3, A5s:0.5, A4s:0.4, A3s:0.2',
  wide:  'QQ+, JJ:0.5, TT:0.25, AKs, AKo, AQs:0.5, AQo:0.25, A5s:0.6, A4s:0.5, A3s:0.4, K9s:0.2, KJo:0.15',
};
// Call sin posición (el 3-bet viene de una posición posterior que no es ciega)
const CALL_OOP = 'QQ:0.5, JJ, TT, 99:0.9, 88:0.75, 77:0.6, 66:0.4, 55:0.25, AQs:0.7, AJs, ATs:0.75, A9s:0.3, KQs, KJs:0.8, KTs:0.5, QJs:0.8, QTs:0.4, JTs:0.75, T9s:0.5, 98s:0.3, AQo:0.75, AJo:0.3, KQo:0.4';
// Call en posición (el 3-bet viene de SB o BB): más parejas, suited y broadways
const CALL_IP3 = 'QQ:0.5, JJ, TT, 99, 88, 77:0.8, 66:0.6, 55:0.4, AQs:0.7, AJs, ATs, A9s:0.5, KQs, KJs, KTs:0.7, QJs, QTs:0.6, JTs, T9s:0.7, 98s:0.5, 87s:0.4, AQo:0.75, AJo:0.5, KQo:0.5';
// El BTN y la SB abren muy amplio: defienden con más manos jugables
const CALL_CO = ', 66:0.6, 55:0.4, 44:0.25, A7s:0.3, A6s:0.3, K8s:0.3, T8s:0.3, KJo:0.3, QJo:0.25, A9s:0.5, A8s:0.4, K9s:0.5, Q9s:0.4, J9s:0.5, T9s:0.7, 98s:0.5, 87s:0.4, 76s:0.3, AJo:0.5, KQo:0.5, ATo:0.25';
const CALL_LATE = ', 88, 77:0.9, 66:0.8, 55:0.6, 44:0.5, 33:0.4, 22:0.3, A9s:0.8, A8s:0.7, A7s:0.6, A6s:0.5, K9s:0.8, K8s:0.5, K7s:0.4, K6s:0.3, Q9s:0.8, Q8s:0.5, J9s:0.8, J8s:0.4, T9s, T8s:0.7, 97s:0.6, 98s:0.8, 87s:0.7, 86s:0.4, 76s:0.6, 75s:0.3, 65s:0.6, 54s:0.5, AJo:0.75, ATo:0.6, A9o:0.3, KQo:0.8, KJo:0.6, KTo:0.4, QJo:0.6, QTo:0.3, JTo:0.5';

for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
  const opener = POS[a], three = POS[b];
  const blind3 = three === 'SB' || three === 'BB';
  const ip = blind3 && opener !== 'SB';                        // la SB contra la BB no tiene posición
  const late = opener === 'BTN' || opener === 'SB';
  const v4 = late || (opener === 'CO' && three !== 'HJ') ? (late ? 'wide' : 'mid') : (a <= 1 && b <= 2 ? 'tight' : 'mid');
  let call = ip ? CALL_IP3 : CALL_OOP;
  if (late) call += CALL_LATE; else if (opener === 'CO') call += CALL_CO;
  // La BB resube un rango algo más fuerte que la SB: contra ella se paga un poco menos
  if (three === 'BB' && opener !== 'SB') call = call.replace(/:0\.(\d+)/g, (m, d) => ':' + round(Number('0.' + d) * 0.9));
  // Contra 3-bets de posiciones tempranas (rango más fuerte) se paga algo menos
  if (opener === 'UTG' && b - a === 1) call = call.replace(/:0\.(\d+)/g, (m, d) => ':' + round(Number('0.' + d) * 0.85));
  charts[`VS_3BET_${opener}_vs_${three}`] = two('4bet', V4[v4], 'call', call, Object.fromEntries(Object.entries(charts['RFI_' + opener]).map(([h, e]) => [h, e.raise])));
}

const out = {
  version: 1,
  name: 'Referencia aproximada 6-max · 100 bb',
  notes: 'Aproximación construida a mano a partir de las ideas habituales de las estrategias de solver para 6-max cash a 100 bb (sin rake, apertura 2,5 bb, 3-bet 3x en posición y 4x sin posición). No es la salida exacta de un solver.',
  charts,
};
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1) + '\n');
console.log('Escrito', Object.keys(charts).length, 'tablas en', process.argv[2]);
