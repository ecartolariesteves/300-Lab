/* Estrategia básica de blackjack: 4-8 barajas, el crupier se planta con 17 blando (S17),
   doblar tras separar permitido (DAS), sin rendición, blackjack paga 3:2.
   Fuente de referencia: Wizard of Odds (4-8 decks, dealer stands on soft 17).
   Códigos: H pedir · S plantarse · D doblar (si no se puede, pedir) ·
            Ds doblar (si no se puede, plantarse) · P separar. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackStrategy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Columnas: carta visible del crupier 2, 3, 4, 5, 6, 7, 8, 9, 10, A
  const DEALER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const row = (s) => s.split(' ');
  const HARD = {          // total duro del jugador
    8:  row('H H H H H H H H H H'),
    9:  row('H D D D D H H H H H'),
    10: row('D D D D D D D D H H'),
    11: row('D D D D D D D D D H'),
    12: row('H H S S S H H H H H'),
    13: row('S S S S S H H H H H'),
    14: row('S S S S S H H H H H'),
    15: row('S S S S S H H H H H'),
    16: row('S S S S S H H H H H'),
    17: row('S S S S S S S S S S'),
  };
  const SOFT = {          // As + otra carta (total blando)
    13: row('H H H D D H H H H H'),   // A2
    14: row('H H H D D H H H H H'),   // A3
    15: row('H H D D D H H H H H'),   // A4
    16: row('H H D D D H H H H H'),   // A5
    17: row('H D D D D H H H H H'),   // A6
    18: row('S Ds Ds Ds Ds S S H H H'), // A7
    19: row('S S S S S S S S S S'),   // A8
    20: row('S S S S S S S S S S'),   // A9
  };
  const PAIRS = {         // pareja: carta repetida
    '2':  row('P P P P P P H H H H'),
    '3':  row('P P P P P P H H H H'),
    '4':  row('H H H P P H H H H H'),
    '5':  row('D D D D D D D D H H'),
    '6':  row('P P P P P H H H H H'),
    '7':  row('P P P P P P H H H H'),
    '8':  row('P P P P P P P P P P'),
    '9':  row('P P P P P S P P S S'),
    '10': row('S S S S S S S S S S'),
    'A':  row('P P P P P P P P P P'),
  };
  const value = (r) => (r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : Number(r));
  // Total de una mano y si es blanda (un As cuenta como 11)
  function handTotal(ranks) {
    let total = 0, aces = 0;
    for (const r of ranks) { total += value(r); if (r === 'A') aces++; }
    while (total > 21 && aces) { total -= 10; aces--; }
    return { total, soft: aces > 0 };
  }
  const dealerKey = (r) => (['J', 'Q', 'K', '10'].includes(r) ? '10' : r);
  /* Devuelve la acción correcta: 'H', 'S', 'D' o 'P'.
     canDouble: solo con las dos primeras cartas. canSplit: pareja y sin límite alcanzado. */
  function bestAction(ranks, dealerUp, { canDouble = ranks.length === 2, canSplit = ranks.length === 2 } = {}) {
    const col = DEALER.indexOf(dealerKey(dealerUp));
    if (col < 0) throw new Error('Carta del crupier no válida: ' + dealerUp);
    if (ranks.length === 2 && canSplit && dealerKey(ranks[0]) === dealerKey(ranks[1])) {
      const code = PAIRS[dealerKey(ranks[0])][col];
      if (code === 'P') return 'P';
      if (code === 'D') return canDouble ? 'D' : 'H';
      return code;
    }
    const { total, soft } = handTotal(ranks);
    let code;
    if (soft && total >= 13 && total <= 20) code = SOFT[total][col];
    else if (soft && total === 21) code = 'S';
    else code = total <= 8 ? 'H' : total >= 17 ? 'S' : HARD[total][col];
    if (code === 'D') return canDouble ? 'D' : 'H';
    if (code === 'Ds') return canDouble ? 'D' : 'S';
    return code;
  }
  return { DEALER, HARD, SOFT, PAIRS, handTotal, bestAction, value };
});
