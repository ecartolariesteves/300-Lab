/* =========================================================
   SOLITARIO (Klondike) — JavaScript puro, sin librerías.
   Idea general:
   1. El estado es un objeto con 13 montones: mazo, descarte,
      4 escaleras (foundations) y 7 columnas (tableau).
   2. Cada montón es un array de cartas; la última del array es la de arriba.
   3. Cada cambio guarda una copia del estado (para Deshacer)
      y después se vuelve a dibujar toda la mesa. Con 52 cartas es rapidísimo.
   4. Los montones se identifican con un código: "w" descarte,
      "f0".."f3" escaleras, "t0".."t6" columnas.
   ========================================================= */

const SUITS = [
  { s: '♠', red: false, name: 'picas' },
  { s: '♥', red: true,  name: 'corazones' },
  { s: '♦', red: true,  name: 'diamantes' },
  { s: '♣', red: false, name: 'tréboles' },
];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES = ['', 'As', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Jota', 'Reina', 'Rey'];
const TEXT = '︎';   // fuerza que los palos se vean como texto y no como emoji

const $ = (id) => document.getElementById(id);
const tableEl = $('table');

let S;                 // estado de la partida
let history = [];      // copias del estado para Deshacer
let drawCount = 1;     // 1 o 3 cartas al robar
let seconds = 0;
let timerId = null;
let won = false;

/* ---------- Reparto ---------- */

function newGame() {
  // Baraja de 52 cartas mezclada con Fisher–Yates
  const deck = [];
  for (let suit = 0; suit < 4; suit++)
    for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  S = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], moves: 0 };

  // Columna i recibe i+1 cartas; solo la última va boca arriba
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j <= i; j++) {
      const card = deck.pop();
      card.up = j === i;
      S.tab[i].push(card);
    }
  }
  S.stock = deck;   // el resto, boca abajo

  history = [];
  won = false;
  stopTimer();
  seconds = 0;
  $('overlay').hidden = true;
  $('brief').textContent = `Klondike · robar ${drawCount} carta${drawCount > 1 ? 's' : ''}`;
  render();
}

/* ---------- Reglas ---------- */

const isRed = (card) => SUITS[card.suit].red;

function getPile(code) {
  if (code === 'w') return S.waste;
  if (code[0] === 'f') return S.found[+code[1]];
  return S.tab[+code[1]];
}

// ¿Se pueden poner estas cartas en el montón de destino?
function canPlace(cards, to) {
  const first = cards[0];
  const top = getPile(to).at(-1);
  if (to[0] === 'f') {
    // Escalera: una sola carta, mismo palo, número siguiente (empieza por As)
    if (cards.length !== 1) return false;
    return top ? top.suit === first.suit && first.rank === top.rank + 1 : first.rank === 1;
  }
  // Columna: alternando color y bajando de uno en uno (vacía solo admite Rey)
  return top ? top.up && isRed(top) !== isRed(first) && first.rank === top.rank - 1 : first.rank === 13;
}

// Intenta mover desde la posición idx del montón "from" hasta el final
function tryMove(from, idx, to) {
  if (from === to) return false;
  const source = getPile(from);
  const cards = source.slice(idx);
  if (!cards.length || !canPlace(cards, to)) return false;

  saveHistory();
  source.splice(idx);
  getPile(to).push(...cards);

  // Si en la columna de origen queda una carta boca abajo, se le da la vuelta
  const last = source.at(-1);
  if (from[0] === 't' && last && !last.up) last.up = true;

  S.moves++;
  startTimer();
  render();
  checkWin();
  return true;
}

// Tocar una carta: la mandamos al mejor destino posible
function autoMove(from, idx, el) {
  const pile = getPile(from);
  const isTop = idx === pile.length - 1;

  // 1) Primero a las escaleras, si es la carta de arriba
  if (isTop && from[0] !== 'f') {
    for (let f = 0; f < 4; f++) if (tryMove(from, idx, 'f' + f)) return;
  }
  // 2) Después a una columna: primero las que tienen cartas, luego las vacías
  const targets = [0, 1, 2, 3, 4, 5, 6]
    .map((n) => 't' + n)
    .sort((a, b) => (getPile(a).length ? 0 : 1) - (getPile(b).length ? 0 : 1));
  for (const to of targets) {
    // Mover un Rey que ya encabeza su columna a otra vacía no sirve de nada
    if (from[0] === 't' && idx === 0 && getPile(to).length === 0) continue;
    if (tryMove(from, idx, to)) return;
  }
  // Sin destino: la carta "dice que no"
  el.classList.remove('nope');
  void el.offsetWidth;          // reinicia la animación
  el.classList.add('nope');
}

