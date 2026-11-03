/* =========================================================
   SERPIENTE — juego clásico en JavaScript puro.
   La partida se actualiza por pasos: cada paso mueve la cabeza,
   comprueba colisiones y decide si la cola debe crecer o avanzar.
   ========================================================= */
const $ = (id) => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const SIZE = 20;
const CELL = canvas.width / SIZE;
const LEVELS = {
  facil: { name: 'Fácil', speed: 170 },
  normal: { name: 'Normal', speed: 120 },
  dificil: { name: 'Difícil', speed: 85 },
};
const DIRECTIONS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const RECORD_KEY = 'serpiente-best';
let level = 'normal';
let snake = [];
let food = null;
let direction = 'right';
// Giros pendientes (máx. 2): así dos pulsaciones rápidas en el mismo paso se aplican
// una tras otra y nunca hacen que la serpiente dé media vuelta sobre sí misma.
let inputQueue = [];
let score = 0;
let foodsEaten = 0;
let timerId = null;
let state = 'ready';
let records = loadRecords();

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECORD_KEY) || '{}');
    return Object.fromEntries(Object.keys(LEVELS).map((key) => [
      key, Number.isFinite(saved[key]) && saved[key] > 0 ? saved[key] : 0
    ]));
  } catch (error) {
    return { facil: 0, normal: 0, dificil: 0 };
  }
}

function saveRecords() {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(records));
  } catch (error) {
    // El juego sigue funcionando aunque el navegador bloquee el almacenamiento.
  }
}

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function draw() {
  // Colores propios del tablero (definidos en style.css, con versión para modo oscuro)
  const bg = cssColor('--snake-bg', '#FBF9F2');
  const grid = cssColor('--snake-grid', '#E7E1D0');
  const snakeColor = cssColor('--snake-body', '#4E9A73');
  const headColor = cssColor('--snake-head', '#1F5C45');
  const foodColor = cssColor('--signal', '#F2A33A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < SIZE; i++) {
    const p = i * CELL + 0.5;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
  }
  if (food) {
    ctx.fillStyle = foodColor;
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * CELL, (food.y + 0.5) * CELL, CELL * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  snake.forEach((part, index) => {
    const inset = index === 0 ? 2 : 3;
    ctx.fillStyle = index === 0 ? headColor : snakeColor;
    const x = part.x * CELL + inset, y = part.y * CELL + inset, w = CELL - inset * 2;
    ctx.beginPath();
    // roundRect no existe en navegadores antiguos (Safari < 16): usamos un cuadrado normal
    if (ctx.roundRect) ctx.roundRect(x, y, w, w, 5); else ctx.rect(x, y, w, w);
    ctx.fill();
  });
}

function placeFood() {
  const free = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!snake.some((part) => part.x === x && part.y === y)) free.push({ x, y });
    }
  }
  food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

function updateReadouts() {
  $('score').textContent = score;
  $('best').textContent = records[level];
  $('best-list').innerHTML = Object.keys(LEVELS).map((key) =>
    `<div><dt>${LEVELS[key].name}</dt><dd>${records[key]}</dd></div>`).join('');
  $('brief').textContent = `Nivel ${LEVELS[level].name.toLowerCase()} · Come y crece sin chocar`;
  document.querySelectorAll('[data-level]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.level === level));
  });
}

