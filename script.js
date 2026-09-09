// Native pointer, case scroll choreography and playback controls.
const dialog = document.querySelector('#case-dialog');
const content = document.querySelector('#case-content');
let returnFocus = null;
const validCases = ['cp1', 'cp2', 'respawn', 'cp3'];
function pauseVideos(root = document) {
  root.querySelectorAll('video').forEach(video => video.pause());
}
document.addEventListener('play', event => {
  if (event.target.tagName !== 'VIDEO') return;
  document.querySelectorAll('video').forEach(video => {
    if (video !== event.target) video.pause();
  });
}, true);
function openCase(id, updateHistory = true) {
  if (!validCases.includes(id)) return;
  if (!dialog.open) returnFocus = document.activeElement;
  pauseVideos();
  content.replaceChildren(document.querySelector('#case-' + id).content.cloneNode(true));
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('case-open');
  dialog.scrollTop = 0;
  dialog.style.setProperty('--case-progress', 0);
  content.querySelector('h1').focus({preventScroll:true});
  setupCaseExperience();
  if (updateHistory) history.pushState(null, '', '#case-' + id);
}
function closeCase(updateHistory = true) {
  caseCleanup();
  pauseVideos(content);
  dialog.close();
  document.body.classList.remove('case-open');
  if (updateHistory) history.replaceState(null, '', '#work');
  returnFocus?.focus({preventScroll:true});
}
document.addEventListener('click', event => {
  const link = event.target.closest('[data-case], [data-next-case]');
  if (link) {
    event.preventDefault();
    openCase(link.dataset.case || link.dataset.nextCase);
  }
  if (event.target.closest('[data-case-contact]')) {
    event.preventDefault();
    closeCase(false);
    location.hash = 'contact';
    document.querySelector('#contact').scrollIntoView();
  }
});
document.querySelector('.case-close').addEventListener('click', () => closeCase());
dialog.addEventListener('cancel', event => { event.preventDefault(); closeCase(); });
dialog.addEventListener('scroll', () => {
  const range = dialog.scrollHeight - dialog.clientHeight;
  dialog.style.setProperty('--case-progress', range > 0 ? dialog.scrollTop / range : 0);
}, {passive:true});
function syncRoute() {
  const id = location.hash.replace('#case-', '');
  if (validCases.includes(id)) openCase(id, false);
  else if (dialog.open) closeCase(false);
}
addEventListener('popstate', syncRoute);

document.querySelector('.wechat-copy').addEventListener('click', async () => {
  const status = document.querySelector('#contact-status');
  try {
    await navigator.clipboard.writeText('nyccrimepartner');
    status.textContent = 'WeChat ID copied: nyccrimepartner';
  } catch {
    status.textContent = 'WeChat ID: nyccrimepartner — select and copy this text.';
  }
});

