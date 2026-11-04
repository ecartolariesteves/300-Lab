/* Motor puro de blackjack: sabot de seis barajas, reparto, turnos y pagos. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SHOE_SIZE = 312;
  const CUT_CARD = 78;

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
      for (const suit of SUITS) {
        for (const rank of RANKS) cards.push({ rank, suit });
      }
    }
    return { cards: shuffle(cards, random), dealt: 0, shuffles: 1 };
  }

  function remaining(shoe) {
    return shoe.cards.length;
  }

  function shouldReshuffle(shoe) {
    return remaining(shoe) <= CUT_CARD;
  }

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
    let value = 0;
    let aces = 0;
    for (const card of hand) {
      if (card.rank === 'A') {
        value += 11;
        aces++;
      } else if (['K', 'Q', 'J'].includes(card.rank)) {
        value += 10;
      } else {
        value += Number(card.rank);
      }
    }
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    return { value, soft: aces > 0 };
  }

  const isBlackjack = hand => hand.length === 2 && total(hand).value === 21;
  const isBust = hand => total(hand).value > 21;

  function dealerShouldHit(hand) {
    const score = total(hand);
    return score.value < 17;
  }

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
    const p = total(playerHand).value;
    const d = total(dealerHand).value;
    if (p > d) return { outcome: 'win', profit: bet };
    if (p < d) return { outcome: 'lose', profit: -bet };
    return { outcome: 'push', profit: 0 };
  }

  function splitHand(hand, nextCards, splitCount = 1) {
    if (hand.length !== 2 || hand[0].rank !== hand[1].rank || splitCount >= 4) {
      throw new Error('No se puede separar esta mano');
    }
    const aces = hand[0].rank === 'A';
    return [
      { cards: [hand[0], nextCards[0]], stood: aces, splitAces: aces, doubled: false, wager: 1 },
      { cards: [hand[1], nextCards[1]], stood: aces, splitAces: aces, doubled: false, wager: 1 }
    ];
  }

  function canHit(handState) {
    return !handState.stood && !isBust(handState.cards) && !handState.splitAces;
  }

  function canDouble(handState) {
    return !handState.stood && handState.cards.length === 2 && !isBust(handState.cards);
  }

  return {
    SUITS, RANKS, SHOE_SIZE, CUT_CARD, shuffle, createShoe, remaining,
    shouldReshuffle, draw, prepareShoe, total, isBlackjack, isBust,
    dealerShouldHit, playDealer, settle, splitHand, canHit, canDouble
  };
});