function setState(next) {
  state = next;
  $('pause').disabled = next !== 'running' && next !== 'paused';
  $('pause').textContent = next === 'paused' ? 'Reanudar' : 'Pausar';
  $('status').textContent = ({ ready: 'Preparado', running: 'En juego', paused: 'En pausa', over: 'Partida terminada' })[next];
  $('overlay').hidden = next === 'running';
  if (next === 'ready') {
    $('overlay-title').textContent = '¿Listo para jugar?';
    $('overlay-text').textContent = 'Pulsa «Nueva partida» o una flecha para empezar.';
    $('overlay-action').textContent = 'Empezar';
  } else if (next === 'paused') {
    $('overlay-title').textContent = 'En pausa';
    $('overlay-text').textContent = 'Tómate un respiro. Continúa cuando quieras.';
    $('overlay-action').textContent = 'Reanudar';
  } else if (next === 'over') {
    $('overlay-title').textContent = '¡Fin de la partida!';
    $('overlay-text').textContent = `Has conseguido ${score} puntos. ${score > 0 ? '¡Una más!' : 'Inténtalo de nuevo.'}`;
    $('overlay-action').textContent = 'Volver a jugar';
  }
}

function stopLoop() {
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;
}

function startLoop() {
  stopLoop();
  timerId = window.setInterval(step, Math.max(48, LEVELS[level].speed - Math.floor(foodsEaten / 5) * 8));
}

function newGame() {
  stopLoop();
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  direction = 'right';
  inputQueue = [];
  score = 0;
  foodsEaten = 0;
  placeFood();
  updateReadouts();
  draw();
  setState('ready');
}

function begin() {
  if (state === 'running') return;
  if (state === 'over') newGame();
  setState('running');
  startLoop();
}

function endGame() {
  stopLoop();
  if (score > records[level]) {
    records[level] = score;
    saveRecords();
  }
  updateReadouts();
  setState('over');
}

function step() {
  if (inputQueue.length) direction = inputQueue.shift();
  const vector = DIRECTIONS[direction];
  const head = { x: snake[0].x + vector.x, y: snake[0].y + vector.y };
  const eating = food && head.x === food.x && head.y === food.y;
  const bodyToCheck = eating ? snake : snake.slice(0, -1);
  const hitWall = head.x < 0 || head.x >= SIZE || head.y < 0 || head.y >= SIZE;
  const hitBody = bodyToCheck.some((part) => part.x === head.x && part.y === head.y);
  if (hitWall || hitBody) { endGame(); return; }
  snake.unshift(head);
  if (eating) {
    score += 10;
    foodsEaten++;
    placeFood();
    if (!food) { endGame(); return; }
    updateReadouts();
    startLoop();
  } else {
    snake.pop();
  }
  draw();
}

function changeDirection(next) {
  if (!DIRECTIONS[next]) return;
  if (state === 'ready') begin();
  if (state !== 'running') return;
  // Comparamos con el último giro pendiente (o con la dirección actual si no hay ninguno)
  const last = inputQueue.length ? inputQueue[inputQueue.length - 1] : direction;
  if (next === last || next === OPPOSITE[last] || inputQueue.length >= 2) return;
  inputQueue.push(next);
}

function togglePause() {
  if (state === 'running') {
    stopLoop();
    setState('paused');
  } else if (state === 'paused') {
    setState('running');
    startLoop();
  }
}

document.querySelectorAll('[data-level]').forEach((button) => {
  button.addEventListener('click', () => {
    level = button.dataset.level;
    newGame();
  });
});
$('start').addEventListener('click', () => { newGame(); begin(); });
$('pause').addEventListener('click', togglePause);
$('overlay-action').addEventListener('click', () => {
  if (state === 'paused') togglePause();
  else { newGame(); begin(); }
});
document.querySelectorAll('[data-dir]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    changeDirection(button.dataset.dir);
  });
});

document.addEventListener('keydown', (event) => {
  const keys = {
    ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  };
  if (keys[event.key]) {
    event.preventDefault();
    changeDirection(keys[event.key]);
  } else if (event.code === 'Space') {
    event.preventDefault();
    if (state === 'ready') begin(); else togglePause();
  }
});

// Permite girar deslizando sobre el tablero en pantallas táctiles.
let touchStart = null;
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  touchStart = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
  changeDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
canvas.addEventListener('pointercancel', () => { touchStart = null; });

// Si cambia el tema claro/oscuro con la partida parada, repintamos con los nuevos colores
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

newGame();