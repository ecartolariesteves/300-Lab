/* Estrategia básica: 6 barajas, S17, DAS, sin rendición, blackjack 3:2.
   Referencia: Wizard of Odds, Blackjack basic strategy, 4-8 decks, dealer stands on soft 17:
   https://wizardofodds.com/games/blackjack/strategy/4-decks/ (tabla 4-8 barajas).
   La tabla es la autoridad para puntuar; el EV infinito es una aproximación explicativa.
   H pedir · S plantarse · D doblar (si no se puede: pedir) · Ds doblar (si no: plantarse) · P separar. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackStrategy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEALER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const row = (s) => s.split(' ');
  const HARD = {
    8: row('H H H H H H H H H H'),
    9: row('H D D D D H H H H H'),
    10: row('D D D D D D D D H H'),
    11: row('D D D D D D D D D H'),
    12: row('H H S S S H H H H H'),
    13: row('S S S S S H H H H H'),
    14: row('S S S S S H H H H H'),
    15: row('S S S S S H H H H H'),
    16: row('S S S S S H H H H H'),
    17: row('S S S S S S S S S S')
  };
  const SOFT = {
    13: row('H H H D D H H H H H'),
    14: row('H H H D D H H H H H'),
    15: row('H H D D D H H H H H'),
    16: row('H H D D D H H H H H'),
    17: row('H D D D D H H H H H'),
    18: row('S Ds Ds Ds Ds S S H H H'),
    19: row('S S S S S S S S S S'),
    20: row('S S S S S S S S S S')
  };
  const PAIRS = {
    '2': row('P P P P P P H H H H'),
    '3': row('P P P P P P H H H H'),
    '4': row('H H H P P H H H H H'),
    '5': row('D D D D D D D D H H'),
    '6': row('P P P P P H H H H H'),
    '7': row('P P P P P P H H H H'),
    '8': row('P P P P P P P P P P'),
    '9': row('P P P P P S P P S S'),
    '10': row('S S S S S S S S S S'),
    'A': row('P P P P P P P P P P')
  };
  const value = (r) => r === 'A' ? 11 : ['J', 'Q', 'K', '10'].includes(r) ? 10 : Number(r);
  function handTotal(ranks) {
    let total = 0, aces = 0;
    for (const rank of ranks) { total += value(rank); if (rank === 'A') aces++; }
    while (total > 21 && aces) { total -= 10; aces--; }
    return { total, soft: aces > 0 };
  }
  const dealerKey = (rank) => ['J', 'Q', 'K', '10'].includes(rank) ? '10' : rank;
  function bestAction(ranks, dealerUp, options = {}) {
    const { canDouble = ranks.length === 2, canSplit = ranks.length === 2 } = options;
    const col = DEALER.indexOf(dealerKey(dealerUp));
    if (col < 0) throw new Error('Carta del crupier no válida: ' + dealerUp);
    // Solo se separan cartas del mismo rango: Q-K no es una pareja.
    if (ranks.length === 2 && canSplit && ranks[0] === ranks[1]) {
      const code = PAIRS[dealerKey(ranks[0])][col];
      if (code === 'P') return 'P';
      if (code === 'D') return canDouble ? 'D' : 'H';
      return code;
    }
    const { total, soft } = handTotal(ranks);
    let code;
    if (soft && total <= 12) code = 'H';
    else if (soft && total >= 13 && total <= 20) code = SOFT[total][col];
    else if (soft && total === 21) code = 'S';
    else code = total <= 8 ? 'H' : total >= 17 ? 'S' : HARD[total][col];
    if (code === 'D') return canDouble ? 'D' : 'H';
    if (code === 'Ds') return canDouble ? 'D' : 'S';
    return code;
  }
  function category(ranks) {
    if (ranks.length === 2 && ranks[0] === ranks[1]) return 'parejas';
    return handTotal(ranks).soft ? 'blandas' : 'duras';
  }
  return { DEALER, HARD, SOFT, PAIRS, handTotal, bestAction, value, dealerKey, category };
});
