/* =========================================================
   SUDOKU — JavaScript puro, sin librerías.
   Idea general:
   1. El tablero es un array de 81 números (0 = vacío), como en el Buscaminas.
   2. Para crear una partida:
      a) rellenamos un tablero completo y válido con "backtracking" al azar;
      b) vamos quitando números mientras la solución siga siendo ÚNICA.
   3. Para comprobar si una casilla admite un número usamos máscaras de bits:
      un entero por fila, columna y caja donde el bit d indica "el d ya está".
   ========================================================= */

const LEVELS = {
  facil:   { name: 'Fácil',   clues: 40 },
  medio:   { name: 'Medio',   clues: 32 },
  dificil: { name: 'Difícil', clues: 25 },
};

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const padEl = $('pad');

// Posición de cada casilla
const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

// Las 20 "vecinas" de cada casilla: misma fila, columna o caja (precalculadas)
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const out = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) out.push(j);
  }
  return out;
});

let level = 'facil';
let givens, solution, values, notes;   // arrays de 81
let history = [];
let selected = 40;                     // empezamos en el centro
let notesMode = false;
let hintsUsed = 0;
let seconds = 0, timerId = null;
let finished = false;

/* ---------- Generador ---------- */

// Cuenta soluciones (hasta "limit") o rellena g con la primera si fill = true.
// Elige siempre la casilla vacía con MENOS candidatos: así es muchísimo más rápido.
function search(g, limit, fill, shuffle) {
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (g[i]) {
      const bit = 1 << g[i];
      rows[rowOf(i)] |= bit; cols[colOf(i)] |= bit; boxes[boxOf(i)] |= bit;
    }
  }
  let count = 0;

  function step() {
    // Busca la casilla vacía más restringida
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]) & 0x3FE;
      const n = popcount(mask);
      if (n === 0) return false;          // callejón sin salida
      if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n === 1) break; }
    }
    if (best === -1) { count++; return fill; }   // tablero completo: una solución

    const digits = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (shuffle) shuffleInPlace(digits);

    const r = rowOf(best), c = colOf(best), b = boxOf(best);
    for (const d of digits) {
      const bit = 1 << d;
      g[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (step()) return true;
      if (count >= limit) { g[best] = 0; return true; }
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  }

  step();
  return count;
}

function popcount(x) { let n = 0; while (x) { x &= x - 1; n++; } return n; }
function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generate(clues) {
  // a) Tablero completo al azar
  const full = new Array(81).fill(0);
  search(full, 1, true, true);

  // b) Quitamos números en orden aleatorio si la solución sigue siendo única
  const puzzle = full.slice();
  let filled = 81;
  for (const i of shuffleInPlace([...Array(81).keys()])) {
    if (filled <= clues) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (search(puzzle.slice(), 2, false, false) !== 1) puzzle[i] = keep;   // dejaría de ser única
    else filled--;
  }
  return { puzzle, full };
}

/* ---------- Partida ---------- */

function newGame() {
  const { puzzle, full } = generate(LEVELS[level].clues);
  givens = puzzle.map((v) => v !== 0);
  values = puzzle.slice();
  solution = full;
  notes = new Array(81).fill(0);
  history = [];
  hintsUsed = 0;
  finished = false;
  selected = values.indexOf(0);
  stopTimer();
  seconds = 0;
  updateTimer();
  $('overlay').hidden = true;
  boardEl.classList.remove('solved');
  $('brief').textContent = `Nivel ${LEVELS[level].name.toLowerCase()} · ${givens.filter(Boolean).length} pistas iniciales`;
  render();
}

function saveHistory(i) {
  history.push({ i, value: values[i], notes: notes.slice() });
  if (history.length > 500) history.shift();
}

