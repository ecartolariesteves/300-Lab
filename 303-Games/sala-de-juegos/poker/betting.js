/* Reglas de apuesta de No Limit Hold'em, sin DOM (se pueden probar con Node).
   Todos los importes son "subir a" o "apostar a": el total que el jugador tendrá
   puesto en esta calle, en ciegas grandes (bb). */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PokerBetting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EPS = 1e-9;
  const round1 = (v) => Math.round(v * 10) / 10;

  /* Subida mínima legal: la apuesta actual más el último incremento.
     - Preflop, la ciega grande cuenta como apuesta de 1 bb: la apertura mínima es a 2 bb.
     - Tras abrir a 2,5 bb (incremento 1,5) se puede resubir como mínimo a 4 bb.
     - Postflop, si nadie ha apostado, la apuesta mínima es 1 bb. */
  function minRaiseTo({ currentBet, lastRaiseSize }) {
    if (currentBet <= EPS) return 1;
    return currentBet + Math.max(lastRaiseSize || 0, 1);
  }

  /* Acciones legales del jugador en este momento.
     - fold solo si hay algo que pagar (si puedes pasar, no tiene sentido tirar la mano).
     - call: pagar lo pendiente; preflop sin subidas se llama limp.
     - raise/bet: con tamaño libre entre minTo y maxTo.
     - allin: siempre que quede stack; puede ser menor que la subida mínima (all-in corto). */
  function legalActions({ player, currentBet, lastRaiseSize, street, raiseCount = 0, canRaise = true }) {
    const bet = player.bet || 0, stack = player.stack || 0;
    const due = Math.max(0, currentBet - bet);
    const maxTo = bet + stack;
    const minTo = Math.min(minRaiseTo({ currentBet, lastRaiseSize }), maxTo);
    const out = { due: round1(due), minTo: round1(minTo), maxTo: round1(maxTo), actions: [] };
    if (due > EPS) {
      out.actions.push('fold');
      out.actions.push(street === 'preflop' && raiseCount === 0 ? 'limp' : 'call');
    } else {
      out.actions.push('check');
    }
    const canIncrease = canRaise && stack > due + EPS;
    if (canIncrease && maxTo + EPS >= minRaiseTo({ currentBet, lastRaiseSize })) out.actions.push(currentBet > EPS ? 'raise' : 'bet');
    if (canIncrease) out.actions.push('allin');
    return out;
  }

  /* Comprueba una acción antes de aplicarla. 'limp' es un call preflop sin subidas. */
  function validateAction({ action, target, player, currentBet, lastRaiseSize, street, raiseCount = 0, canRaise = true }) {
    const legal = legalActions({ player, currentBet, lastRaiseSize, street, raiseCount, canRaise });
    if (!legal.actions.includes(action)) return { ok: false, reason: 'Esa acción no está disponible ahora.', legal };
    if (action === 'raise' || action === 'bet') {
      if (!Number.isFinite(target)) return { ok: false, reason: 'Elige un tamaño.', legal };
      if (target > legal.maxTo + EPS) return { ok: false, reason: 'No puedes apostar más que tu stack.', legal };
      if (target + EPS < minRaiseTo({ currentBet, lastRaiseSize }) && Math.abs(target - legal.maxTo) > EPS)
        return { ok: false, reason: `La subida mínima es a ${legal.minTo} bb.`, legal };
    }
    return { ok: true, legal };
  }

  /* Botones de tamaño postflop.
     Sin apuesta pendiente: porcentajes del bote. Contra una apuesta: 2,5×, 3× y 4× la apuesta rival.
     Se descartan los que no son legales y se añaden sin repetir. */
  function postflopPresets({ pot, currentBet, heroBet, minTo, maxTo }) {
    const raw = currentBet > EPS
      ? [2.5, 3, 4].map((m) => ({ label: m.toString().replace('.', ',') + '×', to: round1(currentBet * m) }))
      : [0.25, 0.33, 0.5, 0.75, 1, 1.25].map((p) => ({ label: Math.round(p * 100) + '\u00a0%', to: round1(heroBet + pot * p) }));
    const seen = new Set();
    return raw.filter((x) => x.to + EPS >= minTo && x.to <= maxTo + EPS && !seen.has(x.to) && seen.add(x.to));
  }

  return { minRaiseTo, legalActions, validateAction, postflopPresets, round1 };
});
