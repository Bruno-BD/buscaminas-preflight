(function (root) {
  'use strict';
  const initialMessage = 'Elegí una casilla. El primer descubrimiento es seguro.';
  const symbols = {
    flag: '<path d="M8 25V5m0 1h15l-4 5 4 5H8M4 26h9"/>',
    mine: '<circle cx="16" cy="16" r="7"/><path d="M16 3v5m0 16v5M3 16h5m16 0h5M6 6l4 4m12 12 4 4M6 26l4-4M22 10l4-4"/>',
    blast: '<path d="m16 2 3 8 8-5-4 9 7 4-9 2 2 10-7-7-7 6 1-10-8-3 9-3-2-9z"/>',
    wrong: '<path d="M8 25V5m0 1h15l-4 5 4 5H8M4 26h9M3 3l26 26M29 3 3 29"/>'
  };
  function icon(kind) { return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${symbols[kind]}</svg>`; }
  function cellView(cell, index, state) {
    const prefix = `Fila ${Math.floor(index / 9) + 1}, columna ${index % 9 + 1}, `;
    if (state.status === 'lost') {
      if (index === state.detonated) return { className: 'cell mine detonated', label: prefix + 'mina detonada', html: icon('blast') };
      if (cell.flag && !cell.mine) return { className: 'cell wrong', label: prefix + 'bandera incorrecta', html: icon('wrong') };
      if (cell.mine) return { className: 'cell mine', label: prefix + (cell.flag ? 'mina con bandera' : 'mina'), html: icon('mine') };
    }
    if (cell.open) return { className: 'cell open', label: prefix + (cell.count ? `descubierta, ${cell.count} minas vecinas` : 'descubierta, sin minas vecinas'), html: cell.count ? String(cell.count) : '' };
    return { className: 'cell', label: prefix + (cell.flag ? 'con bandera' : 'cubierta'), html: cell.flag ? icon('flag') : '' };
  }
  function nextFocus(index, key) {
    const row = Math.floor(index / 9), col = index % 9;
    return { ArrowLeft: col > 0 ? index - 1 : index, ArrowRight: col < 8 ? index + 1 : index, ArrowUp: row > 0 ? index - 9 : index, ArrowDown: row < 8 ? index + 9 : index }[key];
  }
  function mount(doc, engine, clock = Date.now, schedule = setInterval) {
    const get = id => doc.getElementById(id);
    const board = get('board'), status = get('status'), actions = get('actions'), dialog = get('restart-dialog');
    const modes = Array.from(doc.querySelectorAll('input[name="mode"]'));
    let state = engine.newGame(), mode = 'reveal', focused = 0, failed = false;
    const buttons = [];
    for (let r = 0; r < 9; r++) {
      const row = doc.createElement('div'); row.className = 'board-row'; row.setAttribute('role', 'row'); row.setAttribute('aria-rowindex', r + 1);
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c, cell = doc.createElement('div'), button = doc.createElement('button');
        cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-colindex', c + 1);
        button.type = 'button'; button.tabIndex = i === 0 ? 0 : -1;
        button.addEventListener('focus', () => { buttons[focused].tabIndex = -1; focused = i; button.tabIndex = 0; });
        button.addEventListener('click', () => play(i, mode));
        button.addEventListener('contextmenu', event => { event.preventDefault(); button.focus(); play(i, 'flag'); });
        button.addEventListener('keydown', event => {
          const target = nextFocus(i, event.key);
          if (target !== undefined) { event.preventDefault(); buttons[target].focus(); }
          // Native buttons emit one click for Enter/Space. Ignore held-key repeats.
          else if ((event.key === 'Enter' || event.key === ' ') && event.repeat) event.preventDefault();
        });
        buttons.push(button); cell.appendChild(button); row.appendChild(cell);
      }
      board.appendChild(row);
    }
    function updateTime() {
      const value = engine.formatTime(engine.elapsed(state, clock()));
      get('time').textContent = value; get('time').setAttribute('aria-label', `Tiempo transcurrido: ${value}`);
    }
    function render() {
      const finished = state.status === 'won' || state.status === 'lost' || failed;
      actions.disabled = finished;
      get('flags').textContent = String(10 - state.flags);
      buttons.forEach((button, i) => {
        const view = cellView(state.cells[i], i, state);
        button.className = view.className; button.innerHTML = view.html; button.setAttribute('aria-label', view.label);
        button.setAttribute('aria-disabled', String(finished || state.cells[i].open));
      });
      updateTime();
    }
    function play(index, type) {
      if (failed || dialog.open || state.status === 'won' || state.status === 'lost') return;
      try {
        const result = engine.act(state, { index, type }, { now: clock() }); state = result.state;
        const messages = {
          won: '¡Ganaste! Descubriste todas las casillas seguras.', lost: 'Fin de la partida. Descubriste una mina.',
          'already-open': 'Esta casilla ya está descubierta.', flagged: 'Quitá la bandera antes de descubrir esta casilla.',
          'flag-limit': 'No quedan banderas disponibles. Quitá una para marcar otra casilla.',
          'flag-added': 'Bandera colocada.', 'flag-removed': 'Bandera quitada.'
        };
        status.textContent = messages[result.event] || (result.opened > 1 ? `Se descubrieron ${result.opened} casillas. Partida en curso.` : 'Partida en curso.');
        render();
      } catch (error) {
        failed = true; status.textContent = 'No se pudo continuar la partida. Iniciá una nueva partida.';
        actions.disabled = true; buttons.forEach(button => button.setAttribute('aria-disabled', 'true'));
        console.error(error);
      }
    }
    function setMode(value) {
      mode = value; modes.forEach(input => { input.checked = input.value === value; });
      get('instruction').textContent = value === 'flag' ? 'Tocá o hacé clic para poner o quitar una bandera.' : 'Tocá o hacé clic para descubrir.';
    }
    modes.forEach(input => input.addEventListener('change', () => { if (!actions.disabled && input.checked) setMode(input.value); }));
    function restart() {
      state = engine.newGame(); failed = false; setMode('reveal'); status.textContent = initialMessage; render(); buttons[0].focus();
    }
    get('new-game').addEventListener('click', () => {
      if (state.status === 'playing' && !failed) { dialog.showModal(); get('cancel-restart').focus(); }
      else restart();
    });
    get('cancel-restart').addEventListener('click', () => { dialog.close(); get('new-game').focus(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); get('new-game').focus(); });
    get('confirm-restart').addEventListener('click', () => { dialog.close(); restart(); });
    doc.addEventListener('visibilitychange', updateTime);
    render(); schedule(updateTime, 250);
  }
  const api = { mount, cellView, nextFocus };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.MinesApp = api; mount(root.document, root.MinesEngine); }
})(typeof globalThis === 'object' ? globalThis : this);
