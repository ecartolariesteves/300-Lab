import test from 'node:test';
import assert from 'node:assert/strict';
import S from '../strategy.js';

const cases = [
  [['16','x'], '10', 'H'], // sustituido abajo por cartas explícitas
];
test('la tabla contiene decisiones concretas duras, blandas y parejas', () => {
  const checks = [
    [['10','6'],'10','H'], [['10','A'],'A','H'], [['A','6'],'3','D'],
    [['9','9'],'7','S'], [['8','8'],'A','P'], [['10','2'],'4','S'],
    [['10','2'],'2','H'], [['10','3'],'7','H'], [['10','4'],'6','S'],
    [['10','5'],'6','S'], [['10','7'],'10','H'], [['10','8'],'A','S'],
    [['10','9'],'7','S'], [['7','7'],'6','P'], [['6','6'],'5','P'],
    [['4','4'],'5','P'], [['3','3'],'8','H'], [['2','2'],'6','P'],
    [['A','7'],'3','Ds'], [['A','6'],'3','D'], [['A','5'],'4','D'],
    [['A','4'],'6','D'], [['A','3'],'5','D'], [['A','2'],'4','D']
  ];
  for (const [hand, up, expected] of checks) {
    assert.equal(S.bestAction(hand, up), expected, hand.join('+') + ' vs ' + up);
  }
});

test('D pasa a pedir y Ds pasa a plantarse cuando doblar no es legal', () => {
  assert.equal(S.bestAction(['A','6'], '3', { canDouble: false }), 'H');
  assert.equal(S.bestAction(['A','7'], '3', { canDouble: false }), 'S');
});

test('las figuras tienen valor estratégico de diez, pero Q-K no forman pareja', () => {
  assert.equal(S.bestAction(['Q','K'], '6'), 'S');
  assert.equal(S.bestAction(['J','J'], '6'), 'P');
});

test('una pareja no se puede separar cuando la opción está deshabilitada', () => {
  assert.equal(S.bestAction(['8','8'], 'A', { canSplit: false }), 'H');
});

test('la categoría distingue parejas, manos blandas y duras', () => {
  assert.equal(S.category(['8','8']), 'parejas');
  assert.equal(S.category(['A','7']), 'blandas');
  assert.equal(S.category(['10','6']), 'duras');
});
