/* Demos interactivas del tutorial de Buscaminas.
   Usan exactamente la misma lógica que se explica en cada paso. */

/* ---------- Demo 1: índices y vecinas ---------- */
(function () {
  const rows = 6, cols = 6;
  const grid = document.getElementById('demo-vecinas');
  const out = document.getElementById('demo-vecinas-out');
  if (!grid) return;

  // La misma función del paso 2
  function neighbors(i) {
    const r = Math.floor(i / cols), c = i % cols;
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push(nr * cols + nc);
      }
    }
    return result;
  }

  grid.style.setProperty('--cols', cols);
  for (let i = 0; i < rows * cols; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = i;
    b.setAttribute('aria-label', 'Casilla ' + i);
    grid.appendChild(b);
  }

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const i = [...grid.children].indexOf(btn);
    const nb = neighbors(i);
    [...grid.children].forEach((b, k) => {
      b.className = k === i ? 'sel' : nb.includes(k) ? 'nb' : '';
    });
    out.innerHTML =
      `índice <b>${i}</b> → fila <b>${Math.floor(i / cols)}</b>, columna <b>${i % cols}</b><br>` +
      `${nb.length} vecinas: ${nb.join(', ')}`;
  });
})();

/* ---------- Demo 2: abrir en cadena (flood fill) ---------- */
(function () {
  const rows = 8, cols = 8;
  const grid = document.getElementById('demo-flood');
  const out = document.getElementById('demo-flood-out');
  const resetBtn = document.getElementById('demo-flood-reset');
  if (!grid) return;

  // Minas fijas para que la demo siempre sea igual
  const MINES = [5, 13, 22, 30, 31, 41, 50, 58];
  let cells, busy;

  function neighbors(i) {
    const r = Math.floor(i / cols), c = i % cols;
    const result = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push(nr * cols + nc);
      }
    return result;
  }

  function setup() {
    busy = false;
    cells = Array.from({ length: rows * cols }, (_, i) => ({ mine: MINES.includes(i), count: 0, open: false }));
    cells.forEach((cell, i) => { cell.count = neighbors(i).filter((n) => cells[n].mine).length; });
    grid.replaceChildren();
    grid.style.setProperty('--cols', cols);
    for (let i = 0; i < cells.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Casilla ' + i);
      grid.appendChild(b);
    }
    out.innerHTML = 'Toca una casilla. Prueba en la esquina de abajo a la izquierda.';
  }

  function paint(i) {
    const c = cells[i], b = grid.children[i];
    if (c.mine) { b.className = 'mine'; b.textContent = '✱'; return; }
    b.className = 'open' + (c.count ? ' n' + c.count : '');
    b.textContent = c.count || '';
  }

  // El mismo algoritmo del paso 5, pero abriendo una casilla cada 45 ms para verlo
  function openCell(i) {
    if (busy || cells[i].open) return;
    if (cells[i].mine) {
      cells[i].open = true;
      paint(i);
      out.innerHTML = '<b>¡Mina!</b> En el juego real aquí terminaría la partida.';
      return;
    }
    busy = true;
    const stack = [i];
    let opened = 0;
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 45;

    function tick() {
      while (stack.length) {
        const k = stack.pop();
        const c = cells[k];
        if (c.open) continue;
        c.open = true;
        opened++;
        paint(k);
        if (c.count === 0) stack.push(...neighbors(k));
        out.innerHTML = `Abiertas: <b>${opened}</b> · En la pila: <b>${stack.length}</b>`;
        if (delay) return setTimeout(tick, delay);
      }
      busy = false;
      out.innerHTML = `Abiertas: <b>${opened}</b> · Pila vacía, la cadena ha terminado.`;
    }
    tick();
  }

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) openCell([...grid.children].indexOf(btn));
  });
  resetBtn.addEventListener('click', setup);
  setup();
})();
