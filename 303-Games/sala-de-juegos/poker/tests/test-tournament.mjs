import assert from 'node:assert/strict';import T from '../tournament.js';
assert.deepEqual(T.levelAt(31),{level:4,sb:50,bb:100,ante:12});assert.deepEqual(T.levelAt(111),{level:12,sb:800,bb:1600,ante:200});
for(const n of [6,5,4,3,2])assert.equal(T.positions(n).length,n);assert.equal(T.positions(2)[0],'SB');
assert.equal(T.effectiveStack(900,[1200,500]),500);
const s=T.create();assert.equal(s.players.reduce((a,p)=>a+p.stack,0),9000);for(let i=0;i<200;i++)T.advanceHand(s);assert.equal(s.players.reduce((a,p)=>a+p.stack,0),9000);
console.log('✔ torneo');
