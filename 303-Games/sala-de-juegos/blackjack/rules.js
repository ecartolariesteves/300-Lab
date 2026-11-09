/* Reglas puras de blackjack: 6 barajas, S17, peek, DAS y sin rendición. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SHOE_SIZE = 312;
  const CUT_CARD = 78;
  const rankValue = (rank) => rank === 'A' ? 11 : ['J', 'Q', 'K', '10'].includes(rank) ? 10 : Number(rank);

  function shuffle(cards, random = Math.random) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  function createShoe(random = Math.random) {
    const cards = [];
    for (let deck = 0; deck < 6; deck++) {
      for (const suit of SUITS) for (const rank of RANKS) cards.push({ rank, suit });
    }
    return { cards: shuffle(cards, random), dealt: 0, shuffles: 1 };
  }
  const remaining = (shoe) => shoe.cards.length;
  const shouldReshuffle = (shoe) => remaining(shoe) <= CUT_CARD;
  function draw(shoe) {
    if (!shoe.cards.length) return null;
    shoe.dealt++;
    return shoe.cards.pop();
  }
  function prepareShoe(shoe, random = Math.random) {
    if (!shouldReshuffle(shoe)) return false;
    const fresh = createShoe(random);
    shoe.cards = fresh.cards;
    shoe.dealt = 0;
    shoe.shuffles++;
    return true;
  }
  function total(hand) {
    let value = 0, aces = 0;
    for (const card of hand) {
      if (card.rank === 'A') { value += 11; aces++; }
      else value += rankValue(card.rank);
    }
    while (value > 21 && aces > 0) { value -= 10; aces--; }
    return { value, soft: aces > 0 };
  }
  const isBlackjack = (hand, blackjackEligible = true) => blackjackEligible && hand.length === 2 && total(hand).value === 21;
  const isBust = (hand) => total(hand).value > 21;
  const dealerShouldHit = (hand) => total(hand).value < 17;
  function playDealer(hand, shoe) {
    while (dealerShouldHit(hand)) {
      const card = draw(shoe);
      if (!card) break;
      hand.push(card);
    }
    return hand;
  }
  function settle(playerHand, dealerHand, wager, options = {}) {
    const { blackjackEligible = true, doubled = false } = options;
    const bet = wager * (doubled ? 2 : 1);
    if (isBust(playerHand)) return { outcome: 'lose', profit: -bet };
    const playerBJ = blackjackEligible && isBlackjack(playerHand);
    const dealerBJ = isBlackjack(dealerHand);
    if (playerBJ && !dealerBJ) return { outcome: 'blackjack', profit: wager * 1.5 };
    if (dealerBJ && !playerBJ) return { outcome: 'lose', profit: -bet };
    if (isBust(dealerHand)) return { outcome: 'win', profit: bet };
    const p = total(playerHand).value, d = total(dealerHand).value;
    if (p > d) return { outcome: 'win', profit: bet };
    if (p < d) return { outcome: 'lose', profit: -bet };
    return { outcome: 'push', profit: 0 };
  }
  function splitHand(hand, nextCards, splitCount = 1, wager = 1) {
    if (hand.length !== 2 || hand[0].rank !== hand[1].rank || splitCount >= 3) {
      throw new Error('No se puede separar esta mano');
    }
    if (!nextCards || nextCards.length !== 2) throw new Error('Faltan cartas para separar');
    const aces = hand[0].rank === 'A';
    return [
      { cards: [hand[0], nextCards[0]], stood: aces, splitAces: aces, doubled: false, wager },
      { cards: [hand[1], nextCards[1]], stood: aces, splitAces: aces, doubled: false, wager }
    ];
  }
  function canHit(handState) {
    return !handState.stood && !handState.splitAces && !isBust(handState.cards);
  }
  function canDouble(handState) {
    return !handState.stood && handState.cards.length === 2 && !isBust(handState.cards);
  }
  function canSplit(handState, splitCount, bankroll = Infinity) {
    return !handState.stood && !handState.splitAces && handState.cards.length === 2 &&
      handState.cards[0].rank === handState.cards[1].rank && splitCount < 3 && bankroll >= handState.wager;
  }
  function legalActions(handState, splitCount, bankroll = Infinity, options = {}) {
    const actions = [];
    if (canHit(handState)) actions.push('hit');
    if (!handState.stood && !isBust(handState.cards)) actions.push('stand');
    if (canDouble(handState) && bankroll >= handState.wager) actions.push('double');
    if (canSplit(handState, splitCount, bankroll)) actions.push('split');
    if (options.dealerUp === 'A' && !options.insuranceTaken) actions.push('insurance');
    return actions;
  }
  function canInsurance(dealerUp, insuranceTaken = false) { return dealerUp === 'A' && !insuranceTaken; }
  function dealerHasBlackjack(up, hole) {
    return (up.rank === 'A' && rankValue(hole.rank) === 10) ||
      (rankValue(up.rank) === 10 && hole.rank === 'A');
  }
  return { SUITS, RANKS, SHOE_SIZE, CUT_CARD, rankValue, shuffle, createShoe, remaining,
    shouldReshuffle, draw, prepareShoe, total, isBlackjack, isBust, dealerShouldHit,
    playDealer, settle, splitHand, canHit, canDouble, canSplit, canInsurance, legalActions, dealerHasBlackjack };
});
