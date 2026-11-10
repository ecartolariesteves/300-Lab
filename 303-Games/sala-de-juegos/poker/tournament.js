/* Sit & Go de 6 jugadores: niveles, posiciones, fichas y eliminaciones. Sin DOM.
   Las manos se juegan en bb (ciega grande = 1). Este módulo convierte entre fichas y bb. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PokerTournament = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const START_CHIPS = 1500;
  const SEATS = 6;
  // [ciega pequeña, ciega grande, ante por jugador]. Desde el nivel 4, ante = 1/8 de la ciega grande.
  const LEVELS = [
    [10, 20, 0], [15, 30, 0], [25, 50, 0], [50, 100, 12], [75, 150, 19], [100, 200, 25],
    [150, 300, 38], [200, 400, 50], [300, 600, 75], [400, 800, 100], [600, 1200, 150], [800, 1600, 200],
  ];
  const PRIZES = { 1: 65, 2: 35 };

  // Nivel de una mano (la mano 1 es la primera). A partir del 12, cada nivel multiplica por 1,5.
  function levelAt(hand, perLevel = 10) {
    const index = Math.floor(Math.max(0, hand - 1) / perLevel);
    if (index < LEVELS.length) {
      const [sb, bb, ante] = LEVELS[index];
      return { level: index + 1, sb, bb, ante };
    }
    let bb = LEVELS[LEVELS.length - 1][1];
    for (let i = LEVELS.length; i <= index; i++) bb = Math.round((bb * 1.5) / 100) * 100;
    return { level: index + 1, sb: bb / 2, bb, ante: Math.round(bb / 8) };
  }

  // Posiciones según los jugadores que quedan: se quitan primero UTG, luego HJ y luego CO
  function positions(count) {
    const table = {
      6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
      5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
      4: ['CO', 'BTN', 'SB', 'BB'],
      3: ['BTN', 'SB', 'BB'],
      2: ['SB', 'BB'],
    };
    if (!table[count]) throw new Error('Número de jugadores no válido: ' + count);
    return table[count];
  }

  function create(profiles, perLevel = 10, random = Math.random) {
    return {
      hand: 1,
      perLevel,
      button: Math.floor(random() * SEATS),
      players: Array.from({ length: SEATS }, (_, id) => ({
        id,
        chips: START_CHIPS,
        alive: true,
        place: null,
        profile: id === 0 ? null : profiles[id - 1],
      })),
      finished: false,
      decisions: [],
    };
  }

  const alive = (state) => state.players.filter((p) => p.alive);

  // Siguiente asiento vivo en el sentido de las agujas del reloj
  function nextAlive(state, from) {
    for (let k = 1; k <= SEATS; k++) {
      const id = (from + k) % SEATS;
      if (state.players[id].alive) return id;
    }
    return from;
  }

  /* Posición de cada asiento vivo para la mano actual: { asiento: 'BTN' }.
     Con 3 o más: BTN, SB y BB detrás del botón, y el resto en orden desde UTG.
     En heads-up el botón es la SB y el otro jugador la BB. */
  function seating(state) {
    const count = alive(state).length;
    const order = []; // asientos vivos empezando por el de después del botón
    let id = state.button;
    for (let k = 0; k < count; k++) { id = nextAlive(state, id); order.push(id); }
    const map = {};
    if (count === 2) {
      map[state.button] = 'SB';
      map[order[0] === state.button ? order[1] : order[0]] = 'BB';
      return map;
    }
    // order termina en el botón: [SB, BB, ...resto, BTN]
    map[order[0]] = 'SB';
    map[order[1]] = 'BB';
    map[state.button] = 'BTN';
    const early = positions(count).filter((p) => !['BTN', 'SB', 'BB'].includes(p));
    order.slice(2, count - 1).forEach((seat, i) => { map[seat] = early[i]; });
    return map;
  }

  // El botón pasa al siguiente asiento vivo
  function moveButton(state) {
    state.button = nextAlive(state, state.button);
  }

  /* Stack efectivo: el menor entre tu stack y el mayor de los que quedan por hablar.
     Si nadie queda por hablar, tu propio stack. */
  function effectiveStack(hero, behind) {
    if (!behind.length) return hero;
    return Math.min(hero, Math.max(...behind));
  }

  /* Convierte los stacks finales de la mano (en bb) a fichas, conservando el total exacto:
     el redondeo sobrante se ajusta en el stack más grande. */
  function settleChips(state, finalStacksBb, bb) {
    const before = state.players.reduce((s, p) => s + p.chips, 0);
    state.players.forEach((p) => {
      if (p.alive) p.chips = Math.max(0, Math.round(finalStacksBb[p.id] * bb));
    });
    const after = state.players.reduce((s, p) => s + p.chips, 0);
    if (after !== before) {
      const biggest = state.players.filter((p) => p.alive).sort((a, b) => b.chips - a.chips)[0];
      biggest.chips += before - after;
    }
  }

  /* Elimina a quien se ha quedado sin fichas y le asigna su puesto.
     Si caen dos en la misma mano, queda mejor quien empezó la mano con más fichas. */
  function eliminate(state, startChips) {
    const out = state.players.filter((p) => p.alive && p.chips <= 0);
    out.sort((a, b) => (startChips[a.id] || 0) - (startChips[b.id] || 0));
    let remaining = alive(state).length;
    for (const p of out) {
      p.alive = false;
      p.place = remaining;
      remaining--;
    }
    const left = alive(state);
    if (left.length === 1) {
      left[0].place = 1;
      state.finished = true;
    }
    return out;
  }

  const prize = (place) => PRIZES[place] || 0;

  return { START_CHIPS, LEVELS, levelAt, positions, create, alive, seating, moveButton, effectiveStack, settleChips, eliminate, prize };
});
