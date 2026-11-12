/* Perfiles de rival de la Mesa de Estudio. Sin DOM.
   Ninguna función recibe las cartas del héroe: los bots deciden con su propia mano (preflop)
   o con su equity contra el rango del héroe (postflop), que calcula game.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PokerProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TYPES = ['gto', 'roca', 'station', 'maniaco'];
  const LABELS = { gto: 'GTO aprox.', roca: 'Roca', station: 'Station', maniaco: 'Maníaco' };
  // Qué hace cada perfil, en una línea (Ajustes). El GTO solo sigue un equilibrio preflop.
  const DESCRIPTIONS = {
    gto: 'Preflop sigue las tablas de referencia. Postflop es una aproximación equilibrada, no un solver: mismo tamaño para valor y farol, semifaroles con proyectos y apuesta de continuación.',
    roca: 'Juega pocas manos, paga en vez de resubir y casi nunca farolea.',
    station: 'Juega muchas manos, limpea y paga demasiado. No farolea.',
    maniaco: 'Abre muchas manos, resube mucho y farolea a menudo.',
  };
  const MODES = ['mixto', ...TYPES];
  const PREMIUM = ['AA', 'KK', 'QQ', 'AKs', 'AKo'];

  // Mezcla de Fisher-Yates con el generador que se le pase (Math.random o uno con semilla)
  function shuffle(list, random) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* Perfiles de los 5 bots. "mixto": 2 GTO, 1 Roca, 1 Station y 1 Maníaco en asientos al azar.
     Cualquier otro modo: los 5 bots con ese perfil. */
  function assign(mode = 'mixto', random = Math.random) {
    if (mode !== 'mixto') return Array(5).fill(TYPES.includes(mode) ? mode : 'gto');
    return shuffle(['gto', 'gto', 'roca', 'station', 'maniaco'], random);
  }

  /* Decisión preflop con tablas de cash.
     ctx.hand: la mano del bot en notación de 169 (AKs, 72o…).
     ctx.spot: 'Apertura', 'Contra apertura' o 'Contra 3-bet'.
     ctx.freq: frecuencias de la tabla de referencia para esa mano ({ raise: 1 }, { call: 0.4, '3bet': 0.6 }…).
     ctx.inRfiUtg / ctx.inRfiBtn: si la mano está en el rango de apertura de UTG / BTN.
     Devuelve 'chart' (jugar con las frecuencias de la tabla), 'fold', 'call', 'limp' o 'raise'. */
  function decidePreflop(profile, ctx) {
    const { hand, spot, freq = {}, inRfiUtg = false, inRfiBtn = false, random = Math.random } = ctx;
    const continues = (freq.call || 0) + (freq['3bet'] || 0) + (freq['4bet'] || 0) > 0;
    if (profile === 'roca') {
      // Solo juega manos de apertura de UTG; con premium resube, con el resto paga
      if (!inRfiUtg) return 'fold';
      if (spot === 'Apertura') return 'raise';
      if (PREMIUM.includes(hand)) return 'raise';
      return continues ? 'call' : 'fold';
    }
    if (profile === 'station') {
      // Juega muchas manos y casi nunca resube: limpea o paga
      if (spot === 'Apertura') {
        if (!inRfiBtn) return 'fold';
        return random() < 0.5 ? 'limp' : 'raise';
      }
      if (hand === 'AA' || hand === 'KK') return 'raise';
      if (spot === 'Contra apertura') return inRfiBtn ? 'call' : 'fold';
      return continues || inRfiBtn ? 'call' : 'fold';
    }
    if (profile === 'maniaco') {
      // Abre como desde el botón en cualquier posición y convierte calls en 3-bets
      if (spot === 'Apertura') return inRfiBtn ? 'raise' : 'fold';
      if (spot === 'Contra apertura') {
        if (freq['3bet'] > 0) return 'raise';
        if (freq.call > 0) return random() < 0.6 ? 'raise' : 'call';
        return 'fold';
      }
      return 'chart';
    }
    return 'chart';
  }

  /* Decisión postflop a partir de la equity del bot contra el rango (ya estrechado) del héroe.
     ctx.due: lo que tiene que pagar (0 si puede pasar). ctx.potOdds: equity necesaria para pagar.
     ctx.draw: tiene un proyecto fuerte (8 outs o más). ctx.street: 'flop', 'turn' o 'river'.
     ctx.aggressor: fue el último en subir o apostar en la calle anterior.
     Devuelve { action, share } con action 'check', 'bet', 'call', 'fold' o 'raise'.
     share es la fracción del bote al apostar; al subir, game.js sube a 3× la apuesta. */
  function decidePostflop(profile, ctx) {
    const { equity, potOdds = 0, due = 0, draw = false, street = 'river', aggressor = false, random = Math.random } = ctx;
    const drawLive = draw && street !== 'river';
    if (due > 0) {
      if (profile === 'roca') return { action: equity > potOdds + 0.1 ? 'call' : 'fold' };
      if (profile === 'station') return { action: equity > potOdds - 0.08 ? 'call' : 'fold' };
      if (profile === 'maniaco') {
        if (equity > 0.8) return { action: random() < 0.5 ? 'raise' : 'call' };
        if ((equity < 0.3 || drawLive) && random() < 0.1) return { action: 'raise' }; // farol subiendo
        return { action: equity > potOdds + 0.04 ? 'call' : 'fold' };
      }
      // GTO aproximado: sube por valor y, a veces, como semifarol con proyecto
      if (equity > 0.85 && random() < 0.3) return { action: 'raise' };
      if (drawLive && random() < 0.12) return { action: 'raise' };
      // Con proyecto, las cartas que faltan pagan algo más (odds implícitas): margen de 5 puntos
      if (drawLive && equity > potOdds - 0.05) return { action: 'call' };
      return { action: equity > potOdds + 0.02 ? 'call' : 'fold' };
    }
    if (profile === 'roca') return equity > 0.8 ? { action: 'bet', share: 0.5 } : { action: 'check' };
    if (profile === 'station') return equity > 0.7 ? { action: 'bet', share: 0.33 } : { action: 'check' };
    if (profile === 'maniaco') {
      if (equity > 0.55) return { action: 'bet', share: 0.75 };
      if (equity < 0.3 && random() < 0.3) return { action: 'bet', share: 0.75 }; // farol
      return { action: 'check' };
    }
    /* GTO aproximado: un solo tamaño por calle para valor y para farol, así el tamaño no delata la mano.
       Flop: 33 %; turn y river: 66 %. */
    const share = street === 'flop' ? 0.33 : 0.66;
    if (equity > 0.68) return { action: 'bet', share }; // valor
    if (street === 'flop' && aggressor) {
      // Apuesta de continuación: el que subió preflop apuesta pequeño a menudo
      if (equity > 0.45 || draw || random() < 0.4) return { action: 'bet', share };
      return { action: 'check' };
    }
    if (drawLive && random() < 0.5) return { action: 'bet', share }; // semifarol
    // Farol puro: menos de uno por cada dos apuestas de valor, y sobre todo en el river
    if (equity < 0.2 && random() < (street === 'river' ? 0.12 : 0.06)) return { action: 'bet', share };
    return { action: 'check' };
  }

  /* Estrecha el rango del héroe después de su acción postflop.
     combos: [{ cards, weight }] del rango actual. strength: la fuerza de cada combinación en este board
     (equity contra una mano al azar, de 0 a 1). ratio: tamaño de la apuesta o subida respecto al bote.
     - Apostar: se queda la parte alta del rango (más alta cuanto mayor es la apuesta) y una parte baja
       con medio peso, porque también se farolea.
     - Subir: la parte alta (35 %) y algo de farol.
     - Pagar: se quita el 30 % más débil, que habría foldeado.
     - Pasar: se rebaja el peso del 15 % más fuerte (con lo mejor se suele apostar).
     Devuelve el rango nuevo. Nunca lo deja vacío. */
  function narrowRange(combos, strength, action, ratio = 0.5) {
    if (!combos.length) return combos;
    const order = combos.map((c, i) => i).sort((a, b) => strength[b] - strength[a]);
    const rank = new Array(combos.length);
    order.forEach((i, k) => { rank[i] = k / combos.length; }); // 0 = la más fuerte
    const keepTop = action === 'raise' ? 0.35 : Math.max(0.35, Math.min(0.7, 0.75 - 0.25 * ratio));
    const out = combos.map((c, i) => {
      const q = rank[i];
      let factor = 1;
      if (action === 'bet' || action === 'raise' || action === 'allin') factor = q < keepTop ? 1 : q > 0.88 ? 0.5 : 0;
      else if (action === 'call') factor = q >= 0.7 ? 0 : 1;
      else if (action === 'check') factor = q < 0.15 ? 0.5 : 1;
      return { ...c, weight: c.weight * factor };
    }).filter((c) => c.weight > 0);
    return out.length ? out : combos;
  }

  /* Push/fold de torneo: qué tabla de stack usa cada perfil (más estrecha = stack mayor).
     La Roca empuja y paga como si tuviera 3 bb más; el Station paga como con 2 bb menos;
     el Maníaco empuja como con 3 bb menos. Siempre dentro de 4-15 bb. */
  function pushFoldStacks(profile, stack) {
    const clamp = (s) => Math.max(4, Math.min(15, s));
    if (profile === 'roca') return { push: clamp(stack + 3), call: clamp(stack + 3) };
    if (profile === 'station') return { push: clamp(stack), call: clamp(stack - 2) };
    if (profile === 'maniaco') return { push: clamp(stack - 3), call: clamp(stack) };
    return { push: clamp(stack), call: clamp(stack) };
  }

  /* Resubida all-in con 16-25 bb: tabla de stack que usa cada perfil (16-25).
     Roca: resube como con 3 bb más (más estrecho). Station: paga la resubida como con 2 bb menos.
     Maníaco: resube como con 3 bb menos. */
  function reshoveStacks(profile, stack) {
    const clamp = (s) => Math.max(16, Math.min(25, s));
    if (profile === 'roca') return { shove: clamp(stack + 3), call: clamp(stack + 3) };
    if (profile === 'station') return { shove: clamp(stack), call: clamp(stack - 2) };
    if (profile === 'maniaco') return { shove: clamp(stack - 3), call: clamp(stack) };
    return { shove: clamp(stack), call: clamp(stack) };
  }

  /* Ajuste explotador para el "Por qué" del héroe. aggressor: el rival ha apostado o subido. */
  function exploitLine(profile, aggressor) {
    if (profile === 'maniaco' && aggressor) return 'Un maníaco farolea mucho: puedes pagar más ligero de lo que dice la tabla.';
    if (profile === 'maniaco') return 'Un maníaco apuesta a menudo cuando pasas: con manos fuertes, deja que apueste él.';
    if (profile === 'roca' && aggressor) return 'Una roca casi nunca farolea: foldea manos medias.';
    if (profile === 'roca') return 'Una roca foldea mucho: tus faroles y robos funcionan mejor contra ella.';
    if (profile === 'station') return 'Un calling station paga de más: apuesta por valor más fino y no le farolees.';
    return '';
  }

  return { TYPES, LABELS, DESCRIPTIONS, MODES, assign, decidePreflop, decidePostflop, narrowRange, pushFoldStacks, reshoveStacks, exploitLine };
});