// Robar del mazo (o darle la vuelta al descarte si el mazo está vacío)
function drawStock() {
  if (won || (!S.stock.length && !S.waste.length)) return;
  saveHistory();
  if (!S.stock.length) {
    S.stock = S.waste.reverse().map((c) => ({ ...c, up: false }));
    S.waste = [];
  } else {
    for (let k = 0; k < drawCount && S.stock.length; k++) {
      const card = S.stock.pop();
      card.up = true;
      S.waste.push(card);
    }
  }
  S.moves++;
  startTimer();
  render();
}

/* ---------- Deshacer ---------- */

function saveHistory() {
  history.push(JSON.stringify(S));
  if (history.length > 300) history.shift();
}
function undo() {
  if (!history.length || won) return;
  S = JSON.parse(history.pop());
  render();
}

/* ---------- Final ---------- */

// Cuando todo está boca arriba y el mazo vacío, la partida ya está ganada
function canAutoFinish() {
  return !won && !S.stock.length && !S.waste.length &&
    S.tab.some((col) => col.length) && S.tab.every((col) => col.every((c) => c.up));
}

// Sube las cartas a las escaleras una a una, con una pequeña pausa
function autoFinish() {
  if (won) return;
  for (let t = 0; t < 7; t++) {
    const col = S.tab[t];
    if (!col.length) continue;
    for (let f = 0; f < 4; f++) {
      if (tryMove('t' + t, col.length - 1, 'f' + f)) {
        setTimeout(autoFinish, 70);
        return;
      }
    }
  }
}

function checkWin() {
  if (!S.found.every((f) => f.length === 13)) return;
  won = true;
  stopTimer();
  const record = saveBest(seconds);
  $('overlay-text').textContent =
    `${S.moves} movimientos en ${fmtTime(seconds)}${record ? ' · ¡nuevo récord!' : ''}`;
  $('overlay').hidden = false;
  render();
}

/* ---------- Dibujo ---------- */

function cardEl(card, pile, idx) {
  const el = document.createElement('button');
  el.type = 'button';
  if (!card.up) {
    el.className = 'card back';
    el.tabIndex = -1;
    el.setAttribute('aria-label', 'Carta boca abajo');
    return el;
  }
  const suit = SUITS[card.suit];
  el.className = `card ${suit.red ? 'red' : 'black'}${card.rank === 10 ? ' r10' : ''}`;
  el.innerHTML = `<span class="corner">${RANKS[card.rank]}<span class="s">${suit.s}${TEXT}</span></span><span class="pip">${suit.s}${TEXT}</span>`;
  el.setAttribute('aria-label', `${RANK_NAMES[card.rank]} de ${suit.name}`);
  if (pile) {
    el.dataset.pile = pile;     // solo las cartas que se pueden mover llevan origen
    el.dataset.idx = idx;
  } else {
    el.tabIndex = -1;
  }
  return el;
}

function render() {
  // Mazo
  const stock = $('stock');
  stock.replaceChildren();
  if (S.stock.length) {
    stock.append(cardEl({ up: false }));
    const n = document.createElement('span');
    n.className = 'count';
    n.textContent = S.stock.length;
    stock.append(n);
  } else {
    stock.innerHTML = S.waste.length ? '<span class="recycle">↻</span>' : '';
  }

  // Descarte: se ven 1 o 3 cartas, pero solo la de arriba se puede jugar
  const waste = $('waste');
  waste.replaceChildren();
  const visible = S.waste.slice(-(drawCount === 3 ? 3 : 1));
  visible.forEach((card, i) => {
    const isTop = i === visible.length - 1;
    const el = cardEl(card, isTop ? 'w' : null, S.waste.length - 1);
    el.style.setProperty('--fan', i);
    waste.append(el);
  });

  // Escaleras
  document.querySelectorAll('.found').forEach((slot, f) => {
    slot.replaceChildren();
    const pile = S.found[f];
    if (pile.length) slot.append(cardEl(pile.at(-1), 'f' + f, pile.length - 1));
  });

  // Columnas: cada carta se desplaza según cuántas tiene encima
  document.querySelectorAll('.col').forEach((colEl, t) => {
    colEl.replaceChildren();
    let down = 0, up = 0;
    S.tab[t].forEach((card, i) => {
      const el = cardEl(card, card.up ? 't' + t : null, i);
      el.style.setProperty('--d', down);
      el.style.setProperty('--u', up);
      colEl.append(el);
      if (i < S.tab[t].length - 1) card.up ? up++ : down++;
    });
    colEl.style.setProperty('--cd', down);
    colEl.style.setProperty('--cu', up);
  });

  $('moves').textContent = S.moves;
  $('undo').disabled = !history.length || won;
  $('finish').hidden = !canAutoFinish();
  updateTimer();
}

