import assert from 'node:assert/strict';import fs from 'node:fs';import P from '../pushfold.js';
const d=JSON.parse(fs.readFileSync(new URL('../pushfold.json',import.meta.url)));
assert.equal(P.lookup(d,{stackBb:10,pos:'BTN',playersBehind:0,hand:'A2o'}).correct,'allin');
assert.equal(P.lookup(d,{stackBb:15,pos:'UTG',playersBehind:5,hand:'72o'}).correct,'fold');
const k=d.call.BB_vs_SB_10.includes('K2o')?'call':'fold';assert.equal(P.lookup(d,{stackBb:10,pos:'BB',facingPushFrom:'SB',hand:'K2o'}).correct,k);
assert.ok(P.lookup(d,{stackBb:3.4,pos:'BTN',hand:'AA'}).unevaluated);
assert.equal(P.lookup(d,{stackBb:15.4,pos:'BTN',hand:'AA'}).table,'BTN_15');
assert.ok(P.lookup(d,{stackBb:15.6,pos:'BTN',hand:'AA'}).unevaluated);
console.log('✔ lookup');
