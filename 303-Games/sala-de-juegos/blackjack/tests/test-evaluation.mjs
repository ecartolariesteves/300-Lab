import test from 'node:test';
import assert from 'node:assert/strict';
import E from '../evaluation.js';
import EV from '../ev.js';

test('la acción de la tabla puntúa 100 aunque EV prefiera otra acción', () => {
  assert.equal(E.score({ chosen:'hit', correct:'hit', evs:{ hit:-0.5, stand:-0.2 } }).score, 100);
});

test('tomar seguro siempre puntúa cero', () => {
  assert.equal(E.score({ chosen:'insurance', correct:'stand', evs:{ stand:-0.1 } }).score, 0);
});

test('plantarse con 11 contra 6 es un error caro y puntúa cero', () => {
  const result = E.score({ chosen:'stand', correct:'double', evs:{ stand:-0.55, hit:0.1, double:0.2 } });
  assert.equal(result.score, 0);
  assert.ok(result.loss >= 0.15);
});

test('16 contra 10 se marca como mano dudosa con el EV calculado', () => {
  const values = EV.evaluate(['10','6'], '10', ['hit','stand']);
  assert.equal(E.isDoubtful(values), true);
  assert.equal(E.isDoubtful({ hit:-0.2, stand:-0.24 }), false);
});

test('los umbrales de pérdida EV producen 80, 60 y 30 puntos', () => {
  assert.equal(E.score({ chosen:'hit', correct:'stand', evs:{ hit:-0.01, stand:0 } }).score, 80);
  assert.equal(E.score({ chosen:'hit', correct:'stand', evs:{ hit:-0.03, stand:0 } }).score, 60);
  assert.equal(E.score({ chosen:'hit', correct:'stand', evs:{ hit:-0.1, stand:0 } }).score, 30);
});

test('la nota de mano es la media de sus decisiones', () => {
  assert.equal(E.handScore([{score:100},{score:60},{score:80}]), 80);
});