/* ---------- Tiempo y récords ---------- */

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function updateTimer() { $('timer').textContent = fmtTime(seconds); }
function startTimer() {
  if (timerId || won) return;
  timerId = setInterval(() => { seconds++; updateTimer(); }, 1000);
}
function stopTimer() { clearInterval(timerId); timerId = null; }

function loadBest() {
  try { return JSON.parse(localStorage.getItem('solitario-best') || '{}'); } catch { return {}; }
}
function saveBest(time) {
  const best = loadBest();
  const key = 'draw' + drawCount;
  const isRecord = best[key] == null || time < best[key];
  if (isRecord) {
    best[key] = time;
    try { localStorage.setItem('solitario-best', JSON.stringify(best)); } catch {}
  }
  renderBest();
  return isRecord;
}
function renderBest() {
  const best = loadBest();
  $('best').innerHTML = [1, 3]
    .map((n) => `<div><dt>Robar ${n}</dt><dd>${best['draw' + n] != null ? fmtTime(best['draw' + n]) : '—'}</dd></div>`)
    .join('');
}

/* ---------- Arrastrar y soltar ----------
   Al empezar a arrastrar copiamos las cartas en una capa flotante ("ghost")
   que sigue al dedo. Al soltar, miramos qué montón hay debajo. */

let drag = null;
let suppressClick = false;

tableEl.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.card[data-pile]');
  if (!el || e.button !== 0 || won) return;
  drag = { el, pile: el.dataset.pile, idx: +el.dataset.idx, x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
});

document.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.active) {
    if (Math.hypot(dx, dy) < 6) return;   // aún es un toque, no un arrastre
    startDrag();
  }
  drag.ghost.style.transform = `translate(${dx}px, ${dy}px)`;
});

function startDrag() {
  drag.active = true;
  // En una columna se arrastra la carta y todas las que tiene encima
  const sources = drag.pile[0] === 't'
    ? [...drag.el.parentElement.querySelectorAll('.card[data-pile]')].filter((c) => +c.dataset.idx >= drag.idx)
    : [drag.el];
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  for (const src of sources) {
    const r = src.getBoundingClientRect();
    const clone = src.cloneNode(true);
    clone.style.left = r.left + 'px';
    clone.style.top = r.top + 'px';
    ghost.append(clone);
    src.classList.add('lifted');
  }
  tableEl.append(ghost);   // dentro de la mesa para heredar el tamaño de carta
  drag.ghost = ghost;
  drag.sources = sources;
}

function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.active) return;   // fue un toque: lo gestiona el evento click

  suppressClick = true;
  setTimeout(() => (suppressClick = false), 60);
  d.ghost.remove();
  d.sources.forEach((s) => s.classList.remove('lifted'));
  if (cancelled) return;

  const under = document.elementFromPoint(e.clientX, e.clientY);
  const target = under?.closest('[data-drop]');
  if (!target || !tryMove(d.pile, d.idx, target.dataset.drop)) render();
}
document.addEventListener('pointerup', (e) => endDrag(e, false));
document.addEventListener('pointercancel', (e) => endDrag(e, true));

// Toque o clic (también Enter con el teclado): movimiento automático
tableEl.addEventListener('click', (e) => {
  if (suppressClick) return;
  const el = e.target.closest('.card[data-pile]');
  if (el && !won) autoMove(el.dataset.pile, +el.dataset.idx, el);
});

/* ---------- Botones ---------- */

$('stock').addEventListener('click', drawStock);
$('undo').addEventListener('click', undo);
$('finish').addEventListener('click', autoFinish);
$('reset').addEventListener('click', newGame);
$('again').addEventListener('click', newGame);

function setDraw(n) {
  drawCount = n;
  $('draw-1').setAttribute('aria-pressed', String(n === 1));
  $('draw-3').setAttribute('aria-pressed', String(n === 3));
  newGame();
}
$('draw-1').addEventListener('click', () => setDraw(1));
$('draw-3').addEventListener('click', () => setDraw(3));

/* ---------- Arranque ---------- */
renderBest();
newGame();
