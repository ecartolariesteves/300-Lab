/* Interfaz y flujo del Blackjack de Estudio. Los módulos puros contienen las reglas y cálculos. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const R = window.BlackjackRules, S = window.BlackjackStrategy, E = window.BlackjackEvaluation;
  const V = window.BlackjackEV, C = window.BlackjackCoach, COUNT = window.BlackjackCount;
  const STORAGE = 'blackjack-estudio-v1';
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  const labels = { hit: 'Pedir', stand: 'Plantarse', double: 'Doblar', split: 'Separar', insurance: 'Seguro' };
  const rank = (card) => card.rank;
  const cardValue = (card) => R.rankValue(card.rank);
  const random = (list) => list[Math.floor(Math.random() * list.length)];
  const safeGet = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || 'null'); } catch (_) { return null; } };
  const safeSave = () => { try { localStorage.setItem(STORAGE, JSON.stringify({ balance, stats, settings })); } catch (_) { /* El juego sigue sin persistencia. */ } };
  const saved = safeGet();
  let balance = Number.isFinite(saved && saved.balance) ? saved.balance : 1000;
  let stats = saved && saved.stats && Array.isArray(saved.stats.decisions) ? saved.stats : { decisions: [], hands: [], result: 0, evLost: 0 };
  let settings = Object.assign({ feedback: 'immediate', count: false, dealSpeed: 250, countSpeed: 650 }, saved && saved.settings);
  let shoe = R.createShoe(), game = null, handNumber = stats.hands.length + 1;
  let tab = 'mesa', training = null, trainingStreak = { current: 0, best: 0, recent: [] };
  let countRunning = 0, countShown = false, confirmMode = '', shoeCount = 0;
  const allCards = () => shoe.cards.slice();
  const visibleCards = () => game ? game.dealer.slice(0, game.revealed ? game.dealer.length : 1) : [];
  const active = () => game && game.hands[game.active];
  const handTotalText = (cards) => {
    const t = R.total(cards);
    return (t.soft ? 'blando ' : '') + t.value;
  };
  function switchTab(name) {
    tab = name;
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.view').forEach((v) => {
      const on = v.id === 'view-' + name;
      v.hidden = !on;
      v.classList.toggle('active', on);
    });
    if (name === 'estadisticas') renderStats();
  }
  function cardHTML(card, hidden = false) {
    if (hidden) return '<span class="playing-card back" aria-label="Carta tapada">✦</span>';
    const red = ['♥', '♦'].includes(card.suit);
    return '<span class="playing-card ' + (red ? 'red' : '') + '"><b>' + card.rank + '</b><i>' + card.suit + '</i></span>';
  }
  function renderTable() {
    if (!game) return;
    $('balance').textContent = fmt(balance);
    $('wager-label').textContent = fmt(game.wager);
    $('last-result').textContent = stats.hands.length ? fmt(stats.hands[stats.hands.length - 1].profit) : '—';
    $('dealer-cards').innerHTML = game.dealer.map((c, i) => cardHTML(c, i === 1 && !game.revealed)).join('');
    $('dealer-total').textContent = game.revealed ? handTotalText(game.dealer) : '—';
    $('player-hands').innerHTML = game.hands.map((h, i) => {
      const t = R.total(h.cards);
      return '<div class="player-hand ' + (i === game.active && !game.done ? 'selected' : '') + '">' +
        '<div class="hand-title">Mano ' + (i + 1) + (i === game.active && !game.done ? ' · activa' : '') + '</div>' +
        '<div class="cards">' + h.cards.map((c) => cardHTML(c)).join('') + '</div>' +
        '<strong>' + (t.soft ? 'blando ' : '') + t.value + '</strong>' +
        (h.result ? '<span class="hand-outcome">' + h.result + '</span>' : '') + '</div>';
    }).join('');
    $('table-status').textContent = game.done ? game.summary : game.phase === 'deal' ? 'Preparando reparto…' : 'Tu decisión · mano ' + (game.active + 1);
    $('new-hand').hidden = !game.done;
    $('deal-controls').hidden = !game.done;
    $('actions').replaceChildren();
    if (!game.done && game.phase === 'player') renderActions();
    $('count-readout').hidden = !settings.count;
    if (settings.count) {
      const tc = COUNT.trueCount(game.runningCount, R.remaining(shoe));
      $('count-readout').textContent = 'Hi-Lo ' + (game.runningCount > 0 ? '+' : '') + game.runningCount +
        ' · real ' + (tc.count > 0 ? '+' : '') + tc.count + ' (' + tc.decks + ' barajas)';
    }
  }
  function button(label, action, primary = false) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'action-btn' + (primary ? ' primary' : '');
    b.textContent = label; b.addEventListener('click', () => act(action)); $('actions').append(b);
  }
  function renderActions() {
    const h = active(), legal = R.legalActions(h, game.splitCount, balance);
    for (const action of legal) button(labels[action], action, action === 'hit' || action === 'stand');
    if (game.dealer[0].rank === 'A' && !game.insuranceOffered) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'action-btn insurance'; b.textContent = 'Seguro (error)';
      b.addEventListener('click', () => act('insurance')); $('actions').append(b);
      game.insuranceOffered = true;
    }
  }
  function dealCard() {
    if (R.shouldReshuffle(shoe)) { shoe = R.createShoe(); shoeCount = 0; }
    const c = R.draw(shoe);
    shoeCount += COUNT.tag(c.rank);
    if (game) game.runningCount = shoeCount;
    return c;
  }
  function startHand() {
    if (game && !game.done) return;
    const wager = Math.min(Number($('bet-input').value) || 10, balance);
    if (wager <= 0) return;
    if (R.remaining(shoe) < 52 || R.shouldReshuffle(shoe)) { shoe = R.createShoe(); shoeCount = 0; }
    balance -= wager;
    game = { wager, dealer: [], hands: [{ cards: [], wager, stood: false, splitAces: false, doubled: false, decisions: [], profit: 0 }],
      active: 0, splitCount: 0, phase: 'deal', done: false, revealed: false, insuranceOffered: false,
      runningCount: 0, decisions: [], startedBalance: balance, summary: '' };
    game.dealer.push(dealCard());
    game.hands[0].cards.push(dealCard());
    game.dealer.push(dealCard());
    game.hands[0].cards.push(dealCard());
    game.phase = 'player';
    if (['A', '10', 'J', 'Q', 'K'].includes(game.dealer[0].rank) && R.isBlackjack(game.dealer)) {
      game.revealed = true;
      finishHand();
    } else if (R.isBlackjack(game.hands[0].cards)) {
      game.hands[0].stood = true;
      advanceHand();
    }
    renderTable();
  }
  function decision(action) {
    const h = active(), ranks = h.cards.map(rank);
    const legal = R.legalActions(h, game.splitCount, balance);
    const correct = S.bestAction(ranks, game.dealer[0].rank, { canDouble: legal.includes('double'), canSplit: legal.includes('split') });
    const evs = V.evaluate(ranks, game.dealer[0].rank, legal);
    const doubtful = E.isDoubtful(evs);
    const result = E.score({ chosen: action, correct, evs, doubtful });
    const item = { ranks, dealer: game.dealer[0].rank, action, correct, score: result.score, loss: result.loss,
      evs, doubtful, category: S.category(ranks), hand: handNumber };
    h.decisions.push(item); game.decisions.push(item); stats.decisions.push(item);
    if (Number.isFinite(result.loss)) stats.evLost = (stats.evLost || 0) + result.loss * h.wager;
    if (action === 'insurance') {
      item.score = 0; item.loss = null;
      showFeedback(item, h);
      return;
    }
    showFeedback(item, h);
    return item;
  }
  function showFeedback(item, h) {
    if (settings.feedback === 'end') return;
    const host = $('feedback');
    host.hidden = false;
    host.innerHTML = '<strong>' + (item.action === item.correct ? '✓ Correcto' : '✗ ' + labels[item.correct] + ' era la referencia') +
      ' · ' + item.score + '/100</strong><button type="button" class="why-toggle">Por qué</button><div class="why-content" hidden></div>';
    host.querySelector('.why-toggle').addEventListener('click', () => {
      const content = host.querySelector('.why-content');
      content.hidden = !content.hidden;
      if (!content.dataset.ready) {
        content.innerHTML = '<ul>' + C.why({ ranks: item.ranks, dealerUp: item.dealer, legal: [], chosen: item.action,
          correct: item.correct, evs: item.evs }).map((line) => '<li>' + line + '</li>').join('') + '</ul>';
        content.dataset.ready = '1';
      }
    });
  }
  function act(action) {
    if (!game || game.done || game.phase !== 'player') return;
    const h = active();
    const item = decision(action);
    if (action === 'insurance') {
      game.insuranceOffered = true;
      renderTable();
      return;
    }
    if (action === 'hit') {
      h.cards.push(dealCard());
      if (R.isBust(h.cards)) { h.stood = true; h.result = 'Pasada'; advanceHand(); }
    } else if (action === 'stand') {
      h.stood = true; advanceHand();
    } else if (action === 'double') {
      balance -= h.wager; h.wager *= 2; h.doubled = true;
      h.cards.push(dealCard()); h.stood = true; advanceHand();
    } else if (action === 'split') {
      balance -= h.wager;
      const first = h.cards[0], second = h.cards[1];
      const a = { cards: [first, dealCard()], wager: h.wager, stood: first.rank === 'A', splitAces: first.rank === 'A', doubled: false, decisions: [] };
      const b = { cards: [second, dealCard()], wager: h.wager, stood: second.rank === 'A', splitAces: second.rank === 'A', doubled: false, decisions: [] };
      game.hands.splice(game.active, 1, a, b); game.splitCount++;
      if (a.splitAces && b.splitAces) advanceHand();
    }
    if (item && settings.feedback === 'end') $('feedback').hidden = true;
    renderTable();
  }
  function advanceHand() {
    while (game.active < game.hands.length && (game.hands[game.active].stood || R.isBust(game.hands[game.active].cards))) game.active++;
    if (game.active >= game.hands.length) finishHand();
  }
  function finishHand() {
    game.phase = 'dealer'; game.revealed = true;
    if (!game.hands.every((h) => R.isBust(h.cards)) && !R.isBlackjack(game.dealer)) R.playDealer(game.dealer, shoe);
    let totalProfit = 0;
    for (const h of game.hands) {
      const result = R.settle(h.cards, game.dealer, h.wager, { blackjackEligible: !h.splitAces && game.hands.length === 1 });
      // La apuesta inicial ya salió del saldo; el beneficio neto se añade y la devolución de apuesta ganadora también.
      const returned = result.profit > 0 ? h.wager + result.profit : result.profit === 0 ? h.wager : 0;
      balance += returned;
      h.profit = result.profit; h.result = result.outcome;
      totalProfit += result.profit;
    }
    const score = E.handScore(game.decisions);
    game.done = true; game.phase = 'done';
    game.summary = 'Resultado ' + fmt(totalProfit) + ' fichas · nota ' + fmt(score) + '/100';
    stats.result = (stats.result || 0) + totalProfit;
    stats.hands.push({ number: handNumber, dealer: game.dealer.map(rank), hands: game.hands.map((h) => h.cards.map(rank)),
      decisions: game.decisions, profit: totalProfit, score, summary: game.summary });
    stats.hands = stats.hands.slice(-50);
    handNumber++; safeSave(); renderTable();
    $('hand-summary').hidden = false;
    $('hand-summary').textContent = game.summary + ' · ' + game.hands.map((h, i) => 'Mano ' + (i + 1) + ': ' + h.result).join(' · ');
    if (settings.feedback === 'end') {
      $('feedback').hidden = false;
      $('feedback').innerHTML = '<strong>Resumen de decisiones · ' + fmt(score) + '/100</strong>' +
        game.decisions.map((d) => '<p>' + labels[d.action] + ': ' + d.score + '/100 · correcta: ' + labels[d.correct] + '</p>').join('');
    }
  }
  function renderTraining() {
    if (!training) return;
    $('training-hand').textContent = training.ranks.join(' + ') + ' contra ' + training.dealer;
    $('training-total').textContent = handTotalText(training.ranks.map((rank) => ({ rank })));
    $('training-actions').replaceChildren();
    training.legal.forEach((a) => {
      const b = document.createElement('button'); b.className = 'action-btn'; b.textContent = labels[a];
      b.addEventListener('click', () => answerTraining(a)); $('training-actions').append(b);
    });
    $('training-feedback').hidden = true;
    $('training-next').hidden = true;
  }
  function randomSpot() {
    const types = $('training-type').value;
    let ranks;
    if (types === 'parejas') { const r = random(['2','3','4','5','6','7','8','9','10','A']); ranks = [r, r]; }
    else if (types === 'blandas') ranks = ['A', random(['2','3','4','5','6','7','8','9'])];
    else ranks = [random(['2','3','4','5','6','7','8','9','10']), random(['2','3','4','5','6','7','8','9','10'])];
    const dealer = $('training-dealer').value === 'all' ? random(S.DEALER) : $('training-dealer').value;
    const legal = ['hit', 'stand'];
    if (ranks.length === 2) legal.push('double');
    if (ranks.length === 2 && ranks[0] === ranks[1]) legal.push('split');
    const correct = S.bestAction(ranks, dealer, { canDouble: legal.includes('double'), canSplit: legal.includes('split') });
    const evs = V.evaluate(ranks, dealer, legal);
    return { ranks, dealer, legal, correct, evs, doubtful: E.isDoubtful(evs) };
  }
  function nextTraining() {
    let spot, attempts = 0;
    do { spot = randomSpot(); attempts++; }
    while ((($('training-doubtful').checked && !spot.doubtful) ||
      ($('training-type').value === 'repasar' && !stats.decisions.some((d) => d.score < 100 &&
        d.ranks.join(',') === spot.ranks.join(',') && d.dealer === spot.dealer))) && attempts < 300);
    training = spot; renderTraining();
  }
  function answerTraining(action) {
    if (!training || training.answered) return;
    training.answered = true;
    const result = E.score({ chosen: action, correct: training.correct, evs: training.evs, doubtful: training.doubtful });
    const item = { ranks: training.ranks, dealer: training.dealer, action, correct: training.correct, score: result.score,
      loss: result.loss, evs: training.evs, doubtful: training.doubtful, category: S.category(training.ranks), hand: 'training' };
    stats.decisions.push(item);
    trainingStreak.current = result.score === 100 ? trainingStreak.current + 1 : 0;
    trainingStreak.best = Math.max(trainingStreak.best, trainingStreak.current);
    trainingStreak.recent.push(result.score); trainingStreak.recent = trainingStreak.recent.slice(-20);
    $('training-streak').textContent = 'Racha ' + trainingStreak.current + ' · mejor ' + trainingStreak.best +
      ' · media últimas 20: ' + fmt(trainingStreak.recent.reduce((a,b)=>a+b,0) / trainingStreak.recent.length) + '/100';
    $('training-feedback').hidden = false;
    $('training-feedback').innerHTML = '<strong>' + (action === training.correct ? '✓ Correcto' : '✗ ' + labels[training.correct] + ' era la referencia') +
      ' · ' + result.score + '/100</strong><button type="button" class="why-toggle">Por qué</button><div class="why-content" hidden></div>' +
      '<button type="button" class="why-toggle table-toggle">Ver tabla</button><div class="strategy-table" hidden></div>';
    const why = $('training-feedback').querySelector('.why-content');
    $('training-feedback').querySelector('.why-toggle').addEventListener('click', () => {
      why.hidden = !why.hidden;
      if (!why.dataset.ready) { why.innerHTML = '<ul>' + C.why({ ranks: item.ranks, dealerUp: item.dealer, correct: item.correct, chosen: item.action, evs: item.evs }).map((s) => '<li>' + s + '</li>').join('') + '</ul>'; why.dataset.ready = '1'; }
    });
    const table = $('training-feedback').querySelector('.strategy-table');
    $('training-feedback').querySelector('.table-toggle').addEventListener('click', () => {
      table.hidden = !table.hidden;
      if (!table.dataset.ready) { table.innerHTML = renderStrategyTable(item); table.dataset.ready = '1'; }
    });
    $('training-next').hidden = false; safeSave();
  }
  function renderStrategyTable(spot) {
    const col = S.DEALER.indexOf(S.dealerKey(spot.dealer));
    const rows = [];
    for (const [name, values] of Object.entries({ ...S.HARD, ...Object.fromEntries(Object.entries(S.SOFT).map(([k,v]) => ['A+' + (Number(k)-11),v])), ...Object.fromEntries(Object.entries(S.PAIRS).map(([k,v]) => [k+'+'+k,v])) })) {
      const selected = values[col];
      rows.push('<tr class="' + (String(name) === String(spot.ranks[0]) ? 'highlight' : '') + '"><th>' + name + '</th>' +
        values.map((v, i) => '<td class="' + (i === col ? 'spot-cell' : '') + '" aria-label="' + v + '">' + v + '</td>').join('') + '</tr>');
    }
    return '<div class="table-scroll"><table class="strategy-grid"><thead><tr><th>Mano</th>' + S.DEALER.map((d) => '<th>' + d + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div><p>H pedir · S plantarse · D doblar · Ds doblar/plantarse · P separar. Celda resaltada: carta visible ' + spot.dealer + '.</p>';
  }
  function renderStats() {
    const ds = stats.decisions, avg = ds.length ? ds.reduce((a,d)=>a+d.score,0)/ds.length : 0;
    $('stat-decisions').textContent = ds.length;
    $('stat-accuracy').textContent = fmt(avg) + '/100';
    $('stat-result').textContent = fmt(stats.result || 0);
    $('stat-ev').textContent = fmt(stats.evLost || 0);
    const categories = ['duras','blandas','parejas'];
    $('stats-types').innerHTML = categories.map((type) => {
      const list = ds.filter((d) => d.category === type);
      return '<p>' + type + ': ' + (list.length ? fmt(list.reduce((a,d)=>a+d.score,0)/list.length) + '/100 (' + list.length + ')' : '—') + '</p>';
    }).join('');
    $('stats-dealer').innerHTML = S.DEALER.map((up) => {
      const list = ds.filter((d) => d.dealer === up);
      return '<p>' + up + ': ' + (list.length ? fmt(list.reduce((a,d)=>a+d.score,0)/list.length) + '/100' : '—') + '</p>';
    }).join('');
    $('stats-actions').innerHTML = Object.keys(labels).map((a) => {
      const list = ds.filter((d) => d.action === a);
      return '<p>' + labels[a] + ': ' + (list.length ? fmt(list.reduce((s,d)=>s+d.score,0)/list.length) + '/100 (' + list.length + ')' : '—') + '</p>';
    }).join('');
    const leaks = [...ds].filter((d)=>d.loss>0).sort((a,b)=>b.loss-a.loss).slice(0,10);
    $('stats-leaks').innerHTML = leaks.length ? leaks.map((d)=>'<p>' + d.ranks.join('+') + ' vs ' + d.dealer + ': ' + labels[d.action] + ' → ' + labels[d.correct] + ' · EV perdido ' + fmt(d.loss) + '</p>').join('') : '<p>Aún no hay fugas registradas.</p>';
    $('stats-history').innerHTML = stats.hands.slice().reverse().map((h)=>'<details><summary>Mano ' + h.number + ' · ' + fmt(h.profit) + ' fichas · ' + fmt(h.score) + '/100</summary><p>Crupier: ' + h.dealer.join(' ') + '</p>' + h.hands.map((hand,i)=>'<p>Mano ' +(i+1)+': '+hand.join(' ')+'</p>').join('')+'</details>').join('');
  }
  function exportSummary() {
    return 'Blackjack de Estudio\nDecisiones: ' + stats.decisions.length + '\nNota media: ' +
      (stats.decisions.length ? fmt(stats.decisions.reduce((a,d)=>a+d.score,0)/stats.decisions.length) : '—') +
      '\nResultado: ' + fmt(stats.result || 0) + ' fichas\nEV perdido: ' + fmt(stats.evLost || 0) +
      '\nFugas: ' + stats.decisions.filter((d)=>d.loss>0).slice(-20).map((d)=>d.ranks.join('+')+' vs '+d.dealer+' '+labels[d.action]+' (correcta '+labels[d.correct]+')').join('; ');
  }
  function countTraining() {
    const ranks = Array.from({ length: 30 }, () => random(['A','2','3','4','5','6','7','8','9','10']));
    const output = $('count-cards'); output.replaceChildren();
    let i = 0, count = 0;
    if (countRunning) clearInterval(countRunning);
    $('count-answer').hidden = true; $('count-check').hidden = true;
    countRunning = setInterval(() => {
      if (i >= ranks.length) {
        clearInterval(countRunning); countRunning = 0;
        $('count-answer').hidden = false; $('count-check').hidden = false; return;
      }
      const r = ranks[i++]; count += COUNT.tag(r);
      output.textContent = ranks.slice(0,i).join(' · ');
    }, settings.countSpeed);
    $('count-check').onclick = () => {
      const running = Number($('count-running-input').value);
      const remainingDecks = Math.max(0.5, Number($('count-decks-input').value) || 3);
      const real = Math.round((running / remainingDecks) * 10) / 10;
      $('count-result').textContent = 'Conteo corrido: ' + (running === count ? 'correcto' : 'era ' + count) +
        ' · Conteo real: ' + real + ' (con ' + remainingDecks + ' barajas restantes).';
    };
    $('count-cards').dataset.expected = String(count);
  }
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('new-hand').addEventListener('click', startHand);
  $('deal-button').addEventListener('click', startHand);
  $('bet-input').addEventListener('change', () => { $('bet-input').value = Math.max(1, Number($('bet-input').value) || 10); });
  document.querySelectorAll('[data-bet]').forEach((b)=>b.addEventListener('click',()=>{$('bet-input').value=b.dataset.bet;}));
  $('feedback-mode').value = settings.feedback;
  $('feedback-mode').addEventListener('change', (e)=>{settings.feedback=e.target.value;safeSave();});
  $('show-count').checked = settings.count;
  $('show-count').addEventListener('change',(e)=>{settings.count=e.target.checked;renderTable();safeSave();});
  $('deal-speed').value = settings.dealSpeed;
  $('deal-speed').addEventListener('change',(e)=>{settings.dealSpeed=Number(e.target.value);safeSave();});
  $('count-speed').value = settings.countSpeed;
  $('count-speed').addEventListener('change',(e)=>{settings.countSpeed=Number(e.target.value);safeSave();});
  $('reset-balance').addEventListener('click',()=>{confirmMode='balance';$('confirm-area').hidden=false;$('confirm-text').textContent='¿Reiniciar saldo a 1.000 fichas?';});
  $('clear-stats').addEventListener('click',()=>{confirmMode='stats';$('confirm-area').hidden=false;$('confirm-text').textContent='¿Borrar estadísticas e historial?';});
  $('confirm-yes').addEventListener('click',()=>{if(confirmMode==='balance')balance=1000;else if(confirmMode==='stats')stats={decisions:[],hands:[],result:0,evLost:0};$('confirm-area').hidden=true;safeSave();renderTable();renderStats();});
  $('confirm-no').addEventListener('click',()=>{$('confirm-area').hidden=true;});
  $('copy-summary').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(exportSummary());$('export-message').textContent='Resumen copiado.';}catch(_){$('export-message').textContent='No se pudo copiar; selecciona el texto.';$('export-text').hidden=false;$('export-text').value=exportSummary();}});
  $('export-json').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({balance,stats,settings},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='blackjack-estudio-estadisticas.json';a.click();URL.revokeObjectURL(url);});
  $('training-next').addEventListener('click',nextTraining);
  $('training-deal').addEventListener('click',nextTraining);
  $('count-start').addEventListener('click',countTraining);
  window.addEventListener('keydown',(event)=>{
    if (event.target.matches('input,textarea,select')) return;
    const map={h:'hit',p:'hit',s:'stand',d:'double',x:'split',n:'new'};
    const action=map[event.key.toLowerCase()];
    if(action && tab==='mesa'){event.preventDefault();if(action==='new'){if(game&&game.done)startHand();}else act(action);}
    if(event.key==='Enter'&&tab==='mesa'){if(game&&game.done)startHand();else if(!game)startHand();}
  });
  renderTable(); renderStats();
  $('new-hand').hidden = true;
  $('deal-controls').hidden = false;
})();
