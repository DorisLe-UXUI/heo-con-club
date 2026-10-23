// Automated walk-through of the 3D town (index.html?selftest=1&screen=town&as=guest). Result → body[data-selftest].
(async () => {
  const out = { steps: [], errors: [] };
  addEventListener('error', e => out.errors.push(e.message));
  const wait = (f, ms = 20000) => new Promise((res, rej) => { const t0 = performance.now(); const tick = () => { let v; try { v = f(); } catch (e) {} if (v) return res(v); if (performance.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(tick, 50); }; tick(); });
  const step = (name, ok, extra) => out.steps.push(Object.assign({ name, ok: !!ok }, extra || {}));
  try {
    await wait(() => window.town && town.mode === 'play' && town.player, 90000);   // slow under software GL
    let last = performance.now(); setInterval(() => { const n = performance.now(); town.update(Math.min(.1, (n - last) / 1000), n / 1000); last = n; }, 33);   // headless browsers barely run requestAnimationFrame; real elapsed time keeps walking speed right when frames are slow
    step('town ready', true, { buildings: town.buildings.length, npcs: town.npcs.length, cars: town.cars.length });
    // walk by tapping a building label
    const b = town.buildings.find(x => x.key === 'bau-cua');
    const p0 = town.player.ch.root.position.clone();
    b.label.click();
    const title = await wait(() => { const e = document.querySelector('#modal.on .ttl span'); return e && e.textContent === 'Bầu Cua' && e.textContent; }, 60000);
    const p1 = town.player.ch.root.position;
    step('label → walk → prompt', title === 'Bầu Cua', { title, walked: +p0.distanceTo(p1).toFixed(1), atDoor: +Math.hypot(p1.x - b.door.x, p1.z - b.door.z).toFixed(2) });
    closeModal();
    // ground walk
    const q0 = town.player.ch.root.position.clone(); town.walkTo(q0.x + 6, q0.z + 4);
    await wait(() => !town.player.target, 15000);
    step('walk on the street', town.player.ch.root.position.distanceTo(q0) > 4, { moved: +town.player.ch.root.position.distanceTo(q0).toFixed(1) });
    // collision: try to walk into the middle of a shop
    const c = town.buildings.find(x => x.key === 'poker');
    town.player.ch.root.position.set(c.door.x + (c.door.x - c.center.x) * .5, .03, c.door.z + (c.door.z - c.center.z) * .5);   // start just outside its door (long walks are slow under software GL)
    town.walkTo(c.center.x, c.center.z);
    await wait(() => !town.player.target, 30000);
    const inside = (() => { const o = town.obst.find(o => o.type === 'obb' && o.x === c.center.x && o.z === c.center.z); const r = town.player.ch.root.position, cs = Math.cos(o.rot), sn = Math.sin(o.rot), dx = r.x - o.x, dz = r.z - o.z; return Math.abs(dx * cs - dz * sn) < o.hw - .1 && Math.abs(dx * sn + dz * cs) < o.hd - .1; })();
    step('cannot walk through walls', !inside);
    // teleport from the game list
    openModal('games'); const tiles = document.querySelectorAll('#modal .gt'); step('game list', tiles.length === 20, { tiles: tiles.length });
    tiles[0].click();
    const t2 = await wait(() => document.querySelector('#modal.on .ttl span') && document.querySelector('#modal.on .ttl span').textContent, 5000);
    step('game list → fly to shop', t2 === 'Tiến Lên', { title: t2 }); closeModal();
    // every popup opens
    for (const k of ['daily', 'event', 'season', 'wheel', 'piggy', 'rescue', 'shop', 'rank', 'mail', 'profile', 'settings', 'welcome', 'forgot']) { openModal(k); step('modal ' + k, !!document.querySelector('#modal.on .panel')); closeModal(); }
    const n = town.npcs[0]; openModal('npc', n); step('npc card', document.querySelector('#modal.on .ttl span').textContent === n.name); closeModal();
    // daily reward + quests pay out
    const c0 = me.coins; openModal('daily'); [...document.querySelectorAll('#modal .big')].pop().click();
    step('daily reward', me.coins > c0 || !dailyAvailable(), { gained: me.coins - c0 });
    // progression: rounds from any game complete quests / achievements, every quest tab renders, the wheel pays
    for (let i = 0; i < 12; i++) HC.prog.track('round', { game: 'poker', net: 5000, bet: 10000 });
    step('quest ready to claim', HC.prog.claimableCount() > 0, { claimable: HC.prog.claimableCount(), level: HC.prog.level() });
    openModal('event'); const tabs = [...document.querySelectorAll('#modal .gtabs div')]; let rows = 0;
    for (const tb of tabs) { tb.click(); await new Promise(r => setTimeout(r, 400)); rows += document.querySelectorAll('#modal .qrow, #modal .ach, #modal .fsh').length; }
    step('quest tabs', tabs.length === 4 && rows > 20, { rows }); closeModal();
    const g0 = me.coins + me.gems * 1e9, sp = HC.prog.spin(() => 0); step('wheel pays', !!sp && me.coins + me.gems * 1e9 > g0, { prize: sp && sp.prize });
    // minimap paints
    const px = document.querySelector('#miniCv').getContext('2d').getImageData(150, 150, 1, 1).data; step('minimap drawn', px[3] > 0);
    // labels follow the camera
    step('labels on screen', [...document.querySelectorAll('.blabel')].filter(e => e.style.display !== 'none').length > 0);
  } catch (e) {
    out.errors.push(e.message);
    const t = window.town; out.state = { town: !!t, mode: t && t.mode, player: !!(t && t.player), auth: !document.querySelector('#auth').classList.contains('hide'), step: out.steps.length, pos: t && t.player && t.player.ch.root.position.toArray().map(v => +v.toFixed(1)), target: t && t.player && t.player.target && t.player.target.toArray().map(v => +v.toFixed(1)) };
  }
  out.pass = out.steps.filter(s => s.ok).length; out.fail = out.steps.filter(s => !s.ok).length + out.errors.length;
  document.body.dataset.selftest = JSON.stringify(out); document.title = 'SELFTEST_DONE';
})();
