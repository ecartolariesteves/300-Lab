/* Matriz de equity 169 × 169 compartida por los generadores de tablas (push/fold y resubida).
   Monte Carlo con semilla fija: el resultado es siempre el mismo. */
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
function buildEquity(SAMPLES) {
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


export { HANDS, N, TOTAL_COMBOS, EQ, COMPAT, eval7, buildEquity };