// Escribe un número (o una nota) en la casilla seleccionada
function input(d) {
  const i = selected;
  if (finished || i < 0 || givens[i]) return;

  if (notesMode) {
    if (values[i]) return;               // las notas solo van en casillas vacías
    saveHistory(i);
    notes[i] ^= 1 << d;                  // ^ alterna el bit: pone o quita la nota
  } else {
    saveHistory(i);
    values[i] = values[i] === d ? 0 : d; // tocar el mismo número lo borra
    notes[i] = 0;
    if (values[i]) {
      // Quitamos esa nota de todas las vecinas
      for (const p of PEERS[i]) notes[p] &= ~(1 << d);
      startTimer();
    }
  }
  render(i);
  checkWin();
}

function erase() {
  const i = selected;
  if (finished || i < 0 || givens[i] || (!values[i] && !notes[i])) return;
  saveHistory(i);
  values[i] = 0;
  notes[i] = 0;
  render();
}

function undo() {
  if (finished || !history.length) return;
  const h = history.pop();
  values[h.i] = h.value;
  notes = h.notes;
  selected = h.i;
  render();
}

// Pista: rellena la casilla seleccionada (si está vacía o mal) o una vacía al azar
function hint() {
  if (finished) return;
  let i = selected;
  if (i < 0 || givens[i] || values[i] === solution[i]) {
    const empty = values.map((v, k) => (v === solution[k] ? -1 : k)).filter((k) => k >= 0);
    if (!empty.length) return;
    i = empty[Math.floor(Math.random() * empty.length)];
  }
  saveHistory(i);
  values[i] = solution[i];
  notes[i] = 0;
  for (const p of PEERS[i]) notes[p] &= ~(1 << solution[i]);
  hintsUsed++;
  selected = i;
  startTimer();
  render(i);
  checkWin();
}

// Un número está mal colocado si se repite en alguna vecina
const conflict = (i) => values[i] !== 0 && PEERS[i].some((p) => values[p] === values[i]);

function checkWin() {
  if (values.some((v, i) => v !== solution[i])) return;
  finished = true;
  stopTimer();
  const record = saveBest(seconds);
  boardEl.classList.add('solved');
  const pistas = hintsUsed ? ` · ${hintsUsed} pista${hintsUsed > 1 ? 's' : ''}` : '';
  $('overlay-text').textContent = `Nivel ${LEVELS[level].name.toLowerCase()} en ${fmtTime(seconds)}${pistas}${record ? ' · ¡nuevo récord!' : ''}`;
  setTimeout(() => ($('overlay').hidden = false), 700);
  render();
}

/* ---------- Dibujo ---------- */

// Creamos 9 cajas con 9 casillas cada una; guardamos cada casilla por su índice
const cellEls = new Array(81);
function buildBoard() {
  for (let b = 0; b < 9; b++) {
    const box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('role', 'rowgroup');
    for (let k = 0; k < 9; k++) {
      const r = Math.floor(b / 3) * 3 + Math.floor(k / 3);
      const c = (b % 3) * 3 + (k % 3);
      const i = r * 9 + c;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cell';
      el.dataset.i = i;
      el.setAttribute('role', 'gridcell');
      el.style.setProperty('--d', r + c);   // retraso de la ola al ganar
      cellEls[i] = el;
      box.appendChild(el);
    }
    boardEl.appendChild(box);
  }
}

