/* Explicaciones breves y comprobables para el entrenador. Sin DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BlackjackCoach = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EVAL = typeof module !== 'undefined' && module.exports ? require('./ev.js') : root.BlackjackEV;
  const LABEL = { hit: 'Pedir', stand: 'Plantarse', double: 'Doblar', split: 'Separar', insurance: 'Seguro' };
  function why({ ranks, dealerUp, legal, chosen, correct, evs, peek = true }) {
    const total = EVAL ? EVAL.total(ranks) : { value: 0, soft: false };
    const lines = [];
    lines.push('Tu total es ' + (total.soft ? 'blando ' : 'duro ') + total.value +
      (total.soft ? ': el As puede bajar de 11 a 1 si hace falta.' : ': el total ya no puede reducirse.'));
    const bust = EVAL ? EVAL.dealerBustProbability(dealerUp, peek) : 0;
    lines.push('Con un ' + dealerUp + ' visible, el crupier se pasa aproximadamente un ' +
      Math.round(bust * 1000) / 10 + ' % de las veces' + (peek && ['A', '10', 'J', 'Q', 'K'].includes(dealerUp) ? ', condicionado a que no tenga blackjack.' : '.') +
      ' ' + (bust >= 0.35 ? 'Deja que se arriesgue él.' : 'Su carta no le pone tanta presión.'));
    const playerBust = EVAL ? EVAL.bustProbability(ranks) : 0;
    lines.push('Si pides una carta, te pasas aproximadamente un ' + Math.round(playerBust * 1000) / 10 + ' % de las veces.');
    const sorted = Object.entries(evs || {}).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      lines.push('EV por acción: ' + sorted.map(([a, v]) => LABEL[a] + ' ' +
        (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2).replace('.', ',')).join(' · ') + '.');
      if (sorted.length > 1 && sorted[0][1] - sorted[1][1] < 0.02) lines.push('Las dos mejores acciones son casi iguales: mano dudosa.');
    }
    if (correct === 'split') {
      if (ranks[0] === 'A' || ranks[0] === '8') lines.push('Regla fácil: separar siempre Ases y ochos.');
      else lines.push('La tabla recomienda separar esta pareja frente a esta carta.');
    }
    if (ranks[0] === ranks[1] && ranks.length === 2 && ['10', 'J', 'Q', 'K'].includes(ranks[0])) lines.push('No se separan dieces: una mano de 20 ya es muy fuerte.');
    if (ranks.length === 2 && ranks[0] === '5' && ranks[1] === '5') lines.push('Nunca se separan cincos: se juegan como 10 y se busca doblar.');
    if (total.value === 11) lines.push('Con 11 normalmente se dobla; contra As la tabla indica pedir.');
    if (chosen === 'insurance') lines.push('El seguro tiene esperanza negativa: cuesta media apuesta y el pago 2:1 no compensa la probabilidad real de blackjack.');
    else lines.push('La referencia para puntuar es siempre la tabla básica de 6 barajas S17, no el máximo del EV aproximado.');
    return lines;
  }
  return { why };
});
