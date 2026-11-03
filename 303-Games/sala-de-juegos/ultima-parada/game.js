/* =========================================================
   ÚLTIMA PARADA — interfaz y partida.
   El generador vive en levels.js; aquí mantenemos el estado de
   la partida, dibujamos el aparcamiento y animamos el embarque.
   ========================================================= */
const $ = (id) => document.getElementById(id);
const COLORS = ['red', 'blue', 'yellow', 'violet', 'turquoise'];
const COLOR_NAMES = ['rojo', 'azul', 'amarillo', 'violeta', 'turquesa'];
const SYMBOLS = ['●', '▲', '■', '◆', '★'];
const ARROWS = { N: '↑', S: '↓', E: '→', W: '←' };
const PROGRESS_KEY = 'ultima-parada-progress';
const boardEl = $('board');
const baysEl = $('bays');
const queueEl = $('queue');
const overlayEl = $('overlay');

let currentLevel = 1;
let unlocked = loadProgress();
let levelData;
let buses = [];
let state;
let hintsUsed = 0;
let isAnimating = false;
let hintedBus = -1;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return Number.isInteger(saved.unlocked) && saved.unlocked > 0 ? saved.unlocked : 1;
  } catch (error) {
    return 1;
  }
}

function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ unlocked }));
  } catch (error) {
    // La partida sigue siendo jugable si el almacenamiento está bloqueado.
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function announce(message, warning = false) {
  $('message').textContent = message;
  $('message').classList.toggle('warning', warning);
}

function loadLevel(number) {
  currentLevel = Math.max(1, Math.min(number, unlocked));
  levelData = Levels.generateLevel(currentLevel);
  buses = levelData.buses.map((bus, id) => ({ ...bus, id }));
  state = { gone: 0, qi: 0, bays: [], finished: false };
  hintsUsed = 0;
  hintedBus = -1;
  isAnimating = false;
  overlayEl.hidden = true;
  announce('Elige un autobús que tenga el camino libre.');
  render();
}

function occupiedCells(gone = state.gone) {
  const occ = new Array(levelData.W * levelData.H).fill(-1);
  buses.forEach((bus, id) => {
    if (gone & (1 << id)) return;
    Levels.cellsOf(bus).forEach(([r, c]) => { occ[r * levelData.W + c] = id; });
  });
  return occ;
}

function canBusExit(id, gone = state.gone) {
  return !(gone & (1 << id)) &&
    Levels.canExit(buses[id], occupiedCells(gone), levelData.W, levelData.H);
}

function renderBoard() {
  boardEl.style.setProperty('--cols', levelData.W);
  boardEl.innerHTML = '';
  buses.forEach((bus, id) => {
    if (state.gone & (1 << id)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bus ${bus.horiz ? 'horizontal' : 'vertical'} ${COLORS[bus.color]}`;
    if (id === hintedBus) button.classList.add('hinted');
    button.dataset.busId = id;
    button.dataset.color = bus.color;
    button.style.gridColumn = bus.horiz ? `${bus.c + 1} / span ${bus.len}` : `${bus.c + 1} / span 1`;
    button.style.gridRow = bus.horiz ? `${bus.r + 1} / span 1` : `${bus.r + 1} / span ${bus.len}`;
    button.style.setProperty('--exit-x', bus.dir === 'E' ? '115%' : bus.dir === 'W' ? '-115%' : '0');
    button.style.setProperty('--exit-y', bus.dir === 'S' ? '115%' : bus.dir === 'N' ? '-115%' : '0');
    button.innerHTML = `<span class="bus-symbol" aria-hidden="true">${SYMBOLS[bus.color]}</span><span class="bus-arrow" aria-hidden="true">${ARROWS[bus.dir]}</span>`;
    button.setAttribute('aria-label', `Autobús ${COLOR_NAMES[bus.color]}, ${bus.len} casillas, dirección ${bus.dir}. Pulsa Enter o toca para intentar sacarlo.`);
    button.addEventListener('click', () => attemptBus(id));
    boardEl.appendChild(button);
  });
}

function renderBays() {
  baysEl.style.setProperty('--bay-count', levelData.bays);
  baysEl.innerHTML = '';
  for (let i = 0; i < levelData.bays; i++) {
    const bus = state.bays[i];
    const bay = document.createElement('div');
    bay.className = bus ? `bay occupied ${COLORS[bus.color]}` : 'bay';
    bay.setAttribute('aria-label', bus
      ? `Plaza ${i + 1}: autobús ${COLOR_NAMES[bus.color]}, ${bus.filled} de 3 pasajeros`
      : `Plaza ${i + 1}: libre`);
    if (bus) {
      const symbol = document.createElement('span');
      symbol.className = 'bay-symbol';
      symbol.textContent = SYMBOLS[bus.color];
      symbol.setAttribute('aria-hidden', 'true');
      const seats = document.createElement('span');
      seats.className = 'seats';
      for (let seat = 0; seat < Levels.CAP; seat++) {
        const dot = document.createElement('span');
        dot.className = seat < bus.filled ? 'seat filled' : 'seat';
        seats.appendChild(dot);
      }
      bay.append(symbol, seats);
    }
    baysEl.appendChild(bay);
  }
  $('bay-count').textContent = `${state.bays.length} / ${levelData.bays} plazas`;
}

function renderQueue() {
  queueEl.innerHTML = '';
  const remaining = levelData.queue.length - state.qi;
  levelData.queue.slice(state.qi, state.qi + 12).forEach((color, index) => {
    const passenger = document.createElement('span');
    passenger.className = `passenger ${COLORS[color]}${index === 0 ? ' first' : ''}`;
    passenger.textContent = SYMBOLS[color];
    passenger.setAttribute('aria-label', `Pasajero ${COLOR_NAMES[color]}`);
    passenger.title = `Pasajero ${COLOR_NAMES[color]}`;
    queueEl.appendChild(passenger);
  });
  if (remaining > 12) {
    const more = document.createElement('span');
    more.className = 'queue-more';
    more.textContent = `+${remaining - 12}`;
    more.setAttribute('aria-label', `${remaining - 12} pasajeros más`);
    queueEl.appendChild(more);
  }
  $('queue-count').textContent = `${remaining} pasajeros`;
  $('passengers-left').textContent = remaining;
}

function renderPanel() {
  $('level-number').textContent = currentLevel;
  $('previous').disabled = currentLevel <= 1;
  $('next').disabled = currentLevel >= unlocked;
  $('record').textContent = unlocked;
  $('hint-count').textContent = `(${hintsUsed})`;
  $('brief').textContent = `Nivel ${currentLevel} · ${levelData.buses.length} autobuses · ${levelData.bays} plazas`;
}

function render() {
  renderPanel();
  renderBoard();
  renderBays();
  renderQueue();
}

function shakeBus(id) {
  const button = boardEl.querySelector(`[data-bus-id="${id}"]`);
  if (!button) return;
  button.classList.remove('shake');
  // Reinicia la animación para que también funcione en toques repetidos.
  void button.offsetWidth;
  button.classList.add('shake');
}

async function attemptBus(id) {
  if (isAnimating || state.finished || (state.gone & (1 << id))) return;
  if (state.bays.length >= levelData.bays) {
    announce('La parada está llena.', true);
    shakeBus(id);
    return;
  }
  if (!canBusExit(id)) {
    announce('Hay un autobús en el camino.', true);
    shakeBus(id);
    return;
  }

  isAnimating = true;
  hintedBus = -1;
  const bus = buses[id];
  const button = boardEl.querySelector(`[data-bus-id="${id}"]`);
  if (button) button.classList.add('leaving');
  await wait(220);

  state.gone |= 1 << id;
  state.bays.push({ color: bus.color, filled: 0 });
  render();
  announce(`Autobús ${COLOR_NAMES[bus.color]} en la parada.`);
  await boardPassengers();

  isAnimating = false;
  if (state.qi >= levelData.queue.length) {
    finishLevel();
  } else if (state.bays.length >= levelData.bays) {
    finishGame();
  } else {
    announce('Bien. Elige el siguiente autobús.');
  }
}

async function boardPassengers() {
  while (state.qi < levelData.queue.length) {
    const color = levelData.queue[state.qi];
    // find() respeta el orden de izquierda a derecha de las plazas.
    const bayIndex = state.bays.findIndex((bus) => bus.color === color && bus.filled < Levels.CAP);
    if (bayIndex < 0) break;

    state.bays[bayIndex].filled++;
    state.qi++;
    renderBays();
    renderQueue();

    if (state.bays[bayIndex].filled === Levels.CAP) {
      const bayEl = baysEl.children[bayIndex];
      if (bayEl) bayEl.classList.add('departing');
      await wait(220);
      state.bays.splice(bayIndex, 1);
    }
    renderBays();
  }
}

/* solve() iniciado en el estado real: conserva autobuses retirados, cola y plazas ocupadas.
   Reutiliza las transiciones del anexo para encontrar un primer movimiento ganador. */
function solveFromCurrentState() {
  const seen = new Set();
  function search(current) {
    if (current.qi === levelData.queue.length) return [];
    if (current.bays.length >= levelData.bays) return null;
    const key = current.gone + '|' + current.qi + '|' +
      current.bays.map((bay) => `${bay.color}:${bay.filled}`).sort().join(',');
    if (seen.has(key)) return null;
    seen.add(key);

    const occ = new Array(levelData.W * levelData.H).fill(-1);
    buses.forEach((bus, id) => {
      if (current.gone & (1 << id)) return;
      Levels.cellsOf(bus).forEach(([r, c]) => { occ[r * levelData.W + c] = id; });
    });

    for (let id = 0; id < buses.length; id++) {
      if (current.gone & (1 << id) || !Levels.canExit(buses[id], occ, levelData.W, levelData.H)) continue;
      const next = {
        gone: current.gone | (1 << id),
        qi: current.qi,
        bays: current.bays.map((bay) => ({ ...bay })).concat([{ color: buses[id].color, filled: 0 }]),
      };
      Levels.board(next, levelData.queue);
      const rest = search(next);
      if (rest !== null) return [id, ...rest];
    }
    return null;
  }
  const path = search({ gone: state.gone, qi: state.qi, bays: state.bays.map((bay) => ({ ...bay })) });
  return path && path.length ? path[0] : -1;
}

function showHint() {
  if (isAnimating || state.finished) return;
  const id = solveFromCurrentState();
  if (id < 0) {
    announce('No encuentro una salida ganadora desde esta posición.', true);
    return;
  }
  hintsUsed++;
  hintedBus = id;
  renderBoard();
  announce('Prueba este autobús: forma parte de una solución.');
  const button = boardEl.querySelector(`[data-bus-id="${id}"]`);
  if (button) button.focus();
  renderPanel();
}

function showResult(kicker, title, message, action) {
  $('result-kicker').textContent = kicker;
  $('result-title').textContent = title;
  $('result-text').textContent = message;
  $('result-action').textContent = action;
  overlayEl.hidden = false;
}

function finishLevel() {
  state.finished = true;
  unlocked = Math.max(unlocked, currentLevel + 1);
  saveProgress();
  renderPanel();
  showResult('Nivel completado', `¡Nivel ${currentLevel} superado!`,
    `Cola vacía. Pistas utilizadas: ${hintsUsed}.`, 'Siguiente nivel');
}

function finishGame() {
  state.finished = true;
  showResult('Parada bloqueada', '¡Atasco!',
    `Quedan ${levelData.queue.length - state.qi} pasajeros y todas las plazas están ocupadas. Pistas utilizadas: ${hintsUsed}.`,
    'Reintentar');
}

$('retry').addEventListener('click', () => loadLevel(currentLevel));
$('previous').addEventListener('click', () => {
  if (currentLevel > 1 && !isAnimating) loadLevel(currentLevel - 1);
});
$('next').addEventListener('click', () => {
  if (currentLevel < unlocked && !isAnimating) loadLevel(currentLevel + 1);
});
$('hint').addEventListener('click', showHint);
$('result-action').addEventListener('click', () => {
  if (state.qi >= levelData.queue.length) loadLevel(currentLevel + 1);
  else loadLevel(currentLevel);
});

loadLevel(1);
