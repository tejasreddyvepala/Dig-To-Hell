// TOP BAR LAYOUT: the corner buttons (Sound/Economy/Trophies/Guide/Help) sit top-left; the site tabs are centred in
// the world view but never overlap them. When the view is too narrow for both (portal embeds, phones), the corner
// collapses into one ☰ Menu button that drops the same buttons down as a list.
export function initTopBar() {
  const stage = document.getElementById('stage')!, corner = document.getElementById('corner')!, nav = document.getElementById('nav')!;
  const menu = document.getElementById('menuBtn')!, ach = document.getElementById('achBadge')!, eco = document.getElementById('ecoBtn')!;
  const close = () => { corner.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.onclick = (e) => { e.stopPropagation(); const o = corner.classList.toggle('open'); menu.setAttribute('aria-expanded', String(o)); };
  corner.addEventListener('click', (e) => { if (e.target !== menu && !(e.target as HTMLElement).closest('#menuBtn')) close(); });
  document.addEventListener('pointerdown', (e) => { if (!corner.contains(e.target as Node)) close(); });
  const GAP = 10, EDGE = 12;
  let compactW = 54; // the closed ☰ bar's width (measured whenever it is closed)
  const layout = () => {
    const W = stage.clientWidth;
    for (const compact of [false, true]) {
      document.body.classList.toggle('compact', compact);
      const open = compact && corner.classList.contains('open'); // the open dropdown hangs below: the tabs don't move
      if (compact && !open) compactW = corner.offsetWidth;
      const cr = corner.offsetLeft + (open ? compactW : corner.offsetWidth), nw = nav.offsetWidth;
      const left = Math.max(cr + GAP, W / 2 - nw / 2);
      if (left + nw <= W - EDGE || compact) {
        nav.style.left = `${Math.max(cr + GAP, Math.min(left, W - EDGE - nw))}px`;
        nav.style.transform = 'none';
        if (!compact) close(); // the dropdown only exists in compact mode
        return;
      }
    }
  };
  addEventListener('resize', layout);
  const ro = new ResizeObserver(layout); ro.observe(stage); ro.observe(nav);
  void document.fonts?.ready.then(layout);
  layout();
  // the collapsed menu still shows that something inside wants attention
  setInterval(() => menu.classList.toggle('dot', !ach.hidden || eco.classList.contains('hot')), 1000);
}
