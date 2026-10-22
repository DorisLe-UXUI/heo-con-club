/*
 * UI self-test for tien-len.html. Loaded only with ?uitest=N (play N games as a scripted human)
 * or ?pose=turn|result (stop in a state for screenshots). Results go to document.body.dataset.uitest.
 */
(function () {
  'use strict';
  const P = new URLSearchParams(location.search);
  const target = +P.get('uitest') || 0;
  const pose = P.get('pose');
  const R = { games: 0, plays: 0, passes: 0, hints: 0, badTries: 0, badRejected: 0, mismatches: [], errors: window.__errors, ticks: 0 };
  const q = s => document.querySelector(s);
  const down = c => { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
  function selectExactly(ids) {
    const want = new Set(ids);
    document.querySelectorAll('#hand .card.mine').forEach(c => { const id = +c.dataset.id; if (c.classList.contains('sel') !== want.has(id)) down(c); });
  }
  if (pose === 'result') window.__hold = true;
  if (pose === 'cut') {
    const orig = TL.Game.prototype.play;
    TL.Game.prototype.play = function (p, ids) {
      const ev = orig.call(this, p, ids);
      const c = ev.find(e => e.type === 'play' && e.cut);
      if (c && !window.__freeze) {
        window.__freeze = true;
        // a still banner (callout() animates in over 30% of its duration, so a huge duration stayed invisible)
        const slug = c.cut.stacked ? 'chat_chong' : TL.isHeo(c.cut.victimCombo) ? 'chat_heo' : 'chat';
        setTimeout(() => {
          const im = new Image(); im.className = 'callout'; im.style.maxWidth = '820px';
          im.onload = () => { document.title = 'POSED'; };
          im.src = 'assets/ui-premium-generated/callouts/' + slug + '.png'; document.getElementById('fx').appendChild(im);
        }, 500);
      }
      return ev;
    };
  }
  let posed = false;
  function tick() {
    R.ticks++;
    const ui = window.__TL_UI, G = ui && ui.G;
    if (pose === 'turn' && G && !G.over && G.turn === 0 && !q('#bPlay').classList.contains('off') && !posed) {
      posed = true;
      const o = G.options(0);
      setTimeout(() => { selectExactly(o[0].combo.cards); document.title = 'POSED'; }, 600);
      return;
    }
    if (target && (ui.gameNo > target || (ui.gameNo === target && G && G.over && document.querySelector('#modal .res')))) return finish();
    const res = document.querySelector('#modal .res');
    if (res && pose !== 'result') { const btns = document.querySelectorAll('#modal .mbtn'); btns[btns.length - 1].click(); R.games++; }
    if (pose === 'result' && res) { document.title = 'POSED'; return; }
    if (G && !G.over && G.turn === 0 && !q('#bPlay').classList.contains('off') && pose !== 'result') {
      const dom = document.querySelectorAll('#hand .card.mine').length;
      if (dom !== G.hands[0].length) R.mismatches.push({ dom, eng: G.hands[0].length, game: ui.gameNo });
      const before = G.hands[0].length;
      // occasionally try an illegal selection; it must be rejected without changing state
      if (G.current && Math.random() < 0.12) {
        const bad = G.hands[0].find(id => !G.check(0, [id]).ok);
        if (bad != null) { R.badTries++; selectExactly([bad]); q('#bPlay').click(); if (G.hands[0].length === before && G.turn === 0) R.badRejected++; }
      }
      const opts = G.options(0);
      if (Math.random() < 0.2) { q('#bHint').click(); R.hints++; }
      if (!opts.length || (G.current && Math.random() < 0.15)) { q('#bPass').click(); R.passes++; }
      else if (pose !== 'pass') { selectExactly(opts[0].combo.cards); q('#bPlay').click(); R.plays++; }
    }
    setTimeout(tick, 150);
  }
  function finish() {
    R.coins = window.__TL_UI.coins();
    R.gameNo = window.__TL_UI.gameNo;
    R.domCards = document.querySelectorAll('.card').length;
    document.body.dataset.uitest = JSON.stringify(R);
    document.title = 'UITEST DONE';
  }
  setTimeout(tick, 400);
})();
