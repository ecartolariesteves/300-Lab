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

  /* Decisión postflop a partir de la equity del bot contra el rango del héroe.
     ctx.due: lo que tiene que pagar (0 si puede pasar). ctx.potOdds: equity necesaria para pagar.
     Devuelve { action, share } con action 'check', 'bet', 'call', 'fold' o 'raise'.
     share es la fracción del bote al apostar; al subir, game.js sube a 3× la apuesta. */
  function decidePostflop(profile, ctx) {
    const { equity, potOdds = 0, due = 0, random = Math.random } = ctx;
    if (due > 0) {
      if (profile === 'roca') return { action: equity > potOdds + 0.1 ? 'call' : 'fold' };
      if (profile === 'station') return { action: equity > potOdds - 0.08 ? 'call' : 'fold' };
      if (profile === 'maniaco') {
        if (equity > 0.8) return { action: random() < 0.5 ? 'raise' : 'call' };
        if (equity < 0.3 && random() < 0.1) return { action: 'raise' }; // farol subiendo
        return { action: equity > potOdds + 0.04 ? 'call' : 'fold' };
      }
      // GTO aproximado
      if (equity > 0.85 && random() < 0.3) return { action: 'raise' };
      return { action: equity > potOdds + 0.04 ? 'call' : 'fold' };
    }
    if (profile === 'roca') return equity > 0.8 ? { action: 'bet', share: 0.5 } : { action: 'check' };
    if (profile === 'station') return equity > 0.7 ? { action: 'bet', share: 0.33 } : { action: 'check' };
    if (profile === 'maniaco') {
      if (equity > 0.55) return { action: 'bet', share: 0.75 };
      if (equity < 0.3 && random() < 0.3) return { action: 'bet', share: 0.75 }; // farol
      return { action: 'check' };
    }
    if (equity > 0.78) return { action: 'bet', share: 0.75 };
    if (equity > 0.62) return { action: 'bet', share: 0.33 };
    if (equity < 0.25 && random() < 0.08) return { action: 'bet', share: 0.33 }; // farol ocasional
    return { action: 'check' };
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

  /* Ajuste explotador para el "Por qué" del héroe. aggressor: el rival ha apostado o subido. */
  function exploitLine(profile, aggressor) {
    if (profile === 'maniaco' && aggressor) return 'Un maníaco farolea mucho: puedes pagar más ligero de lo que dice la tabla.';
    if (profile === 'maniaco') return 'Un maníaco apuesta a menudo cuando pasas: con manos fuertes, deja que apueste él.';
    if (profile === 'roca' && aggressor) return 'Una roca casi nunca farolea: foldea manos medias.';
    if (profile === 'roca') return 'Una roca foldea mucho: tus faroles y robos funcionan mejor contra ella.';
    if (profile === 'station') return 'Un calling station paga de más: apuesta por valor más fino y no le farolees.';
    return '';
  }

  return { TYPES, LABELS, MODES, assign, decidePreflop, decidePostflop, pushFoldStacks, exploitLine };
});
