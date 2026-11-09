/* Conteo Hi-Lo informativo. No modifica la estrategia en esta versión. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackCount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function tag(rank) {
    if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
    if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) return -1;
    return 0;
  }
  function runningCount(cards) { return cards.reduce((sum, card) => sum + tag(typeof card === 'string' ? card : card.rank), 0); }
  function trueCount(running, cardsRemaining) {
    const decks = Math.max(0.5, Math.round((cardsRemaining / 52) * 2) / 2);
    return { decks, count: Math.round((running / decks) * 10) / 10 };
  }
  function remainingDecks(cardsRemaining) {
    return Math.max(0.5, Math.round((cardsRemaining / 52) * 2) / 2);
  }
  return { tag, runningCount, trueCount, remainingDecks };
});
