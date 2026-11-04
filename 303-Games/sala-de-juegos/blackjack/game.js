/* Interfaz de blackjack, evaluación de decisiones y persistencia local. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const R = window.BlackjackRules;
  const S = window.BlackjackStrategy;
  const STORAGE = 'blackjack-stats';
  let shoe = R.createShoe();
  let bankroll = 1000;
  let wager = 25;
  let hands = [];
  let dealer = [];
  let active = 0;
  let phase = 'bet';
  let mode = 'mesa';
  let stats = { decisions: [], balance: 1000 };
  let spot = null;
  let peeked = false;
  let waitingNatural = false;

  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}');
      bankroll = Number.isFinite(saved.balance) ? saved.balance : 1000;
      stats = saved.stats || { decisions: [] };
    } catch (_) {
      bankroll = 1000;
      stats = { decisions: [] };
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ balance: bankroll, stats }));
    } catch (_) {}
  }
  function record(ranks, up, action, correct, kind) {
    stats.decisions ||= [];
    stats.decisions.push({ ranks, up, action, correct, kind });
    if (stats.decisions.length > 500) stats.decisions.shift();
    save();
    renderStats();
  }
  function cardNode(card, hidden = false) {
    const el = document.createElement('div');
    el.className = 'card' + (['♥','♦'].includes(card.suit) ? ' red' : '');
    el.innerHTML = hidden ? '<span>?</span><span class="suit">♠</span>' :
      '<span>' + card.rank + '</span><span class="suit">' + card.suit + '</span>';
    return el;
  }
  function draw() {
    if (R.shouldReshuffle(shoe)) R.prepareShoe(shoe);
    return R.draw(shoe);
  }
  function totalLabel(cards) {
    const t = R.total(cards);
    return t.value + (t.soft ? ' blando' : '');
  }
  function render() {
    $('bankroll').textContent = bankroll.toLocaleString('es-ES');
    $('wager').textContent = wager;
    $('shoe-count').textContent = R.remaining(shoe);
    const p = hands[active];
    $('dealer-cards').replaceChildren(...dealer.map((c, i) => cardNode(c, phase !== 'done' && i === 1)));
    $('player-cards').replaceChildren(...(p ? p.cards.map(c => cardNode(c)) : []));
    $('dealer-total').textContent = dealer.length ? (phase === 'done' ? totalLabel(dealer) : totalLabel([dealer[0]])) : '';
    $('player-total').textContent = p ? totalLabel(p.cards) : '';
    $('hand-index').textContent = hands.length > 1 ? (active + 1) + '/' + hands.length : '';
    $('hit').disabled = phase !== 'play' || !p || !R.canHit(p);
    $('stand').disabled = phase !== 'play' || !p || p.stood;
    $('double').disabled = phase !== 'play' || !p || !R.canDouble(p) || bankroll < p.wager;
    $('split').disabled = phase !== 'play' || !p || !canSplit(p);
    $('insurance').hidden = phase !== 'play' || dealer[0]?.rank !== 'A' || peeked;
    $('skip-insurance').hidden = !waitingNatural;
    $('deal').disabled = phase === 'play' || bankroll < wager;
  }
  function canSplit(hand) {
    return hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank &&
      hands.length < 4 && bankroll >= hand.wager && !hand.splitAces;
  }
  function beginHand() {
    wager = Number($('bet').value);
    if (bankroll < wager) {
      $('feedback').textContent = 'No tienes fichas suficientes. Recarga para continuar.';
      return;
    }
    if (R.shouldReshuffle(shoe)) R.prepareShoe(shoe);
    bankroll -= wager;
    dealer = [draw(), draw()];
    hands = [{ cards: [draw(), draw()], wager, stood: false, doubled: false, splitAces: false, blackjackEligible: true }];
    active = 0;
    phase = 'play';
    peeked = false;
    waitingNatural = false;
    const up = dealer[0].rank;
    if (['10','J','Q','K'].includes(up)) {
      peeked = true;
      if (R.isBlackjack(dealer)) {
        finishRound();
        $('feedback').textContent = 'El crupier tiene blackjack. La mano termina.';
        return;
      }
    }
    if (R.isBlackjack(hands[0].cards)) {
      hands[0].stood = true;
      if (up === 'A') {
        waitingNatural = true;
        $('feedback').textContent = '¡Blackjack! El crupier muestra un As. Puedes tomar seguro o continuar sin seguro.';
        render();
        return;
      }
    }
    $('feedback').textContent = 'Tu turno. La tabla básica te indica la mejor decisión.';
    advance();
  }
  function checkAcePeek() {
    if (dealer[0]?.rank !== 'A' || peeked) return false;
    peeked = true;
    if (!R.isBlackjack(dealer)) return false;
    finishRound();
    $('feedback').textContent = 'El crupier tiene blackjack. La mano termina.';
    return true;
  }
  function decision(action, hand = hands[active]) {
    const ranks = hand.cards.map(c => c.rank);
    const best = S.bestAction(ranks, dealer[0].rank, {
      canDouble: R.canDouble(hand) && bankroll >= hand.wager,
      canSplit: canSplit(hand)
    });
    const right = action === best || (best === 'D' && action === 'H' && !R.canDouble(hand));
    record(ranks, dealer[0].rank, action, right, R.total(hand.cards).soft ? 'blanda' :
      (ranks.length === 2 && ranks[0] === ranks[1] ? 'pareja' : 'dura'));
    $('feedback').textContent = totalLabel(hand.cards) + ' contra ' + dealer[0].rank +
      ' · Estrategia básica: ' + labelAction(best) + ' · Has ' + labelAction(action).toLowerCase() +
      ' → ' + (right ? 'Correcta' : 'Incorrecta');
  }
  function labelAction(a) {
    return ({ H:'PEDIR', S:'PLANTARSE', D:'DOBLAR', P:'SEPARAR' })[a] || a;
  }
  function advance() {
    while (active < hands.length && (hands[active].stood || R.isBust(hands[active].cards))) active++;
    if (active >= hands.length) finishRound();
    render();
  }
  function hit() {
    if (checkAcePeek()) return;
    const hand = hands[active];
    decision('H');
    hand.cards.push(draw());
    if (R.isBust(hand.cards)) hand.stood = true;
    advance();
  }
  function stand() {
    if (checkAcePeek()) return;
    decision('S');
    hands[active].stood = true;
    advance();
  }
  function double() {
    if (checkAcePeek()) return;
    const hand = hands[active];
    if (!R.canDouble(hand) || bankroll < hand.wager) return;
    decision('D');
    bankroll -= hand.wager;
    hand.wager *= 2;
    hand.doubled = true;
    hand.cards.push(draw());
    hand.stood = true;
    advance();
  }
  function split() {
    if (checkAcePeek()) return;
    const hand = hands[active];
    if (!canSplit(hand)) return;
    decision('P');
    bankroll -= hand.wager;
    const aces = hand.cards[0].rank === 'A';
    const first = { cards:[hand.cards[0], draw()], wager:hand.wager, stood:aces, doubled:false, splitAces:aces, blackjackEligible:false };
    const second = { cards:[hand.cards[1], draw()], wager:hand.wager, stood:aces, doubled:false, splitAces:aces, blackjackEligible:false };
    hands.splice(active, 1, first, second);
    render();
    advance();
  }
  function insurance() {
    const cost = wager / 2;
    if (bankroll < cost) return;
    bankroll -= cost;
    $('feedback').textContent = 'Seguro: incorrecto en estrategia básica. La apuesta de seguro no se recomienda.';
    record(hands[active].cards.map(c=>c.rank), 'A', 'I', false, 'seguro');
    if (R.isBlackjack(dealer)) {
      bankroll += cost * 3;
      peeked = true;
      waitingNatural = false;
      finishRound();
      $('feedback').textContent = 'Seguro acertado: el crupier tenía blackjack.';
      return;
    }
    peeked = true;
    if (waitingNatural) {
      waitingNatural = false;
      finishRound();
      return;
    }
    render();
  }
  function skipInsurance() {
    waitingNatural = false;
    if (checkAcePeek()) return;
    finishRound();
  }
  function finishRound() {
    if (phase === 'done') return;
    if (hands.some(h => !R.isBust(h.cards)) && !R.isBlackjack(dealer)) R.playDealer(dealer, shoe);
    const results = hands.map(h => {
      const result = R.settle(h.cards, dealer, h.wager, {
        blackjackEligible: h.blackjackEligible && !h.doubled,
        doubled: false
      });
      bankroll += h.wager + result.profit;
      return result;
    });
    phase = 'done';
    $('feedback').textContent = results.map(r => r.outcome.toUpperCase()).join(' · ') +
      ' · Crupier: ' + totalLabel(dealer) + ' · Pulsa Repartir para otra mano.';
    save();
    render();
  }
  function startTrainingSpot() {
    const kind = $('hand-type').value;
    const pairs = ['2','3','4','5','6','7','8','9','10','A'];
    const hardHands = [['5','3'],['6','3'],['7','3'],['8','3'],['9','3'],['10','3'],['10','4'],['10','5'],['10','6'],['10','7']];
    const softHands = [['A','2'],['A','3'],['A','4'],['A','5'],['A','6'],['A','7'],['A','8']];
    const pick = list => list[Math.floor(Math.random()*list.length)];
    const ranks = kind === 'pareja' ? [pick(pairs), null] : kind === 'blanda' ? pick(softHands) : pick(hardHands);
    if (kind === 'pareja') ranks[1] = ranks[0];
    const options = ['2','3','4','5','6','7','8','9','10','A'];
    const selected = $('training-up').value;
    const up = selected === 'aleatoria' ? options[Math.floor(Math.random()*options.length)] : selected;
    spot = { ranks, up, kind };
    $('training-cards').textContent = ranks.join(' + ') + ' contra ' + up;
    $('training-feedback').textContent = 'Elige Pedir, Plantarse, Doblar o Separar.';
    renderStrategy();
  }
  function trainingAction(action) {
    if (!spot) return;
    const best = S.bestAction(spot.ranks, spot.up);
    const right = action === best;
    record(spot.ranks, spot.up, action, right, spot.kind);
    $('training-feedback').textContent = spot.ranks.join(' + ') + ' contra ' + spot.up +
      ' · Estrategia básica: ' + labelAction(best) + ' · Has ' + labelAction(action).toLowerCase() +
      ' → ' + (right ? 'Correcta' : 'Incorrecta');
    renderStrategy(best);
  }
  function renderStrategy(best = S.bestAction(spot.ranks, spot.up)) {
    const kind = spot.kind;
    const table = kind === 'pareja' ? S.PAIRS : kind === 'blanda' ? S.SOFT : S.HARD;
    const rowKey = kind === 'pareja' ? spot.ranks[0] : S.handTotal(spot.ranks).total;
    const row = table[rowKey];
    if (!row) { $('strategy-box').textContent = 'Consulta la tabla para esta situación.'; return; }
    $('strategy-box').innerHTML = '<strong>' + (kind === 'pareja' ? 'Parejas' : kind === 'blanda' ? 'Manos blandas' : 'Manos duras') +
      '</strong><table><thead><tr><th>Mano</th>' + S.DEALER.map(d=>'<th>'+d+'</th>').join('') +
      '</tr></thead><tbody><tr><th>'+rowKey+'</th>' + row.map((a,i)=>'<td class="'+(S.DEALER[i]===spot.up?'chosen':'')+'">'+a+'</td>').join('') +
      '</tr></tbody></table><p>La marca señala la columna del crupier. En esta casilla, la acción óptima es '+labelAction(best)+'.</p>';
  }
  function renderStats() {
    const decisions = stats.decisions || [];
    $('stats-summary').replaceChildren();
    const correct = decisions.filter(d=>d.correct).length;
    const pct = decisions.length ? Math.round(correct / decisions.length * 100) : 0;
    $('accuracy').textContent = decisions.length ? pct + '%' : '—';
    $('stats-summary').textContent = decisions.length + ' decisiones · ' + pct + '% correctas';
    const byKind = new Map();
    const byDealer = new Map();
    decisions.forEach(d => {
      const kind = byKind.get(d.kind) || { total:0, correct:0 };
      kind.total++; if (d.correct) kind.correct++; byKind.set(d.kind,kind);
      const dealer = byDealer.get(d.up) || { total:0, correct:0 };
      dealer.total++; if (d.correct) dealer.correct++; byDealer.set(d.up,dealer);
    });
    const summary = document.createElement('div');
    summary.className = 'stats-breakdown';
    const makeTable = (title, rows) => {
      const section = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = title; section.append(heading);
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>Situación</th><th>Decisiones</th><th>Acierto</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const [key,value] of rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<th></th><td></td><td></td>';
        tr.children[0].textContent = key;
        tr.children[1].textContent = value.total;
        tr.children[2].textContent = Math.round(value.correct/value.total*100)+'%';
        body.append(tr);
      }
      table.append(body); section.append(table); return section;
    };
    summary.append(makeTable('Por tipo de mano',byKind),makeTable('Por carta del crupier',byDealer));
    $('stats-summary').append(summary);
    const misses = new Map();
    decisions.filter(d=>!d.correct).forEach(d=>{
      const key = d.ranks.join(',') + ' vs ' + d.up;
      misses.set(key,(misses.get(key)||0)+1);
    });
    $('leaks').replaceChildren(...[...misses].filter(([,n])=>n>=3).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([key,n])=>{const li=document.createElement('li');li.textContent=key+' · '+n+' fallos';return li;}));
  }
  function switchMode(next) {
    mode = next;
    $('table-view').hidden = next !== 'mesa';
    $('training-view').hidden = next !== 'entrenamiento';
    $('stats-view').hidden = next !== 'estadisticas';
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));
    if (next === 'entrenamiento' && !spot) startTrainingSpot();
    renderStats();
  }
  $('deal').addEventListener('click',beginHand);
  $('hit').addEventListener('click',hit);
  $('stand').addEventListener('click',stand);
  $('double').addEventListener('click',double);
  $('split').addEventListener('click',split);
  $('insurance').addEventListener('click',insurance);
  $('skip-insurance').addEventListener('click',skipInsurance);
  $('bet').addEventListener('change',()=>{wager=Number($('bet').value);render();});
  $('next-spot').addEventListener('click',startTrainingSpot);
  $('training-actions').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)trainingAction(b.dataset.action);});
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  $('recharge').addEventListener('click',()=>{bankroll+=1000;save();render();});
  $('reset-stats').addEventListener('click',()=>{stats={decisions:[]};save();renderStats();});
  readSaved();
  render();
  renderStats();
})();
