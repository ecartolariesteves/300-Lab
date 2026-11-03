/* =========================================================
   BUSCAMINAS — JavaScript puro, sin librerías.
   Idea general:
   1. El tablero es un array plano de casillas (índice = fila * columnas + columna).
   2. Las minas se colocan DESPUÉS del primer clic, para que nunca pierdas al empezar.
   3. Al abrir una casilla con 0 minas alrededor, se abren sus vecinas en cadena
      (flood fill), igual que un recorrido de grafo.
   ========================================================= */

// Configuración de los tres niveles clásicos
const LEVELS = {
  facil:   { name: 'Principiante', rows: 9,  cols: 9,  mines: 10 },
  medio:   { name: 'Intermedio',   rows: 16, cols: 16, mines: 40 },
  experto: { name: 'Experto',      rows: 16, cols: 30, mines: 99 },
};

// Iconos en SVG (se pintan con el color del texto de la casilla)
const ICON_FLAG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 1.5v13" stroke="var(--ink)" stroke-width="1.6"/><path d="M5.5 2h8l-2.6 3.4L13.5 9h-8z" fill="var(--flag)"/><path d="M2 14.5h6" stroke="var(--ink)" stroke-width="1.6"/></svg>';
const ICON_MINE = '<svg viewBox="0 0 16 16" aria-hidden="true"><g stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round"><path d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13"/></g><circle cx="8" cy="8" r="4.6" fill="var(--ink)"/><circle cx="6.6" cy="6.6" r="1.2" fill="var(--paper)"/></svg>';

// Referencias a elementos del HTML
const $ = (id) => document.getElementById(id);
const boardEl = $('board');

// Estado de la partida
let level = 'facil';
let rows, cols, totalMines;
let cells = [];          // { mine, count, open, flag }
let state = 'ready';     // 'ready' | 'playing' | 'won' | 'lost'
let flagsPlaced = 0;
let openedCount = 0;
let seconds = 0;
let timerId = null;
let flagMode = false;    // true cuando el botón "Bandera" está activo

/* ---------- Utilidades ---------- */

// Devuelve los índices de las (hasta 8) casillas vecinas
function neighbors(i) {
  const r = Math.floor(i / cols), c = i % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
    }
  }
  return out;
}

// Formatea un número a 3 dígitos, estilo marcador clásico
const pad3 = (n) => (n < 0 ? '-' + String(-n).padStart(2, '0') : String(n).padStart(3, '0'));

/* ---------- Nueva partida ---------- */

function newGame() {
  const cfg = LEVELS[level];
  rows = cfg.rows; cols = cfg.cols; totalMines = cfg.mines;

  // En pantallas estrechas giramos el tablero Experto (30×16 en vez de 16×30)
  if (cols > rows && window.innerWidth < 640) [rows, cols] = [cols, rows];

  cells = Array.from({ length: rows * cols }, () => ({ mine: false, count: 0, open: false, flag: false }));
  state = 'ready';
  flagsPlaced = 0;
  openedCount = 0;
  stopTimer();
  seconds = 0;

  $('brief').textContent = `Campo ${rows} × ${cols} · ${totalMines} minas`;
  $('result').hidden = true;
  updateCounters();
  buildBoard();
}

// Crea un <button> por casilla. Se hace una sola vez por partida.
function buildBoard() {
  // Tamaño de casilla según el ancho disponible (entre 28 y 40 px)
  const avail = boardEl.parentElement.clientWidth - 12;
  const size = Math.max(28, Math.min(40, Math.floor((avail - (cols - 1) * 2) / cols)));
  boardEl.style.setProperty('--cell', size + 'px');
  boardEl.style.setProperty('--cols', cols);

  const frag = document.createDocumentFragment();
  cells.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell';
    b.dataset.i = i;
    b.setAttribute('role', 'gridcell');
    b.setAttribute('aria-label', `Fila ${Math.floor(i / cols) + 1}, columna ${(i % cols) + 1}, tapada`);
    frag.appendChild(b);
  });
  boardEl.replaceChildren(frag);
}

/* ---------- Minas ---------- */

// Coloca las minas evitando la casilla del primer clic y sus vecinas
function placeMines(safeIndex) {
  const forbidden = new Set([safeIndex, ...neighbors(safeIndex)]);
  const candidates = [];
  for (let i = 0; i < cells.length; i++) if (!forbidden.has(i)) candidates.push(i);

  // Barajado Fisher–Yates: cada posición tiene la misma probabilidad
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidates.slice(0, totalMines).forEach((i) => (cells[i].mine = true));

  // Precalculamos el número de minas vecinas de cada casilla
  cells.forEach((cell, i) => {
    cell.count = neighbors(i).filter((n) => cells[n].mine).length;
  });
}

/* ---------- Acciones del jugador ---------- */

function openCell(i) {
  const cell = cells[i];
  if (cell.open || cell.flag) return;

  if (state === 'ready') {         // primer clic de la partida
    placeMines(i);
    state = 'playing';
    startTimer();
  }

  if (cell.mine) return lose(i);

  // Flood fill iterativo con una pila (evita desbordar la recursión)
  const stack = [i];
  while (stack.length) {
    const k = stack.pop();
    const c = cells[k];
    if (c.open || c.flag) continue;
    c.open = true;
    openedCount++;
    paint(k);
    if (c.count === 0) stack.push(...neighbors(k));
  }
  checkWin();
}

function toggleFlag(i) {
  const cell = cells[i];
  if (cell.open || state === 'won' || state === 'lost') return;
  cell.flag = !cell.flag;
  flagsPlaced += cell.flag ? 1 : -1;
  paint(i);
  updateCounters();
}

