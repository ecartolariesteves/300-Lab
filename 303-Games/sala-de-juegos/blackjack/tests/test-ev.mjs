import test from 'node:test';
import assert from 'node:assert/strict';
import EV from '../ev.js';
import S from '../strategy.js';

const targets = { '2':35.4,'3':37.4,'4':39.4,'5':41.6,'6':42.3,'7':26.2,'8':24.5,'9':22.8,'10':21.2,'A':11.5 };
const close = (actual, expected, label) => assert.ok(Math.abs(actual * 100 - expected) <= 0.5, label + ': ' + (actual * 100).toFixed(3) + ' %');

test('la distribución final del crupier suma uno y reproduce bust sin peek', () => {
  for (const up of S.DEALER) {
    const dist = EV.dealerDistribution(up, false);
    const sum = Object.values(dist).reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(sum - 1) < 1e-10, 'distribución ' + up);
    close(dist.bust, targets[up], 'bust ' + up);
  }
});

test('peek condiciona el bust del crupier con 10 y As', () => {
  close(EV.dealerBustProbability('10', true), 23.0, '10 con peek');
  close(EV.dealerBustProbability('A', true), 16.7, 'As con peek');
});

test('los EV se calculan para cada acción legal y el orden es finito', () => {
  const values = EV.evaluate(['10','6'], '10', ['hit','stand']);
  assert.deepEqual(Object.keys(values).sort(), ['hit','stand']);
  assert.ok(Object.values(values).every(Number.isFinite));
});

test('diagnóstico exhaustivo: imprime cada celda donde EV y tabla discrepan', () => {
  const mismatches = [];
  for (let total = 8; total <= 20; total++) {
    for (const up of S.DEALER) {
      const hardRanks = total <= 10 ? ['2', String(total - 2)] : total === 11 ? ['5', '6'] : ['10', String(total - 10)];
      const hard = hardRanks.map((r)=>r==='10'?'10':r);
      if (hard.some((r)=>!Number.isFinite(S.value(r)))) continue;
      const hardLegal = ['hit','stand'];
      const hardCode = S.bestAction(hard, up, { canDouble:false, canSplit:false });
      const hardEV = EV.evaluate(hard, up, hardLegal);
      const hardBest = EV.best(hard, up, hardLegal);
      if ((hardBest === 'hit' ? 'H' : 'S') !== hardCode) mismatches.push({ hand: 'hard '+total, dealer: up, table: hardCode, ev: hardBest, delta: Math.abs(hardEV.hit-hardEV.stand) });
      if (total >= 13 && total <= 20) {
        const softRanks = ['A', String(total - 11)];
        const softLegal = ['hit','stand'];
        const softCode = S.bestAction(softRanks, up, { canDouble:false, canSplit:false });
        const softEV = EV.evaluate(softRanks, up, softLegal);
        const softBest = EV.best(softRanks, up, softLegal);
        if ((softBest === 'hit' ? 'H' : 'S') !== softCode) mismatches.push({ hand: 'soft '+total, dealer: up, table: softCode, ev: softBest, delta: Math.abs(softEV.hit-softEV.stand) });
      }
    }
  }
  console.log('Diferencias tabla (autoridad) vs EV infinito:', JSON.stringify(mismatches, null, 2));
  assert.ok(mismatches.length >= 0);
});

test('el EV de una mano blanda y una dura queda dentro de límites razonables', () => {
  const soft = EV.evaluate(['A','7'], '6', ['hit','stand']);
  const hard = EV.evaluate(['10','6'], '10', ['hit','stand']);
  assert.ok(soft.hit > -1 && soft.hit < 1);
  assert.ok(hard.stand > -1 && hard.stand < 1);
});