function render(justPlaced = -1) {
  const sel = selected;
  const selVal = sel >= 0 ? values[sel] : 0;

  for (let i = 0; i < 81; i++) {
    const el = cellEls[i];
    const v = values[i];
    let cls = 'cell';
    if (givens[i]) cls += ' given';
    if (i === sel) cls += ' sel';
    else if (selVal && v === selVal) cls += ' same';
    else if (sel >= 0 && PEERS[sel].includes(i)) cls += ' peer';
    if (!givens[i] && conflict(i)) cls += ' bad';
    if (i === justPlaced && v) cls += ' placed';
    el.className = cls;

    if (v) {
      el.textContent = v;
    } else if (notes[i]) {
      let html = '<span class="mini" aria-hidden="true">';
      for (let d = 1; d <= 9; d++) html += `<span>${notes[i] & (1 << d) ? d : ''}</span>`;
      el.innerHTML = html + '</span>';
    } else {
      el.textContent = '';
    }
    el.setAttribute('aria-label',
      `Fila ${rowOf(i) + 1}, columna ${colOf(i) + 1}: ${v ? v + (givens[i] ? ', fijo' : '') : 'vacía'}`);
    el.tabIndex = i === sel ? 0 : -1;
  }

  // Teclado: cuántas veces falta cada número
  const counts = new Array(10).fill(0);
  values.forEach((v) => counts[v]++);
  [...padEl.children].forEach((btn, k) => {
    const d = k + 1, left = 9 - counts[d];
    btn.classList.toggle('done', left <= 0);
    btn.querySelector('small').textContent = left > 0 ? left : '✓';
  });

  $('left').textContent = values.filter((v, i) => v !== solution[i]).length;
  $('undo').disabled = !history.length || finished;
}

function buildPad() {
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${d}<small></small>`;
    b.setAttribute('aria-label', 'Número ' + d);
    b.addEventListener('click', () => input(d));
    padEl.appendChild(b);
  }
}

/* ---------- Tiempo y récords ---------- */

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function updateTimer() { $('timer').textContent = fmtTime(seconds); }
function startTimer() {
  if (timerId || finished) return;
  timerId = setInterval(() => { seconds++; updateTimer(); }, 1000);
}
function stopTimer() { clearInterval(timerId); timerId = null; }

function loadBest() {
  try { return JSON.parse(localStorage.getItem('sudoku-best') || '{}'); } catch { return {}; }
}
function saveBest(time) {
  const best = loadBest();
  const isRecord = best[level] == null || time < best[level];
  if (isRecord) {
    best[level] = time;
    try { localStorage.setItem('sudoku-best', JSON.stringify(best)); } catch {}
  }
  renderBest();
  return isRecord;
}
function renderBest() {
  const best = loadBest();
  $('best').innerHTML = Object.entries(LEVELS)
    .map(([k, v]) => `<div><dt>${v.name}</dt><dd>${best[k] != null ? fmtTime(best[k]) : '—'}</dd></div>`)
    .join('');
}

/* ---------- Eventos ---------- */

boardEl.addEventListener('click', (e) => {
  const el = e.target.closest('.cell');
  if (!el) return;
  selected = +el.dataset.i;
  render();
});

function setNotes(on) {
  notesMode = on;
  $('notes').setAttribute('aria-pressed', String(on));
  $('notes-state').textContent = on ? 'sí' : 'no';
  padEl.classList.toggle('notes-on', on);
}

// Teclado físico: flechas, números, borrar y N para notas
document.addEventListener('keydown', (e) => {
  if (e.target.closest('.seg, .reset') || e.ctrlKey || e.metaKey || e.altKey) return;
  const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (e.key in moves) {
    e.preventDefault();
    const r = rowOf(selected), c = colOf(selected);
    const nr = (r + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0) + 9) % 9;
    const nc = (c + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0) + 9) % 9;
    selected = nr * 9 + nc;
    render();
    cellEls[selected].focus();
  } else if (/^[1-9]$/.test(e.key)) {
    input(+e.key);
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    e.preventDefault();
    erase();
  } else if (e.key === 'n' || e.key === 'N') {
    setNotes(!notesMode);
  }
});

$('notes').addEventListener('click', () => setNotes(!notesMode));
$('erase').addEventListener('click', erase);
$('undo').addEventListener('click', undo);
$('hint').addEventListener('click', hint);
$('reset').addEventListener('click', newGame);
$('again').addEventListener('click', newGame);

document.querySelectorAll('.seg button').forEach((btn) => {
  btn.addEventListener('click', () => {
    level = btn.dataset.level;
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    newGame();
  });
});

/* ---------- Arranque ---------- */
buildBoard();
buildPad();
renderBest();
newGame();
