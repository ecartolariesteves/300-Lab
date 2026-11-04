/* Tamaños de referencia preflop (6-max, 100 bb, sin rake) y su evaluación.
   Son las convenciones habituales de las estrategias de solver para este formato;
   las tablas de ranges.json están pensadas para estos tamaños.
   - Apertura: 2,5 bb desde UTG, HJ, CO y BTN; 3 bb desde la SB.
   - 3-bet: 3× la apertura en posición; 4× sin posición (SB, y BB contra UTG-BTN).
     La BB contra la SB sí tiene posición: 3×.
   - 4-bet: 2,2× el 3-bet en posición; 2,5× sin posición. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PokerSizing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  // Postflop, la SB actúa primero, luego la BB y después el resto en orden
  const POSTFLOP = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];
  // ¿hero tiene posición sobre villano después del flop?
  const inPosition = (hero, villain) => POSTFLOP.indexOf(hero) > POSTFLOP.indexOf(villain);

  /* Devuelve el tamaño de referencia (en bb, "subir a") y la banda aceptable.
     spot: 'open' (apertura), '3bet' o '4bet'.
     raiseTo: a cuánto se ha subido antes (la apertura para un 3-bet, el 3-bet para un 4-bet). */
  function reference(spot, heroPos, villainPos, raiseTo) {
    if (spot === 'open') {
      const ref = heroPos === 'SB' ? 3 : 2.5;
      return { ref, low: ref - 0.5, high: ref + 0.5, unit: 'bb', note: heroPos === 'SB' ? 'Desde la SB se abre algo más grande (3 bb) porque jugarás sin posición contra la BB.' : 'La apertura estándar en 6-max a 100 bb es 2,5 bb.' };
    }
    const ip = inPosition(heroPos, villainPos);
    if (spot === '3bet') {
      const mult = ip ? 3 : 4;
      return { ref: raiseTo * mult, low: raiseTo * (mult - 0.5), high: raiseTo * (mult + 0.5), mult, unit: 'x', note: ip ? 'En posición, el 3-bet estándar es 3× la apertura.' : 'Sin posición se resube más grande (4×) para compensar la desventaja de jugar primero.' };
    }
    if (spot === '4bet') {
      const mult = ip ? 2.2 : 2.5;
      return { ref: raiseTo * mult, low: raiseTo * (mult - 0.2), high: raiseTo * (mult + 0.3), mult, unit: 'x', note: ip ? 'En posición, el 4-bet suele ser unas 2,2× el 3-bet.' : 'Sin posición, el 4-bet suele ser unas 2,5× el 3-bet.' };
    }
    throw new Error('Spot desconocido: ' + spot);
  }

  /* Puntúa el tamaño elegido: 1 si coincide con la referencia (±0,05 bb de redondeo),
     0,85 si está dentro de la banda aceptable y 0,6 si está fuera. */
  function sizingFactor(spot, heroPos, villainPos, raiseTo, sizeTo) {
    const r = reference(spot, heroPos, villainPos, raiseTo);
    let factor, verdict;
    if (Math.abs(sizeTo - r.ref) <= 0.05) { factor = 1; verdict = 'Tamaño correcto'; }
    else if (sizeTo >= r.low - 1e-9 && sizeTo <= r.high + 1e-9) { factor = 0.85; verdict = 'Tamaño aceptable'; }
    else { factor = 0.6; verdict = sizeTo > r.ref ? 'Tamaño demasiado grande' : 'Tamaño demasiado pequeño'; }
    return { factor, verdict, ...r };
  }

  /* Nota final de una subida = nota de la acción (frecuencia GTO) × factor del tamaño.
     Las demás acciones (fold, call, check) no tienen tamaño y conservan su nota. */
  const combinedScore = (actionScore, factor) => Math.round(actionScore * factor);

  // Botones de tamaño que debe ofrecer la interfaz en cada spot (en bb, "subir a")
  function presets(spot, heroPos, villainPos, raiseTo, stackPlusBet = 100) {
    const cap = (v) => Math.min(Math.round(v * 10) / 10, stackPlusBet);
    if (spot === 'open') return (heroPos === 'SB' ? [2.5, 3, 3.5] : [2, 2.5, 3]).map(cap);
    if (spot === '3bet') return [2.5, 3, 3.5, 4, 4.5].map((m) => cap(raiseTo * m));
    if (spot === '4bet') return [2.2, 2.5].map((m) => cap(raiseTo * m)).concat([stackPlusBet]);
    return [];
  }
  return { ORDER, inPosition, reference, sizingFactor, combinedScore, presets };
});
