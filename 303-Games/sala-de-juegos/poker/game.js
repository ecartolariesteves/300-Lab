/* Mesa de Estudio: mesa 6-max, bots, entrenamiento, estadísticas e interfaz.
   La lógica sin DOM vive en módulos aparte, que se prueban con Node:
   - engine.js      baraja, evaluador de 7 cartas y equity Monte Carlo
   - sizing.js      tamaños de referencia preflop y su nota
   - betting.js     acciones legales, subida mínima y botones de tamaño
   - evaluation.js  frecuencias, nota de la acción × tamaño, manos dudosas */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SIZING = window.PokerSizing;
  const BETTING = window.PokerBetting;
  const EVAL = window.PokerEvaluation;
  const ENGINE = window.PokerEngine;
  const COACH = window.PokerCoach;
  const PROFILES = window.PokerProfiles;
  const TOURNAMENT = window.PokerTournament;
  const PUSHFOLD = window.PokerPushFold;
  const STORAGE_RIVALS = 'poker-rivales';
  const STORAGE_TOURNAMENT = 'poker-torneo-actual';
  let rivalMode = 'mixto';
  let showRivalProfiles = true;
  let cashProfiles = null; // perfiles de los 5 bots de la Mesa; se sortean de nuevo al cambiar el tipo de rivales
  let pushfold = null; // tablas de push/fold (pushfold.json)
  let reshove = null; // tablas de resubida all-in con 16-25 bb (reshove.json)
  let tour = null; // torneo en curso (ver tournament.js)
  let cashGame = null; // mano de la pestaña Mesa
  let tourGame = null; // mano de la pestaña Torneo

  // Orden de actuación preflop. El héroe siempre ocupa el asiento 0 y el botón va rotando.
  const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const FROM_BUTTON = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];
  const RANKS = 'AKQJT98765432';
  const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_NAME = { s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' };
  const STORAGE_RANGES = 'poker-ranges-custom';
  const STORAGE_STATS = 'poker-stats';
  const STORAGE_HINTS = 'poker-hints';
  const HISTORY_SIZE = 50;
  const EPS = 1e-6;

  // Las 35 tablas que necesita la app: 5 de apertura, 15 contra apertura y 15 contra 3-bet
  const REQUIRED = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 6; b++) {
    REQUIRED.push('VS_OPEN_' + POS[b] + '_vs_' + POS[a]);
    REQUIRED.push('VS_3BET_' + POS[a] + '_vs_' + POS[b]);
  }
  for (const p of POS.slice(0, 5)) REQUIRED.push('RFI_' + p);

  // Rango "todas las manos": se usa cuando no sabemos con qué ha llegado alguien al flop
  const FULL_RANGE = (() => {
    const chart = {};
    for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) chart[EVAL.handAt(i, j)] = { call: 1 };
    return chart;
  })();

  let referenceRanges = null;
  let ranges = null;
  let rangeSource = 'Referencia aproximada 6-max · 100 bb';
  let stats = loadStats();
  let game = null;
  let training = null;
  let feedbackMode = 'immediate';
  // Pistas antes de decidir postflop: qué mano tienes y tus outs (se puede apagar en Ajustes)
  let showHints = safeGet(STORAGE_HINTS) !== 'off';
  let sessionDecisions = 0;
  // Barra de acciones activa (la de la mesa o la del entrenamiento), para los atajos de teclado
  const bars = { mesa: null, entrenamiento: null };
  let currentTab = 'mesa';
  // Marcador de la sesión de entrenamiento
  const streak = { current: 0, best: 0, last: [] };

  /* ---------- Utilidades ---------- */

  // Números en formato español: 2,5 · 8,75 · 100
  const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  const pct = (v) => Math.round(v * 100) + '\u00a0%';
  const pct1 = (v) => (v * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + '\u00a0%';
  const random = (list) => list[Math.floor(Math.random() * list.length)];
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function safeGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* el juego sigue sin guardar */ } }

  function loadStats() {
    try {
      const s = JSON.parse(safeGet(STORAGE_STATS) || 'null');
      if (s && Array.isArray(s.decisions) && Array.isArray(s.hands)) return s;
    } catch (_) { /* datos dañados: empezamos de cero */ }
    return { decisions: [], hands: [], result: 0 };
  }
  function saveStats() { safeSet(STORAGE_STATS, JSON.stringify(stats)); }

  /* ---------- Rangos ---------- */

  function validateRanges(data) {
    if (!data || data.version !== 1 || !data.charts || typeof data.charts !== 'object') throw new Error('El JSON debe incluir version: 1 y charts.');
    if (Object.keys(data.charts).length !== 35) throw new Error('Se necesitan exactamente 35 tablas.');
    const missing = REQUIRED.filter((k) => !data.charts[k]);
    if (missing.length) throw new Error('Faltan tablas: ' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? '…' : ''));
    for (const name of REQUIRED) {
      const chart = data.charts[name];
      if (!chart || typeof chart !== 'object' || Array.isArray(chart)) throw new Error(name + ': tabla no válida.');
      const allowed = name.startsWith('RFI_') ? ['raise'] : name.startsWith('VS_OPEN_') ? ['call', '3bet'] : ['call', '4bet'];
      for (const [hand, acts] of Object.entries(chart)) {
        if (!/^(AA|KK|QQ|JJ|TT|99|88|77|66|55|44|33|22|[AKQJT98765432]{2}[so])$/.test(hand)) throw new Error(name + ': mano no válida ' + hand);
        if (!acts || typeof acts !== 'object' || Array.isArray(acts)) throw new Error(name + ' ' + hand + ': acciones no válidas.');
        let sum = 0;
        for (const [action, value] of Object.entries(acts)) {
          if (!allowed.includes(action) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(name + ' ' + hand + ': frecuencia/acción incorrecta.');
          sum += value;
        }
        if (sum > 1.0001) throw new Error(name + ' ' + hand + ': las frecuencias superan 1.');
      }
    }
    return true;
  }

  async function initRanges() {
    try {
      const response = await fetch('ranges.json');
      if (!response.ok) throw new Error('No se pudo leer ranges.json');
      referenceRanges = await response.json();
      validateRanges(referenceRanges);
      ranges = referenceRanges;
    } catch (error) {
      $('range-source').textContent = 'Error al cargar rangos';
      $('range-message').textContent = error.message;
      return;
    }
    try {
      const custom = JSON.parse(safeGet(STORAGE_RANGES) || 'null');
      if (custom) { validateRanges(custom); ranges = custom; rangeSource = 'Rangos propios · ' + (custom.name || 'sin nombre'); }
    } catch (_) { safeSet(STORAGE_RANGES, ''); }
    $('range-source').textContent = rangeSource;
    try {
      const response = await fetch('pushfold.json');
      if (response.ok) pushfold = await response.json();
    } catch (_) {
      pushfold = null; // sin tablas, el torneo juega igual pero sin evaluar el push/fold
    }
    try {
      const response = await fetch('reshove.json');
      if (response.ok) reshove = await response.json();
    } catch (_) {
      reshove = null;
    }
  }

  /* ---------- Cartas y manos ---------- */

  function makeCard(card) {
    const el = document.createElement('span');
    el.className = 'playing-card ' + ('hd'.includes(card[1]) ? 'red' : 'black');
    el.innerHTML = '<span>' + card[0] + '</span><span class="suit">' + SUIT[card[1]] + '</span>';
    el.setAttribute('aria-label', card[0] + ' de ' + SUIT_NAME[card[1]]);
    return el;
  }
  const miniCards = (cards) => cards.map((c) => '<span class="playing-card ' + ('hd'.includes(c[1]) ? 'red' : 'black') + '">' + c[0] + SUIT[c[1]] + '</span>').join('');
  const cardText = (cards) => cards.map((c) => c[0] + SUIT[c[1]]).join(' ');

  // "AKs", "T9o", "77"
  function handKey(cards) {
    const a = cards[0][0], b = cards[1][0], i = RANKS.indexOf(a), j = RANKS.indexOf(b);
    if (i === j) return a + b;
    const high = i < j ? a : b, low = i < j ? b : a;
    return high + low + (cards[0][1] === cards[1][1] ? 's' : 'o');
  }

  function categoryOf(hand) {
    if (hand.length === 2) return 'pareja';
    if (hand[0] === 'A' && hand.endsWith('s')) return 'As suited';
    if ('AKQJT'.includes(hand[0]) && 'AKQJT'.includes(hand[1])) return 'broadways';
    if (hand.endsWith('s') && Math.abs(RANKS.indexOf(hand[0]) - RANKS.indexOf(hand[1])) <= 2) return 'suited connectors';
    if (hand.endsWith('s')) return 'suited';
    return 'offsuit débil';
  }

  /* ---------- Spots preflop de la mesa ---------- */

  // Qué tabla corresponde al jugador que actúa ahora. Fuera de las tablas (limps, multibote, 5-bet…) → null
  function spotOf(pos) {
    const none = { name: 'Sin evaluar · spot fuera de las tablas', chart: null, chartName: null };
    if (game.calls > 0) return none;
    if (game.raiseCount === 0) {
      if (pos === 'BB') return none;
      return { name: 'Apertura', chartName: 'RFI_' + pos, chart: ranges.charts['RFI_' + pos], villain: null, raiseTo: 1, sizing: 'open' };
    }
    if (game.raiseCount === 1) {
      const opener = game.raises[0];
      const name = 'VS_OPEN_' + pos + '_vs_' + opener.pos;
      return { name: 'Contra apertura', chartName: name, chart: ranges.charts[name] || null, villain: opener.pos, raiseTo: opener.to, sizing: '3bet' };
    }
    if (game.raiseCount === 2 && game.raises[0].pos === pos) {
      const tb = game.raises[1];
      const name = 'VS_3BET_' + pos + '_vs_' + tb.pos;
      return { name: 'Contra 3-bet', chartName: name, chart: ranges.charts[name] || null, villain: tb.pos, raiseTo: tb.to, sizing: '4bet' };
    }
    return none;
  }

  // Rango formado por las manos que juegan una acción de una tabla (lo que los demás saben de ti)
  function actionRange(chart, action) {
    const out = {};
    for (const [hand, acts] of Object.entries(chart || {})) if (acts[action] > 0) out[hand] = { [action]: acts[action] };
    return Object.keys(out).length ? out : null;
  }

  /* ---------- Tabla 13×13 ---------- */

  function renderRangeGrid(container, chart, cards) {
    container.replaceChildren();
    const hero = cards ? handKey(cards) : null;
    for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
      const hand = EVAL.handAt(i, j);
      const entry = (chart && chart[hand]) || {};
      const sum = Object.values(entry).reduce((a, b) => a + b, 0);
      const cell = document.createElement('span');
      cell.className = 'range-cell';
      if (sum > 0) {
        const acts = Object.keys(entry).filter((k) => entry[k] > 0);
        if (acts.length > 1 || sum < 0.999) cell.classList.add('mixed');
        else if (acts[0] === 'call') cell.classList.add('call');
        else if (acts[0] === '4bet') cell.classList.add('raise4');
        else cell.classList.add('raise');
      }
      if (hand === hero) cell.classList.add('hero-hand');
      cell.textContent = hand;
      cell.title = hand + ': ' + Object.entries(entry).map(([a, v]) => a + ' ' + pct(v)).join(' · ') + (sum < 1 ? (sum > 0 ? ' · ' : '') + 'fold ' + pct(1 - sum) : '');
      container.append(cell);
    }
  }

  /* ---------- Textos del feedback preflop ---------- */

  const ACTION_LABEL = { fold: 'Fold', call: 'Call', check: 'Check', limp: 'Limp', raise: 'Apertura', '3bet': '3-bet', '4bet': '4-bet' };
  const actionWord = (score) => (score >= 90 ? 'correcto' : score >= 50 ? 'aceptable (estrategia mixta)' : score > 0 ? 'impreciso' : 'error');
  const verdictClass = (score) => (score == null ? 'warn' : score >= 90 ? '' : score >= 50 ? 'warn' : 'error');
  const refText = (freq) => Object.entries(freq).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([a, v]) => (ACTION_LABEL[a] || a) + ' ' + pct(v)).join(' · ') || 'Fold 100 %';
  const multText = (to, raiseTo) => fmt(Math.round((to / raiseTo) * 10) / 10) + '×';

  /* Ejemplo:
     "BB contra BTN con A5s · 3-bet: correcto (referencia 3-bet 70 % · Fold 30 %)
      Tamaño: 7,5 bb (3×) es demasiado pequeño, la referencia es 10 bb (4×). Sin posición… → 60/100" */
  function preflopFeedbackHtml({ hand, pos, villain, spot, raiseTo, sizeTo, result }) {
    const who = pos + (villain ? ' contra ' + villain : '') + ' con ' + hand;
    if (result.action === 'limp') {
      return '<p><strong>' + who + ' · Limp: error → 0/100</strong></p><p>' + result.note + ' Referencia: ' + refText(result.freq) + '.</p>';
    }
    let html = '<p><strong>' + who + ' · ' + (ACTION_LABEL[result.action] || result.action) + ': ' + actionWord(result.actionScore) + '</strong> (referencia: ' + refText(result.freq) + ')</p>';
    const s = result.sizing;
    if (s) {
      const yours = s.unit === 'x' ? fmt(sizeTo) + ' bb (' + multText(sizeTo, raiseTo) + ')' : fmt(sizeTo) + ' bb';
      const refSize = s.unit === 'x' ? fmt(s.ref) + ' bb (' + fmt(s.mult) + '×)' : fmt(s.ref) + ' bb';
      const word = s.factor === 1 ? 'es el de referencia' : s.factor > 0.6 ? 'es aceptable, aunque la referencia es ' + refSize : 'es ' + s.verdict.replace('Tamaño ', '') + ', la referencia es ' + refSize;
      html += '<p>Tamaño: ' + yours + ' ' + word + '. ' + s.note + '</p>';
      if (s.factor < 1) html += '<p class="source">Las tablas de referencia están calculadas para ' + (s.unit === 'x' ? fmt(s.mult) + '×' : 'aperturas de ' + fmt(s.ref) + ' bb') + '; con otro tamaño la acción se evalúa con la misma tabla.</p>';
    }
    html += '<p class="score-line">→ <strong>' + result.score + '/100</strong>' + (s ? ' (acción ' + result.actionScore + ' × tamaño ' + fmt(s.factor) + ')' : '') + '</p>';
    html += '<p class="source">Rangos de referencia aproximados (6-max, 100 bb). No son la salida exacta de un solver.</p>';
    return html;
  }

  /* ---------- El porqué (coach.js) ---------- */

  // Equity de tu mano contra el rango con el que ha subido el rival, y qué parte de las manos es ese rango
  async function rangeEquity(cards, spotName, heroPos, villainPos) {
    let chart, action, villainSpot;
    if (spotName === 'Contra apertura') { chart = ranges.charts['RFI_' + villainPos]; action = 'raise'; villainSpot = 'Apertura'; }
    else if (spotName === 'Contra 3-bet') { chart = ranges.charts['VS_OPEN_' + villainPos + '_vs_' + heroPos]; action = '3bet'; villainSpot = 'Contra apertura'; }
    else return { equity: null, share: null };
    if (!chart) return { equity: null, share: null };
    const range = ENGINE.expandChart(actionRange(chart, action) || FULL_RANGE, cards);
    const equity = await equityAsync(cards, range, [], 3000, 7);
    return { equity, share: COACH.rangeStats(chart, villainSpot)[action] };
  }

  async function whyPreflopHtml({ cards, hand, spotName, heroPos, villainPos, chart, result, due, pot }) {
    const re = await rangeEquity(cards, spotName, heroPos, villainPos);
    const lines = COACH.whyPreflop({ spot: spotName, hand, heroPos, villainPos, chart, freq: result.freq, chosen: result.action, due, pot, equity: re.equity, villainRange: re.share });
    return whyHtml(lines);
  }
  const whyHtml = (lines) => '<div class="why"><p><strong>Por qué</strong></p><ul>' + lines.map((l) => '<li>' + escapeHtml(l) + '</li>').join('') + '</ul></div>';

  // Lectura de tu mano postflop: "Top pair, kicker Rey · proyecto de color (9 outs)"
  function handReadText(read) {
    let t = read.label;
    if (read.draws.length) t += ' · ' + read.draws.map((d) => d.name + ' (' + d.outs + ' outs)').join(' + ');
    return t;
  }

  /* ---------- Barra de acciones (mesa y entrenamiento) ---------- */

  /* Dibuja las acciones legales con sus importes, los botones de tamaño, el deslizante y el campo numérico.
     opts: { el, player, currentBet, lastRaiseSize, street, raiseCount, canRaise, pot, presets:[{label,to}],
             refTo, raiseWord, multBase, onAction(action, to) } */
  function renderBetBar(opts) {
    const { el, player, currentBet, lastRaiseSize, street, raiseCount, canRaise, pot } = opts;
    const legal = BETTING.legalActions({ player, currentBet, lastRaiseSize, street, raiseCount, canRaise });
    el.replaceChildren();
    const bar = { legal, opts, value: null, act: null };
    const row = document.createElement('div');
    row.className = 'actions';
    el.append(row);
    const button = (label, action, primary, to) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'action-btn' + (primary ? ' primary' : '');
      b.dataset.action = action;
      b.innerHTML = label;
      b.addEventListener('click', () => bar.act(action, to));
      row.append(b);
      return b;
    };
    bar.act = (action, to) => { if (!bar.done) { bar.done = true; opts.onAction(action, to); } };

    const due = legal.due;
    const callAllIn = due >= player.stack - EPS;
    for (const a of legal.actions) {
      if (a === 'fold') button('Fold <kbd>F</kbd>', 'fold');
      if (a === 'check') button('Check <kbd>C</kbd>', 'check');
      if (a === 'call' || a === 'limp') button((a === 'limp' ? 'Limp ' : 'Call ') + fmt(Math.min(due, player.stack)) + ' bb' + (callAllIn ? ' · all-in' : '') + ' <kbd>C</kbd>', a);
    }
    const canSize = legal.actions.includes('raise') || legal.actions.includes('bet');
    if (!canSize && legal.actions.includes('allin')) button('All-in ' + fmt(legal.maxTo) + ' bb', 'allin', true, legal.maxTo);

    if (canSize) {
      const word = legal.actions.includes('bet') ? 'Bet' : opts.raiseWord || 'Raise';
      const box = document.createElement('div');
      box.className = 'bet-box';
      const presets = document.createElement('div');
      presets.className = 'size-presets';
      const seen = new Set();
      for (const p of opts.presets || []) {
        const to = Math.min(Math.max(p.to, legal.minTo), legal.maxTo);
        if (seen.has(to)) continue;
        seen.add(to);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'size-btn';
        b.textContent = to >= legal.maxTo - EPS ? 'All-in' : p.label;
        b.dataset.to = to;
        b.addEventListener('click', () => set(to));
        presets.append(b);
      }
      if (!seen.has(legal.maxTo)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'size-btn'; b.textContent = 'All-in'; b.dataset.to = legal.maxTo;
        b.addEventListener('click', () => set(legal.maxTo));
        presets.append(b);
      }
      const sliderRow = document.createElement('div');
      sliderRow.className = 'size-slider';
      const slider = document.createElement('input');
      slider.type = 'range'; slider.min = legal.minTo; slider.max = legal.maxTo; slider.step = '0.05';
      slider.setAttribute('aria-label', 'Tamaño de la apuesta en bb');
      const number = document.createElement('input');
      number.type = 'number'; number.min = legal.minTo; number.max = legal.maxTo; number.step = '0.05'; number.inputMode = 'decimal';
      number.setAttribute('aria-label', 'Importe en bb');
      sliderRow.append(slider, number);
      const info = document.createElement('p');
      info.className = 'size-info';
      // El botón de subir va en la fila principal, al lado de Fold y Call:
      // así las tres decisiones quedan juntas y arriba, sin tener que bajar hasta el final de la caja.
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'action-btn primary confirm-size';
      confirm.addEventListener('click', () => bar.act(bar.value >= legal.maxTo - EPS ? 'allin' : (legal.actions.includes('bet') ? 'bet' : 'raise'), bar.value));
      row.append(confirm);
      box.append(presets, sliderRow, info);
      el.append(box);

      // Cambia el importe elegido y actualiza el texto "Raise a X bb · …"
      function set(v) {
        v = Math.round(Math.min(Math.max(Number(v) || legal.minTo, legal.minTo), legal.maxTo) * 100) / 100;
        bar.value = v;
        slider.value = v;
        if (document.activeElement !== number) number.value = v;
        const put = v - player.bet;
        const allin = v >= legal.maxTo - EPS;
        confirm.innerHTML = (allin ? 'All-in ' : word + ' ') + fmt(v) + ' bb <kbd>↵</kbd>';
        const parts = ['Pones ' + fmt(put) + ' bb', pct(put / pot) + ' del bote'];
        if (currentBet > EPS && opts.multBase) parts.push(multText(v, opts.multBase) + ' ' + (street === 'preflop' ? (raiseCount === 1 ? 'la apertura' : 'la subida') : 'la apuesta'));
        parts.push('mín. ' + fmt(legal.minTo) + ' · máx. ' + fmt(legal.maxTo));
        info.textContent = parts.join(' · ');
        presets.querySelectorAll('.size-btn').forEach((b) => b.classList.toggle('selected', Math.abs(Number(b.dataset.to) - v) < 0.01));
      }
      slider.addEventListener('input', () => set(slider.value));
      number.addEventListener('change', () => set(number.value));
      number.addEventListener('keydown', (e) => { if (e.key === 'Enter') { set(number.value); confirm.click(); } });
      const firstPreset = presets.querySelector('.size-btn');
      set(firstPreset ? Number(firstPreset.dataset.to) : legal.minTo);
      bar.set = set;
      // Flechas: medio bb preflop, 1 bb postflop
      bar.nudge = (dir) => set(bar.value + dir * (street === 'preflop' ? 0.5 : 1));
      bar.confirm = () => confirm.click();
      bar.raiseRef = () => { set(opts.refTo != null ? opts.refTo : legal.minTo); confirm.click(); };
    }
    bar.fold = () => legal.actions.includes('fold') && bar.act('fold');
    bar.checkCall = () => {
      const a = legal.actions.find((x) => x === 'check' || x === 'call' || x === 'limp');
      if (a) bar.act(a);
    };
    return bar;
  }

  /* Botones de tamaño preflop según el spot.
     Para el 3-bet se muestran solo 3×, 3,5× y 4× (de los cinco de PokerSizing.presets): cubren los dos tamaños
     de referencia (3× en posición, 4× sin posición) y uno intermedio. 2,5× y 4,5× casi nunca se usan,
     y el deslizante sigue permitiendo cualquier importe. Las tablas y los tamaños de referencia no cambian. */
  function preflopPresets(pos, spot, raiseCount, calls, currentBet, stackPlusBet) {
    const label = (to, base) => (base ? fmt(Math.round((to / base) * 10) / 10) + '× · ' : '') + fmt(to) + (base ? '' : ' bb');
    if (raiseCount === 0 && calls === 0) return SIZING.presets('open', pos, null, 1, stackPlusBet).map((to) => ({ label: label(to), to }));
    if (raiseCount === 0) return [3, 4, 5].map((to) => ({ label: fmt(to + calls - 1) + ' bb', to: to + calls - 1 })); // subir contra limpers
    if (raiseCount === 1) return SIZING.presets('3bet', pos, spot.villain, currentBet, stackPlusBet).slice(1, 4).map((to) => ({ label: label(to, currentBet), to }));
    if (raiseCount === 2) return SIZING.presets('4bet', pos, spot.villain, currentBet, stackPlusBet).map((to) => ({ label: label(to, currentBet), to }));
    return [];
  }

  /* ---------- Mesa: estado y reglas ---------- */

  const seatForPosition = (pos) => game.players.find((p) => p.pos === pos);
  const currentLive = () => game.players.filter((p) => !p.folded);
  const playerName = (p) => (p.id === 0 ? 'Tú' : 'Rival ' + p.id);

  function pay(p, amount) {
    const actual = Math.max(0, Math.min(p.stack, amount));
    p.stack -= actual; p.bet += actual; p.contribution += actual; game.pot += actual;
    if (p.stack < EPS) { p.stack = 0; p.allin = true; }
  }

  function legalContext(p) {
    return { player: p, currentBet: game.currentBet, lastRaiseSize: game.lastRaiseSize, street: game.street, raiseCount: game.raiseCount, canRaise: !game.acted.has(p.id) };
  }

  // Apunta una acción en el historial de la mano
  function log(p, text) { game.log.push({ street: game.street, who: playerName(p) + ' (' + p.pos + ')', text }); }

  // Aplica una acción ya validada. Devuelve false si no es legal.
  function applyAction(p, action, target) {
    const check = BETTING.validateAction({ action, target, ...legalContext(p) });
    if (!check.ok) { if (p.id === 0) $('table-status').textContent = check.reason; return false; }
    if (action === 'fold') { p.folded = true; p.lastAction = 'Fold'; log(p, 'Fold'); return true; }
    if (action === 'check') { game.acted.add(p.id); p.lastAction = 'Check'; log(p, 'Check'); return true; }
    if (action === 'call' || action === 'limp') {
      pay(p, Math.max(0, game.currentBet - p.bet));
      if (game.street === 'preflop') game.calls++;
      game.acted.add(p.id);
      p.lastAction = (action === 'limp' ? 'Limp' : 'Call') + (p.allin ? ' · all-in' : '');
      log(p, p.lastAction + ' ' + fmt(p.bet) + ' bb');
      return true;
    }
    // bet, raise o all-in: "to" es el total que el jugador tendrá puesto en esta calle
    const to = action === 'allin' ? p.bet + p.stack : target;
    const before = game.currentBet;
    const potBefore = game.pot;
    pay(p, Math.max(0, to - p.bet));
    if (p.bet > before + EPS) {
      const increment = p.bet - before;
      // Una subida completa reabre la acción; un all-in corto no (los que ya hablaron solo pueden pagar o tirar)
      const full = increment + EPS >= Math.max(game.lastRaiseSize, game.street === 'preflop' ? 1 : 1);
      game.currentBet = p.bet;
      game.raiseCount++;
      game.raises.push({ pos: p.pos, to: p.bet });
      if (full) { game.lastRaiseSize = increment; game.acted = new Set([p.id]); }
      else game.acted.add(p.id);
    } else game.acted.add(p.id);
    let name;
    if (game.street === 'preflop') name = game.calls > 0 && game.raiseCount === 1 ? 'Sube' : ['Abre', '3-bet', '4-bet', '5-bet'][game.raiseCount - 1] || 'Sube';
    else name = before > EPS ? 'Raise' : 'Bet';
    p.lastAction = (p.allin ? 'All-in' : name) + ' ' + fmt(p.bet);
    const potShare = game.street !== 'preflop' && before <= EPS ? ' (' + pct((p.bet) / potBefore) + ' del bote)' : '';
    log(p, (p.allin ? 'All-in a ' : name + ' a ') + fmt(p.bet) + ' bb' + potShare);
    return true;
  }

  // Jugadores que todavía tienen que hablar en esta calle, en orden
  function getPending() {
    const postflop = game.headsUp ? ['BB', 'SB'] : ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
    const order = game.street === 'preflop' ? POS : postflop;
    return order.map(seatForPosition).filter((p) => p && !p.folded && !p.allin && (!game.acted.has(p.id) || p.bet + EPS < game.currentBet));
  }

  /* ---------- Bots ---------- */

  /* Los bots responden al tamaño. Las tablas suponen la subida de referencia; contra una más grande
     continúan con menos manos: sus frecuencias de call, 3-bet y 4-bet se multiplican por
     min(1, referencia / tamaño) y el resto pasa a fold. Es una aproximación sencilla, no un solver. */
  function sizeAdjustment() {
    const r = game.raises;
    let ref = null;
    if (game.raiseCount === 1) ref = SIZING.reference('open', r[0].pos).ref;
    else if (game.raiseCount === 2) ref = SIZING.reference('3bet', r[1].pos, r[0].pos, r[0].to).ref;
    else if (game.raiseCount === 3) ref = SIZING.reference('4bet', r[2].pos, r[1].pos, r[1].to).ref;
    return ref ? Math.min(1, ref / game.currentBet) : 1;
  }

  // Elige una acción al azar con las frecuencias de la tabla (ajustadas al tamaño)
  function pickAction(chart, hand, spotName, k) {
    const freq = EVAL.frequencies(chart, hand, spotName);
    let playing = 0;
    for (const a of Object.keys(freq)) if (a !== 'fold') { freq[a] *= k; playing += freq[a]; }
    freq.fold = 1 - playing;
    let n = Math.random(), acc = 0;
    for (const [a, v] of Object.entries(freq)) { acc += v; if (n <= acc) return a; }
    return 'fold';
  }

  // Tamaño con el que sube un bot: siempre el de referencia
  function botRaiseTo(p, spot) {
    if (game.raiseCount === 0) {
      if (game.calls > 0) return 3 + game.calls;
      // En el torneo, desde el nivel 4 (con ante) se abre más pequeño: 2,2 bb (2,5 desde la SB)
      if (game.mode === 'torneo' && game.level.level >= 4) return p.pos === 'SB' ? 2.5 : 2.2;
      return SIZING.reference('open', p.pos).ref;
    }
    if (game.raiseCount === 1) return SIZING.reference('3bet', p.pos, spot.villain, game.currentBet).ref;
    if (game.raiseCount === 2) return SIZING.reference('4bet', p.pos, spot.villain, game.currentBet).ref;
    return p.bet + p.stack;
  }

  const inChart = (name, hand) => {
    const entry = ranges.charts[name] && ranges.charts[name][hand];
    return !!entry && Object.values(entry).some((v) => v > 0);
  };
  // Rango aproximado de cada perfil, para que tu equity postflop se calcule contra algo realista
  const PROFILE_RANGE = { roca: 'RFI_UTG', station: 'RFI_BTN', maniaco: 'RFI_BTN' };

  // Jugadores que hablan después de p en el preflop y siguen en la mano
  function playersBehind(p) {
    const order = POS.map(seatForPosition).filter((x) => x && !x.out);
    return order.slice(order.indexOf(p) + 1).filter((x) => !x.folded);
  }

  /* Situación de push/fold para cualquier jugador (bot o héroe) en el torneo.
     Devuelve null si no es un spot de stack corto. */
  function shortStackSpot(p) {
    if (game.mode !== 'torneo' || game.street !== 'preflop') return null;
    const firstIn = game.raiseCount === 0 && game.calls === 0;
    const raiser = game.raises.length === 1 ? seatForPosition(game.raises[0].pos) : null;
    const facingPush = game.raiseCount === 1 && game.calls === 0 && raiser && raiser.allin;
    if (firstIn) {
      const behind = playersBehind(p);
      const eff = TOURNAMENT.effectiveStack(p.startStack, behind.map((x) => x.startStack));
      if (eff >= 15.5) return null;
      return { kind: 'push', eff, behind: behind.length };
    }
    if (facingPush) {
      const order = POS.map(seatForPosition).filter((x) => x && !x.out);
      const after = order.slice(order.indexOf(raiser) + 1);
      const eff = Math.min(p.startStack, raiser.startStack);
      if (eff >= 15.5) return null;
      return { kind: 'call', eff, pusher: raiser, pusherBehind: after.length, callerOffset: after.indexOf(p) + 1 };
    }
    const eff = p.startStack;
    if (eff >= 15.5) return null;
    return { kind: 'other', eff };
  }

  /* Torneo con 16-25 bb efectivos: te enfrentas a una única apertura (resubir all-in o foldear)
     o abriste y te han resubido all-in (pagar o foldear). Devuelve null si no es ese spot. */
  function reshoveSpot(p) {
    if (game.mode !== 'torneo' || game.street !== 'preflop' || !reshove || game.calls > 0) return null;
    const inBand = (eff) => eff >= 15.5 && eff < 25.5;
    if (game.raiseCount === 1) {
      const opener = seatForPosition(game.raises[0].pos);
      if (!opener || opener === p || opener.allin) return null;
      const eff = Math.min(p.startStack, opener.startStack);
      return inBand(eff) ? { kind: 'reshove', eff, opener } : null;
    }
    if (game.raiseCount === 2 && game.raises[0].pos === p.pos) {
      const shover = seatForPosition(game.raises[1].pos);
      if (!shover || !shover.allin) return null;
      const eff = Math.min(p.startStack, shover.startStack);
      return inBand(eff) ? { kind: 'callshove', eff, shover } : null;
    }
    return null;
  }

  // Bots con 16-25 bb: resubida all-in y call según las tablas, ajustadas a su perfil
  function botReshove(p, hand) {
    const spot = reshoveSpot(p);
    if (!spot) return null;
    const profile = p.profile || 'gto';
    const st = PROFILES.reshoveStacks(profile, Math.round(spot.eff));
    if (spot.kind === 'reshove') {
      const table = p.pos + '_vs_' + spot.opener.pos + '_' + st.shove;
      const list = reshove.reshove[table];
      if (!list) return null;
      p.chartLabel = 'Resubida ' + table.replace(/_/g, ' ') + ' bb · ' + PROFILES.LABELS[profile];
      p.rangeChart = PUSHFOLD.toChart(list, 'raise');
      if (list.includes(hand)) return { action: 'allin' };
      // Sin resubida, paga solo con las manos que la tabla de cash paga contra esa apertura
      const freq = spotOf(p.pos).chart && spotOf(p.pos).chart[hand];
      return { action: freq && freq.call > 0 && Math.random() < freq.call ? 'call' : 'fold' };
    }
    const table = p.pos + '_vs_' + spot.shover.pos + '_' + st.call;
    const list = reshove.call[table];
    if (!list) return null;
    p.chartLabel = 'Paga resubida ' + table.replace(/_/g, ' ') + ' bb · ' + PROFILES.LABELS[profile];
    return { action: list.includes(hand) ? 'call' : 'fold' };
  }

  // Manos con las que un bot va all-in con menos de 4 bb: un As, un Rey, una pareja o dos cartas de 9 o más
  function desperateHand(hand) {
    const high = '9TJQKA';
    return hand[0] === 'A' || hand[0] === 'K' || hand[0] === hand[1] || (high.includes(hand[0]) && high.includes(hand[1]));
  }
  const SHOVE_OVER = ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs'];

  // Bots en el torneo con stack corto: tablas de push/fold ajustadas a su perfil
  function botPushFold(p, hand) {
    const spot = shortStackSpot(p);
    if (!spot) return null;
    const due = game.currentBet - p.bet;
    const profile = p.profile || 'gto';
    const S = Math.round(spot.eff);
    if (spot.kind === 'other' || !pushfold || S < 4) {
      if (spot.kind === 'call' && due <= 1 + EPS) return { action: 'call' }; // te pagan casi gratis: siempre
      if (S < 4 && (spot.kind === 'push' || spot.kind === 'call')) {
        if (!desperateHand(hand)) return { action: due > 0 ? 'fold' : 'check' };
        return { action: spot.kind === 'push' ? 'allin' : 'call' };
      }
      // Botes con limp o subidas que no son all-in: resube all-in solo con manos fuertes
      if (SHOVE_OVER.includes(hand) || (profile === 'maniaco' && hand[0] === 'A')) return { action: 'allin' };
      return { action: due > 0 ? 'fold' : 'check' };
    }
    const stacks = PROFILES.pushFoldStacks(profile, S);
    if (spot.kind === 'push') {
      if (p.pos === 'BB' && due <= EPS) return { action: 'check' };
      const res = PUSHFOLD.pushSpot(pushfold, { stackBb: stacks.push, playersBehind: spot.behind, hand });
      if (res.unevaluated) return { action: due > 0 ? 'fold' : 'check' };
      p.chartLabel = 'Push/fold ' + res.table + ' · ' + PROFILES.LABELS[profile];
      p.rangeChart = PUSHFOLD.toChart(res.list, 'raise');
      return { action: res.inRange ? 'allin' : 'fold' };
    }
    const res = PUSHFOLD.callSpot(pushfold, { stackBb: stacks.call, pusherBehind: spot.pusherBehind, callerOffset: spot.callerOffset, hand });
    if (res.unevaluated) return { action: due > 0 ? 'fold' : 'check' };
    p.chartLabel = 'Push/fold ' + res.table + ' · ' + PROFILES.LABELS[profile];
    p.rangeChart = PUSHFOLD.toChart(res.list, 'call');
    return { action: res.inRange ? 'call' : 'fold' };
  }

  function botPreflop(p) {
    const hand = handKey(p.cards);
    const premium = ['AA', 'KK', 'QQ', 'AKs'].includes(hand);
    const due = game.currentBet - p.bet;
    const short = botPushFold(p, hand);
    if (short) return short;
    const re = botReshove(p, hand);
    if (re) return re;
    // Fuera de las tablas: botes con limp, multibote o 5-bet. Regla simple con manos premium.
    if (game.calls > 0 || game.raiseCount >= 3 || (game.raiseCount === 2 && game.raises[0].pos !== p.pos)) {
      if (game.raiseCount === 0) {
        // Contra limpers: la BB pasa gratis; el resto sube (aísla) con su rango de apertura
        if (p.pos === 'BB') return premium ? { action: 'raise' } : { action: 'check' };
        if (p.profile === 'station') return inChart('RFI_BTN', hand) ? { action: 'limp' } : { action: 'fold' };
        const chart = ranges.charts['RFI_' + p.pos];
        const a = chart ? pickAction(chart, hand, 'Apertura', 1) : 'fold';
        if (a === 'raise') { p.chartLabel = 'RFI_' + p.pos + ' · aísla'; p.rangeChart = actionRange(chart, 'raise'); return { action: 'raise' }; }
        return { action: 'fold' };
      }
      if (['AA', 'KK'].includes(hand)) return { action: game.raiseCount >= 3 ? 'allin' : 'raise' };
      if (premium) return { action: due > 0 ? 'call' : 'check' };
      // Subida sobre limpers (aislamiento): ya no se foldea casi todo
      if (game.raiseCount === 1 && game.calls > 0) return limpedPotDefense(p, hand, due);
      return { action: due > 0 ? 'fold' : 'check' };
    }
    const spot = spotOf(p.pos);
    if (!spot.chart) return { action: due > 0 ? 'fold' : 'check' };
    // Los perfiles que no son GTO deciden con sus propias reglas; el GTO usa las frecuencias de la tabla
    const profile = p.profile || 'gto';
    const choice = PROFILES.decidePreflop(profile, {
      hand, spot: spot.name, freq: spot.chart[hand] || {}, inRfiUtg: inChart('RFI_UTG', hand), inRfiBtn: inChart('RFI_BTN', hand)
    });
    if (choice !== 'chart') {
      if (choice === 'fold') return { action: due > 0 ? 'fold' : 'check' };
      p.chartLabel = PROFILES.LABELS[profile] + ' · ' + spot.name;
      p.rangeChart = ranges.charts[PROFILE_RANGE[profile]] || spot.chart;
      if (choice === 'limp') return { action: due > 0 ? 'limp' : 'check' };
      if (choice === 'call') return { action: due > 0 ? 'call' : 'check' };
      return { action: 'raise', spot };
    }
    const a = pickAction(spot.chart, hand, spot.name, sizeAdjustment());
    if (a === 'fold') return { action: due > 0 ? 'fold' : 'check' };
    p.chartLabel = spot.chartName + ' · ' + (ACTION_LABEL[a] || a);
    p.rangeChart = actionRange(spot.chart, a);
    if (a === 'call') return { action: 'call' };
    return { action: 'raise', spot };
  }

  /* Alguien sube sobre uno o varios limps. Quien limpeó paga con un rango de apertura
     (de CO; el Station con el de BTN, la Roca solo con el de UTG) y resube con QQ+ y AK.
     Quien no había entrado aún paga con manos fuertes (rango de UTG; de CO para Station y Maníaco). */
  function limpedPotDefense(p, hand, due) {
    if (due <= 0) return { action: 'check' };
    if (['QQ', 'AKs', 'AKo'].includes(hand)) return { action: 'raise' };
    const profile = p.profile || 'gto';
    const limped = p.lastAction.startsWith('Limp') || (p.pos === 'BB' && p.bet >= 1 - EPS);
    const chart = limped
      ? { roca: 'RFI_UTG', station: 'RFI_BTN' }[profile] || 'RFI_CO'
      : { station: 'RFI_CO', maniaco: 'RFI_CO' }[profile] || 'RFI_UTG';
    if (profile === 'maniaco' && inChart('RFI_CO', hand) && Math.random() < 0.2) return { action: 'raise' };
    return { action: inChart(chart, hand) ? 'call' : 'fold' };
  }

  /* ---------- Rango del héroe postflop ----------
     Empieza con el rango preflop de su acción y se estrecha con cada acción postflop:
     si apuestas fuerte, los bots descartan la parte débil de tu rango (ver PROFILES.narrowRange). */
  function heroCombos() {
    const dead = new Set(game.board);
    if (!game.heroCombos) game.heroCombos = ENGINE.expandChart(game.heroRange || FULL_RANGE, game.board);
    game.heroCombos = game.heroCombos.filter((c) => !dead.has(c.cards[0]) && !dead.has(c.cards[1]));
    if (!game.heroCombos.length) game.heroCombos = ENGINE.expandChart(FULL_RANGE, game.board);
    return game.heroCombos;
  }

  // Fuerza de una mano en este board: equity contra una mano al azar, con pocas simulaciones
  function strengthVsRandom(cards, board, trials, random) {
    const used = new Set([...cards, ...board]);
    const deck = ENGINE.makeDeck().filter((c) => !used.has(c));
    let score = 0;
    for (let t = 0; t < trials; t++) {
      // Barajado parcial: las 2 del rival y las que faltan del board
      const need = 2 + (5 - board.length);
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(random() * (deck.length - i));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const rest = deck.slice(2, need);
      const mine = ENGINE.evaluate7([...cards, ...board, ...rest]);
      const theirs = ENGINE.evaluate7([deck[0], deck[1], ...board, ...rest]);
      const cmp = ENGINE.compare(mine, theirs);
      score += cmp > 0 ? 1 : cmp === 0 ? 0.5 : 0;
    }
    return score / trials;
  }

  function narrowHeroRange(action, ratio) {
    const combos = heroCombos();
    const random = ENGINE.rng(game.handNo * 131 + game.board.length);
    const strength = combos.map((c) => strengthVsRandom(c.cards, game.board, 20, random));
    game.heroCombos = PROFILES.narrowRange(combos, strength, action, ratio);
  }

  // Postflop los bots no ven tus cartas: calculan su equity contra tu rango, estrechado por tus acciones
  function botPostflop(p) {
    const hero = game.players[0];
    if (hero.folded) return { action: game.currentBet > p.bet ? 'call' : 'check' };
    const mine = new Set(p.cards);
    let range = heroCombos().filter((c) => !mine.has(c.cards[0]) && !mine.has(c.cards[1]));
    if (!range.length) range = ENGINE.expandChart(FULL_RANGE, [...p.cards, ...game.board]);
    const eq = ENGINE.equity(p.cards, range, game.board, 600, game.handNo * 71 + p.id + game.board.length);
    const due = Math.max(0, game.currentBet - p.bet);
    const potOdds = due > 0 ? EVAL.potOdds(Math.min(due, p.stack), game.pot) : 0;
    const draw = game.street !== 'river' && COACH.readHand(p.cards, game.board).outs >= 8;
    return PROFILES.decidePostflop(p.profile || 'gto', {
      equity: eq, potOdds, due, draw, street: game.street, aggressor: game.prevAggressor === p.pos
    });
  }

  function botAction(p) {
    let decision = game.street === 'preflop' ? botPreflop(p) : botPostflop(p);
    let { action } = decision, target = null;
    if (action === 'raise' && game.street !== 'preflop') target = Math.max(game.currentBet * 3, game.currentBet + game.lastRaiseSize);
    else if (action === 'raise') target = botRaiseTo(p, decision.spot || spotOf(p.pos));
    if (action === 'bet') target = Math.max(1, Math.round(game.pot * decision.share * 10) / 10);
    if (target != null && target >= p.bet + p.stack - EPS) { action = 'allin'; target = null; }
    if (action === 'raise' && game.currentBet <= EPS) action = 'bet';
    if (!applyAction(p, action, target)) {
      // Plan B si la acción no es legal (por ejemplo, sin stack para subir): pagar o pasar
      const legal = BETTING.legalActions(legalContext(p)).actions;
      applyAction(p, legal.includes('call') ? 'call' : legal.includes('limp') ? 'limp' : legal.includes('check') ? 'check' : legal.includes('allin') ? 'allin' : 'fold');
    }
  }

  /* ---------- Mesa: dibujo ---------- */

  function renderSeat(p, active) {
    const el = $('seat-' + p.id);
    el.className = 'seat seat-' + p.id + (p.folded ? ' folded' : '') + (p.out ? ' out' : '') + (active ? ' active' : '');
    if (p.out) {
      el.innerHTML = '<strong>' + playerName(p) + '</strong><span>Eliminado · ' + p.place + '.º</span>';
      return;
    }
    const isButton = p.pos === 'BTN' || (game.headsUp && p.pos === 'SB');
    const dealer = isButton ? '<span class="dealer" title="Botón">D</span>' : '';
    let cards = '';
    if (p.id === 0 || (game.finished && game.showdown && !p.folded)) cards = '<span class="seat-cards">' + miniCards(p.cards) + '</span>';
    else if (!p.folded) cards = '<span class="seat-cards back"><span class="card-back"></span><span class="card-back"></span></span>';
    const profile = p.id !== 0 && showRivalProfiles && p.profile ? '<span class="seat-profile">' + PROFILES.LABELS[p.profile] + '</span>' : '';
    const chart = game.finished && game.showdown && p.id !== 0 && !p.folded && p.chartLabel ? '<span class="seat-chart">' + p.chartLabel + '</span>' : '';
    const last = p.lastAction ? '<span class="seat-action">' + p.lastAction + '</span>' : '';
    el.innerHTML = dealer + '<strong>' + (p.id === 0 ? 'TÚ' : 'Rival ' + p.id) + ' · ' + p.pos + '</strong>' + profile +
      '<span>' + (p.allin ? 'All-in' : fmt(p.stack) + ' bb') + '</span>' +
      (p.bet > 0 && !game.finished ? '<span class="seat-bet">' + fmt(p.bet) + ' bb</span>' : '') + last + cards + chart;
  }

  function renderTable(activeId = null) {
    if (!game) return;
    game.players.forEach((p) => renderSeat(p, p.id === activeId));
    const board = $('board');
    board.replaceChildren();
    if (game.board.length) game.board.forEach((c) => board.append(makeCard(c)));
    else { const empty = document.createElement('span'); empty.className = 'board-empty'; empty.textContent = 'Preflop'; board.append(empty); }
    $('pot').textContent = fmt(game.pot) + ' bb';
    if (game.mode === 'torneo') { renderTournamentPanel(); return; }
    $('hand-number').textContent = game.handNo;
    // Se redondea antes del signo para no mostrar "+-0" cuando el resultado es -0 o -0,001
    const last = Math.round(game.lastResult * 100) / 100 || 0;
    $('hand-result').textContent = (last >= 0 ? '+' : '') + fmt(last) + ' bb';
  }

  const STREET = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

  function renderHeroActions() {
    const hero = game.players[0];
    const due = Math.max(0, game.currentBet - hero.bet);
    $('action-prompt').innerHTML = 'Te toca · <strong>' + hero.pos + '</strong> · ' + STREET[game.street] +
      ' · bote <strong>' + fmt(game.pot) + ' bb</strong>' + (due > 0 ? ' · a pagar <strong class="due">' + fmt(Math.min(due, hero.stack)) + ' bb</strong>' + ' (necesitas ' + pct(EVAL.potOdds(Math.min(due, hero.stack), game.pot)) + ' de equity)' : '') +
      (showHints && game.street !== 'preflop' ? '<span class="hint">Tu mano: ' + escapeHtml(handReadText(COACH.readHand(hero.cards, game.board))) + '</span>' : '');
    let presets, refTo = null, multBase = game.currentBet, raiseWord = 'Raise';
    const legal = BETTING.legalActions(legalContext(hero));
    if (game.street === 'preflop') {
      const spot = spotOf(hero.pos);
      presets = preflopPresets(hero.pos, spot, game.raiseCount, game.calls, game.currentBet, hero.bet + hero.stack);
      if (spot.chart) refTo = SIZING.reference(spot.sizing, hero.pos, spot.villain, spot.raiseTo).ref;
      raiseWord = game.raiseCount === 0 ? 'Raise' : game.raiseCount === 1 ? '3-bet' : game.raiseCount === 2 ? '4-bet' : 'Raise';
      if (game.raiseCount === 0) multBase = null;
    } else {
      presets = BETTING.postflopPresets({ pot: game.pot, currentBet: game.currentBet, heroBet: hero.bet, minTo: legal.minTo, maxTo: legal.maxTo })
        .filter((x) => x.label !== '25\u00a0%' && x.label !== '125\u00a0%'); // 25 % y 125 % quedan en el deslizante
      refTo = game.currentBet > EPS ? game.currentBet * 3 : hero.bet + game.pot * 0.5;
    }
    if (refTo != null) refTo = Math.min(Math.max(refTo, legal.minTo), legal.maxTo);
    bars.mesa = renderBetBar({
      el: $('actions'), ...legalContext(hero), pot: game.pot, presets, refTo, raiseWord, multBase,
      onAction: (action, to) => heroAction(action, to)
    });
  }

  /* ---------- Mesa: decisiones del héroe ---------- */

  function equityAsync(hero, range, board, iterations, seed) {
    return new Promise((resolve) => {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined') { resolve(ENGINE.equity(hero, range, board, iterations, seed)); return; }
      let worker, url;
      const fallback = () => { if (worker) worker.terminate(); if (url) URL.revokeObjectURL(url); resolve(ENGINE.equity(hero, range, board, iterations, seed)); };
      try {
        // El cálculo va en un Web Worker para que la página no se congele
        const engineUrl = new URL('engine.js', location.href).href;
        const source = 'importScripts(' + JSON.stringify(engineUrl) + ');self.onmessage=(e)=>{const d=e.data;self.postMessage(PokerEngine.equity(d.hero,d.range,d.board,d.iterations,d.seed));};';
        url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = (event) => { worker.terminate(); URL.revokeObjectURL(url); resolve(event.data); };
        worker.onerror = fallback;
        worker.postMessage({ hero, range, board, iterations, seed });
      } catch (_) { fallback(); }
    });
  }

  // Postflop: equity contra el rango del rival que más ha mostrado, y comparación con las pot odds
  async function evaluatePostflop(action, target) {
    const hero = game.players[0];
    const opponents = game.players.filter((p) => p.id !== 0 && !p.folded);
    const rangePlayer = opponents.find((p) => p.rangeChart) || opponents[0];
    const dead = [...hero.cards, ...game.board];
    let villainRange = ENGINE.expandChart((rangePlayer && rangePlayer.rangeChart) || FULL_RANGE, dead);
    if (!villainRange.length) villainRange = ENGINE.expandChart(FULL_RANGE, dead);
    const equity = await equityAsync(hero.cards, villainRange, game.board, 4000, game.handNo * 101 + game.board.length);
    const due = Math.max(0, game.currentBet - hero.bet);
    const out = { equity, due, villain: rangePlayer, multiway: opponents.length > 1 };
    // Al apostar o subir: cuánto tiene que foldear el rival para que un farol sea rentable
    if (action === 'bet' || action === 'raise' || action === 'allin') {
      const to = action === 'allin' ? hero.bet + hero.stack : target;
      out.risk = to - hero.bet;
      out.breakeven = EVAL.bluffBreakeven(out.risk, game.pot);
    }
    if (due > 0 && (action === 'call' || action === 'fold')) {
      out.potOdds = EVAL.potOdds(Math.min(due, hero.stack), game.pot);
      out.expected = equity > out.potOdds + 0.03 ? 'call' : equity < out.potOdds - 0.03 ? 'fold' : 'límite';
      out.score = out.expected === 'límite' ? 50 : out.expected === action ? 100 : 0;
      out.scored = true;
    }
    return out;
  }

  function postflopFeedbackHtml(r, action, read) {
    let html = '<p><strong>' + STREET[game.street] + ' · Tu mano: ' + escapeHtml(read.label) + '</strong></p>';
    if (read.draws.length) {
      html += '<p>Proyectos: ' + escapeHtml(read.draws.map((d) => d.name + ' (' + d.outs + ' outs)').join(' + ')) + '. Con ' + read.outs + ' outs ligas ≈ ' + pct(read.hit) +
        (game.board.length === 3 ? ' hasta el river (regla del 4: ' + read.outs + ' × 4 ≈ ' + read.rule + '\u00a0%).' : ' en la siguiente carta (regla del 2: ' + read.outs + ' × 2 ≈ ' + read.rule + '\u00a0%).') + '</p>';
    }
    if (r.scored) {
      const verdict = r.score === 100 ? 'Correcta' : r.score === 50 ? 'Decisión límite' : 'Imprecisa';
      html += '<p><strong>' + verdict + ' · ' + r.score + '/100</strong></p>';
      html += '<p>Equity estimada: ' + pct1(r.equity) + ' · Pot odds: ' + pct1(r.potOdds) + ' (pagas ' + fmt(r.due) + ' bb para un bote de ' + fmt(game.pot + r.due) + ' bb). ' +
        (r.expected === 'límite' ? 'Están casi igualadas: call y fold valen parecido.' : 'Con estos números la referencia es ' + r.expected + '.') + '</p>';
    } else {
      html += '<p><strong>Equity estimada: ' + pct1(r.equity) + '</strong>' + (r.multiway ? ' (contra el rival con más información, en un bote multijugador es menor)' : '') + '</p>';
    }
    if (r.breakeven != null) {
      html += '<p>Para que un farol de ' + fmt(r.risk) + ' bb sea rentable, el rival tiene que foldear más del ' + pct1(r.breakeven) + '. ' +
        (r.equity > 0.6 ? 'Con tu equity, esta apuesta es sobre todo de valor.' : r.equity < 0.35 ? 'Con tan poca equity, la apuesta funciona como farol.' : 'Tu mano está en medio: apuesta de protección o semifarol.') + '</p>';
    }
    html += '<p><strong>Plan:</strong> ' + escapeHtml(read.plan) + '</p>';
    if (game.spr != null) html += '<p class="source">SPR al empezar el flop: ' + fmt(Math.round(game.spr * 10) / 10) + ' · ' + sprNote(game.spr) + '</p>';
    html += '<p class="source">Postflop: equity Monte Carlo frente a pot odds. El tamaño no se puntúa (no es GTO).</p>';
    return html;
  }

  const sprNote = (spr) => (spr < 4 ? 'bajo: con top pair ya es fácil comprometer el stack.' : spr <= 10 ? 'medio: el top pair juega bien, pero con cuidado ante mucha acción.' : 'alto: hacen falta manos fuertes para jugar un bote grande.');

  function saveDecision(d) {
    sessionDecisions++;
    stats.decisions.push(d);
    if (stats.decisions.length > 5000) stats.decisions.splice(0, stats.decisions.length - 5000);
    saveStats();
    renderStats();
  }

  async function heroAction(action, target) {
    if (!game || game.finished || game.busy) return;
    const hero = game.players[0];
    if ((action === 'raise' || action === 'bet') && target >= hero.bet + hero.stack - EPS) action = 'allin';
    if (action === 'allin') target = hero.bet + hero.stack;
    const check = BETTING.validateAction({ action, target, ...legalContext(hero) });
    if (!check.ok) { $('table-status').textContent = check.reason; renderHeroActions(); return; }
    game.busy = true;
    $('new-hand').disabled = true;
    const hand = handKey(hero.cards);
    const box = $('feedback');

    const exploit = exploitHtml(hero);
    const tourSpot = game.street === 'preflop' ? tournamentPreflopSpot(hero) : null;
    if (tourSpot) {
      await heroTournamentDecision(tourSpot, action, hand, exploit);
    } else if (game.street === 'preflop') {
      const spot = spotOf(hero.pos);
      let d;
      if (spot.chart) {
        const isRaise = action === 'raise' || action === 'allin';
        const result = EVAL.evaluatePreflop({ chart: spot.chart, hand, spot: spot.name, action, heroPos: hero.pos, villainPos: spot.villain, raiseTo: spot.raiseTo, sizeTo: isRaise ? target : undefined });
        d = decisionRecord('mesa', hero.pos, spot, hand, result, isRaise ? target : null);
        if (feedbackMode === 'immediate') {
          box.hidden = false;
          box.className = 'feedback ' + verdictClass(result.score);
          $('action-prompt').textContent = 'Analizando la decisión…';
          const why = await whyPreflopHtml({ cards: hero.cards, hand, spotName: spot.name, heroPos: hero.pos, villainPos: spot.villain, chart: spot.chart, result, due: Math.max(0, game.currentBet - hero.bet), pot: game.pot });
          const approx = game.mode === 'torneo' ? '<p class="source">Aproximación: tablas de cash a 100 bb (tienes ' + fmt(Math.round(hero.startStack)) + ' bb).</p>' : '';
          box.innerHTML = preflopFeedbackHtml({ hand, pos: hero.pos, villain: spot.villain, spot: spot.name, raiseTo: spot.raiseTo, sizeTo: target, result }) + approx + why + exploit;
          $('range-panel').hidden = false;
          $('range-label').textContent = spot.name + ' · ' + hero.pos + (spot.villain ? ' vs ' + spot.villain : '');
          renderRangeGrid($('range-grid'), spot.chart, hero.cards);
        }
        // Lo que los bots saben de ti postflop: las manos que juegan tu acción en esta tabla
        game.heroRange = actionRange(spot.chart, result.action) || game.heroRange;
        game.lastPreflop = { chart: spot.chart, cards: hero.cards, label: spot.name + ' · ' + hero.pos + (spot.villain ? ' vs ' + spot.villain : '') };
        d.note = (ACTION_LABEL[result.action] || action) + (d.sizeTo ? ' a ' + fmt(d.sizeTo) + ' bb' : '') + ' → ' + result.score + '/100';
      } else {
        d = { type: 'preflop', source: 'mesa', pos: hero.pos, spot: spot.name, hand, category: categoryOf(hand), action, score: null, verdict: spot.name, note: (ACTION_LABEL[action] || action) + ' · sin evaluar' };
        if (feedbackMode === 'immediate') { box.hidden = false; box.className = 'feedback warn'; box.innerHTML = '<p><strong>Sin evaluar</strong></p><p>Esta situación (limps, multibote o 5-bet) no está en las tablas de referencia.</p>'; $('range-panel').hidden = true; }
      }
      game.decisions.push(d);
      if (feedbackMode === 'immediate' && d.score != null) saveDecision(d);
    } else {
      $('actions').querySelectorAll('button,input').forEach((b) => { b.disabled = true; });
      $('action-prompt').textContent = 'Calculando equity…';
      const r = await evaluatePostflop(action, target);
      const opponents = game.players.filter((p) => p.id !== 0 && !p.folded).length;
      const read = COACH.readHand(hero.cards, game.board, { facingBet: game.currentBet > hero.bet, opponents });
      if (feedbackMode === 'immediate') { box.hidden = false; box.className = 'feedback ' + (r.scored ? verdictClass(r.score) : ''); box.innerHTML = postflopFeedbackHtml(r, action, read) + exploit; }
      const label = action === 'allin' ? 'All-in' : ACTION_LABEL[action] || (action === 'bet' ? 'Bet' : 'Raise');
      const d = { type: 'postflop', source: 'mesa', pos: hero.pos, spot: game.street, hand, category: categoryOf(hand), action, score: r.scored ? r.score : null,
        note: STREET[game.street] + ': ' + label + (target ? ' a ' + fmt(target) + ' bb' : '') + ' · equity ' + pct(r.equity) + (r.scored ? ' · pot odds ' + pct(r.potOdds) + ' → ' + r.score + '/100' : r.breakeven != null ? ' · el farol necesita ' + pct(r.breakeven) + ' de fold' : '') };
      game.decisions.push(d);
      if (feedbackMode === 'immediate' && d.score != null) saveDecision(d);
    }
    game.busy = false;
    $('new-hand').disabled = false;
    $('actions').replaceChildren();
    bars.mesa = null;
    $('action-prompt').textContent = 'Los rivales continúan…';
    const potBefore = game.pot, betBefore = game.currentBet;
    applyAction(hero, action, target);
    if (game.street !== 'preflop' && action !== 'fold') {
      // Tamaño de tu apuesta o subida respecto al bote que había: cuanto mayor, más se estrecha tu rango
      const added = Math.max(0, hero.bet - betBefore);
      const kind = action === 'allin' ? (betBefore > 0 ? 'raise' : 'bet') : action;
      narrowHeroRange(kind, potBefore > 0 ? added / potBefore : 1);
    }
    renderTable();
    advance();
  }

  /* Línea de ajuste explotador: solo si se muestran los perfiles (si no, delataría al rival).
     El rival es el último que ha subido o apostado; si no hay, el único que queda en la mano. */
  function exploitHtml(hero) {
    if (!showRivalProfiles) return '';
    let rival = null, aggressor = false;
    if (game.raises.length) { rival = seatForPosition(game.raises[game.raises.length - 1].pos); aggressor = true; }
    else {
      const others = currentLive().filter((p) => p.id !== 0);
      if (others.length === 1) rival = others[0];
    }
    if (!rival || rival.id === 0 || !rival.profile) return '';
    const line = PROFILES.exploitLine(rival.profile, aggressor);
    return line ? '<p class="exploit"><strong>Contra este rival (' + PROFILES.LABELS[rival.profile] + '):</strong> ' + escapeHtml(line) + ' Tu nota sigue midiéndose contra la referencia.</p>' : '';
  }

  /* ---------- Torneo: evaluación preflop del héroe ----------
     4-15 bb sin nadie dentro → push/fold. Contra un único all-in → call/fold.
     60 bb o más → tablas de cash (devuelve null). Lo demás, sin evaluar. */
  function tournamentPreflopSpot(hero) {
    if (game.mode !== 'torneo') return null;
    const hand = handKey(hero.cards);
    const spot = shortStackSpot(hero);
    const rs = !spot ? reshoveSpot(hero) : null;
    if (rs) return heroReshoveSpot(hero, rs, hand);
    if (!spot) {
      const behind = playersBehind(hero).map((x) => x.startStack);
      const eff = TOURNAMENT.effectiveStack(hero.startStack, behind);
      if (eff >= 60) return null;
      return { unevaluated: 'Con ' + fmt(Math.round(eff)) + ' bb efectivos no hay tablas fiables (entre 16 y 59 bb la estrategia cambia mucho con la profundidad).' };
    }
    if (!pushfold) return { unevaluated: 'No se han podido cargar las tablas de push/fold.' };
    if (spot.kind === 'other') return { unevaluated: 'Con 15 bb o menos solo se evalúan dos spots: nadie ha entrado (all-in o fold) o te enfrentas a un único all-in (call o fold).' };
    const shortTable = TOURNAMENT.alive(tour).length < 6;
    if (spot.kind === 'push') {
      const res = PUSHFOLD.pushSpot(pushfold, { stackBb: spot.eff, playersBehind: spot.behind, hand });
      return res.unevaluated ? res : { ...res, eff: spot.eff, behind: spot.behind, shortTable };
    }
    const res = PUSHFOLD.callSpot(pushfold, { stackBb: spot.eff, pusherBehind: spot.pusherBehind, callerOffset: spot.callerOffset, hand });
    return res.unevaluated ? res : { ...res, eff: spot.eff, pusherBehind: spot.pusherBehind, pusherPlayer: spot.pusher, shortTable };
  }

  function heroReshoveSpot(hero, rs, hand) {
    const S = Math.round(rs.eff);
    const shortTable = TOURNAMENT.alive(tour).length < 6;
    const share = PUSHFOLD.share;
    if (rs.kind === 'reshove') {
      const table = hero.pos + '_vs_' + rs.opener.pos + '_' + S;
      const list = reshove.reshove[table];
      if (!list) return { unevaluated: 'No hay tabla de resubida para esta posición.' };
      const inRange = list.includes(hand);
      return { kind: 'reshove', table, pos: hero.pos, opener: rs.opener.pos, stack: S, list, inRange, correct: inRange ? 'allin' : 'fold', share: share(list), eff: rs.eff, shortTable };
    }
    const table = hero.pos + '_vs_' + rs.shover.pos + '_' + S;
    const list = reshove.call[table];
    if (!list) return { unevaluated: 'No hay tabla de call para esta posición.' };
    const inRange = list.includes(hand);
    return { kind: 'callshove', table, pos: hero.pos, shover: rs.shover.pos, stack: S, list, inRange, correct: inRange ? 'call' : 'fold', share: share(list), eff: rs.eff, shortTable };
  }

  const pushLike = (t) => t.kind === 'push' || t.kind === 'reshove';

  async function heroTournamentDecision(t, action, hand, exploit) {
    const hero = game.players[0];
    const box = $('feedback');
    const show = feedbackMode === 'immediate';
    let d;
    if (t.unevaluated) {
      d = { type: 'preflop', source: 'torneo', pos: hero.pos, spot: 'Torneo', hand, category: categoryOf(hand), action, score: null, note: (ACTION_LABEL[action] || action) + ' · sin evaluar' };
      if (show) { box.hidden = false; box.className = 'feedback warn'; box.innerHTML = '<p><strong>Sin evaluar</strong></p><p>' + escapeHtml(t.unevaluated) + '</p>' + exploit; $('range-panel').hidden = true; }
    } else {
      // Contra un all-in, ir all-in con más fichas equivale a pagar
      const chosen = !pushLike(t) && action === 'allin' ? 'call' : action;
      const valid = pushLike(t) ? ['allin', 'fold'] : ['call', 'fold'];
      if (!valid.includes(chosen)) {
        d = { type: 'preflop', source: 'torneo', pos: hero.pos, spot: 'Torneo', hand, category: categoryOf(hand), action, score: null, note: (ACTION_LABEL[action] || action) + ' · sin evaluar' };
        const why = t.kind === 'reshove'
          ? 'con 16-25 bb esta referencia solo cubre resubir all-in o foldear; pagar la apertura o resubir sin ir all-in no se evalúa.'
          : 'con 15 bb o menos, la referencia es all-in o fold.';
        if (show) { box.hidden = false; box.className = 'feedback warn'; box.innerHTML = '<p><strong>Sin evaluar</strong> · ' + why + '</p><p>Según la tabla ' + t.table + ', con ' + hand + ' resubir all-in ' + (t.correct === 'allin' ? 'sería correcto' : 'no entra en la referencia') + '.</p>' + exploit; }
      } else {
        const score = chosen === t.correct ? 100 : 0;
        d = pushfoldRecord('torneo', t, hand, chosen, score);
        if (show) {
          box.hidden = false;
          box.className = 'feedback ' + verdictClass(score);
          box.innerHTML = pushfoldFeedbackHtml(t, hand, chosen, score) + '<p class="source why-loading">Calculando el porqué…</p>' + exploit;
          showPushfoldChart($('range-panel'), $('range-label'), $('range-grid'), t, hero.cards);
          $('action-prompt').textContent = 'Analizando la decisión…';
          const why = await pushfoldWhyHtml(t, hero.cards, game.pot, Math.max(0, game.currentBet - hero.bet));
          const loading = box.querySelector('.why-loading');
          if (loading) loading.outerHTML = why;
        }
      }
    }
    game.decisions.push(d);
    if (d.score != null && feedbackMode === 'immediate') saveDecision(d);
  }

  /* ---------- Push/fold: textos comunes a la mesa del torneo y al entrenamiento ---------- */

  function pushfoldRecord(source, t, hand, action, score) {
    const band = t.stack <= 7 ? '4-7 bb' : t.stack <= 11 ? '8-11 bb' : t.stack <= 15 ? '12-15 bb' : '16-25 bb';
    const spot = { push: 'Push', call: 'Call', reshove: 'Resubida', callshove: 'Call resubida' }[t.kind];
    return {
      type: 'pushfold', source, pos: t.pos, spot, stack: t.stack, band, table: t.table,
      hand, category: categoryOf(hand), action, correct: t.correct, score,
      note: (action === 'allin' ? 'All-in' : ACTION_LABEL[action] || action) + ' con ' + t.stack + ' bb (' + t.table + ') → ' + score + '/100'
    };
  }

  function pushfoldFeedbackHtml(t, hand, action, score) {
    const what = {
      push: 'Con ' + t.stack + ' bb desde ' + t.pos + ', el equilibrio empuja el ' + pct1(t.share) + ' de las manos.',
      call: 'Con ' + t.stack + ' bb en ' + t.pos + ' contra un all-in de ' + t.pusher + ', el equilibrio paga con el ' + pct1(t.share) + ' de las manos.',
      reshove: 'Con ' + t.stack + ' bb en ' + t.pos + ' contra una apertura de ' + t.opener + ', se resube all-in con el ' + pct1(t.share) + ' de las manos.',
      callshove: 'Abriste desde ' + t.pos + ' y ' + t.shover + ' resube all-in con ' + t.stack + ' bb: se paga con el ' + pct1(t.share) + ' de las manos.'
    }[t.kind];
    const label = (a) => (a === 'allin' ? 'All-in' : a === 'call' ? 'Call' : 'Fold');
    return '<p><strong>' + (score === 100 ? '✓ Correcto' : '✗ Error') + ' · ' + score + '/100</strong> · ' + hand + ' · tabla ' + t.table +
      '</p><p>Referencia: <strong>' + label(t.correct) + '</strong> · Tu acción: ' + label(action) + '</p><p>' + what + '</p>' +
      '<p class="source">' + (t.kind === 'reshove' || t.kind === 'callshove'
        ? 'Resubida: equilibrio aproximado en fichas, sin ICM, contra los rangos de apertura de referencia (de 100 bb).'
        : 'Push/fold: equilibrio aproximado en fichas, sin ICM.') + (t.shortTable ? ' Aproximación: con menos de 6 jugadores se usa la tabla 6-max con el mismo número de jugadores detrás.' : '') + '</p>';
  }

  function showPushfoldChart(panel, labelEl, grid, t, cards) {
    panel.hidden = false;
    labelEl.textContent = (pushLike(t) ? 'All-in · ' : 'Call · ') + t.table.replace(/_/g, ' ') + ' bb';
    renderRangeGrid(grid, PUSHFOLD.toChart(t.list, pushLike(t) ? 'raise' : 'call'), cards);
  }

  // El porqué del push/fold: dinero muerto, fold equity y tu equity cuando te pagan
  async function pushfoldWhyHtml(t, cards, pot, due) {
    const lines = [];
    if (t.kind === 'push') {
      lines.push('Hay ' + fmt(pot) + ' bb en el bote antes de que hables: un ' + pct(pot / t.stack) + ' de tu stack. Ese dinero muerto es lo que ganas cuando todos foldean.');
      const fe = PUSHFOLD.foldEquity(pushfold, { stack: t.stack, pusherBehind: t.behind });
      lines.push('Con ' + t.behind + (t.behind === 1 ? ' jugador' : ' jugadores') + ' detrás, todos foldean aproximadamente el ' + pct(fe) + ' de las veces.');
      const callers = PUSHFOLD.callRanges(pushfold, { stack: t.stack, pusherBehind: t.behind });
      const caller = callers[callers.length - 1];
      const range = ENGINE.expandChart(PUSHFOLD.toChart(caller.list, 'call'), cards);
      const eq = range.length ? await equityAsync(cards, range, [], 1500, t.stack * 31 + t.behind) : null;
      if (eq != null) lines.push('Si la ' + caller.pos + ' paga (con el ' + pct1(PUSHFOLD.share(caller.list)) + ' de sus manos), tu equity es de un ' + pct(eq) + '.');
      lines.push('Regla práctica: cuanto menos stack y más tarde la posición, más ancho se empuja.');
    } else if (t.kind === 'reshove') {
      const openChart = ranges.charts['RFI_' + t.opener] || {};
      const openShare = Object.entries(openChart).reduce((sum, [h, f]) => sum + PUSHFOLD.combos(h) * (f.raise || 0), 0) / 1326;
      const callList = reshove.call[t.opener + '_vs_' + t.pos + '_' + t.stack] || [];
      const foldPct = openShare > 0 ? Math.max(0, 1 - PUSHFOLD.share(callList) / openShare) : 0;
      lines.push('Hay ' + fmt(pot) + ' bb en el bote con la apertura: un ' + pct(pot / t.stack) + ' de tu stack, y lo ganas sin ver el flop cada vez que ' + t.opener + ' foldea.');
      lines.push(t.opener + ' abre con el ' + pct1(openShare) + ' de las manos y solo paga tu all-in con el ' + pct1(PUSHFOLD.share(callList)) + ': foldea aproximadamente el ' + pct(foldPct) + ' de las veces.');
      const range = ENGINE.expandChart(PUSHFOLD.toChart(callList, 'call'), cards);
      const eq = range.length ? await equityAsync(cards, range, [], 1500, t.stack * 41 + 3) : null;
      if (eq != null) lines.push('Cuando te paga, tu equity es de un ' + pct(eq) + '.');
      lines.push('Con 16-25 bb, pagar una apertura deja poco stack para jugar después: resubir all-in aprovecha tu fold equity.');
    } else if (t.kind === 'callshove') {
      const need = EVAL.potOdds(due, pot);
      lines.push('Pagas ' + fmt(due) + ' bb para ganar un bote de ' + fmt(pot) + ' bb: necesitas un ' + pct(need) + ' de equity.');
      const shoveList = reshove.reshove[t.shover + '_vs_' + t.pos + '_' + t.stack] || [];
      const range = ENGINE.expandChart(PUSHFOLD.toChart(shoveList, 'raise'), cards);
      const eq = range.length ? await equityAsync(cards, range, [], 1500, t.stack * 43 + 5) : null;
      if (eq != null) lines.push('Contra el rango de resubida de ' + t.shover + ' (el ' + pct1(PUSHFOLD.share(shoveList)) + ' de las manos), tu equity es de un ' + pct(eq) + (eq > need ? ': paga.' : ': no llega.'));
      lines.push('Ya has puesto la apertura en el bote: por eso se paga con más manos de lo que parecería.');
    } else {
      const need = EVAL.potOdds(due, pot);
      lines.push('Pagas ' + fmt(due) + ' bb para ganar un bote de ' + fmt(pot) + ' bb: necesitas un ' + pct(need) + ' de equity.');
      const pushList = pushfold.push[t.pusher + '_' + t.stack] || [];
      const range = ENGINE.expandChart(PUSHFOLD.toChart(pushList, 'raise'), cards);
      const eq = range.length ? await equityAsync(cards, range, [], 1500, t.stack * 37 + 1) : null;
      if (eq != null) lines.push('Contra el rango de all-in de ' + t.pusher + ' con ' + t.stack + ' bb (el ' + pct1(PUSHFOLD.share(pushList)) + ' de las manos), tu equity es de un ' + pct(eq) + (eq > need ? ': paga.' : ': no llega.'));
      lines.push('Cuantos más jugadores quedan detrás de ti, más fuerte tiene que ser tu mano para pagar: alguno podría despertar con algo mejor.');
    }
    return whyHtml(lines);
  }

  // Registro de una decisión preflop evaluada (mesa o entrenamiento)
  function decisionRecord(source, pos, spot, hand, result, sizeTo) {
    return {
      type: 'preflop', source, pos, rival: spot.villain || null, spot: spot.name, hand, category: categoryOf(hand),
      action: result.action, score: result.score, actionScore: result.actionScore, verdict: result.verdict,
      sizingSpot: result.sizing ? spot.sizing : null, sizingScore: result.sizing ? Math.round(result.sizing.factor * 100) : null,
      sizeTo: result.sizing ? sizeTo : null
    };
  }

  /* ---------- Mesa: desarrollo de la mano ---------- */

  // Estado vacío de una mano
  function baseGame(extra) {
    return {
      lastResult: 0, finished: false, showdown: false, busy: false, headsUp: false,
      street: 'preflop', pot: 0, currentBet: 1, lastRaiseSize: 1, raiseCount: 0, calls: 0, raises: [], acted: new Set(),
      board: [], runout: [], players: [], decisions: [], log: [], heroRange: null, spr: null, lastPreflop: null,
      ...extra
    };
  }

  function newPlayer(id, pos, cards, stack, profile) {
    return {
      id, pos, cards, stack, startStack: stack, bet: 0, contribution: 0, folded: false, allin: false, out: false,
      rangeChart: null, chartLabel: null, lastAction: '', profile
    };
  }

  // El ante es dinero muerto: va al bote pero no cuenta como apuesta de la calle
  function payDead(p, amount) {
    const actual = Math.max(0, Math.min(p.stack, amount));
    p.stack -= actual; p.contribution += actual; game.pot += actual;
    if (p.stack < EPS) { p.stack = 0; p.allin = true; }
  }

  function postBlinds(ante) {
    if (ante > 0) game.players.filter((p) => !p.out).forEach((p) => payDead(p, ante));
    pay(seatForPosition('SB'), 0.5);
    pay(seatForPosition('BB'), 1);
    game.currentBet = 1;
    game.lastRaiseSize = 1;
  }

  // Limpia la interfaz y deja que hablen los jugadores
  function beginHand() {
    $('feedback').hidden = true;
    $('range-panel').hidden = true;
    $('hand-summary').hidden = true;
    $('table-status').textContent = 'Estás en ' + game.players[0].pos;
    $('new-hand').hidden = true;
    $('tour-see').hidden = true;
    renderTable();
    advance();
  }

  function startHand() {
    if (currentTab === 'torneo') { startTournamentHand(); return; }
    const prev = cashGame;
    if (!cashProfiles) cashProfiles = PROFILES.assign(rivalMode);
    const button = prev ? (prev.button + 1) % 6 : 0;
    game = cashGame = baseGame({ mode: 'cash', button, handNo: prev ? prev.handNo + 1 : 1 });
    const deal = ENGINE.deal();
    game.players = Array.from({ length: 6 }, (_, id) =>
      newPlayer(id, FROM_BUTTON[(id - button + 6) % 6], deal.hands[id], 100, id === 0 ? null : cashProfiles[id - 1]));
    game.runout = deal.board;
    postBlinds(0);
    beginHand();
  }

  const heroNet = () => game.players[0].stack - game.players[0].startStack;

  function finishByFold(winner) {
    winner.stack += game.pot;
    finishHand(winner.id === 0 ? 'Ganas el bote: todos foldean.' : 'Gana ' + playerName(winner) + ' (' + winner.pos + ') sin showdown.', heroNet());
  }

  /* Reparto por capas (bote principal y botes secundarios): cada capa la pueden ganar los jugadores
     vivos que han puesto al menos ese importe. Lo que nadie más ha igualado vuelve a quien lo puso. */
  function awardPots(live) {
    const levels = [...new Set(game.players.map((p) => p.contribution).filter((c) => c > EPS))].sort((a, b) => a - b);
    const maxLive = Math.max(...live.map((p) => p.contribution));
    let previous = 0;
    let mainWinners = null;
    for (const level of levels) {
      const layer = game.players.reduce((sum, p) => sum + Math.max(0, Math.min(p.contribution, level) - previous), 0);
      previous = level;
      if (layer <= EPS) continue;
      let eligible = live.filter((p) => p.contribution >= level - EPS);
      // Fichas de quien foldeó por encima de lo que pusieron los vivos: van a los que más pusieron
      if (!eligible.length) eligible = live.filter((p) => p.contribution >= maxLive - EPS);
      let best = null, winners = [];
      for (const p of eligible) {
        const cmp = best ? ENGINE.compare(p.result, best) : 1;
        if (cmp > 0) { best = p.result; winners = [p]; } else if (cmp === 0) winners.push(p);
      }
      winners.forEach((p) => { p.stack += layer / winners.length; });
      if (!mainWinners) mainWinners = { winners, best };
    }
    return mainWinners;
  }

  function showdown() {
    game.showdown = true;
    const live = currentLive();
    live.forEach((p) => { p.result = ENGINE.evaluate7([...p.cards, ...game.board]); });
    const { winners, best } = awardPots(live);
    const hero = game.players[0];
    const heroWin = winners.includes(hero);
    const names = winners.map((p) => playerName(p) + ' (' + p.pos + ')').join(' y ');
    finishHand((heroWin ? (winners.length > 1 ? 'Empate: repartís el bote' : '¡Ganas!') : 'Gana ' + names) + ' con ' + best.name.toLowerCase() + '.', heroNet());
  }

  function finishHand(message, net) {
    game.finished = true;
    game.lastResult = net;
    if (game.mode === 'cash') stats.result += net;
    recordProfileResult(net);
    const hero = game.players[0];
    const summary = {
      number: game.handNo, result: net, position: hero.pos, hand: cardText(hero.cards), board: cardText(game.board), message,
      log: game.log,
      // Cartas enseñadas en el showdown y la tabla que usó cada bot
      shown: game.showdown ? currentLive().map((p) => ({ who: playerName(p) + ' (' + p.pos + ')', cards: cardText(p.cards), made: p.result ? p.result.name : '', chart: p.id === 0 ? null : p.chartLabel })) : [],
      charts: game.players.filter((p) => p.id !== 0 && p.chartLabel).map((p) => playerName(p) + ' (' + p.pos + '): ' + p.chartLabel),
      notes: game.decisions.map((d) => d.note || '')
    };
    stats.hands.unshift(summary);
    stats.hands = stats.hands.slice(0, HISTORY_SIZE);
    if (feedbackMode === 'end') game.decisions.filter((d) => d.score != null).forEach(saveDecision);
    saveStats();
    renderStats();
    $('table-status').textContent = message;
    $('hand-summary').hidden = false;
    $('hand-summary').textContent = message + ' Resultado: ' + (net >= 0 ? '+' : '') + fmt(net) + ' bb · Pulsa «Nueva mano» (o N) para seguir.';
    $('actions').replaceChildren();
    bars.mesa = null;
    $('action-prompt').textContent = 'Mano terminada.';
    $('new-hand').hidden = false;
    $('new-hand').focus({ preventScroll: true });
    if (feedbackMode === 'end' && game.decisions.length) {
      const box = $('feedback');
      box.hidden = false;
      box.className = 'feedback';
      box.innerHTML = '<p><strong>Resumen de decisiones</strong></p>' + game.decisions.map((d) => '<p>' + escapeHtml(d.note || d.verdict) + '</p>').join('');
      if (game.lastPreflop) { $('range-panel').hidden = false; $('range-label').textContent = game.lastPreflop.label; renderRangeGrid($('range-grid'), game.lastPreflop.chart, game.lastPreflop.cards); }
    }
    // El torneo va al final: puede ocultar «Nueva mano» si te han eliminado
    if (game.mode === 'torneo') afterTournamentHand(net);
    renderTable();
  }

  function nextStreet() {
    if (game.street === 'river') { showdown(); return; }
    if (game.street === 'preflop') { game.street = 'flop'; game.board = game.runout.slice(0, 3); }
    else if (game.street === 'flop') { game.street = 'turn'; game.board = game.runout.slice(0, 4); }
    else { game.street = 'river'; game.board = game.runout.slice(0, 5); }
    // Quien subió o apostó el último en la calle anterior (para la apuesta de continuación)
    game.prevAggressor = game.raises.length ? game.raises[game.raises.length - 1].pos : null;
    game.players.forEach((p) => { p.bet = 0; p.lastAction = ''; });
    game.currentBet = 0; game.lastRaiseSize = 0; game.raiseCount = 0; game.raises = []; game.acted = new Set();
    let status = STREET[game.street] + ' · bote ' + fmt(game.pot) + ' bb';
    if (game.street === 'flop') {
      // SPR = stack efectivo / bote. El stack efectivo es el menor entre el tuyo y el mayor de tus rivales.
      const hero = game.players[0];
      const others = currentLive().filter((p) => p.id !== 0).map((p) => p.stack);
      if (!hero.folded && others.length) {
        game.spr = EVAL.spr(Math.min(hero.stack, Math.max(...others)), game.pot);
        status += ' · SPR ' + fmt(Math.round(game.spr * 10) / 10) + ' (' + sprNote(game.spr).split(':')[0] + ')';
      }
    }
    $('table-status').textContent = status;
    renderTable();
    advance();
  }

  function advance() {
    if (!game || game.finished) return;
    let guard = 0;
    while (guard++ < 80) {
      const live = currentLive();
      if (live.length === 1) { finishByFold(live[0]); return; }
      const pending = getPending();
      if (!pending.length) {
        // Si todos están all-in (o solo queda uno con fichas), se reparte el resto del board
        if (live.filter((p) => !p.allin).length <= 1) { while (game.street !== 'river') nextStreetSilently(); showdown(); return; }
        nextStreet();
        return;
      }
      const actor = pending[0];
      if (actor.id === 0) { renderTable(0); renderHeroActions(); return; }
      botAction(actor);
      renderTable();
    }
    $('table-status').textContent = 'La mano se ha detenido para evitar un bucle. Inicia otra mano.';
    $('actions').replaceChildren();
    $('new-hand').hidden = false;
  }

  function nextStreetSilently() {
    const order = ['preflop', 'flop', 'turn', 'river'];
    game.street = order[order.indexOf(game.street) + 1];
    game.board = game.runout.slice(0, { flop: 3, turn: 4, river: 5 }[game.street]);
    game.players.forEach((p) => { p.bet = 0; });
  }

  /* ---------- Entrenamiento ---------- */

  const TRAINING_TYPES = {
    rfi: { spot: 'Apertura', sizing: 'open', heroes: ['UTG', 'HJ', 'CO', 'BTN', 'SB'] },
    '3bet': { spot: 'Contra apertura', sizing: '3bet', heroes: ['HJ', 'CO', 'BTN', 'SB', 'BB'] },
    def: { spot: 'Contra 3-bet', sizing: '4bet', heroes: ['UTG', 'HJ', 'CO', 'BTN', 'SB'] }
  };
  const SPOT_TO_TYPE = { 'Apertura': 'rfi', 'Contra apertura': '3bet', 'Contra 3-bet': 'def' };

  // Rivales posibles: en "3-bet" el que abre antes que tú; en "defensa" el que te resube después
  function validRivals(type, hero) {
    const i = POS.indexOf(hero);
    if (type === '3bet') return POS.slice(0, i);
    if (type === 'def') return POS.slice(i + 1);
    return [];
  }

  const PF_BANDS = { all: [4, 15], '4-7': [4, 7], '8-11': [8, 11], '12-15': [12, 15] };
  const PF_HEROES = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

  function refreshTrainingFilters() {
    const type = $('training-spot').value;
    const heroSel = $('training-position'), rivalSel = $('training-rival');
    $('training-rival-label').textContent = type === 'pushfold' ? 'Stack' : 'Rival';
    if (type === 'pushfold') {
      const heroValue = heroSel.value, bandValue = rivalSel.value;
      heroSel.replaceChildren(new Option('Aleatoria', 'random'), ...PF_HEROES.map((p) => new Option(p, p)));
      heroSel.value = PF_HEROES.includes(heroValue) ? heroValue : 'random';
      heroSel.disabled = false;
      rivalSel.replaceChildren(new Option('4-15 bb', 'all'), new Option('4-7 bb', '4-7'), new Option('8-11 bb', '8-11'), new Option('12-15 bb', '12-15'));
      rivalSel.value = PF_BANDS[bandValue] ? bandValue : 'all';
      rivalSel.disabled = false;
      return;
    }
    const t = TRAINING_TYPES[type];
    const heroValue = heroSel.value;
    // Posiciones propias posibles para el tipo de spot
    heroSel.replaceChildren(new Option('Aleatoria', 'random'), ...(t ? t.heroes : POS).map((p) => new Option(p, p)));
    heroSel.value = t && t.heroes.includes(heroValue) ? heroValue : 'random';
    heroSel.disabled = type === 'leaks';
    const rivalValue = rivalSel.value;
    const rivals = !t || type === 'rfi' ? [] : heroSel.value === 'random' ? POS.filter((p) => t.heroes.some((h) => validRivals(type, h).includes(p))) : validRivals(type, heroSel.value);
    rivalSel.replaceChildren(new Option(type === 'rfi' ? '—' : 'Aleatorio', 'random'), ...rivals.map((p) => new Option(p, p)));
    rivalSel.value = rivals.includes(rivalValue) ? rivalValue : 'random';
    rivalSel.disabled = type === 'rfi' || type === 'leaks';
  }

  // Las fugas: grupos posición · spot · tipo de mano con al menos 5 decisiones, ordenados por nota
  function computeLeaks() {
    const groups = new Map();
    for (const d of stats.decisions) {
      if (d.type !== 'preflop' || d.score == null || !SPOT_TO_TYPE[d.spot]) continue;
      const k = d.pos + ' · ' + d.spot + ' · ' + d.category;
      if (!groups.has(k)) groups.set(k, { key: k, pos: d.pos, spot: d.spot, category: d.category, items: [] });
      groups.get(k).items.push(d);
    }
    return [...groups.values()].filter((g) => g.items.length >= 5)
      .map((g) => ({ ...g, avg: g.items.reduce((s, x) => s + x.score, 0) / g.items.length }))
      .sort((a, b) => a.avg - b.avg).slice(0, 5);
  }

  function startTraining() {
    if (!ranges) return;
    if ($('training-spot').value === 'pushfold') { startPushfoldTraining(); return; }
    let type = $('training-spot').value;
    let hero = $('training-position').value, rival = $('training-rival').value;
    let category = null;
    const message = $('training-spot-label');
    if (type === 'leaks') {
      const leaks = computeLeaks();
      if (!leaks.length) {
        message.textContent = 'Aún no hay fugas: necesitas al menos 5 decisiones del mismo tipo (posición, spot y tipo de mano). Juega en la Mesa o entrena otros spots.';
        $('training-cards').replaceChildren(); $('training-actions').replaceChildren(); bars.entrenamiento = null;
        return;
      }
      const leak = random(leaks);
      type = SPOT_TO_TYPE[leak.spot];
      hero = leak.pos; rival = 'random'; category = leak.category;
      if (!TRAINING_TYPES[type].heroes.includes(hero)) hero = 'random';
    }
    const t = TRAINING_TYPES[type];
    if (hero === 'random' || !t.heroes.includes(hero)) {
      const options = rival !== 'random' ? t.heroes.filter((h) => validRivals(type, h).includes(rival)) : t.heroes;
      hero = random(options.length ? options : t.heroes);
    }
    const rivals = validRivals(type, hero);
    if (type !== 'rfi' && !rivals.includes(rival)) rival = random(rivals);
    if (type === 'rfi') rival = null;

    // Situación: apuestas de cada uno antes de que hables
    const bets = { SB: 0.5, BB: 1 };
    let chartName, raiseTo = 1, currentBet = 1, lastRaiseSize = 1, raiseCount = 0, story, villain = rival, openTo;
    if (type === 'rfi') {
      chartName = 'RFI_' + hero;
      story = 'Nadie ha entrado. Estás en ' + hero + '.';
    } else if (type === '3bet') {
      chartName = 'VS_OPEN_' + hero + '_vs_' + rival;
      openTo = SIZING.reference('open', rival).ref;
      bets[rival] = openTo;
      raiseTo = currentBet = openTo; lastRaiseSize = openTo - 1; raiseCount = 1;
      story = rival + ' abre a ' + fmt(openTo) + ' bb y los demás foldean. Estás en ' + hero + '.';
    } else {
      chartName = 'VS_3BET_' + hero + '_vs_' + rival;
      openTo = SIZING.reference('open', hero).ref;
      const threeBet = SIZING.reference('3bet', rival, hero, openTo).ref;
      bets[hero] = openTo; bets[rival] = threeBet;
      raiseTo = currentBet = threeBet; lastRaiseSize = threeBet - openTo; raiseCount = 2;
      story = 'Abres desde ' + hero + ' a ' + fmt(openTo) + ' bb y ' + rival + ' te hace 3-bet a ' + fmt(threeBet) + ' bb.';
    }
    const chart = ranges.charts[chartName];
    const spotName = t.spot;

    // Reparto: solo manos dudosas (o de la categoría de la fuga) si se ha pedido
    const doubtful = $('training-doubtful').checked;
    let cards, hand;
    for (let tries = 0; tries < 600; tries++) {
      cards = ENGINE.deal().hands[0];
      hand = handKey(cards);
      if (category && categoryOf(hand) !== category) continue;
      if (doubtful && !EVAL.isDoubtful(chart, hand, spotName)) continue;
      break;
    }
    const heroBet = bets[hero] || 0;
    const pot = Object.values(bets).reduce((a, b) => a + b, 0);
    const label = spotName + ' · ' + hero + (villain ? ' vs ' + villain : '') + (category ? ' · repaso de fuga: ' + category : '') + (doubtful ? ' · mano dudosa' : '');
    training = { type, hero, villain, chart, chartName, spotName, sizing: t.sizing, raiseTo, cards, hand, label, done: false, pot, due: currentBet - heroBet };

    message.innerHTML = '<strong>' + escapeHtml(label) + '</strong><br>' + escapeHtml(story) + ' Bote: ' + fmt(pot) + ' bb.';
    $('training-cards').replaceChildren(...cards.map(makeCard));
    const player = { bet: heroBet, stack: 100 - heroBet };
    const spot = { villain };
    const presets = preflopPresets(hero, spot, raiseCount, 0, currentBet, 100);
    bars.entrenamiento = renderBetBar({
      el: $('training-actions'), player, currentBet, lastRaiseSize, street: 'preflop', raiseCount, canRaise: true, pot, presets,
      refTo: SIZING.reference(t.sizing, hero, villain, raiseTo).ref, raiseWord: raiseCount === 0 ? 'Raise' : raiseCount === 1 ? '3-bet' : '4-bet',
      multBase: raiseCount ? currentBet : null,
      onAction: (action, to) => answerTraining(action, to)
    });
    $('training-feedback').hidden = true;
    $('training-range-panel').hidden = true;
    $('next-training').hidden = true;
  }

  async function answerTraining(action, to) {
    if (!training || training.done) return;
    training.done = true;
    const tr = training;
    const isRaise = action === 'raise' || action === 'allin';
    const result = EVAL.evaluatePreflop({ chart: tr.chart, hand: tr.hand, spot: tr.spotName, action, heroPos: tr.hero, villainPos: tr.villain, raiseTo: tr.raiseTo, sizeTo: isRaise ? to : undefined });
    const box = $('training-feedback');
    box.hidden = false;
    box.className = 'feedback ' + verdictClass(result.score);
    box.innerHTML = preflopFeedbackHtml({ hand: tr.hand, pos: tr.hero, villain: tr.villain, spot: tr.spotName, raiseTo: tr.raiseTo, sizeTo: to, result }) + '<p class="source why-loading">Calculando el porqué…</p>';
    whyPreflopHtml({ cards: tr.cards, hand: tr.hand, spotName: tr.spotName, heroPos: tr.hero, villainPos: tr.villain, chart: tr.chart, result, due: tr.due, pot: tr.pot }).then((html) => {
      if (training !== tr) return; // ya se ha repartido otro spot
      const loading = box.querySelector('.why-loading');
      if (loading) loading.outerHTML = html;
    });
    renderRangeGrid($('training-range-grid'), tr.chart, tr.cards);
    $('training-range-label').textContent = tr.label;
    $('training-range-panel').hidden = false;
    $('training-actions').replaceChildren();
    bars.entrenamiento = null;
    $('next-training').hidden = false;
    $('next-training').focus({ preventScroll: true });
    // Racha: acierto = 85 o más (acción correcta y tamaño al menos aceptable)
    if (result.score >= 85) { streak.current++; streak.best = Math.max(streak.best, streak.current); } else streak.current = 0;
    streak.last.push(result.score);
    if (streak.last.length > 20) streak.last.shift();
    renderStreak();
    saveDecision(decisionRecord('entrenamiento', tr.hero, { name: tr.spotName, villain: tr.villain, sizing: tr.sizing }, tr.hand, result, isRaise ? to : null));
  }

  /* ---------- Entrenamiento de push/fold ----------
     Mitad de los spots: nadie ha entrado y decides all-in o fold.
     La otra mitad: alguien va all-in antes que tú y decides call o fold. La BB solo puede pagar. */
  function startPushfoldTraining() {
    const message = $('training-spot-label');
    if (!pushfold) { message.textContent = 'No se han podido cargar las tablas de push/fold.'; return; }
    const [lo, hi] = PF_BANDS[$('training-rival').value] || PF_BANDS.all;
    const heroChoice = $('training-position').value;
    const doubtful = $('training-doubtful').checked;
    let spot = null, cards, hand;
    for (let tries = 0; tries < 2000 && !spot; tries++) {
      const stack = lo + Math.floor(Math.random() * (hi - lo + 1));
      const hero = heroChoice === 'random' ? random(PF_HEROES) : heroChoice;
      const iHero = POS.indexOf(hero);
      const kind = hero === 'BB' ? 'call' : hero === 'UTG' ? 'push' : Math.random() < 0.5 ? 'push' : 'call';
      cards = ENGINE.deal().hands[0];
      hand = handKey(cards);
      if (kind === 'push') {
        const res = PUSHFOLD.pushSpot(pushfold, { stackBb: stack, playersBehind: 5 - iHero, hand });
        if (doubtful && !PUSHFOLD.isDoubtfulPush(pushfold, { stack, pos: res.pos, hand })) continue;
        spot = { ...res, behind: 5 - iHero };
      } else {
        const pusher = random(POS.slice(0, iHero));
        const iPusher = POS.indexOf(pusher);
        const res = PUSHFOLD.callSpot(pushfold, { stackBb: stack, pusherBehind: 5 - iPusher, callerOffset: iHero - iPusher, hand });
        if (res.unevaluated) continue;
        if (doubtful && !PUSHFOLD.isDoubtfulCall(pushfold, { stack, caller: hero, pusher, hand })) continue;
        spot = { ...res, pusherBehind: 5 - iPusher };
      }
    }
    // Bote antes de que hables: ciegas, antes y, si alguien ha ido all-in, su stack entero
    const blinds = 1.5 + 6 * pushfold.ante;
    const heroPosted = spot.pos === 'SB' ? 0.5 : spot.pos === 'BB' ? 1 : 0;
    const pot = spot.kind === 'push' ? blinds : blinds + spot.stack - (spot.pusher === 'SB' ? 0.5 : 0) - pushfold.ante;
    const due = spot.kind === 'push' ? 0 : spot.stack - heroPosted - pushfold.ante;
    training = { pushfold: true, spot, cards, hand, done: false, pot, due, label: 'Push/fold · ' + spot.pos + ' · ' + spot.stack + ' bb' + (doubtful ? ' · mano dudosa' : '') };
    const story = spot.kind === 'push'
      ? 'Torneo, ante 0,125 bb. Nadie ha entrado y tienes ' + spot.stack + ' bb en ' + spot.pos + ' (' + spot.behind + (spot.behind === 1 ? ' jugador' : ' jugadores') + ' detrás). ¿All-in o fold?'
      : 'Torneo, ante 0,125 bb. ' + spot.pusher + ' va all-in con ' + spot.stack + ' bb, los demás foldean y te toca en ' + spot.pos + '. ¿Call o fold?';
    message.innerHTML = '<strong>' + escapeHtml(training.label) + '</strong><br>' + escapeHtml(story) + ' Bote: ' + fmt(pot) + ' bb.';
    $('training-cards').replaceChildren(...cards.map(makeCard));
    const el = $('training-actions');
    el.replaceChildren();
    const row = document.createElement('div');
    row.className = 'actions';
    const options = spot.kind === 'push' ? [['fold', 'Fold', 'F'], ['allin', 'All-in', 'R']] : [['fold', 'Fold', 'F'], ['call', 'Call ' + fmt(due) + ' bb', 'C']];
    for (const [action, text, key] of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'action-btn' + (action === 'fold' ? '' : ' primary');
      b.innerHTML = text + ' <kbd>' + key + '</kbd>';
      b.addEventListener('click', () => answerPushfold(action));
      row.append(b);
    }
    el.append(row);
    bars.entrenamiento = {
      fold: () => answerPushfold('fold'),
      checkCall: () => spot.kind === 'call' && answerPushfold('call'),
      raiseRef: () => spot.kind === 'push' && answerPushfold('allin')
    };
    $('training-feedback').hidden = true;
    $('training-range-panel').hidden = true;
    $('next-training').hidden = true;
  }

  async function answerPushfold(action) {
    if (!training || !training.pushfold || training.done) return;
    training.done = true;
    const tr = training;
    const score = action === tr.spot.correct ? 100 : 0;
    const box = $('training-feedback');
    box.hidden = false;
    box.className = 'feedback ' + verdictClass(score);
    box.innerHTML = pushfoldFeedbackHtml(tr.spot, tr.hand, action, score) + '<p class="source why-loading">Calculando el porqué…</p>';
    showPushfoldChart($('training-range-panel'), $('training-range-label'), $('training-range-grid'), tr.spot, tr.cards);
    $('training-actions').replaceChildren();
    bars.entrenamiento = null;
    $('next-training').hidden = false;
    $('next-training').focus({ preventScroll: true });
    if (score === 100) { streak.current++; streak.best = Math.max(streak.best, streak.current); } else streak.current = 0;
    streak.last.push(score);
    if (streak.last.length > 20) streak.last.shift();
    renderStreak();
    saveDecision(pushfoldRecord('entrenamiento', tr.spot, tr.hand, action, score));
    const why = await pushfoldWhyHtml(tr.spot, tr.cards, tr.pot, tr.due);
    if (training !== tr) return;
    const loading = box.querySelector('.why-loading');
    if (loading) loading.outerHTML = why;
  }

  function renderStreak() {
    const avg = streak.last.length ? Math.round(streak.last.reduce((a, b) => a + b, 0) / streak.last.length) : null;
    $('training-score').innerHTML = 'Racha <strong>' + streak.current + '</strong> · Mejor <strong>' + streak.best + '</strong> · Media de los últimos ' + (streak.last.length || 20) + ': <strong>' + (avg == null ? '—' : avg + '/100') + '</strong>';
  }

  /* ---------- Estadísticas ---------- */

  const avg = (items, key = 'score') => (items.length ? items.reduce((s, x) => s + x[key], 0) / items.length : null);

  function tableRows(el, rows, head) {
    if (!rows.length) { el.innerHTML = '<p class="muted">Aún no hay datos suficientes.</p>'; return; }
    el.innerHTML = '<table class="stats-table">' + (head ? '<thead><tr>' + head.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead>' : '') +
      '<tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  function renderStats() {
    const pre = stats.decisions.filter((d) => d.type === 'preflop' && d.score != null);
    const post = stats.decisions.filter((d) => d.type === 'postflop' && d.score != null);
    const sized = stats.decisions.filter((d) => d.sizingScore != null);
    const show = (v) => (v == null ? '—' : fmt(Math.round(v * 10) / 10) + '/100');
    $('stat-decisions').textContent = stats.decisions.length;
    $('stat-session').textContent = sessionDecisions;
    $('stat-pre').textContent = show(avg(pre));
    $('stat-post').textContent = show(avg(post));
    $('stat-sizing').textContent = show(avg(sized, 'sizingScore'));
    $('stat-result').textContent = (stats.result >= 0 ? '+' : '') + fmt(stats.result) + ' bb';

    tableRows($('stats-position'), POS.map((p) => [p, pre.filter((d) => d.pos === p)]).filter(([, g]) => g.length).map(([p, g]) => [p + ' (' + g.length + ')', show(avg(g))]));
    tableRows($('stats-spot'), ['Apertura', 'Contra apertura', 'Contra 3-bet'].map((s) => [s, pre.filter((d) => d.spot === s)]).filter(([, g]) => g.length).map(([s, g]) => [s + ' (' + g.length + ')', show(avg(g))]));
    // Tamaño por tipo de subida: nota de la acción y nota del tamaño por separado
    const sizingRows = [['open', 'Apertura'], ['3bet', '3-bet'], ['4bet', '4-bet']].map(([k, name]) => [name, sized.filter((d) => d.sizingSpot === k)])
      .filter(([, g]) => g.length).map(([name, g]) => [name + ' (' + g.length + ')', show(avg(g.filter((d) => d.actionScore != null), 'actionScore')), show(avg(g, 'sizingScore'))]);
    tableRows($('stats-sizing'), sizingRows, ['Subida', 'Acción', 'Tamaño']);

    // Resultado contra cada perfil (en bb, Mesa y Torneo)
    const byProfile = stats.byProfile || {};
    tableRows($('stats-profiles'), PROFILES.TYPES.filter((t) => byProfile[t]).map((t) => {
      const e = byProfile[t];
      return [PROFILES.LABELS[t] + ' (' + e.hands + ')', (e.net >= 0 ? '+' : '') + fmt(Math.round(e.net * 10) / 10) + ' bb', fmt(Math.round((e.net / e.hands) * 100) / 100) + ' bb/mano'];
    }), ['Perfil', 'Resultado', 'Por mano']);
    // Push/fold por tramo de stack y posición, con las fugas (media < 70 y al menos 5 decisiones)
    const pf = stats.decisions.filter((d) => d.type === 'pushfold');
    const pfRows = [];
    for (const band of ['4-7 bb', '8-11 bb', '12-15 bb', '16-25 bb']) {
      for (const pos of PF_HEROES) {
        const g = pf.filter((d) => d.band === band && d.pos === pos);
        if (!g.length) continue;
        const pushes = g.filter((d) => d.spot === 'Push');
        const tight = pushes.filter((d) => d.correct === 'allin' && d.action === 'fold').length;
        const loose = pushes.filter((d) => d.correct === 'fold' && d.action === 'allin').length;
        const note = tight > loose ? 'empujas poco' : loose > tight ? 'empujas de más' : '';
        pfRows.push([pos + ' · ' + band + ' (' + g.length + ')', show(avg(g)), avg(g) < 70 && g.length >= 5 ? '<strong>fuga</strong>' + (note ? ': ' + note : '') : note]);
      }
    }
    tableRows($('stats-pushfold'), pfRows, ['Spot', 'Nota', '']);
    tableRows($('stats-tournaments'), (stats.tournaments || []).slice(0, 10).map((t) =>
      [t.date, t.place + '.º' + (t.prize ? ' · ' + t.prize + ' %' : ''), t.hands + ' manos', 'push/fold ' + (t.pushfold == null ? '—' : t.pushfold + '/100')]), ['Fecha', 'Puesto', 'Manos', 'Nota']);

    const leaks = computeLeaks();
    $('stats-leaks').innerHTML = leaks.length
      ? '<table class="stats-table"><tbody>' + leaks.map((l) => '<tr><td>' + l.key + ' (' + l.items.length + ')</td><td>' + show(l.avg) + '</td></tr>').join('') + '</tbody></table><button type="button" class="reset" id="train-leaks">Repasar mis fugas</button>'
      : '<p class="muted">Necesitas al menos cinco decisiones del mismo tipo para detectar una fuga.</p>';
    const trainLeaks = $('train-leaks');
    if (trainLeaks) trainLeaks.addEventListener('click', () => { $('training-spot').value = 'leaks'; refreshTrainingFilters(); setTab('entrenamiento'); startTraining(); });

    renderHistory();
  }

  // Historial: cada mano se puede abrir y muestra la acción calle a calle
  function renderHistory() {
    const el = $('stats-history');
    if (!stats.hands.length) { el.innerHTML = '<p class="muted">Aún no has terminado ninguna mano.</p>'; return; }
    el.innerHTML = stats.hands.slice(0, HISTORY_SIZE).map((h) => {
      const res = (h.result >= 0 ? '+' : '') + fmt(h.result) + ' bb';
      let body = '';
      if (Array.isArray(h.log) && h.log.length) {
        for (const street of ['preflop', 'flop', 'turn', 'river']) {
          const items = h.log.filter((x) => x.street === street);
          if (!items.length) continue;
          const boardCards = h.board ? h.board.split(' ').slice(0, { preflop: 0, flop: 3, turn: 4, river: 5 }[street]).join(' ') : '';
          body += '<h4>' + STREET[street] + (boardCards ? ' · ' + boardCards : '') + '</h4><ul>' + items.map((x) => '<li><b>' + escapeHtml(x.who) + '</b> ' + escapeHtml(x.text) + '</li>').join('') + '</ul>';
        }
      }
      if (h.shown && h.shown.length) body += '<h4>Showdown</h4><ul>' + h.shown.map((s) => '<li><b>' + escapeHtml(s.who) + '</b> ' + escapeHtml(s.cards) + (s.made ? ' · ' + escapeHtml(s.made) : '') + (s.chart ? ' · tabla ' + escapeHtml(s.chart) : '') + '</li>').join('') + '</ul>';
      if (h.charts && h.charts.length) body += '<h4>Tablas de los bots</h4><ul>' + h.charts.map((c) => '<li>' + escapeHtml(c) + '</li>').join('') + '</ul>';
      const notes = (h.notes || h.decisions || []).filter(Boolean);
      if (notes.length) body += '<h4>Tus notas</h4><ul>' + notes.map((n) => '<li>' + escapeHtml(n) + '</li>').join('') + '</ul>';
      return '<details class="hand-log"><summary><span>Mano ' + h.number + ' · ' + h.position + ' · ' + escapeHtml(h.hand) + '</span><span class="' + (h.result >= 0 ? 'win' : 'loss') + '">' + res + '</span></summary>' +
        '<p class="muted">' + escapeHtml(h.message) + (h.board ? ' · Board: ' + escapeHtml(h.board) : '') + '</p>' + body + '</details>';
    }).join('');
  }

  /* ---------- Exportar estadísticas ---------- */

  // Resumen en texto, pensado para pegarlo en un chat y analizarlo
  function buildSummary() {
    const pre = stats.decisions.filter((d) => d.type === 'preflop' && d.score != null);
    const post = stats.decisions.filter((d) => d.type === 'postflop' && d.score != null);
    const show = (v) => (v == null ? '—' : Math.round(v));
    const lines = [];
    lines.push('Mesa de Estudio (Sala de Juegos) · estadísticas exportadas el ' + new Date().toLocaleString('es-ES'));
    lines.push('Formato: NLHE cash 6-max, 100 bb, ciegas 0,5/1. Rangos: ' + rangeSource + '. Nota = 100 × frecuencia de tu acción / frecuencia de la acción más usada, × factor del tamaño en las subidas.');
    lines.push('Decisiones guardadas: ' + stats.decisions.length + ' · preflop evaluadas: ' + pre.length + ' (media ' + show(avg(pre)) + '/100) · postflop evaluadas: ' + post.length + ' (media ' + show(avg(post)) + '/100) · resultado acumulado: ' + fmt(stats.result) + ' bb');
    lines.push('');
    lines.push('Por posición (preflop): ' + POS.map((p) => [p, pre.filter((d) => d.pos === p)]).filter(([, g]) => g.length).map(([p, g]) => p + ' ' + show(avg(g)) + ' (' + g.length + ')').join(' · '));
    // Por posición y spot, con los tipos de error
    lines.push('Por posición y spot (nota media · decisiones · % de folds con manos que la referencia juega · % de jugadas con manos que la referencia foldea):');
    for (const p of POS) for (const sp of ['Apertura', 'Contra apertura', 'Contra 3-bet']) {
      const g = pre.filter((d) => d.pos === p && d.spot === sp);
      if (!g.length) continue;
      const overFold = g.filter((d) => d.action === 'fold' && d.score < 50).length;
      const overPlay = g.filter((d) => d.action !== 'fold' && d.actionScore === 0).length;
      lines.push('  ' + p + ' · ' + sp + ': ' + show(avg(g)) + ' · ' + g.length + ' · foldea de más ' + pct(overFold / g.length) + ' · juega de más ' + pct(overPlay / g.length));
    }
    const sized = stats.decisions.filter((d) => d.sizingScore != null);
    const sizingLine = [['open', 'Apertura'], ['3bet', '3-bet'], ['4bet', '4-bet']].map(([k, n]) => [n, sized.filter((d) => d.sizingSpot === k)]).filter(([, g]) => g.length).map(([n, g]) => n + ' ' + show(avg(g.filter((d) => d.actionScore != null), 'actionScore')) + '/' + show(avg(g, 'sizingScore')) + ' (' + g.length + ')').join(' · ');
    if (sizingLine) lines.push('Tamaños (nota de la acción / del tamaño): ' + sizingLine);
    const leaks = computeLeaks();
    if (leaks.length) lines.push('Fugas (peores grupos con 5+ decisiones): ' + leaks.map((l) => l.key + ' ' + show(l.avg) + ' (' + l.items.length + ')').join(' · '));
    lines.push('');
    lines.push('Últimas decisiones preflop con nota < 50 (posición · spot · rival · mano · acción · tamaño → nota):');
    pre.filter((d) => d.score < 50).slice(-40).forEach((d) => lines.push('  ' + d.pos + ' · ' + d.spot + ' · ' + (d.rival || '—') + ' · ' + d.hand + ' · ' + d.action + (d.sizeTo ? ' a ' + fmt(d.sizeTo) + ' bb' : '') + ' → ' + d.score));
    lines.push('');
    lines.push('Últimas decisiones postflop:');
    stats.decisions.filter((d) => d.type === 'postflop').slice(-20).forEach((d) => lines.push('  ' + d.pos + ' · ' + d.hand + ' · ' + (d.note || d.action)));
    lines.push('');
    lines.push('Últimas 10 manos:');
    stats.hands.slice(0, 10).forEach((h) => {
      lines.push('  Mano ' + h.number + ' · ' + h.position + ' · ' + h.hand + ' · ' + (h.result >= 0 ? '+' : '') + fmt(h.result) + ' bb · board ' + (h.board || '—') + ' · ' + h.message);
      (h.log || []).forEach((x) => lines.push('    ' + x.street + ': ' + x.who + ' ' + x.text));
    });
    return lines.join('\n');
  }

  function exportJson() {
    const data = { app: 'Mesa de Estudio', exportedAt: new Date().toISOString(), rangeSource, summary: buildSummary(), stats };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mesa-de-estudio-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('export-message').textContent = 'Descargado. Adjunta el archivo en un chat para analizarlo.';
  }

  async function copySummary() {
    const text = buildSummary();
    const msg = $('export-message');
    try {
      await navigator.clipboard.writeText(text);
      msg.textContent = 'Resumen copiado (' + text.split('\n').length + ' líneas). Pégalo en un chat.';
    } catch (_) {
      // Sin permiso para el portapapeles: mostramos el texto para copiarlo a mano
      const area = $('export-text');
      area.hidden = false;
      area.value = text;
      area.select();
      msg.textContent = 'No se pudo copiar automáticamente: selecciona el texto y cópialo.';
    }
  }

  /* ---------- Pestañas, ajustes y teclado ---------- */

  function setTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab').forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('.view').forEach((v) => { const on = v.id === 'view-' + name; v.hidden = !on; v.classList.toggle('active', on); });
    if (name === 'mesa' || name === 'torneo') showTableIn(name);
  }

  function importRanges() {
    const msg = $('range-message');
    try {
      const data = JSON.parse($('range-json').value);
      validateRanges(data);
      safeSet(STORAGE_RANGES, JSON.stringify(data));
      ranges = data;
      rangeSource = 'Rangos propios · ' + (data.name || 'sin nombre');
      $('range-source').textContent = rangeSource;
      msg.className = 'settings-message';
      msg.textContent = 'Rangos validados e importados. Se usarán en las próximas decisiones.';
    } catch (e) {
      msg.className = 'settings-message error';
      msg.textContent = 'No se han importado: ' + e.message;
    }
  }

  function restoreRanges() {
    safeSet(STORAGE_RANGES, '');
    ranges = referenceRanges;
    rangeSource = 'Referencia aproximada 6-max · 100 bb';
    $('range-source').textContent = rangeSource;
    $('range-message').textContent = 'Rangos de referencia restaurados.';
  }

  /* ---------- Resultado contra cada perfil ---------- */

  // A quién se atribuye la mano: si pierdes, a quien más gana; si ganas, a quien más pierde
  function recordProfileResult(net) {
    if (Math.abs(net) < EPS) return;
    const rivals = game.players.filter((p) => p.id !== 0 && !p.out && p.profile);
    if (!rivals.length) return;
    const delta = (p) => p.stack - p.startStack;
    const rival = rivals.reduce((a, b) => (net < 0 ? (delta(b) > delta(a) ? b : a) : (delta(b) < delta(a) ? b : a)));
    stats.byProfile = stats.byProfile || {};
    const entry = stats.byProfile[rival.profile] || (stats.byProfile[rival.profile] = { hands: 0, net: 0 });
    entry.hands++;
    entry.net += net;
  }

  /* ---------- Torneo ---------- */

  function saveTour() { safeSet(STORAGE_TOURNAMENT, tour ? JSON.stringify(tour) : ''); }
  function loadTour() {
    try {
      const data = JSON.parse(safeGet(STORAGE_TOURNAMENT) || 'null');
      if (data && Array.isArray(data.players) && data.players.length === 6) tour = data;
    } catch (_) { tour = null; }
  }

  function newTournament() {
    tour = TOURNAMENT.create(PROFILES.assign(rivalMode), Number($('tournament-level-speed').value) || 10);
    tourGame = null;
    $('tour-result').hidden = true;
    saveTour();
    startTournamentHand();
  }

  function startTournamentHand() {
    if (!tour || tour.finished || tour.heroOut) { renderTournament(); return; }
    const level = TOURNAMENT.levelAt(tour.hand, tour.perLevel);
    const seats = TOURNAMENT.seating(tour);
    const deal = ENGINE.deal();
    game = tourGame = baseGame({ mode: 'torneo', button: tour.button, handNo: tour.hand, level });
    game.headsUp = TOURNAMENT.alive(tour).length === 2;
    game.players = tour.players.map((tp, id) => {
      const p = newPlayer(id, seats[id] || '', deal.hands[id], tp.alive ? tp.chips / level.bb : 0, tp.profile);
      if (!tp.alive) { p.out = true; p.folded = true; p.place = tp.place; }
      return p;
    });
    game.startChips = Object.fromEntries(tour.players.map((p) => [p.id, p.chips]));
    game.runout = deal.board;
    postBlinds(level.ante / level.bb);
    renderTournament();
    beginHand();
  }

  // Al terminar una mano: fichas, eliminaciones, botón y siguiente nivel
  function afterTournamentHand(net) {
    const finals = Object.fromEntries(game.players.map((p) => [p.id, p.out ? 0 : p.stack]));
    TOURNAMENT.settleChips(tour, finals, game.level.bb);
    const out = TOURNAMENT.eliminate(tour, game.startChips);
    const names = out.map((p) => (p.id === 0 ? 'Tú' : 'Rival ' + p.id) + ' (' + p.place + '.º)');
    tour.decisions.push(...game.decisions.filter((d) => d.score != null).map((d) => ({ type: d.type, score: d.score })));
    tour.hand++;
    if (!tour.finished) TOURNAMENT.moveButton(tour);
    const hero = tour.players[0];
    if (!hero.alive || tour.finished) {
      tour.heroOut = true;
      tour.finished = true;
      recordTournament(hero.place);
      showTournamentEnd(hero.place);
    }
    const chips = hero.chips.toLocaleString('es-ES');
    $('hand-summary').textContent = $('table-status').textContent + ' Tus fichas: ' + chips + ' (' + (net >= 0 ? '+' : '') + fmt(net) + ' bb).' +
      (names.length ? ' Eliminados: ' + names.join(', ') + '.' : '') + (tour.finished ? '' : ' Pulsa «Nueva mano» (o N) para seguir.');
    saveTour();
    renderTournament();
  }

  // Fin del torneo: en lugar de «Nueva mano», el resultado y un botón para ir a él
  function showTournamentEnd(place) {
    $('new-hand').hidden = true;
    $('action-prompt').innerHTML = '<strong>' + (place === 1 ? '¡Has ganado el torneo!' : 'Torneo terminado: ' + place + '.º puesto') + '</strong>';
    $('tour-see').hidden = false;
  }

  function recordTournament(place) {
    const pf = tour.decisions.filter((d) => d.type === 'pushfold');
    const pre = tour.decisions.filter((d) => d.type === 'preflop');
    const mean = (list) => (list.length ? Math.round(list.reduce((a, d) => a + d.score, 0) / list.length) : null);
    tour.summary = { place, hands: tour.hand - 1, pushfold: mean(pf), preflop: mean(pre), prize: TOURNAMENT.prize(place) };
    stats.tournaments = stats.tournaments || [];
    stats.tournaments.unshift({ date: new Date().toISOString().slice(0, 10), ...tour.summary });
    stats.tournaments = stats.tournaments.slice(0, 50);
    saveStats();
    renderStats();
  }

  function renderTournamentPanel() {
    if (!tour) return;
    const level = TOURNAMENT.levelAt(Math.min(tour.hand, game && game.mode === 'torneo' ? game.handNo : tour.hand), tour.perLevel);
    const es = (n) => n.toLocaleString('es-ES');
    $('tour-level').textContent = level.level;
    $('tour-blinds').innerHTML = es(level.sb) + '/' + es(level.bb) + (level.ante ? '<small>ante ' + es(level.ante) + '</small>' : '');
    $('tour-players').textContent = TOURNAMENT.alive(tour).length;
    const hero = game && game.mode === 'torneo' && !game.finished ? game.players[0].stack + game.players[0].bet : tour.players[0].chips / level.bb;
    const chips = game && game.mode === 'torneo' && !game.finished ? Math.round(hero * level.bb) : tour.players[0].chips;
    $('tour-stack').innerHTML = fmt(Math.round(hero * 10) / 10) + ' bb<small>' + es(chips) + ' fichas</small>';
  }

  // Pestaña Torneo: lobby, marcador, mesa o resultado final
  function renderTournament() {
    const playing = !!tour && !tour.finished;
    $('tour-panel').hidden = !tour;
    $('tour-lobby').hidden = playing;
    $('table-block').hidden = currentTab === 'torneo' && !tourGame;
    if (tour) renderTournamentPanel();
    $('tournament-new').textContent = 'Nuevo torneo';
    $('tour-quit').hidden = !playing;
    const res = $('tour-result');
    if (tour && tour.finished && tour.summary) {
      const s = tour.summary;
      res.hidden = false;
      res.innerHTML = '<h3>' + (s.place === 1 ? '¡Has ganado el torneo!' : 'Torneo terminado · ' + s.place + '.º puesto') + '</h3>' +
        '<p>' + s.hands + ' manos · premio ' + (s.prize ? s.prize + ' % (simulado)' : 'fuera de premios') +
        ' · nota push/fold ' + (s.pushfold == null ? '—' : s.pushfold + '/100') + ' · nota preflop ' + (s.preflop == null ? '—' : s.preflop + '/100') + '</p>';
    } else res.hidden = true;
    $('tournament-players').innerHTML = tour ? tour.players.map((p) =>
      '<p>' + (p.id === 0 ? '<strong>Tú</strong>' : 'Rival ' + p.id + (showRivalProfiles ? ' · ' + PROFILES.LABELS[p.profile] : '')) + ' · ' +
      (p.alive ? p.chips.toLocaleString('es-ES') + ' fichas' : 'eliminado (' + p.place + '.º)') + '</p>').join('') : '';
  }

  /* ---------- Pestañas Mesa y Torneo: comparten la mesa ---------- */

  function showTableIn(tab) {
    const block = $('table-block');
    if (tab === 'torneo') {
      $('tour-slot').append(block);
      game = tourGame;
      // Torneo guardado de otra visita: se sigue con una mano nueva
      if (!game && tour && !tour.finished && ranges) { startTournamentHand(); return; }
      if (!game) block.hidden = true;
      renderTournament();
    } else {
      $('view-mesa').append(block);
      block.hidden = false;
      game = cashGame;
    }
    if (!game) return;
    renderTable(game.finished ? null : 0);
    $('tour-see').hidden = true;
    if (game.finished) {
      $('actions').replaceChildren();
      $('action-prompt').textContent = 'Mano terminada.';
      $('new-hand').hidden = false;
      if (game.mode === 'torneo' && tour && tour.finished && tour.summary) showTournamentEnd(tour.summary.place);
    }
    else if (!game.busy) { const pending = getPending(); if (pending.length && pending[0].id === 0) renderHeroActions(); }
  }

  function loadRivalSettings() {
    try {
      const data = JSON.parse(safeGet(STORAGE_RIVALS) || 'null');
      if (data && PROFILES.MODES.includes(data.mode)) rivalMode = data.mode;
      if (data && typeof data.show === 'boolean') showRivalProfiles = data.show;
    } catch (_) { /* valores por defecto */ }
  }
  function saveRivalSettings() { safeSet(STORAGE_RIVALS, JSON.stringify({ mode: rivalMode, show: showRivalProfiles })); }

  function bind() {
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('new-hand').addEventListener('click', startHand);
    $('deal-training').addEventListener('click', startTraining);
    $('next-training').addEventListener('click', startTraining);
    $('training-spot').addEventListener('change', refreshTrainingFilters);
    $('training-position').addEventListener('change', refreshTrainingFilters);
    $('import-ranges').addEventListener('click', importRanges);
    $('restore-ranges').addEventListener('click', restoreRanges);
    $('range-file').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) $('range-json').value = await f.text(); });
    $('feedback-mode').addEventListener('change', (e) => { feedbackMode = e.target.value; });
    $('rival-mode').value = rivalMode;
    $('rival-mode').addEventListener('change', (e) => {
      rivalMode = e.target.value;
      cashProfiles = PROFILES.assign(rivalMode);
      saveRivalSettings();
      $('rival-message').textContent = 'Se aplica desde la próxima mano de la Mesa y en el próximo torneo.';
    });
    $('show-rival-profiles').checked = showRivalProfiles;
    $('show-rival-profiles').addEventListener('change', (e) => {
      showRivalProfiles = e.target.checked;
      saveRivalSettings();
      if (game) renderTable();
      renderTournament();
    });
    $('tournament-level-speed').addEventListener('change', (e) => { if (tour && !tour.finished) { tour.perLevel = Number(e.target.value); saveTour(); renderTournament(); } });
    $('tournament-new').addEventListener('click', newTournament);
    $('tour-see').addEventListener('click', () => $('tour-lobby').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    // Abandonar pide un segundo toque en el propio botón (sin confirm())
    $('tour-quit').addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Toca otra vez para abandonar'; return; }
      b.dataset.armed = '';
      b.textContent = 'Abandonar torneo';
      tour = null;
      tourGame = null;
      game = null;
      saveTour();
      $('table-block').hidden = true;
      $('tour-see').hidden = true;
      renderTournament();
    });
    $('show-hints').checked = showHints;
    $('show-hints').addEventListener('change', (e) => { showHints = e.target.checked; safeSet(STORAGE_HINTS, showHints ? 'on' : 'off'); if (bars.mesa && game && !game.finished) renderHeroActions(); });
    $('export-json').addEventListener('click', exportJson);
    $('copy-summary').addEventListener('click', copySummary);
    // Confirmación en dos pasos dentro de la página (sin confirm(), que algunos navegadores bloquean)
    let clearArmed = null;
    $('clear-stats').addEventListener('click', () => {
      const b = $('clear-stats');
      if (!clearArmed) {
        b.dataset.label = b.textContent;
        b.textContent = 'Pulsa otra vez para borrarlo todo';
        clearArmed = setTimeout(() => { b.textContent = b.dataset.label; clearArmed = null; }, 4000);
        return;
      }
      clearTimeout(clearArmed); clearArmed = null;
      b.textContent = b.dataset.label;
      stats = { decisions: [], hands: [], result: 0 };
      saveStats();
      renderStats();
    });

    /* Atajos: F fold · C check/call · R subida con el tamaño de referencia · ← → cambian el tamaño ·
       Enter confirma (o reparte el siguiente spot) · N nueva mano */
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.matches('textarea, select, input[type=number], input[type=text], input[type=file]')) return;
      const bar = bars[currentTab === 'torneo' ? 'mesa' : currentTab];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (currentTab === 'entrenamiento' && key === 'Enter' && training && training.done) { e.preventDefault(); startTraining(); return; }
      if ((currentTab === 'mesa' || currentTab === 'torneo') && key === 'n' && game && game.finished && !$('new-hand').hidden) { startHand(); return; }
      if (!bar) return;
      if (key === 'f') bar.fold();
      else if (key === 'c') bar.checkCall();
      else if (key === 'r' && bar.raiseRef) bar.raiseRef();
      else if ((key === 'ArrowRight' || key === 'ArrowUp') && bar.nudge && !e.target.matches('input[type=range]')) { e.preventDefault(); bar.nudge(1); }
      else if ((key === 'ArrowLeft' || key === 'ArrowDown') && bar.nudge && !e.target.matches('input[type=range]')) { e.preventDefault(); bar.nudge(-1); }
      else if (key === 'Enter' && bar.confirm && !e.target.matches('button')) { e.preventDefault(); bar.confirm(); }
    });
  }

  async function boot() {
    loadRivalSettings();
    loadTour();
    bind();
    refreshTrainingFilters();
    renderStreak();
    await initRanges();
    renderStats();
    if (ranges) { startHand(); startTraining(); }
    renderTournament();
  }
  boot();
})();
