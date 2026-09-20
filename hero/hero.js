/* ESEKAI hero intro + scroll handoff.
   Owns only: .hx-stage (scroll), .hx-logo/.hx-star (intro), .hx-shift (pointer).
   Never touches the existing site vars (--mx/--my/--px/--py stay with script.js). */
(function () {
  const host = document.querySelector('.hx-host');
  if (!host) return;
  const hx = host.querySelector('.hx');
  const S = host.style;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const DUR = 4400;

  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const smooth = (p, a, b) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ---------- final resting state ---------- */
  function setFinal() {
    S.setProperty('--revEn', 1); S.setProperty('--revCn', 1);
    S.setProperty('--starY', 0); S.setProperty('--starS', 1);
    S.setProperty('--starO', 1); S.setProperty('--starB', 1);
    S.setProperty('--introScale', 1);
    S.setProperty('--prism', 1);
    S.setProperty('--ui', 1);
    S.setProperty('--gi', fine.matches && !reduce.matches ? .42 : .22);
  }

  /* ---------- intro timeline ---------- */
  let introRAF = 0, introStart = 0, introDone = false;

  function frame(now) {
    if (!introStart) introStart = now;
    const t = now - introStart;
    const T = clamp(t / DUR);

    /* star: rises and flares first, then settles into the wordmark */
    const rise = easeOut(seg(t, 0, 720));
    const settle = easeInOut(seg(t, 1600, 3500));
    S.setProperty('--starO', clamp(seg(t, 0, 500)).toFixed(3));
    S.setProperty('--starY', (-48 * (1 - settle) * (0.35 + 0.65 * rise)).toFixed(2));
    S.setProperty('--starS', (0.8 + 0.28 * rise - 0.08 * settle).toFixed(3));
    const flare = Math.sin(Math.PI * clamp(seg(t, 150, 1500)));
    S.setProperty('--starB', (1 + 1.15 * flare).toFixed(3));

    /* english lights up, then chinese, both as a soft top-down reveal */
    const revEn = easeOut(seg(t, 650, 2700));
    const revCn = easeOut(seg(t, 1800, 3900));
    S.setProperty('--revEn', revEn.toFixed(3));
    S.setProperty('--revCn', revCn.toFixed(3));

    /* a few local highlights travelling along the existing gloss art */
    const gp = seg(t, 1100, 4200);
    S.setProperty('--gx', (18 + gp * 64).toFixed(1) + '%');
    S.setProperty('--gy', (34 + Math.sin(gp * Math.PI * 1.6) * 22).toFixed(1) + '%');
    const pulse = Math.sin(Math.PI * clamp(gp)) * (0.55 + 0.45 * Math.sin(gp * Math.PI * 3));
    S.setProperty('--gi', Math.max(0, pulse * .8).toFixed(3));

    /* environment settles last */
    S.setProperty('--prism', (0.34 + 0.66 * easeInOut(seg(t, 300, 4300))).toFixed(3));
    S.setProperty('--introScale', (1.035 - 0.035 * easeOut(seg(t, 0, 4000))).toFixed(4));
    S.setProperty('--ui', easeOut(seg(t, 3500, 4350)).toFixed(3));

    if (T < 1) { introRAF = requestAnimationFrame(frame); }
    else { introDone = true; introRAF = 0; setFinal(); applyPointer(); }
  }

  function startIntro() {
    introDone = false; introStart = 0;
    S.setProperty('--gi', 0);
    introRAF = requestAnimationFrame(frame);
  }
  function endIntroNow() {
    if (introRAF) cancelAnimationFrame(introRAF);
    introRAF = 0; introDone = true; setFinal();
  }

  /* ---------- pointer gloss (idle state) ---------- */
  let tx = 0, ty = 0, cx = 0, cy = 0, pointerRAF = 0;
  const glows = [...host.querySelectorAll('.hx-en-glow,.hx-cn-glow')];
  let rects = [];
  const measure = () => { rects = glows.map(g => g.getBoundingClientRect()); };

  function applyPointer() {
    cx += (tx - cx) * .12; cy += (ty - cy) * .12;
    if (Math.abs(tx - cx) < .002 && Math.abs(ty - cy) < .002) { cx = tx; cy = ty; pointerRAF = 0; }
    else pointerRAF = requestAnimationFrame(() => applyPointer());
    S.setProperty('--hpx', cx.toFixed(4));
    S.setProperty('--hpy', cy.toFixed(4));
    {
      const r = hx.getBoundingClientRect();
      const ax = r.left + (cx + .5) * r.width, ay = r.top + (cy + .5) * r.height;
      glows.forEach((g, i) => {
        const b = rects[i]; if (!b || !b.width) return;
        g.style.setProperty('--gx', (((ax - b.left) / b.width) * 100).toFixed(1) + '%');
        g.style.setProperty('--gy', (((ay - b.top) / b.height) * 100).toFixed(1) + '%');
      });
    }
  }

  if (fine.matches) {
    host.addEventListener('pointermove', e => {
      if (!introDone || scrollP > .12) return;
      const r = hx.getBoundingClientRect();
      tx = clamp((e.clientX - r.left) / r.width, 0, 1) - .5;
      ty = clamp((e.clientY - r.top) / r.height, 0, 1) - .5;
      if (!pointerRAF) pointerRAF = requestAnimationFrame(() => applyPointer());
    });
    host.addEventListener('pointerleave', () => {
      tx = 0; ty = 0;
      if (!pointerRAF) pointerRAF = requestAnimationFrame(() => applyPointer());
    });
  }

  /* ---------- scroll: one continuous camera pull-back ---------- */
  let scrollP = 0, scrollRAF = 0;
  function onScrollFrame() {
    scrollRAF = 0;
    const p = clamp(window.scrollY / (window.innerHeight * .9));
    scrollP = p;
    S.setProperty('--sy', (p * 72).toFixed(2));
    S.setProperty('--ss', (1 - p * .1).toFixed(4));
    S.setProperty('--so', (1 - smooth(p, .32, 1)).toFixed(3));
    if (introDone) {
      S.setProperty('--prism', (1 - p * .55).toFixed(3));
      S.setProperty('--ui', (1 - clamp(p / .3)).toFixed(3));
      if (p > .12) S.setProperty('--gi', ((fine.matches ? .42 : .22) * (1 - clamp(p / .3))).toFixed(3));
    }
    host.dataset.past = p > .995 ? '1' : '0';
  }
  addEventListener('scroll', () => {
    if (!introDone && window.scrollY > 24) endIntroNow();   /* hand over, never two timelines */
    if (!scrollRAF) scrollRAF = requestAnimationFrame(onScrollFrame);
  }, { passive: true });
  addEventListener('resize', () => { measure(); onScrollFrame(); }, { passive: true });

  /* ---------- boot: load gate, then intro once per session ---------- */
  const critical = [...host.querySelectorAll('.hx-bg,.hx-en,.hx-cn,.hx-star')];
  const ready = Promise.all(critical.map(img =>
    img.complete && img.naturalWidth ? Promise.resolve() :
      new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); })
  ));
  const timeout = new Promise(res => setTimeout(() => res('slow'), 2500));

  Promise.race([ready.then(() => 'ok'), timeout]).then(state => {
    measure();
    const broken = critical.some(i => !i.naturalWidth);
    if (state === 'slow' || broken) { host.dataset.hx = 'fallback'; setFinal(); onScrollFrame(); return; }
    host.dataset.hx = 'ready';
    const deepLink = location.hash && location.hash !== '#top';
    const played = sessionStorage.getItem('esekai-intro') === '1';
    const atTop = window.scrollY < 24;
    if (reduce.matches || played || deepLink || !atTop) { setFinal(); }
    else { sessionStorage.setItem('esekai-intro', '1'); startIntro(); }
    onScrollFrame();
  });

  /* preview-only replay */
  const btn = document.querySelector('.hx-replay');
  if (btn) btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    endIntroNow(); setTimeout(startIntro, 60);
  });
})();
