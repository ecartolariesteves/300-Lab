/* Interfaz de Spider: selección, arrastre, pistas, deshacer y récords. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const R = window.SpiderRules;
let state, history = [], selected = null, seconds = 0, timer = null, won = false, hint = null;
const clone = value => JSON.parse(JSON.stringify(value));
const fmt = n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
function safeRead() { try { return JSON.parse(localStorage.getItem('spider-best') || '{}'); } catch (_) { return {}; } }
function safeWrite(data) { try { localStorage.setItem('spider-best', JSON.stringify(data)); } catch (_) {} }
function save() { history.push({state:clone(state),seconds}); if (history.length > 250) history.shift(); }
function startClock() { if (!timer && !won) timer = setInterval(() => { seconds++; $('timer').textContent = fmt(seconds); }, 1000); }
function stopClock() { clearInterval(timer); timer = null; }
function renderBest() {
  const best = safeRead();
  $('best').innerHTML = [1,2,4].map(n => '<div><dt>' + n + ' palo' + (n > 1 ? 's' : '') + '</dt><dd>' + (best[n] == null ? '—' : fmt(best[n])) + '</dd></div>').join('');
}
function newGame() {
  stopClock(); state = R.newGame(+$('difficulty').value); history = []; selected = null; seconds = 0; won = false; hint = null;
  $('timer').textContent = '0:00'; $('overlay').hidden = true; $('message').textContent = ''; render();
}
function render() {
  const root = $('columns'); root.replaceChildren();
  state.columns.forEach((col, ci) => {
    const pile = document.createElement('div'); pile.className = 'spider-col'; pile.dataset.col = ci; pile.setAttribute('aria-label','Columna ' + (ci + 1));
    col.forEach((card, i) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'playing-card' + (!card.faceUp ? ' back' : '') + ('♥♦'.includes(card.suit) ? ' red' : '');
      b.style.zIndex = i + 1; b.dataset.col = ci; b.dataset.index = i;
      b.textContent = card.faceUp ? (['','A','2','3','4','5','6','7','8','9','10','J','Q','K'][card.rank] + card.suit) : ' ';
      b.setAttribute('aria-label', card.faceUp ? (b.textContent + ', columna ' + (ci + 1)) : 'Carta boca abajo');
      if (selected && selected.col === ci && i >= selected.index) b.classList.add('selected');
      if (hint && hint.from === ci && i === hint.index) b.classList.add('hint');
      if (hint && hint.to === ci) pile.classList.add('drop-target');
      if (!card.faceUp) b.disabled = true;
      pile.append(b);
    });
    root.append(pile);
  });
  $('moves').textContent = state.moves; $('runs').textContent = state.completed + ' / 8'; $('stock').textContent = state.stock.length;
  $('deal').disabled = !state.stock.length;
  $('undo').disabled = !history.length || won;
  renderBest();
}
function attemptMove(from,index,to) {
  if (!R.canMove(state,from,index,to)) return false;
  save(); R.move(state,from,index,to); selected = null; hint = null; startClock(); render(); finishIfWon(); return true;
}
function finishIfWon() {
  if (!R.isWon(state)) return;
  won = true; stopClock();
  const best = safeRead(), key = state.difficulty, record = best[key] == null || seconds < best[key];
  if (record) { best[key] = seconds; safeWrite(best); }
  $('result').textContent = state.moves + ' movimientos · ' + fmt(seconds) + (record ? ' · ¡Nuevo récord!' : '');
  $('overlay').hidden = false; renderBest();
}
function selectCard(col,index) {
  const card = state.columns[col][index]; if (!card || !card.faceUp || won) return;
  hint = null;
  if (selected) {
    if (selected.col === col && selected.index === index) { autoMove(); return; }
    if (attemptMove(selected.col,selected.index,col)) return;
    selected = {col,index};
  } else selected = {col,index};
  autoMove();
  render();
}
// Valora un movimiento: mejor si cae sobre el mismo palo o destapa una carta; inútil si solo cambia de sitio
function moveScore(from,index,to) {
  const src = state.columns[from], dst = state.columns[to], card = src[index], top = dst.at(-1), below = src[index - 1];
  if (!top && index === 0) return -1;                                   // columna entera a otra vacía: no aporta nada
  if (below && below.faceUp && below.rank === card.rank + 1 && (below.suit === card.suit || !top || top.suit !== card.suit)) return -1;  // ya estaba bien colocada
  let score = 0;
  if (top && top.suit === card.suit) score += 3;                        // forma una secuencia del mismo palo
  if (below && !below.faceUp) score += 2;                               // destapa una carta
  if (index === 0) score += 1;                                          // deja una columna libre
  if (!top) score -= 1;                                                 // gastar una columna vacía es caro
  return score;
}
function autoMove() {
  if (!selected) return;
  const {col,index} = selected;
  // Preferimos el destino del mismo palo, luego cualquier carta y por último una columna vacía
  const candidates = state.columns.map((pile,to) => ({to,top:pile.at(-1)}))
    .filter(x => R.canMove(state,col,index,x.to))
    .sort((a,b) => {
      const rank = x => !x.top ? 2 : x.top.suit === state.columns[col][index].suit ? 0 : 1;
      return rank(a) - rank(b);
    });
  if (candidates.length) attemptMove(col,index,candidates[0].to);
}
function showHint() {
  hint = null;
  // Recorremos todos los movimientos legales y nos quedamos con el más útil
  let bestScore = -1;
  for (let from=0;from<10;from++) {
    const col=state.columns[from];
    for(let i=0;i<col.length;i++) if(col[i].faceUp && R.validRun(col.slice(i))) {
      for(let to=0;to<10;to++) if(R.canMove(state,from,i,to)) {
        const score = moveScore(from,i,to);
        if (score > bestScore) { bestScore = score; hint={from,index:i,to}; }
      }
    }
  }
  if (hint) { selected={col:hint.from,index:hint.index}; $('message').textContent='Prueba a mover la secuencia resaltada.'; }
  else $('message').textContent = state.stock.length ? 'No hay movimientos útiles: reparte.' : 'No quedan movimientos ni cartas en el mazo.';
  render();
}
$('columns').addEventListener('click', e => {
  const card=e.target.closest('.playing-card'), col=e.target.closest('.spider-col');
  if (!col) return;
  const to=+col.dataset.col;
  if (card) selectCard(+card.dataset.col,+card.dataset.index);
  else if (selected) { if (!attemptMove(selected.col,selected.index,to)) $('message').textContent='Ese movimiento no es válido.'; }
});
$('columns').addEventListener('pointerdown', e => {
  const card=e.target.closest('.playing-card'); if (!card || card.disabled || won) return;
  card.setPointerCapture?.(e.pointerId);
  card.dataset.dragX=e.clientX; card.dataset.dragY=e.clientY;
});
$('columns').addEventListener('pointerup', e => {
  const card=e.target.closest('.playing-card'); if (!card || !card.dataset.dragX) return;
  const dx=e.clientX-Number(card.dataset.dragX),dy=e.clientY-Number(card.dataset.dragY);
  delete card.dataset.dragX; delete card.dataset.dragY;
  if(Math.hypot(dx,dy)<12)return;
  const under=document.elementFromPoint(e.clientX,e.clientY)?.closest('.spider-col');
  if(under) { selected={col:+card.dataset.col,index:+card.dataset.index}; if(!attemptMove(selected.col,selected.index,+under.dataset.col)) render(); }
});
$('deal').addEventListener('click', () => {
  if (state.columns.some(c=>!c.length)) { $('message').textContent='Rellena las columnas vacías antes de repartir'; return; }
  if (!state.stock.length) return;
  save(); R.deal(state); selected=null; hint=null; startClock(); $('message').textContent=''; render(); finishIfWon();
});
$('undo').addEventListener('click', () => { const last=history.pop(); if(!last)return; state=last.state; seconds=last.seconds; selected=null; hint=null; $('timer').textContent=fmt(seconds); render(); });
$('hint').addEventListener('click',showHint); $('new').addEventListener('click',newGame); $('again').addEventListener('click',newGame);
$('difficulty').addEventListener('change',newGame);
document.addEventListener('keydown',e => {
  if (e.key==='Escape') { selected=null; hint=null; render(); }
  if (e.key==='Enter' && selected) autoMove();
  if (e.key==='ArrowLeft'||e.key==='ArrowRight') {
    const next=Math.max(0,Math.min(9,(selected?.col ?? 0)+(e.key==='ArrowRight'?1:-1)));
    selected={col:next,index:Math.max(0,state.columns[next].length-1)}; render(); e.preventDefault();
  }
});
renderBest(); newGame();
})();
