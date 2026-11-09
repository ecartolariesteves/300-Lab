/* EV aproximado con baraja infinita. No sustituye la tabla de estrategia para puntuar. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackEV = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const PROB = { A: 1/13, 2: 1/13, 3: 1/13, 4: 1/13, 5: 1/13, 6: 1/13, 7: 1/13, 8: 1/13, 9: 1/13, 10: 4/13 };
  const value = (r) => r === 'A' ? 11 : r === '10' ? 10 : Number(r);
  const key = (r) => ['J', 'Q', 'K'].includes(r) ? '10' : r;
  function total(ranks) {
    let n = 0, aces = 0;
    for (const r of ranks) { n += value(r); if (r === 'A') aces++; }
    while (n > 21 && aces) { n -= 10; aces--; }
    return { value: n, soft: aces > 0 };
  }
  const cache = new Map();
  function dealerDistribution(up, peek = true) {
    up = key(up);
    const cacheKey = up + ':' + (peek ? 'peek' : 'nopeek');
    if (cache.has(cacheKey)) return { ...cache.get(cacheKey) };
    const out = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 };
    let allowed = RANKS.slice();
    if (peek && (up === 'A' || up === '10')) {
      // Condicionamos la carta tapada a que no complete blackjack.
      allowed = allowed.filter((r) => !(up === 'A' && value(r) === 10) && !(up === '10' && r === 'A'));
    }
    let norm = 0;
    for (const hole of allowed) norm += PROB[hole];
    const visit = (ranks, probability) => {
      const t = total(ranks);
      if (t.value >= 17) {
        out[t.value > 21 ? 'bust' : t.value] += probability;
        return;
      }
      for (const r of RANKS) visit(ranks.concat(r), probability * PROB[r]);
    };
    for (const hole of allowed) visit([up, hole], PROB[hole] / norm);
    cache.set(cacheKey, out);
    return { ...out };
  }
  function handKey(ranks) { return ranks.slice().sort().join(','); }
  function standEV(ranks, up, peek = true) {
    const p = total(ranks).value;
    if (p > 21) return -1;
    const dist = dealerDistribution(up, peek);
    let ev = dist.bust;
    for (let d = 17; d <= 21; d++) {
      if (p > d) ev += dist[d];
      else if (p < d) ev -= dist[d];
    }
    return ev;
  }
  function hitEV(ranks, up, peek = true) {
    let ev = 0;
    for (const r of RANKS) {
      const next = ranks.concat(r);
      const p = total(next);
      ev += PROB[r] * (p.value > 21 ? -1 : Math.max(standEV(next, up, peek), hitEV(next, up, peek)));
    }
    return ev;
  }
  function actionEV(ranks, up, action, options = {}) {
    const peek = options.peek !== false;
    if (action === 'stand') return standEV(ranks, up, peek);
    if (action === 'hit') return hitEV(ranks, up, peek);
    if (action === 'double') {
      let ev = 0;
      for (const r of RANKS) {
        const next = ranks.concat(r);
        ev += PROB[r] * (total(next).value > 21 ? -2 : 2 * standEV(next, up, peek));
      }
      return ev;
    }
    if (action === 'split') {
      // Aproximación documentada: dos manos independientes, sin re-separar y con una carta inicial.
      const rank = ranks[0];
      let one = 0;
      for (const r of RANKS) {
        const next = [rank, r];
        const t = total(next);
        one += PROB[r] * (t.value > 21 ? -1 : Math.max(standEV(next, up, peek), hitEV(next, up, peek)));
      }
      return 2 * one;
    }
    return -Infinity;
  }
  function evaluate(ranks, up, legalActions, options = {}) {
    const values = {};
    for (const action of legalActions) values[action] = actionEV(ranks, up, action, options);
    return values;
  }
  function best(ranks, up, legalActions, options = {}) {
    const values = evaluate(ranks, up, legalActions, options);
    return Object.keys(values).sort((a, b) => values[b] - values[a])[0] || null;
  }
  function bustProbability(ranks) {
    let p = 0;
    for (const r of RANKS) if (total(ranks.concat(r)).value > 21) p += PROB[r];
    return p;
  }
  function dealerBustProbability(up, peek = true) { return dealerDistribution(up, peek).bust; }
  function clearCache() { cache.clear(); }
  return { RANKS, PROB, total, dealerDistribution, standEV, hitEV, actionEV, evaluate, best,
    bustProbability, dealerBustProbability, clearCache };
});
