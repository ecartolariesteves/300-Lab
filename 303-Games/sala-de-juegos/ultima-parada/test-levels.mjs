// Pruebas del generador de Última Parada. Ejecutar con: node test-levels.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const Levels = require('./levels.js');
const started = performance.now();
let maxMs = 0;
let totalMs = 0;

for (let n = 1; n <= 300; n++) {
  const before = performance.now();
  const level = Levels.generateLevel(n);
  const elapsed = performance.now() - before;
  assert.ok(level, `El nivel ${n} no se pudo generar`);
  assert.equal(Levels.solve(level).ok, true, `El nivel ${n} no tiene solución`);
  assert.ok(elapsed <= 300, `El nivel ${n} tardó ${elapsed.toFixed(1)} ms`);

  const expected = new Map();
  const actual = new Map();
  for (const bus of level.buses) {
    expected.set(bus.color, (expected.get(bus.color) || 0) + Levels.CAP);
  }
  for (const color of level.queue) {
    actual.set(color, (actual.get(color) || 0) + 1);
  }
  assert.deepEqual(actual, expected, `Pasajeros incorrectos en el nivel ${n}`);
  maxMs = Math.max(maxMs, elapsed);
  totalMs += elapsed;
}

const level37a = JSON.stringify(Levels.generateLevel(37));
const level37b = JSON.stringify(Levels.generateLevel(37));
assert.equal(level37a, level37b, 'El nivel 37 debe ser determinista');

console.log(`OK: 300 niveles · máximo ${maxMs.toFixed(1)} ms · media ${(totalMs / 300).toFixed(1)} ms · nivel 37 determinista · soluciones y pasajeros verificados (${(performance.now() - started).toFixed(0)} ms total)`);
