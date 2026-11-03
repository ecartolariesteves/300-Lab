import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const R=require('../rules.js');
for(const [level,count] of Object.entries({facil:8,medio:10,dificil:18})){
 const deck=R.makeDeck(level,12345);assert.equal(deck.length,count*2);
 const totals=new Map();for(const card of deck)totals.set(card.key,(totals.get(card.key)||0)+1);
 assert.equal(totals.size,count);for(const n of totals.values())assert.equal(n,2);
}
assert.deepEqual(R.makeDeck('dificil',99),R.makeDeck('dificil',99));
assert.notDeepEqual(R.makeDeck('dificil',99),R.makeDeck('dificil',100));
assert.equal(R.isMatch({key:'luna'},{key:'luna'}),true);
assert.equal(R.isMatch({key:'luna'},{key:'sol'}),false);
console.log('✔ Parejas: 8/10/18 parejas exactas, dos cartas por dibujo y barajado con semilla determinista');
