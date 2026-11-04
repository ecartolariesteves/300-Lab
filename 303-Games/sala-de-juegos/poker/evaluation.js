/* Evaluación de decisiones preflop y ayudas postflop, sin DOM.
   Depende de PokerSizing (sizing.js) para la parte del tamaño. */
(function (root, factory) {
  const sizing = typeof module !== 'undefined' && module.exports ? require('./sizing.js') : root.PokerSizing;
  const api = factory(sizing);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PokerEvaluation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PokerSizing) {
  const RANKS = 'AKQJT98765432';
  const SPOT_ACTIONS = { 'Apertura': ['raise'], 'Contra apertura': ['call', '3bet'], 'Contra 3-bet': ['call', '4bet'] };
  const SIZING_SPOT = { 'Apertura': 'open', 'Contra apertura': '3bet', 'Contra 3-bet': '4bet' };

  // Frecuencias de la tabla para una mano, con el fold como resto hasta 1
  function frequencies(chart, hand, spot) {
    const entry = (chart && chart[hand]) || {};
    const allowed = SPOT_ACTIONS[spot] || [];
    const out = { fold: Math.max(0, 1 - allowed.reduce((s, a) => s + (entry[a] || 0), 0)) };
    for (const a of allowed) out[a] = entry[a] || 0;
    return out;
  }

  /* Traduce la acción del botón al nombre que usa la tabla:
     una subida es 'raise' en la apertura, '3bet' contra una apertura y '4bet' contra un 3-bet.
     En la v1 este paso faltaba y todos los 3-bets puntuaban 0. */
  function chartAction(action, spot) {
    if (action === 'raise' || action === 'bet' || action === 'allin') return spot === 'Contra apertura' ? '3bet' : spot === 'Contra 3-bet' ? '4bet' : 'raise';
    return action;
  }

  // Nota de la acción: 100 × frecuencia de tu acción / frecuencia de la acción más usada
  function actionScore(action, freq) {
    const max = Math.max(0, ...Object.values(freq));
    const value = freq[action] || 0;
    const score = max > 0 ? Math.round((100 * value) / max) : 0;
    return { score, frequency: value, verdict: verdictOf(score) };
  }
  const verdictOf = (score) => (score >= 90 ? 'Correcta' : score >= 50 ? 'Aceptable (estrategia mixta)' : score > 0 ? 'Imprecisa' : 'Error');

  /* Evalúa una decisión preflop dentro de las tablas.
     ctx: { chart, hand, spot, action, heroPos, villainPos, raiseTo (apuesta a la que te enfrentas), sizeTo (tu subida) } */
  function evaluatePreflop(ctx) {
    const { chart, hand, spot, heroPos, villainPos, raiseTo, sizeTo } = ctx;
    const freq = frequencies(chart, hand, spot);
    // Limp: pagar 1 bb sin que nadie haya subido. La referencia juega raise o fold.
    if (ctx.action === 'limp') {
      return { evaluated: true, freq, action: 'limp', actionScore: 0, score: 0, verdict: 'Error', sizing: null,
        note: `La referencia no limpea desde ${heroPos}: juega raise o fold.` };
    }
    const action = chartAction(ctx.action, spot);
    const a = actionScore(action, freq);
    let sizing = null, score = a.score;
    const isRaise = action === 'raise' || action === '3bet' || action === '4bet';
    if (isRaise && Number.isFinite(sizeTo)) {
      sizing = PokerSizing.sizingFactor(SIZING_SPOT[spot], heroPos, villainPos, raiseTo, sizeTo);
      score = PokerSizing.combinedScore(a.score, sizing.factor);
    }
    return { evaluated: true, freq, action, actionScore: a.score, score, verdict: verdictOf(score), actionVerdict: a.verdict, sizing };
  }

  /* ¿Es una mano "dudosa"? Son las que más enseñan:
     - alguna acción (incluido el fold) entre el 15 % y el 85 %, o
     - está en el borde del rango: juega y alguna vecina de la tabla 13×13 no (o al revés). */
  function handAt(i, j) { return i === j ? RANKS[i] + RANKS[j] : i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o'; }
  function isDoubtful(chart, hand, spot) {
    const f = frequencies(chart, hand, spot);
    if (Object.values(f).some((v) => v >= 0.15 && v <= 0.85)) return true;
    const plays = (h) => frequencies(chart, h, spot).fold < 0.5;
    let pos = null;
    for (let i = 0; i < 13 && !pos; i++) for (let j = 0; j < 13; j++) if (handAt(i, j) === hand) { pos = [i, j]; break; }
    const [i, j] = pos;
    // Solo se comparan vecinas del mismo tipo: parejas con parejas (22 con 33),
    // suited con suited y offsuit con offsuit (54o con 64o y 53o, nunca con 55)
    const kind = (a, b) => (a === b ? 0 : a < b ? 1 : 2);
    const steps = i === j ? [[-1, -1], [1, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [di, dj] of steps) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni > 12 || nj > 12 || kind(ni, nj) !== kind(i, j)) continue;
      if (plays(handAt(ni, nj)) !== plays(hand)) return true;
    }
    return false;
  }

  // Fold que necesita un farol de "bet" bb en un bote de "pot" bb para ser rentable
  const bluffBreakeven = (bet, pot) => bet / (pot + bet);
  // SPR: stack efectivo / bote. Cuanto más bajo, más fácil es comprometerse con la mano.
  const spr = (effectiveStack, pot) => (pot > 0 ? effectiveStack / pot : Infinity);
  // Equity mínima para pagar: lo que pagas / (bote después de pagar)
  const potOdds = (due, pot) => due / (pot + due);

  return { RANKS, SPOT_ACTIONS, frequencies, chartAction, actionScore, verdictOf, evaluatePreflop, isDoubtful, handAt, bluffBreakeven, spr, potOdds };
});