// "Chord": pulsar un número que ya tiene sus banderas abre el resto de vecinas
function chord(i) {
  const cell = cells[i];
  if (!cell.open || cell.count === 0) return;
  const around = neighbors(i);
  const flags = around.filter((n) => cells[n].flag).length;
  if (flags !== cell.count) return;
  for (const n of around) {
    if (state !== 'playing') break;
    if (!cells[n].flag && !cells[n].open) openCell(n);
  }
}

function act(i, wantFlag) {
  if (state === 'won' || state === 'lost') return;
  if (cells[i].open) return chord(i);
  wantFlag ? toggleFlag(i) : openCell(i);
}

/* ---------- Fin de partida ---------- */

function lose(hitIndex) {
  state = 'lost';
  stopTimer();
  cells.forEach((c, i) => {
    if (c.mine && !c.flag) { c.open = true; paint(i); }
    if (!c.mine && c.flag) boardEl.children[i].classList.add('wrong'); // bandera mal puesta
  });
  boardEl.children[hitIndex].classList.add('boom');
  showResult('Has pisado una mina', 'lose');
}

function checkWin() {
  if (state !== 'playing') return;
  if (openedCount === cells.length - totalMines) {
    state = 'won';
    stopTimer();
    // Ponemos bandera en todas las minas restantes
    cells.forEach((c, i) => { if (c.mine && !c.flag) { c.flag = true; paint(i); } });
    flagsPlaced = totalMines;
    updateCounters();
    const record = saveBest(seconds);
    showResult(record ? `¡Campo despejado en ${seconds} s! Nuevo récord` : `¡Campo despejado en ${seconds} s!`, 'win');
  }
}

function showResult(text, kind) {
  const el = $('result');
  el.textContent = text;
  el.className = 'result ' + kind;
  el.hidden = false;
}

/* ---------- Dibujar una casilla ---------- */

function paint(i) {
  const c = cells[i];
  const el = boardEl.children[i];
  const pos = `Fila ${Math.floor(i / cols) + 1}, columna ${(i % cols) + 1}`;
  el.className = 'cell';
  if (c.open) {
    el.classList.add('open');
    if (c.mine) {
      el.innerHTML = ICON_MINE;
      el.setAttribute('aria-label', pos + ', mina');
    } else if (c.count > 0) {
      el.classList.add('has-num', 'n' + c.count);
      el.textContent = c.count;
      el.setAttribute('aria-label', `${pos}, ${c.count}`);
    } else {
      el.textContent = '';
      el.setAttribute('aria-label', pos + ', vacía');
    }
  } else if (c.flag) {
    el.innerHTML = ICON_FLAG;
    el.setAttribute('aria-label', pos + ', bandera');
  } else {
    el.textContent = '';
    el.setAttribute('aria-label', pos + ', tapada');
  }
}

/* ---------- Contadores ---------- */

function updateCounters() {
  $('mines-left').textContent = pad3(totalMines - flagsPlaced);
  $('timer').textContent = pad3(Math.min(seconds, 999));
}
function startTimer() {
  timerId = setInterval(() => { seconds++; updateCounters(); }, 1000);
}
function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

/* ---------- Récords (se guardan en este navegador) ---------- */

function loadBest() {
  try { return JSON.parse(localStorage.getItem('buscaminas-best') || '{}'); }
  catch { return {}; }
}
function saveBest(time) {
  const best = loadBest();
  const isRecord = best[level] == null || time < best[level];
  if (isRecord) {
    best[level] = time;
    try { localStorage.setItem('buscaminas-best', JSON.stringify(best)); } catch {}
  }
  renderBest();
  return isRecord;
}
function renderBest() {
  const best = loadBest();
  $('best').innerHTML = Object.entries(LEVELS)
    .map(([k, v]) => `<div><dt>${v.name}</dt><dd>${best[k] != null ? best[k] + ' s' : '—'}</dd></div>`)
    .join('');
}

/* ---------- Eventos ----------
   Usamos "delegación": un solo listener en el tablero en lugar de uno por casilla. */

let pressTimer = null;
let longPressed = false;

boardEl.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || e.button !== 0) return;
  longPressed = false;
  // Mantener pulsado 400 ms = poner bandera (para móvil)
  pressTimer = setTimeout(() => {
    longPressed = true;
    act(+cell.dataset.i, !flagMode);
    if (navigator.vibrate) navigator.vibrate(15);
  }, 400);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
  boardEl.addEventListener(ev, () => clearTimeout(pressTimer))
);

boardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  if (longPressed) { longPressed = false; return; } // ya se gestionó con la pulsación larga
  act(+cell.dataset.i, flagMode);
});

// Clic derecho = bandera
boardEl.addEventListener('contextmenu', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  e.preventDefault();
  if (!longPressed) act(+cell.dataset.i, true);
});

// Teclado: F pone bandera en la casilla con foco
boardEl.addEventListener('keydown', (e) => {
  const cell = e.target.closest('.cell');
  if (cell && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault();
    act(+cell.dataset.i, true);
  }
});

// Botones de modo Abrir / Bandera
function setMode(flag) {
  flagMode = flag;
  $('mode-open').setAttribute('aria-pressed', String(!flag));
  $('mode-flag').setAttribute('aria-pressed', String(flag));
}
$('mode-open').addEventListener('click', () => setMode(false));
$('mode-flag').addEventListener('click', () => setMode(true));

// Selector de nivel
document.querySelectorAll('.levels button').forEach((btn) => {
  btn.addEventListener('click', () => {
    level = btn.dataset.level;
    document.querySelectorAll('.levels button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b === btn))
    );
    newGame();
  });
});

$('reset').addEventListener('click', newGame);

// Arranque
renderBest();
newGame();
