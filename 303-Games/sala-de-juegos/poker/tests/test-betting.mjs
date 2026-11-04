import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../betting.js');
const hero = {bet:0,stack:100};
assert.deepEqual(B.legalActions({player:hero,currentBet:0,street:'preflop'}),['fold','check','raise','allin']);
assert.ok(B.legalActions({player:hero,currentBet:2.5,lastRaiseSize:1.5,street:'preflop'}).includes('raise'));
const short = B.legalActions({player:{bet:0,stack:3.5},currentBet:2.5,lastRaiseSize:1.5,street:'preflop'});
assert.ok(!short.includes('raise'));
assert.ok(short.includes('allin'));
assert.equal(B.validateAction({action:'allin',player:{bet:0,stack:3.5},currentBet:2.5,lastRaiseSize:1.5,street:'preflop'}).ok,true);
assert.equal(B.validateAction({action:'raise',target:7.5,player:hero,currentBet:2.5,lastRaiseSize:1.5,street:'preflop'}).ok,true);
assert.equal(B.validateAction({action:'raise',target:3,player:hero,currentBet:2.5,lastRaiseSize:1.5,street:'preflop'}).ok,false);
assert.equal(B.validateAction({action:'raise',target:120,player:hero,currentBet:2.5,lastRaiseSize:1.5,street:'preflop'}).ok,false);
assert.equal(B.validateAction({action:'check',player:hero,currentBet:2.5,street:'preflop'}).ok,false);
assert.equal(B.classify('raise'),'raise');
assert.equal(B.classify('3bet'),'3bet');
assert.equal(B.classify('4bet'),'4bet');
const locked = B.legalActions({player:hero,currentBet:5,lastRaiseSize:2.5,street:'preflop',canRaise:false});
assert.ok(locked.includes('call'));
assert.ok(!locked.includes('raise')&&!locked.includes('allin'));
assert.equal(B.validateAction({action:'raise',target:8,player:hero,currentBet:5,lastRaiseSize:2.5,street:'preflop',canRaise:false}).ok,false);
const charts=JSON.parse(fs.readFileSync(new URL('../ranges.json',import.meta.url),'utf8')).charts;
for(const [name,chart] of Object.entries(charts)){
  const allowed=name.startsWith('RFI_')?['raise']:name.startsWith('VS_OPEN_')?['call','3bet']:['call','4bet'];
  for(const [hand,actions] of Object.entries(chart))for(const action of Object.keys(actions))assert.ok(allowed.includes(action),name+' '+hand+' has invalid action '+action);
}
console.log('✔ Betting: acciones legales, subida mínima, short all-in y tope del stack');