// Audible previews; browser autoplay restrictions never trigger a muted fallback.
const hoverCapable = matchMedia('(hover:hover) and (pointer:fine)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let caseCleanup = () => {};
function setupCaseExperience() {
  caseCleanup();
  const videos = [...content.querySelectorAll('.film video')];
  videos.forEach(video => {
    video.loop = true;
    video.volume = .5;
    video.controls = false;
    const figure = video.closest('figure');
    const pair = content.querySelector('.photo-pair');
    if (pair && !figure.closest('.film-spread')) {
      const spread = document.createElement('div');
      spread.className = 'film-spread';
      figure.before(spread);
      const photos = [...pair.children];
      if (photos[0]) spread.append(photos[0]);
      spread.append(figure);
      if (photos[1]) spread.append(photos[1]);
      pair.remove();
    }
    const button = document.createElement('button');
    button.className = 'case-video-toggle';
    button.textContent = 'Play with sound';
    figure.append(button);
    let manualPause = false;
    button.addEventListener('click', () => {
      manualPause = !video.paused;
      if (manualPause) video.pause(); else video.play().catch(() => { button.textContent = 'Play with sound'; });
    });
    video.addEventListener('play', () => { button.textContent = 'Pause film'; });
    video.addEventListener('pause', () => { button.textContent = 'Play with sound'; });
    video._autoPlay = () => { if (!manualPause && !reduceMotion.matches) video.play().catch(() => {}); };
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target._autoPlay(); else entry.target.pause();
    });
  }, {root:dialog, threshold:.45});
  videos.forEach(v => observer.observe(v));
  const media = [...content.querySelectorAll('.media')];
  let frame = 0;
  const render = () => {
    frame = 0;
    const height = dialog.clientHeight;
    media.forEach(el => {
      const rect = el.getBoundingClientRect();
      const p = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - height / 2) / height));
      el.style.setProperty('--travel', reduceMotion.matches ? '0px' : p * -24 + 'px');
      el.style.setProperty('--crop', reduceMotion.matches ? '0%' : Math.abs(p) * 2 + '%');
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  dialog.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  reduceMotion.addEventListener('change', schedule);
  render();
  caseCleanup = () => {
    observer.disconnect(); cancelAnimationFrame(frame);
    dialog.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    reduceMotion.removeEventListener('change', schedule);
  };
}
syncRoute();
document.querySelectorAll('.reel-rail video').forEach(video => {
  video.volume = 0.5;
  const title = video.getAttribute('aria-label');
  let wanted = false;
  let request = 0;
  const stop = () => { request++; wanted = false; video.pause(); };
  const play = async () => {
    const token = ++request;
    wanted = true;
    video.muted = false;
    try { await video.play(); if (!wanted) video.pause(); }
    catch {
      if (token !== request) return;
      wanted = false;
      document.querySelector('.rail-note').textContent = 'Click a video to play with sound · Hover to continue exploring';
    }
  };
  video.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch' && hoverCapable.matches && !reduceMotion.matches) play();
  });
  video.addEventListener('pointerleave', () => { if (hoverCapable.matches) stop(); });
  video.addEventListener('click', () => video.paused ? play() : stop());
  video.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); video.paused ? play() : stop();
    }
  });
  video.addEventListener('blur', stop);
  video.addEventListener('play', () => {
    video.setAttribute('aria-pressed', 'true');
    video.setAttribute('aria-label', 'Pause: ' + title);
  });
  video.addEventListener('pause', () => {
    video.setAttribute('aria-pressed', 'false');
    video.setAttribute('aria-label', 'Play: ' + title);
  });
  const visible = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) stop();
  }, {threshold:0.15});
  visible.observe(video);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseVideos();
});

document.querySelectorAll('.cover-project').forEach(card => {
  const video = card.querySelector('.project-preview');
  const link = card.querySelector('a');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cover-preview-button';
  button.textContent = 'Play Preview';
  button.setAttribute('aria-label', 'Play preview for ' + card.querySelector('h2').textContent);
  button.setAttribute('aria-pressed', 'false');
  card.appendChild(button);
  video.volume = 0.5;
  let wanted = false;
  let version = 0;
  const stop = () => {
    wanted = false; version++;
    video.pause();
    card.classList.remove('is-previewing');
    button.textContent = 'Play Preview';
    button.setAttribute('aria-pressed', 'false');
  };
  const start = async () => {
    wanted = true;
    const token = ++version;
    video.currentTime = 0;
    try {
      await video.play();
      if (!wanted || token !== version) return;
      card.classList.add('is-previewing');
      button.textContent = 'Pause Preview';
      button.setAttribute('aria-pressed', 'true');
    } catch {
      if (token === version) { wanted = false; button.textContent = 'Click to Play Preview'; }
    }
  };
  card.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'touch' && hoverCapable.matches && !reduceMotion.matches) start();
  });
  card.addEventListener('pointerleave', stop);
  button.addEventListener('click', () => video.paused ? start() : stop());
  link.addEventListener('click', stop);
  card.addEventListener('focusout', e => { if (!card.contains(e.relatedTarget)) stop(); });
  video.addEventListener('pause', () => {
    card.classList.remove('is-previewing');
    button.textContent = 'Play Preview';
    button.setAttribute('aria-pressed', 'false');
  });
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); },{threshold:.1}).observe(card);
});
