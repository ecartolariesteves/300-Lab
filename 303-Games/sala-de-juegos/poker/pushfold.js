/* Consulta de las tablas de push/fold (pushfold.json). Sin DOM.
   Las tablas son 6-max. Con menos jugadores se usa la posición con el mismo número de
   jugadores detrás: con 4 jugadores, el primero en hablar usa la tabla de CO. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PokerPushFold = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const POS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const MIN = 4;
  const MAX = 15;
  // Posición de la tabla según cuántos jugadores quedan por hablar detrás del que empuja
  const BY_BEHIND = { 5: 'UTG', 4: 'HJ', 3: 'CO', 2: 'BTN', 1: 'SB' };

  // Combinaciones de cada mano de 169: parejas 6, suited 4, offsuit 12
  const combos = (hand) => (hand.length === 2 ? 6 : hand[2] === 's' ? 4 : 12);
  const share = (list) => list.reduce((s, h) => s + combos(h), 0) / 1326;

  /* Stack de la tabla (entero de 4 a 15) o el motivo por el que no hay tabla. */
  function tableStack(stackBb) {
    const s = Math.round(stackBb);
    if (s < MIN) return { reason: 'Con menos de 4 bb casi siempre entran varios jugadores y estas tablas no sirven.' };
    if (s > MAX) return { reason: 'Con más de 15 bb ya no se juega solo all-in o fold.' };
    return { stack: s };
  }

  const pusherPos = (playersBehind) => BY_BEHIND[playersBehind] || null;
  // Posición del que paga: el n-ésimo jugador detrás del que empuja (1 = el siguiente)
  const callerPos = (pusher, offset) => POS[POS.indexOf(pusher) + offset] || null;

  /* Spot first-in (nadie ha entrado): ¿all-in o fold?
     stackBb: stack efectivo. playersBehind: jugadores vivos que hablan después. */
  function pushSpot(data, { stackBb, playersBehind, hand }) {
    const s = tableStack(stackBb);
    if (s.reason) return { unevaluated: s.reason };
    const pos = pusherPos(playersBehind);
    if (!pos) return { unevaluated: 'No hay tabla para esta posición.' };
    const table = pos + '_' + s.stack;
    const list = data.push[table];
    const inRange = list.includes(hand);
    return { kind: 'push', table, pos, stack: s.stack, list, inRange, correct: inRange ? 'allin' : 'fold', share: share(list) };
  }

  /* Te enfrentas a un all-in y nadie más ha entrado: ¿call o fold?
     pusherBehind: jugadores que había detrás del que empujó. callerOffset: cuántos asientos detrás de él estás tú. */
  function callSpot(data, { stackBb, pusherBehind, callerOffset, hand }) {
    const s = tableStack(stackBb);
    if (s.reason) return { unevaluated: s.reason };
    const pusher = pusherPos(pusherBehind);
    const caller = pusher && callerPos(pusher, callerOffset);
    if (!caller) return { unevaluated: 'No hay tabla para esta posición.' };
    const table = caller + '_vs_' + pusher + '_' + s.stack;
    const list = data.call[table];
    if (!list) return { unevaluated: 'No hay tabla para esta posición.' };
    const inRange = list.includes(hand);
    return { kind: 'call', table, pos: caller, pusher, stack: s.stack, list, inRange, correct: inRange ? 'call' : 'fold', share: share(list) };
  }

  /* Rangos de los que quedan detrás del que empuja (para la fold equity y los bots). */
  function callRanges(data, { stack, pusherBehind }) {
    const pusher = pusherPos(pusherBehind);
    const out = [];
    for (let k = 1; k <= pusherBehind; k++) {
      const caller = callerPos(pusher, k);
      out.push({ pos: caller, list: data.call[caller + '_vs_' + pusher + '_' + stack] || [] });
    }
    return out;
  }

  /* Probabilidad aproximada de que todos los que quedan foldeen (sin descontar cartas bloqueadas). */
  function foldEquity(data, { stack, pusherBehind }) {
    return callRanges(data, { stack, pusherBehind }).reduce((p, r) => p * (1 - share(r.list)), 1);
  }

  // Lista de manos a tabla 13×13 con el formato de ranges.json, para dibujarla con la misma rejilla
  function toChart(list, action) {
    const chart = {};
    for (const h of list) chart[h] = { [action]: 1 };
    return chart;
  }

  /* Manos dudosas: las que cambian de decisión entre S−2 y S+2 bb en esa posición. */
  function isDoubtfulPush(data, { stack, pos, hand }) {
    const lo = Math.max(MIN, stack - 2), hi = Math.min(MAX, stack + 2);
    return data.push[pos + '_' + lo].includes(hand) !== data.push[pos + '_' + hi].includes(hand);
  }
  function isDoubtfulCall(data, { stack, caller, pusher, hand }) {
    const lo = Math.max(MIN, stack - 2), hi = Math.min(MAX, stack + 2);
    const key = (s) => caller + '_vs_' + pusher + '_' + s;
    return data.call[key(lo)].includes(hand) !== data.call[key(hi)].includes(hand);
  }

  return { POS, MIN, MAX, BY_BEHIND, combos, share, tableStack, pusherPos, callerPos, pushSpot, callSpot, callRanges, foldEquity, toChart, isDoubtfulPush, isDoubtfulCall };
});
