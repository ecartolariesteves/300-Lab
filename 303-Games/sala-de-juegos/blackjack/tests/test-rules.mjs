import test from 'node:test';
import assert from 'node:assert/strict';
import R from '../rules.js';

const c = (rank, suit = '♠') => ({ rank, suit });

test('el sabot contiene exactamente 312 cartas de seis barajas', () => {
  const shoe = R.createShoe(() => 0.5);
  assert.equal(shoe.cards.length, 312);
  assert.equal(shoe.cards.filter((x) => x.rank === 'A').length, 24);
  assert.equal(shoe.cards.filter((x) => x.rank === '10').length, 24);
});

test('un blackjack natural paga 3:2 y no confunde un 21 de tres cartas', () => {
  assert.deepEqual(R.settle([c('A'), c('K')], [c('9'), c('7'), c('5')], 10), { outcome: 'blackjack', profit: 15 });
  assert.deepEqual(R.settle([c('7'), c('7'), c('7')], [c('9'), c('7'), c('5')], 10), { outcome: 'win', profit: 10 });
});

test('un empate devuelve apuesta sin beneficio ni pérdida', () => {
  assert.deepEqual(R.settle([c('10'), c('8')], [c('K'), c('8')], 25), { outcome: 'push', profit: 0 });
});

test('el crupier pide con 16 y se planta con 17 blando', () => {
  assert.equal(R.dealerShouldHit([c('10'), c('6')]), true);
  assert.equal(R.dealerShouldHit([c('A'), c('6')]), false);
  assert.deepEqual(R.total([c('A'), c('6')]), { value: 17, soft: true });
});

test('As + 6 + 10 se convierte en 17 duro, no en 27', () => {
  assert.deepEqual(R.total([c('A'), c('6'), c('10')]), { value: 17, soft: false });
});

test('los Ases separados reciben una carta y quedan plantados', () => {
  const hands = R.splitHand([c('A'), c('A', '♥')], [c('10'), c('K')], 1);
  assert.equal(hands.length, 2);
  assert.deepEqual(hands.map((h) => h.cards.length), [2, 2]);
  assert.ok(hands.every((h) => h.stood && h.splitAces));
  assert.ok(hands.every((h) => !R.canHit(h)));
  assert.ok(hands.every((h) => !R.canSplit(h, 1, 10)));
});

test('un 21 de dos cartas tras separar no es blackjack natural', () => {
  const splitAceHand = { cards: [c('A'), c('K')], stood: true, splitAces: true };
  assert.equal(R.isBlackjack(splitAceHand.cards), true);
  assert.equal(R.isBlackjack(splitAceHand.cards, false), false);
  assert.deepEqual(R.settle(splitAceHand.cards, [c('10'), c('7')], 10, { blackjackEligible: false }),
    { outcome: 'win', profit: 10 });
});

test('doblar solo es legal con dos cartas y no después de pedir', () => {
  const initial = { cards: [c('5'), c('6')], stood: false, wager: 10 };
  assert.equal(R.canDouble(initial), true);
  assert.equal(R.canDouble({ ...initial, cards: [...initial.cards, c('2')] }), false);
  assert.deepEqual(R.legalActions(initial, 0, 10), ['hit', 'stand', 'double']);
});

test('se permiten como máximo tres separaciones y cuatro manos', () => {
  const pair = [c('8'), c('8','♥')];
  assert.equal(R.canSplit({ cards: pair, wager: 10 }, 2, 10), true);
  assert.equal(R.canSplit({ cards: pair, wager: 10 }, 3, 10), false);
  assert.throws(() => R.splitHand(pair, [c('8'), c('8','♦')], 3), /separar/);
});

test('el seguro solo es legal con As visible y una sola oferta', () => {
  const hand = { cards: [c('10'), c('6')], stood: false, wager: 10 };
  assert.equal(R.canInsurance('A'), true);
  assert.equal(R.canInsurance('10'), false);
  assert.equal(R.canInsurance('A', true), false);
  assert.ok(R.legalActions(hand, 0, 10, { dealerUp: 'A' }).includes('insurance'));
});

test('el corte se activa al quedar 78 cartas, no antes', () => {
  const shoe = R.createShoe(() => 0.5);
  shoe.cards.length = 79;
  assert.equal(R.shouldReshuffle(shoe), false);
  shoe.cards.length = 78;
  assert.equal(R.shouldReshuffle(shoe), true);
});
