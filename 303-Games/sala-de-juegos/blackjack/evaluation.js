/* Puntuación de decisiones. La estrategia básica manda; EV solo cuantifica el coste del error. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackEvaluation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LABEL = { hit: 'Pedir', stand: 'Plantarse', double: 'Doblar', split: 'Separar', insurance: 'Seguro' };
  function score({ chosen, correct, evs = {}, doubtful = false }) {
    if (chosen === 'insurance') return { score: 0, loss: null, doubtful: false, correct };
    if (chosen === correct) return { score: 100, loss: 0, doubtful, correct };
    const values = Object.values(evs).filter(Number.isFinite);
    const best = values.length ? Math.max(...values) : 0;
    const actual = Number.isFinite(evs[chosen]) ? evs[chosen] : best - 1;
    const loss = Math.max(0, best - actual);
    let result = loss < 0.02 ? 80 : loss < 0.05 ? 60 : loss < 0.15 ? 30 : 0;
    return { score: result, loss, doubtful, correct };
  }
  function isDoubtful(evs) {
    const sorted = Object.values(evs).filter(Number.isFinite).sort((a, b) => b - a);
    return sorted.length > 1 && sorted[0] - sorted[1] < 0.02;
  }
  function label(action) { return LABEL[action] || action; }
  function handScore(decisions) {
    return decisions.length ? decisions.reduce((sum, d) => sum + d.score, 0) / decisions.length : 0;
  }
  return { score, isDoubtful, label, handScore };
});
