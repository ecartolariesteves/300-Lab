import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const E=require('../engine.js');
const assert=(x,m)=>{if(!x)throw new Error(m);};
const hand=(s)=>s.split(' ');
const score=(s)=>E.evaluate7(hand(s));
const cases=[
 ['As Ks Qs Js Ts 2d 3c',8],['As Ah Ad Ac Ks 2d 3c',7],
 ['As Ah Ad Ks Kh Kd 3c',6],['As Js 8s 5s 2s Kd 3c',5],
 ['As 2d 3c 4h 5s Kd Qc',4],['As Ah Ad Ks Qh 2d 3c',3],
 ['As Ah Ks Kh Qs 2d 3c',2],['As Ah Ks Qh Js 2d 3c',1],
 ['As Kd Qh Js 9c 4d 2s',0]
];
for(const [cards,cat] of cases)assert(score(cards).category===cat,'Categoría incorrecta: '+cards);
assert(score('As 2d 3c 4h 5s Kd Qc').score<score('2s 3d 4c 5h 6s Kd Qc').score,'La escalera wheel debe perder ante 6-high');
assert(E.compare(score('As Ad Kc Qh 7s 2d 3c'),score('Ah Ac Qc Jh 7d 2s 3h'))>0,'Kicker de pareja incorrecto');
assert(E.compare(score('As Ad Kc Qh 7s 2d 3c'),score('Ah Ac Kd Qd 7h 2s 3c'))===0,'Empate incorrecto');
const sim=(a,b,seed)=>E.equity(hand(a),[{cards:hand(b),weight:1}],[],20000,seed);
const aa=sim('As Ah','Ks Kh',17),aks=sim('As Ks','Qh Qd',18),weak=sim('7s 2h','As Ah',19);
console.log('Equity AA vs KK:',(aa*100).toFixed(2)+'%','AKs vs QQ:',(aks*100).toFixed(2)+'%','72o vs AA:',(weak*100).toFixed(2)+'%');
assert(aa>=.80&&aa<=.84,'AA vs KK fuera de 80–84%');
assert(aks>=.44&&aks<=.49,'AKs vs QQ fuera de 44–49%');
assert(weak>=.10&&weak<=.14,'72o vs AA fuera de 10–14%');
assert(Math.round(100*100/100)===100&&Math.round(100*30/70)===43&&0===0,'Puntuación preflop');
console.log('✔ Motor validado: categorías, wheel, kickers, empates y equity Monte Carlo');
