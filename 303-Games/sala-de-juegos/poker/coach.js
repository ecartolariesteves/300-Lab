/* El "entrenador": explica POR QUÉ una acción es buena o mala.
   - Preflop: precio del call, equity contra el rango del rival, posición, valor o farol y manos parecidas.
   - Postflop: qué mano tienes (top pair, overpair, proyecto de color…), tus outs y un plan.
   Sin DOM: devuelve textos que la interfaz pinta, y se prueba con Node. */
(function (root, factory) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const api = factory(isNode ? require('./evaluation.js') : root.PokerEvaluation, isNode ? require('./sizing.js') : root.PokerSizing);
  if (isNode) module.exports = api;
  root.PokerCoach = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (EVAL, SIZING) {
  const ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const NAME = { fold: 'fold', call: 'call', raise: 'abrir', '3bet': '3-bet', '4bet': '4-bet' };
  const pct = (v) => Math.round(v * 100) + '\u00a0%';
  const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });

  /* ---------- Rangos ---------- */

  // Combinaciones de cada mano: parejas 6, suited 4, offsuit 12 (1.326 en total)
  const combos = (hand) => (hand.length === 2 ? 6 : hand.endsWith('s') ? 4 : 12);

  // Qué parte de todas las manos (por combinaciones) juega cada acción de una tabla
  function rangeStats(chart, spot) {
    const out = {};
    for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
      const hand = EVAL.handAt(i, j);
      const f = EVAL.frequencies(chart, hand, spot);
      for (const [a, v] of Object.entries(f)) out[a] = (out[a] || 0) + (v * combos(hand)) / 1326;
    }
    out.play = 1 - (out.fold || 0);
    return out;
  }

  // Texto corto de una mano: "K9s: call 25 % · 3-bet 30 %" o "K8s: fold"
  function handSummary(chart, hand, spot) {
    const f = EVAL.frequencies(chart, hand, spot);
    const parts = Object.entries(f).filter(([a, v]) => a !== 'fold' && v > 0).map(([a, v]) => NAME[a] + ' ' + pct(v));
    if (!parts.length) return hand + ': fold';
    if (f.fold > 0.001) parts.push('fold ' + pct(f.fold));
    return hand + ': ' + parts.join(' · ');
  }

  // Manos parecidas (vecinas del mismo tipo en la tabla 13×13), para ver dónde está el borde del rango
  function neighbors(chart, hand, spot) {
    let pos = null;
    for (let i = 0; i < 13 && !pos; i++) for (let j = 0; j < 13; j++) if (EVAL.handAt(i, j) === hand) { pos = [i, j]; break; }
    const [i, j] = pos;
    const kind = (a, b) => (a === b ? 0 : a < b ? 1 : 2);
    const steps = i === j ? [[-1, -1], [1, 1]] : [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const out = [];
    for (const [di, dj] of steps) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni > 12 || nj > 12 || kind(ni, nj) !== kind(i, j)) continue;
      out.push(handSummary(chart, EVAL.handAt(ni, nj), spot));
    }
    return out.slice(0, 3);
  }

  /* ---------- Preflop: por qué ---------- */

  function categoryReason(hand) {
    const suited = hand.endsWith('s'), pair = hand.length === 2;
    const gap = Math.abs(EVAL.RANKS.indexOf(hand[0]) - EVAL.RANKS.indexOf(hand[1]));
    if (pair) return EVAL.RANKS.indexOf(hand[0]) >= 4
      ? 'Las parejas medianas y pequeñas viven de ligar trío (≈ 12 % en el flop): cuando lo ligan suelen ganar un bote grande, y si no, se abandonan sin perder más'
      : 'Las parejas altas ya suelen ir por delante sin mejorar';
    if (suited && gap <= 2 && !'AK'.includes(hand[0])) return 'Los conectores suited ligan proyectos de color y escalera: ganan poco a menudo, pero cuando ligan ganan botes grandes, sobre todo jugando en posición';
    if (suited && hand[0] === 'A') return 'El As suited tiene el proyecto de color más alto (color "nut") y bloquea las manos fuertes del rival';
    if ('AKQJT'.includes(hand[0]) && 'AKQJT'.includes(hand[1])) return 'Las broadways ligan parejas altas, pero contra un rango fuerte a menudo con peor kicker (mano dominada)';
    if (!suited) return 'Las manos offsuit apenas ligan proyectos de color y, cuando ligan pareja, muchas veces con peor kicker';
    return 'Las manos suited tienen proyectos de color además de las parejas';
  }

  // Por qué una mano con equity suficiente "sobre el papel" se foldea igualmente
  function foldReason(hand) {
    const suited = hand.endsWith('s'), pair = hand.length === 2;
    const gap = Math.abs(EVAL.RANKS.indexOf(hand[0]) - EVAL.RANKS.indexOf(hand[1]));
    if (pair) return 'Las parejas pequeñas viven de ligar trío (≈ 12 % en el flop); el resto de las veces casi nunca ganan el bote, así que solo compensan cuando el precio es bueno y no hay riesgo de resubida.';
    if (suited && gap <= 2) return 'Los conectores suited dependen de ligar proyectos: casi siempre fallan el flop y tienen que foldear, y para compensarlo necesitan un precio mejor que este.';
    if ('AKQJT'.includes(hand[0]) && 'AKQJT'.includes(hand[1])) return 'Contra un rango de apertura, ' + hand + ' está a menudo dominada (por ejemplo AJ contra AQ o AK): cuando ligas pareja, el rival suele tener mejor kicker y pierdes un bote grande.';
    return 'La mano liga poco y, cuando liga pareja, muchas veces es con peor kicker: no realiza la equity que marca el número.';
  }

  function blockerText(hand) {
    if (hand.includes('A')) return 'el As bloquea AA, AK y AQ del rival (hay menos combinaciones con las que te pueda pagar o resubir)';
    if (hand.includes('K')) return 'el Rey bloquea KK y AK del rival';
    return 'la mano juega bien cuando te pagan (proyectos de color y escalera)';
  }

  /* Devuelve una lista de frases que explican la decisión.
     ctx: { spot, hand, heroPos, villainPos, chart, freq, chosen, score,
            due, pot (bote antes de pagar), equity (0-1 o null), villainRange (fracción de manos o null) } */
  function whyPreflop(ctx) {
    const { spot, hand, heroPos, villainPos, chart, freq, chosen, due, pot, equity, villainRange } = ctx;
    const lines = [];
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const [ref, refFreq] = sorted[0];
    const second = sorted[1] || [null, 0];
    const need = due > 0 ? due / (pot + due) : 0;
    const ip = villainPos ? SIZING.inPosition(heroPos, villainPos) : null;
    // Jugadores que aún hablan después de ti (sin contar al que subió)
    const behind = ORDER.slice(ORDER.indexOf(heroPos) + 1).filter((p) => p !== villainPos);

    if (spot === 'Apertura') {
      const r = rangeStats(chart, spot);
      lines.push('Quedan ' + behind.length + ' jugadores por hablar (' + behind.join(', ') + '). Desde ' + heroPos + ' la referencia abre el ' + pct(r.raise) + ' de las manos: cuantos menos jugadores quedan detrás, más manos se abren.');
      lines.push(ref === 'raise'
        ? 'Abrir ' + hand + ' gana: muchas veces todos foldean y te llevas las ciegas, y si te pagan juegas con la iniciativa' + (heroPos === 'BTN' ? ' y con posición en todas las calles.' : '.')
        : 'Con ' + behind.length + ' jugadores detrás, a menudo alguno tiene una mano que domina a ' + hand + '. No llega al rango de apertura: fold.');
    } else {
      // Precio y equity
      if (due > 0) lines.push('Pagar cuesta ' + fmt(due) + ' bb para un bote final de ' + fmt(pot + due) + ' bb: necesitas al menos ' + pct(need) + ' de equity para que el call no pierda dinero.');
      if (equity != null) lines.push('Contra el rango de ' + (spot === 'Contra 3-bet' ? '3-bet' : 'apertura') + ' de ' + villainPos + (villainRange != null ? ' (' + pct(villainRange) + ' de las manos)' : '') + ', tu ' + hand + ' tiene ' + pct(equity) + ' de equity.');
      // Posición
      if (heroPos === 'BB' && spot === 'Contra apertura') lines.push('Desde la BB ya tienes 1 bb puesta y cierras la acción: pagas barato, por eso se defienden muchas manos aunque juegues sin posición.');
      else if (ip) lines.push('Tendrás posición contra ' + villainPos + ': hablas el último en el flop, turn y river, y así realizas más equity de la que dice el número.');
      else lines.push('Jugarás sin posición contra ' + villainPos + ': hablas primero en cada calle y realizas menos equity. Por eso sin posición se paga poco y se prefiere 3-bet o fold.');
      // Motivo de la acción de referencia
      const raiseName = spot === 'Contra 3-bet' ? '4-bet' : '3-bet';
      if (ref === 'fold') {
        if (equity != null && equity + 0.02 < need) lines.push('Fold: tu equity (' + pct(equity) + ') no llega al ' + pct(need) + ' que exige el precio.');
        else {
          // La equity bruta supera el precio, pero no se realiza entera
          const parts = ['Fold' + (equity != null ? ': tu equity bruta (' + pct(equity) + ') supera el precio, pero ese número supone que ves las 5 cartas sin más apuestas, y no es así' : '') + '.'];
          parts.push(foldReason(hand));
          if (behind.length && spot === 'Contra apertura') parts.push('Además quedan por hablar ' + behind.join(' y ') + ', que pueden hacer squeeze (3-bet): si pasa, foldeas y pierdes lo que pagaste.');
          if (spot === 'Contra 3-bet') parts.push('Lo que ya pusiste al abrir no cuenta: ese dinero ya está en el bote.');
          parts.push('Por eso la referencia juega estas manos solo a veces o con 3-bet las mejores, y foldea el resto.');
          lines.push(parts.join(' '));
        }
      } else if (ref === 'call') {
        const price = equity == null ? 'tienes precio' : equity >= need ? 'tienes precio (' + pct(equity) + ' frente al ' + pct(need) + ' necesario)'
          : 'tu equity bruta (' + pct(equity) + ') queda algo por debajo del precio (' + pct(need) + '), pero se paga por lo que ganas después cuando ligas (pot odds implícitas)';
        lines.push('Call: ' + price + (ip ? ' y juegas con posición' : '') + '. ' + categoryReason(hand) + '. Hacer ' + raiseName + ' convertiría la mano en un farol: foldearían las peores y solo te pagarían las mejores.');
      } else {
        const value = (equity != null && equity >= 0.55) || ['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(hand);
        lines.push(value
          ? raiseName + ' por valor: vas por delante del rango de ' + villainPos + (equity != null ? ' (' + pct(equity) + ')' : '') + ', así que subes para que te paguen manos peores y el bote crezca cuando eres favorito.'
          : raiseName + ' como farol: ' + blockerText(hand) + '. Ganas el bote cuando foldean y, si te pagan, la mano tiene juego. Ante un ' + (spot === 'Contra 3-bet' ? '5-bet' : '4-bet') + ' se foldea sin problema.');
      }
    }
    if (second[0] && second[1] >= 0.2) lines.push('Es una mano mixta: la referencia hace ' + NAME[ref] + ' el ' + pct(refFreq) + ' y ' + NAME[second[0]] + ' el ' + pct(second[1]) + '. Las dos opciones valen casi lo mismo.');
    // Comentario sobre tu elección cuando se aleja de la referencia
    const chosenFreq = freq[chosen] || 0;
    if (chosen === 'fold' && freq.fold < 0.5) lines.push('Has foldeado una mano que la referencia juega el ' + pct(1 - freq.fold) + ' de las veces: renuncias al valor que tiene jugarla.');
    else if (chosen !== 'fold' && chosen !== 'limp' && chosenFreq === 0) lines.push('La referencia nunca hace ' + NAME[chosen] + ' con ' + hand + ' aquí: a largo plazo pierde dinero frente a ' + NAME[ref] + '.');
    const near = neighbors(chart, hand, spot);
    if (near.length) lines.push('Manos parecidas → ' + near.join(' · ') + '.');
    return lines;
  }

  /* ---------- Postflop: qué tengo y cómo lo juego ---------- */

  const RV = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
  const RN = { 14: 'As', 13: 'Rey', 12: 'Dama', 11: 'Jota', 10: 'Diez', 9: 'Nueve', 8: 'Ocho', 7: 'Siete', 6: 'Seis', 5: 'Cinco', 4: 'Cuatro', 3: 'Tres', 2: 'Dos' };

  // ¿Hay escalera con estos valores? Devuelve las ventanas de 5 que la forman (el As vale 14 y 1)
  function straightWindows(values) {
    const set = new Set(values);
    if (set.has(14)) set.add(1);
    const out = [];
    for (let high = 14; high >= 5; high--) {
      const w = [high, high - 1, high - 2, high - 3, high - 4];
      if (w.every((v) => set.has(v))) out.push(w);
    }
    return out;
  }
  const usesHero = (window, heroVals) => window.some((v) => heroVals.includes(v) || (v === 1 && heroVals.includes(14)));

  /* Lee la mano del héroe: mano hecha, proyectos, outs y plan.
     hero: ['As','Kd'], board: 3 a 5 cartas. */
  function readHand(hero, board, { facingBet = false, opponents = 1 } = {}) {
    const hv = hero.map((c) => RV[c[0]]), bv = board.map((c) => RV[c[0]]);
    const all = [...hero, ...board];
    const count = (vals) => vals.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {});
    const ac = count(all.map((c) => RV[c[0]])), bc = count(bv);
    const suits = all.reduce((m, c) => ((m[c[1]] = (m[c[1]] || 0) + 1), m), {});
    const boardSorted = [...new Set(bv)].sort((a, b) => b - a);
    const topBoard = boardSorted[0];
    let label, strength;

    const flushSuit = Object.keys(suits).find((s) => suits[s] >= 5);
    const heroFlush = flushSuit && hero.some((c) => c[1] === flushSuit);
    const straights = straightWindows(all.map((c) => RV[c[0]])).filter((w) => usesHero(w, hv));
    const groups = Object.entries(ac).map(([v, n]) => ({ v: +v, n })).sort((a, b) => b.n - a.n || b.v - a.v);
    const heroIn = (v) => hv.includes(v);

    if (groups[0].n === 4 && heroIn(groups[0].v)) { label = 'Póker'; strength = 'monstruo'; }
    else if (groups[0].n === 3 && groups.some((g) => g.n >= 2 && g.v !== groups[0].v) && (heroIn(groups[0].v) || heroIn(groups[1].v))) { label = 'Full'; strength = 'monstruo'; }
    else if (heroFlush) {
      const heroHigh = Math.max(...hero.filter((c) => c[1] === flushSuit).map((c) => RV[c[0]]));
      label = 'Color' + (heroHigh === 14 ? ' al As (nut)' : heroHigh >= 12 ? ' alto' : ' bajo');
      strength = heroHigh >= 12 ? 'monstruo' : 'fuerte';
    } else if (straights.length) { label = 'Escalera al ' + RN[straights[0][0]]; strength = 'monstruo'; }
    else if (groups[0].n === 3 && heroIn(groups[0].v)) {
      if (hv[0] === hv[1]) { label = 'Set (trío con pareja en mano)'; strength = 'monstruo'; }
      else { label = 'Trío (con la pareja de la mesa)'; strength = 'fuerte'; }
    } else {
      // Cartas tuyas que hacen pareja con la mesa (la pareja que está solo en la mesa no es tuya)
      const pocket = hv[0] === hv[1] ? hv[0] : null;
      const pairs = pocket ? [] : [...new Set(hv)].filter((v) => bc[v] >= 1).sort((a, b) => b - a);
      if (pairs.length >= 2) {
        label = 'Dobles parejas (con tus dos cartas)'; strength = 'fuerte';
      } else if (pocket) {
        if (pocket > topBoard) { label = 'Overpair (pareja de ' + RN[pocket] + 's, mayor que la mesa)'; strength = pocket >= 11 ? 'fuerte' : 'buena'; }
        else { label = 'Pareja en mano por debajo de la mesa (' + RN[pocket] + 's)'; strength = pocket > boardSorted[1] ? 'media' : 'débil'; }
      } else if (pairs.length === 1) {
        const p = pairs[0];
        const kicker = Math.max(...hv.filter((v) => v !== p), 0);
        if (p === topBoard) {
          const good = kicker >= 11 || p === 14;
          label = 'Top pair (pareja con la carta más alta de la mesa), kicker ' + (kicker ? RN[kicker] : '—');
          strength = good ? 'buena' : 'media';
        } else if (p === boardSorted[1]) { label = 'Pareja media'; strength = 'media'; }
        else { label = 'Pareja baja'; strength = 'débil'; }
      } else {
        const overs = hv.filter((v) => v > topBoard).length;
        label = overs === 2 ? 'Carta alta: dos overcards' : overs === 1 ? 'Carta alta: una overcard' : 'Nada (aire)';
        strength = 'aire';
      }
    }

    // Proyectos (solo si quedan cartas por salir y no tienes ya una mano muy fuerte)
    const draws = [];
    let outs = 0;
    if (board.length < 5 && strength !== 'monstruo') {
      const fdSuit = Object.keys(suits).find((s) => suits[s] === 4 && hero.some((c) => c[1] === s));
      if (fdSuit) {
        const nut = hero.some((c) => c[1] === fdSuit && c[0] === 'A');
        draws.push({ name: 'proyecto de color' + (nut ? ' al As (nut)' : ''), outs: 9 });
        outs += 9;
      }
      // Rangos que completarían escalera usando alguna carta tuya
      const allVals = all.map((c) => RV[c[0]]);
      const completing = [];
      for (let x = 2; x <= 14; x++) {
        if (allVals.includes(x)) continue;
        const w = straightWindows([...allVals, x]).filter((win) => win.includes(x) || (x === 14 && win.includes(1)));
        if (w.some((win) => usesHero(win, hv))) completing.push(x);
      }
      if (completing.length >= 2) draws.push({ name: 'proyecto de escalera abierto (' + completing.map((v) => RN[v]).join(' o ') + ')', outs: 8 });
      else if (completing.length === 1) draws.push({ name: 'proyecto de escalera interno (gutshot: ' + RN[completing[0]] + ')', outs: 4 });
      const st = completing.length >= 2 ? 8 : completing.length * 4;
      // Si hay color y escalera, las cartas que dan las dos cosas solo cuentan una vez
      outs += fdSuit && st ? st - completing.length : st;
      if (strength === 'aire' && !draws.length) {
        const overs = hv.filter((v) => v > topBoard).length;
        if (overs) { draws.push({ name: overs === 2 ? 'dos overcards' : 'una overcard', outs: overs * 3 }); outs += overs * 3; }
      }
    }
    const left = 52 - all.length;
    const hit = !outs ? 0 : board.length === 3 ? 1 - ((left - outs) / left) * ((left - 1 - outs) / (left - 1)) : outs / left;
    const rule = board.length === 3 ? outs * 4 : outs * 2;

    // Plan según la fuerza de la mano
    const strongDraw = outs >= 8;
    let plan;
    if (strength === 'monstruo') plan = 'Mano muy fuerte: apuesta por valor y construye el bote. Con proyectos en la mesa, apuesta grande (66–100 %) para cobrar a quien persiga.';
    else if (strength === 'fuerte') plan = 'Mano fuerte: apuesta por valor y protección. Si te suben con fuerza en turn y river, reconsidera: una sola pareja rara vez gana contra un rival que sube varias veces.';
    else if (strength === 'buena') plan = 'Buena mano, pero de una pareja: apuesta pequeña o mediana por valor y protección (33–50 %). Paga apuestas normales; ante mucha acción, frena.';
    else if (strongDraw) plan = 'Proyecto fuerte: es el mejor momento para un semifarol (apostar o subir), porque ganas si foldean y también si ligas. Si pagas, compara ' + outs + ' outs (≈ ' + pct(hit) + ') con las pot odds; en posición puedes pagar algo más por lo que ganarás si ligas (pot odds implícitas).';
    else if (strength === 'media') plan = 'Mano media: controla el bote. Pasa y paga apuestas pequeñas o medianas; no la conviertas en un farol apostando ni subiendo. Contra varios rivales, más cuidado: alguno suele tener más.';
    else if (outs >= 4) plan = 'Proyecto débil (' + outs + ' outs): paga solo apuestas pequeñas (el precio debe ser mejor que ≈ ' + pct(hit) + '). Si no, fold. Contra un solo rival y en posición, a veces sirve para un farol.';
    else if (strength === 'débil') plan = 'Pareja débil: llega gratis al showdown si puedes (pasa). Ante apuestas grandes o en varias calles, fold.';
    else plan = facingBet ? 'Sin mano ni proyecto: fold ante una apuesta, salvo que el precio sea muy bueno.' : 'Sin mano ni proyecto: pasa. Un farol solo tiene sentido contra un rival, en mesas que favorecen tu rango (cartas altas si abriste) y apostando pequeño.';
    if (opponents > 1 && ['buena', 'media'].includes(strength)) plan += ' Hay ' + opponents + ' rivales: con más jugadores, más probable que alguno te gane.';
    return { label, strength, draws, outs, hit, rule, plan };
  }

  return { combos, rangeStats, handSummary, neighbors, whyPreflop, readHand, straightWindows };
});
