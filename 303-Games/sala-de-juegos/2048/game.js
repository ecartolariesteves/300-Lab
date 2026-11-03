/* =========================================================
   2048 — JavaScript puro, sin librerías.
   Idea general:
   1. El tablero es una matriz 4×4. Cada casilla guarda una ficha o null.
   2. Cada ficha tiene un id fijo; así su elemento HTML puede deslizarse
      (con transform) de su posición antigua a la nueva.
   3. Al mover, recorremos las fichas empezando por el lado hacia el que se mueven.
      Cada ficha avanza hasta chocar; si choca con otra de igual valor
      que no se haya fusionado ya en este turno, se fusionan.
   ========================================================= */

const SIZE = 4;
const MOVE_MS = 110;          // debe coincidir con la transición del CSS

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const tilesEl = $('tiles');

let grid;                     // grid[fila][columna] = ficha | null
let tiles;                    // Map id -> { id, value, r, c, el }
let nextId = 1;
let score = 0;
let best = 0;
let won = false;              // ya se mostró el mensaje de 2048
let busy = false;             // true mientras dura la animación
let over = false;

/* ---------- Partida nueva ---------- */

function newGame() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  tiles = new Map();
  tilesEl.replaceChildren();
  score = 0;
  won = false;
  over = false;
  busy = false;
  hideOverlay();
  addRandomTile();
  addRandomTile();
  updateScore();
}

// Coloca un 2 (90 %) o un 4 (10 %) en una casilla libre al azar
function addRandomTile() {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const tile = { id: nextId++, value: Math.random() < 0.9 ? 2 : 4, r, c, el: null };
  grid[r][c] = tile;
  tiles.set(tile.id, tile);
  createTileEl(tile);
}

/* ---------- Dibujo ---------- */

function createTileEl(tile) {
  const el = document.createElement('div');
  const inner = document.createElement('span');
  inner.className = 'in';
  el.appendChild(inner);
  tile.el = el;
  paintTile(tile, 'new');
  tilesEl.appendChild(el);
}

// Actualiza posición, número y color de una ficha
function paintTile(tile, anim = '') {
  const el = tile.el;
  const digits = String(tile.value).length;
  const colorClass = tile.value <= 2048 ? 'v' + tile.value : 'vbig';
  el.className = `t ${colorClass} ${digits > 2 ? 'd' + digits : ''} ${anim}`;
  el.style.setProperty('--r', tile.r);
  el.style.setProperty('--c', tile.c);
  el.firstChild.textContent = tile.value;
}

function updateScore() {
  if (score > best) {
    best = score;
    try { localStorage.setItem('2048-best', String(best)); } catch {}
  }
  $('score').textContent = score;
  $('best').textContent = best;
}

/* ---------- Movimiento ---------- */

const DIRS = {
  up:    { dr: -1, dc: 0 },
  down:  { dr: 1,  dc: 0 },
  left:  { dr: 0,  dc: -1 },
  right: { dr: 0,  dc: 1 },
};

function move(dirName) {
  if (busy || over) return;
  const { dr, dc } = DIRS[dirName];

  // Orden de recorrido: empezamos por el borde hacia el que se mueve todo
  const order = [0, 1, 2, 3];
  const rows = dr === 1 ? [...order].reverse() : order;
  const cols = dc === 1 ? [...order].reverse() : order;

  let moved = false;
  const mergedInto = new Set();   // ids de fichas que ya se han fusionado este turno
  const removed = [];             // fichas que desaparecen al fusionarse

  for (const r of rows) {
    for (const c of cols) {
      const tile = grid[r][c];
      if (!tile) continue;

      // Avanza mientras la siguiente casilla esté libre
      let nr = r, nc = c;
      while (inside(nr + dr, nc + dc) && !grid[nr + dr][nc + dc]) {
        nr += dr; nc += dc;
      }

      // ¿Hay una ficha igual justo delante?
      const ahead = inside(nr + dr, nc + dc) ? grid[nr + dr][nc + dc] : null;
      if (ahead && ahead.value === tile.value && !mergedInto.has(ahead.id)) {
        grid[r][c] = null;
        tile.r = ahead.r; tile.c = ahead.c;  // se desliza encima de la otra
        ahead.value *= 2;
        score += ahead.value;
        mergedInto.add(ahead.id);
        removed.push(tile);
        moved = true;
      } else if (nr !== r || nc !== c) {
        grid[r][c] = null;
        grid[nr][nc] = tile;
        tile.r = nr; tile.c = nc;
        moved = true;
      }
    }
  }

  if (!moved) return;
  busy = true;

  // 1) Deslizamos todas las fichas a su nueva posición (sin cambiar aún el número)
  for (const t of [...tiles.values()]) {
    t.el.classList.remove('new', 'merged');
    t.el.style.setProperty('--r', t.r);
    t.el.style.setProperty('--c', t.c);
  }

  // 2) Al terminar el deslizamiento: quitamos las absorbidas y mostramos las fusiones
  setTimeout(() => {
    removed.forEach((t) => { t.el.remove(); tiles.delete(t.id); });
    mergedInto.forEach((id) => paintTile(tiles.get(id), 'merged'));
    addRandomTile();
    updateScore();
    busy = false;
    checkEnd();
  }, MOVE_MS);
}

const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/* ---------- Fin de partida ---------- */

function checkEnd() {
  if (!won && [...tiles.values()].some((t) => t.value >= 2048)) {
    won = true;
    showOverlay('win', '¡2048!', `Lo has conseguido con ${score} puntos.`, true);
    return;
  }
  if (!canMove()) {
    over = true;
    showOverlay('lose', 'Sin movimientos', `Puntuación final: ${score}.`, false);
  }
}

// Queda algún movimiento si hay hueco libre o dos vecinas iguales
function canMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (!t) return true;
      if (c + 1 < SIZE && grid[r][c + 1]?.value === t.value) return true;
      if (r + 1 < SIZE && grid[r + 1][c]?.value === t.value) return true;
    }
  }
  return false;
}

function showOverlay(kind, title, text, canContinue) {
  const o = $('overlay');
  o.className = 'overlay ' + kind;
  $('overlay-title').textContent = title;
  $('overlay-text').textContent = text;
  $('keep-going').hidden = !canContinue;
  o.hidden = false;
  if (kind === 'win') over = true;   // pausa hasta que elija
}
function hideOverlay() { $('overlay').hidden = true; }

/* ---------- Controles ---------- */

// Teclado: flechas y W A S D
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};
document.addEventListener('keydown', (e) => {
  const dir = KEYS[e.key];
  if (!dir) return;
  e.preventDefault();               // que las flechas no muevan la página
  move(dir);
});

// Deslizar con el dedo o el ratón: comparamos dónde empieza y dónde acaba
let start = null;
boardEl.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  start = { x: e.clientX, y: e.clientY };
});
boardEl.addEventListener('pointerup', (e) => {
  if (!start) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  start = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;   // toque demasiado corto
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
});
boardEl.addEventListener('pointercancel', () => (start = null));

$('reset').addEventListener('click', newGame);
$('retry').addEventListener('click', newGame);
$('keep-going').addEventListener('click', () => { over = false; hideOverlay(); });

/* ---------- Arranque ---------- */

// Huecos de la cuadrícula de fondo
document.querySelector('.grid').replaceChildren(
  ...Array.from({ length: SIZE * SIZE }, () => document.createElement('span'))
);
try { best = Number(localStorage.getItem('2048-best')) || 0; } catch {}
newGame();
