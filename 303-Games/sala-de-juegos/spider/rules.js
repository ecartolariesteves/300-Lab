/* Reglas puras de Spider: no conoce el DOM ni el almacenamiento. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SpiderRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const makeDeck = (difficulty, random = Math.random) => {
    const suits = difficulty === 1 ? [SUITS[0]] : difficulty === 2 ? SUITS.slice(0, 2) : SUITS;
    const deck = [];
    for (let copy = 0; copy < 8 / suits.length; copy++) for (const suit of suits)
      for (let rank = 1; rank <= 13; rank++) deck.push({ id: copy + '-' + suit + '-' + rank, suit, rank, faceUp: false });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };
  function newGame(difficulty = 1, random = Math.random) {
    const deck = makeDeck(difficulty, random);
    const columns = Array.from({ length: 10 }, (_, i) => {
      const col = deck.splice(0, i < 4 ? 6 : 5);
      col[col.length - 1].faceUp = true;
      return col;
    });
    return { difficulty, columns, stock: deck, completed: 0, moves: 0 };
  }
  function validRun(cards) {
    return cards.length > 0 && cards.every((c, i) => i === 0 ||
      (cards[i - 1].rank === c.rank + 1 && cards[i - 1].suit === c.suit));
  }
  function canMove(state, from, index, to) {
    if (from === to || !Number.isInteger(index) || index < 0) return false;
    const source = state.columns[from], target = state.columns[to];
    if (!source || !target || index >= source.length) return false;
    const run = source.slice(index);
    if (!run.every(c => c.faceUp) || !validRun(run)) return false;
    return !target.length || target[target.length - 1].rank === run[0].rank + 1;
  }
  function completeRuns(state) {
    let removed = 0;
    for (const col of state.columns) {
      while (col.length >= 13) {
        const run = col.slice(-13);
        if (run[0].rank !== 13 || run[12].rank !== 1 || !validRun(run)) break;
        col.splice(-13);
        if (col.length) col[col.length - 1].faceUp = true;
        state.completed++;
        removed++;
      }
    }
    return removed;
  }
  function move(state, from, index, to) {
    if (!canMove(state, from, index, to)) return false;
    const cards = state.columns[from].splice(index);
    state.columns[to].push(...cards);
    if (state.columns[from].length) state.columns[from][state.columns[from].length - 1].faceUp = true;
    state.moves++;
    completeRuns(state);
    return true;
  }
  function deal(state) {
    if (!state.stock.length || state.columns.some(c => !c.length)) return false;
    for (const col of state.columns) {
      const card = state.stock.pop();
      card.faceUp = true;
      col.push(card);
    }
    state.moves++;
    completeRuns(state);
    return true;
  }
  const isWon = state => state.completed === 8;
  return { SUITS, makeDeck, newGame, validRun, canMove, move, deal, completeRuns, isWon };
});
