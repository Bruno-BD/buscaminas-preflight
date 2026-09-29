(function (root) {
  'use strict';
  const SIZE = 9, MINES = 10, TOTAL = SIZE * SIZE;
  function neighbors(index) {
    const cells = [], row = Math.floor(index / SIZE), col = index % SIZE;
    for (let r = Math.max(0, row - 1); r <= Math.min(SIZE - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(SIZE - 1, col + 1); c++) {
        if (r !== row || c !== col) cells.push(r * SIZE + c);
      }
    }
    return cells;
  }
  function generateMines(first, random = Math.random) {
    const choices = Array.from({ length: TOTAL }, (_, i) => i).filter(i => i !== first);
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices.slice(0, MINES);
  }
  function newGame() {
    return { cells: Array.from({ length: TOTAL }, () => ({ open: false, flag: false, mine: false, count: 0 })), status: 'ready', startedAt: null, endedAt: null, opened: 0, flags: 0, detonated: null };
  }
  // Inputs (time and mine factory) are explicit, so tests need no browser or debug UI.
  function act(state, action, { now = Date.now(), mineFactory = generateMines } = {}) {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i >= TOTAL) throw new RangeError('Invalid cell');
    if (state.status === 'won' || state.status === 'lost') return { state, event: 'finished', opened: 0 };
    if (state.cells[i].open) return { state, event: 'already-open', opened: 0 };
    if (action.type !== 'flag' && action.type !== 'reveal') throw new Error('Invalid action');
    if (action.type === 'reveal' && state.cells[i].flag) return { state, event: 'flagged', opened: 0 };
    if (action.type === 'flag' && !state.cells[i].flag && state.flags === MINES) return { state, event: 'flag-limit', opened: 0 };
    const next = { ...state, cells: state.cells.map(cell => ({ ...cell })) };
    if (action.type === 'flag') {
      next.cells[i].flag = !next.cells[i].flag;
      next.flags += next.cells[i].flag ? 1 : -1;
      return { state: next, event: next.cells[i].flag ? 'flag-added' : 'flag-removed', opened: 0 };
    }
    if (next.status === 'ready') {
      const mines = mineFactory(i);
      if (!Array.isArray(mines) || mines.length !== MINES || new Set(mines).size !== MINES || mines.some(m => !Number.isInteger(m) || m < 0 || m >= TOTAL || m === i)) throw new Error('Invalid mine layout');
      mines.forEach(m => { next.cells[m].mine = true; });
      next.cells.forEach((cell, index) => { cell.count = neighbors(index).filter(n => next.cells[n].mine).length; });
      next.startedAt = now;
      next.status = 'playing';
    }
    if (next.cells[i].mine) {
      next.status = 'lost'; next.detonated = i; next.endedAt = now;
      return { state: next, event: 'lost', opened: 0 };
    }
    const pending = [i];
    while (pending.length) {
      const index = pending.pop(), cell = next.cells[index];
      if (cell.open || cell.flag || cell.mine) continue;
      cell.open = true; next.opened++;
      if (cell.count === 0) pending.push(...neighbors(index));
    }
    if (next.opened === TOTAL - MINES) { next.status = 'won'; next.endedAt = now; }
    return { state: next, event: next.status === 'won' ? 'won' : 'revealed', opened: next.opened - state.opened };
  }
  function elapsed(state, now = Date.now()) {
    return state.startedAt === null ? 0 : Math.max(0, Math.floor(((state.endedAt ?? now) - state.startedAt) / 1000));
  }
  function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
  const api = { SIZE, MINES, TOTAL, neighbors, generateMines, newGame, act, elapsed, formatTime };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MinesEngine = api;
})(typeof globalThis === 'object' ? globalThis : this);
