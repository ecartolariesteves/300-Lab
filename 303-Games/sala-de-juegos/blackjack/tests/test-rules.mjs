import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../rules.js');

assert.equal(R.SHOE_SIZE, 312);
const shoe = R.createShoe(() => 0.5);
assert.equal(shoe.cards.length, 312);
assert.equal(new Set(shoe.cards.map(c => c.rank + c.suit)).size, 52);
shoe.cards = shoe.cards.slice(0, 78);
assert.equal(R.shouldReshuffle(shoe), true);
assert.equal(R.prepareShoe(shoe, () => 0.3), true);
assert.equal(shoe.cards.length, 312);
assert.equal(shoe.shuffles, 2);

assert.deepEqual(R.total([{rank:'A'},{rank:'A'},{rank:'9'}]), {value:21,soft:true});
assert.deepEqual(R.total([{rank:'A'},{rank:'9'},{rank:'5'}]), {value:15,soft:false});
assert.equal(R.settle([{rank:'A'},{rank:'K'}],[{rank:'9'},{rank:'7'}],20).profit,30);
assert.equal(R.settle([{rank:'10'},{rank:'8'}],[{rank:'10'},{rank:'9'},{rank:'5'}],25,{doubled:true}).profit,50);
assert.equal(R.dealerShouldHit([{rank:'10'},{rank:'6'}]),true);
assert.equal(R.dealerShouldHit([{rank:'A'},{rank:'6'}]),false);
assert.equal(R.dealerShouldHit([{rank:'A'},{rank:'6'},{rank:'10'}]),false);
assert.equal(R.dealerShouldHit([{rank:'10'},{rank:'7'}]),false);

const aces=R.splitHand([{rank:'A',suit:'♠'},{rank:'A',suit:'♥'}],[{rank:'9'},{rank:'K'}]);
assert.equal(aces.length,2);
assert.ok(aces.every(h=>h.stood&&h.splitAces&&h.cards.length===2));
assert.equal(R.canHit(aces[0]),false);
assert.equal(R.canDouble(aces[0]),false);
console.log('✔ Blackjack: 312 cartas, corte al 75 %, totales, pago 3:2, S17 y Ases separados');
