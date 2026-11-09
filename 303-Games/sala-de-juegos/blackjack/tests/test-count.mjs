import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../count.js';
import R from '../rules.js';

test('un sabot completo suma cero en Hi-Lo', () => {
  const cards = [];
  for (let d=0; d<6; d++) for (const suit of R.SUITS) for (const rank of R.RANKS) cards.push({rank,suit});
  assert.equal(C.runningCount(cards), 0);
});

test('el conteo real divide por tres barajas restantes', () => {
  const result = C.trueCount(6, 156);
  assert.deepEqual(result, { decks:3, count:2 });
});

test('cartas bajas suman uno, 7-9 cero y figuras/As restan uno', () => {
  assert.deepEqual(['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map(C.tag),
    [1,1,1,1,1,0,0,0,-1,-1,-1,-1,-1]);
});

test('el redondeo de barajas restantes se hace a medias barajas', () => {
  assert.equal(C.remainingDecks(130), 2.5);
  assert.equal(C.remainingDecks(105), 2);
});
