import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const source = await import('node:fs/promises');
const rulesText = await source.readFile(new URL('../rules.js',import.meta.url),'utf8');
const R = createRequire(import.meta.url)('../rules.js');

// Mil flotas generadas con semillas distintas deben cumplir las reglas geométricas.
for(let seed=1;seed<=1000;seed++) assert.equal(R.isValidFleet(R.placeRandom(R.seeded(seed))),true,'flota '+seed);

// Agua, tocado, hundido y marcación del agua circundante.
const fleet=[{length:2,cells:[[0,0],[0,1]]},{length:5,cells:[[2,0],[2,1],[2,2],[2,3],[2,4]]},
{length:4,cells:[[4,0],[4,1],[4,2],[4,3]]},{length:3,cells:[[6,0],[6,1],[6,2]]},{length:3,cells:[[8,0],[8,1],[8,2]]}];
let shots=R.emptyShots();
let result=R.shoot(fleet,shots,9,9);assert.equal(result.result,'water');shots=result.shots;
result=R.shoot(fleet,shots,0,0);assert.equal(result.result,'hit');shots=result.shots;
result=R.shoot(fleet,shots,0,1);assert.equal(result.result,'sunk');assert.equal(result.sunk,2);
assert.equal(result.shots[0][0],3);assert.equal(result.shots[0][1],3);assert.equal(result.shots[1][0],1);

// La IA recibe solo la cuadrícula de disparos y la lista de longitudes restantes.
assert.match(rulesText,/function chooseShot\(shots,remainingShips=/);
assert.doesNotMatch(rulesText,/function chooseShot\([^)]*(opponent|enemyFleet|enemyShips|fleetBoard)/i);

// Simula 200 partidas por nivel contra una flota aleatoria. Imprime la media de disparos.
function gameShots(difficulty,seed) {
  const fleet=R.placeRandom(R.seeded(seed));
  let shots=R.emptyShots(),count=0,remaining=[5,4,3,3,2];
  while(count<100) {
    const choice=R.chooseShot(shots,remaining,difficulty,R.seeded(seed*1000+count+17));
    if(!choice) break;
    const outcome=R.shoot(fleet,shots,choice[0],choice[1]);
    shots=outcome.shots;count++;
    if(outcome.sunk) remaining.splice(remaining.indexOf(outcome.sunk),1);
    if(outcome.won) break;
  }
  return count;
}
const averages={};
for(const level of ['facil','medio','dificil']) {
  let sum=0;
  for(let i=1;i<=200;i++) sum+=gameShots(level,i*31);
  averages[level]=sum/200;
}
console.log('Media de disparos IA (200 partidas):',Object.fromEntries(Object.entries(averages).map(([k,v])=>[k,Number(v.toFixed(2))])));
assert.ok(averages.facil>=85,'Fácil debe ser aleatoria y gastar al menos 85 disparos');
assert.ok(averages.medio<=70,'Medio debe terminar en 70 disparos o menos');
assert.ok(averages.dificil<=60,'Difícil debe terminar en 60 disparos o menos');
console.log('✔ Hundir la flota: 1.000 flotas válidas, agua/tocado/hundido y privacidad de IA');
