/* ==========================================================================
   ChangAR · site interactions
   Plain JavaScript, no build step. 3D is rendered by vendor/model-viewer.min.js.
   Sections: helpers · nav · reveals · scroll effects · 3D story · 3D explorer ·
             finishes · sound demo · media fallbacks · presentation mode · edit mode
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const root = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EDIT = new URLSearchParams(location.search).has('edit');
  const scrollTasks = [];

  const toastEl = $('#toast');
  let toastTimer;
  function toast(html, ms = 2600) {
    if (!toastEl) return;
    toastEl.innerHTML = html;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), ms);
  }

  /* Opened by double-clicking index.html? Browsers block 3D files from disk. */
  if (location.protocol === 'file:') {
    const n = document.createElement('div');
    n.className = 'notice';
    n.innerHTML = '<strong>A 3D modellekhez helyi szerver kell.</strong> A böngészők letiltják őket, ha az oldalt közvetlenül a lemezről nyitod meg. ' +
      'Kattints duplán a <code>start.bat</code> fájlra (vagy futtasd a <code>python -m http.server 8080</code> parancsot ebben a mappában), majd nyisd meg a <code>http://localhost:8080</code> címet.';
    document.body.append(n);
  }

  /* First-load intro: wait briefly for the font so the headline doesn't jump. */
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 700))]) : Promise.resolve();
  fontsReady.then(() => requestAnimationFrame(() => root.classList.add('is-loaded')));

  /* ======================================================================
     Navigation
     ====================================================================== */
  const nav = $('#nav');
  const navToggle = $('.nav__toggle');
  const navLinks = $$('.nav__menu a');

  navToggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
  });
  navLinks.forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }));
  scrollTasks.push(() => nav?.classList.toggle('is-scrolled', scrollY > 8));

  // Switch the bar to light glass while it sits over a light section.
  const themed = $$('main > section, .footer');
  scrollTasks.push(() => {
    if (!nav) return;
    const y = nav.offsetHeight / 2;
    const under = themed.find(s => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
    nav.classList.toggle('is-light', !!under && under.matches('.section--light, .section--white'));
  });

  // Highlight the nav link of the section in the middle of the screen.
  // Sections without their own link belong to the closest linked section above them.
  const navIds = navLinks.map(a => a.hash.slice(1));
  const groupOf = new Map();
  let group = null;
  $$('main > [id]').forEach(s => { if (navIds.includes(s.id)) group = s.id; groupOf.set(s, group); });
  const navIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const g = groupOf.get(e.target);
      navLinks.forEach(a => a.classList.toggle('is-current', a.hash === '#' + g));
    });
  }, { rootMargin: '-49% 0px -50% 0px' });
  groupOf.forEach((_, s) => navIO.observe(s));

  /* ======================================================================
     Reveal on scroll + number counters
     ====================================================================== */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  $$('.reveal').forEach(el => revealIO.observe(el));

  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      if (reduceMotion) return;
      const el = e.target;
      const to = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const t0 = performance.now();
      const tick = now => {
        const k = clamp((now - t0) / 1600);
        el.textContent = (to * (1 - Math.pow(1 - k, 3))).toFixed(dec);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ======================================================================
     Scroll effects: hero fade, scroll-lit statement
     ====================================================================== */
  const hero = $('.hero');
  scrollTasks.push(() => {
    if (!hero) return;
    const p = clamp(scrollY / (hero.offsetHeight * 0.55));
    hero.style.setProperty('--hero-p', p.toFixed(3));
  });

  // Split statement paragraphs into words; light them up as the paragraph scrolls in.
  const scrubs = $$('[data-scrub]').map(el => {
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(' '); return; }
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = part;
        frag.append(w);
      });
      node.replaceWith(frag);
    });
    return { el, words: $$('.w', el), lit: -1 };
  });
  scrollTasks.push(() => {
    const vh = innerHeight;
    scrubs.forEach(s => {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      const start = vh * 0.88;
      const end = vh * 0.56 - r.height / 2; // fully lit just before the paragraph is centred
      const p = reduceMotion ? 1 : clamp((start - r.top) / (start - end));
      const n = Math.round(p * s.words.length);
      if (n === s.lit) return;
      s.lit = n;
      s.words.forEach((w, i) => w.classList.toggle('is-on', i < n));
    });
  });

  /* ======================================================================
     3D helpers (model-viewer)
     ====================================================================== */
  const viewers = $$('model-viewer');
  const mvDefined = window.customElements ? customElements.whenDefined('model-viewer') : new Promise(() => {});
  const whenLoaded = mv => new Promise(res => (mv.loaded ? res() : mv.addEventListener('load', res, { once: true })));

  viewers.forEach(mv => {
    mv.addEventListener('load', () => mv.classList.add('is-ready'), { once: true });
    mv.addEventListener('error', e => {
      console.warn('[ChangAR] 3D model failed to load:', mv.getAttribute('src'), e.detail || '');
      mv.classList.add('is-ready');
    });
  });

  // Prepare a model's first animation (e.g. an exploded view) for scrubbing. Returns its duration.
  async function prepareAnimation(mv) {
    await whenLoaded(mv);
    const names = mv.availableAnimations || [];
    if (!names.length) return 0;
    mv.animationName = names[0];
    mv.play();
    mv.pause();
    mv.currentTime = 0;
    return mv.duration || 0;
  }

  // "25deg 75deg 105%" -> [{v:25,u:'deg'}, …] so camera angles can be blended smoothly.
  function parseOrbit(str) {
    return str.trim().split(/\s+/).map(tok => {
      const m = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(tok);
      return m ? { v: parseFloat(m[1]), u: m[2] } : { raw: tok };
    });
  }
  const fmtPart = p => (p.raw !== undefined ? p.raw : `${+p.v.toFixed(4)}${p.u}`);
  function mixOrbit(A, B, t) {
    return A.map((a, k) => {
      const b = B[k];
      if (!b || a.raw !== undefined || b.raw !== undefined || a.u !== b.u) return fmtPart(t < 0.5 || !b ? a : b);
      return `${+lerp(a.v, b.v, t).toFixed(4)}${a.u}`;
    }).join(' ');
  }

  /* ======================================================================
     Design story: pinned model, camera + exploded view driven by scroll
     ====================================================================== */
  const story = $('.story');
  if (story) {
    const steps = $$('.story__step', story);
    const mv = $('model-viewer', story);
    const dotsWrap = $('.story__dots', story);
    const N = Math.max(1, steps.length);
    story.style.setProperty('--steps', String(N));
    const dots = steps.map(() => { const i = document.createElement('i'); dotsWrap?.append(i); return i; });
    const keys = steps.map(s => ({
      orbit: parseOrbit(s.dataset.orbit || '0deg 75deg 105%'),
      target: s.dataset.target ? parseOrbit(s.dataset.target) : null, // optional orbit centre "x y z" in metres
      explode: parseFloat(s.dataset.explode || '0') || 0,
    }));
    let duration = 0;
    let active = -1;
    let ready = false;

    const update = () => {
      const r = story.getBoundingClientRect();
      const vh = innerHeight;
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
      const prog = clamp(-r.top / Math.max(1, r.height - vh));
      const seg = prog * (N - 1);
      const i = Math.min(Math.max(N - 2, 0), Math.floor(seg));
      const f = N > 1 ? smoothstep(0.15, 0.85, seg - i) : 0; // hold still near each chapter
      const a = keys[i];
      const b = keys[Math.min(i + 1, N - 1)];
      if (ready && a) {
        mv.cameraOrbit = mixOrbit(a.orbit, b.orbit, f);
        if (a.target && b.target) mv.cameraTarget = mixOrbit(a.target, b.target, f);
        if (duration > 0) mv.currentTime = clamp(lerp(a.explode, b.explode, f)) * duration * 0.999;
      }
      const now = Math.round(seg);
      if (now !== active) {
        active = now;
        steps.forEach((s, k) => s.classList.toggle('is-active', k === now));
        dots.forEach((d, k) => d.classList.toggle('is-active', k === now));
      }
    };
    scrollTasks.push(update);

    if (mv) {
      mvDefined.then(() => {
        ready = true;
        update();
        return prepareAnimation(mv);
      }).then(d => { duration = d || 0; update(); });
    }
  }

  /* ======================================================================
     Explorer: hotspots, exploded view toggle, wheel behaviour
     ====================================================================== */
  const explorer = $('#explore-model');
  if (explorer) {
    const wrap = explorer.closest('.viewer');
    const toggle = $('[data-explode-toggle]');
    const baseRadius = (explorer.getAttribute('camera-orbit') || '').trim().split(/\s+/)[2] || 'auto';
    let duration = 0;
    let value = 0;
    let raf = 0;

    // Tap a hotspot to reveal its label (labels are hidden by default on phones).
    const hotspots = $$('.hotspot', explorer);
    hotspots.forEach(h => h.addEventListener('click', () => {
      const open = !h.classList.contains('is-open');
      hotspots.forEach(o => o.classList.remove('is-open'));
      h.classList.toggle('is-open', open);
    }));

    // Let the page scroll when the mouse wheel is used over the model.
    // Ctrl/⌘ + wheel and trackpad pinch still zoom.
    explorer.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation(); }, { capture: true });

    mvDefined.then(() => prepareAnimation(explorer)).then(d => {
      duration = d || 0;
      if (!duration && toggle) toggle.hidden = true;
    });

    toggle?.addEventListener('click', e => {
      const btn = e.target.closest('button[data-explode]');
      if (!btn || !duration) return;
      const to = parseFloat(btn.dataset.explode) || 0;
      $$('button', toggle).forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      wrap?.classList.toggle('is-exploded', to > 0.5);
      const o = explorer.getCameraOrbit();
      const radius = to > 0.5 ? (explorer.dataset.explodedRadius || '250%') : baseRadius;
      explorer.cameraOrbit = `${o.theta}rad ${o.phi}rad ${radius}`;
      const from = value;
      const t0 = performance.now();
      const dur = reduceMotion ? 1 : 1500;
      cancelAnimationFrame(raf);
      const tick = now => {
        const k = clamp((now - t0) / dur);
        value = lerp(from, to, easeInOut(k));
        explorer.currentTime = value * duration * 0.999;
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  }

  /* ======================================================================
     Finishes: recolour a named material on every model on the page
     ====================================================================== */
  $$('.swatches').forEach(groupEl => {
    const matName = groupEl.dataset.material;
    const label = $('.swatches__name', groupEl);
    let current = null;

    const apply = mv => {
      if (!current || !mv.model) return;
      const m = mv.model.getMaterialByName && mv.model.getMaterialByName(matName);
      if (m) m.pbrMetallicRoughness.setBaseColorFactor([current[0], current[1], current[2], 1]);
    };

    mvDefined.then(() => {
      const probe = explorer || viewers[0];
      if (!probe) return;
      whenLoaded(probe).then(() => {
        const ok = probe.model && probe.model.getMaterialByName && probe.model.getMaterialByName(matName);
        if (!ok) groupEl.hidden = true;
      });
      viewers.forEach(mv => whenLoaded(mv).then(() => apply(mv)));
    });

    groupEl.addEventListener('click', e => {
      const sw = e.target.closest('.swatch');
      if (!sw) return;
      current = sw.dataset.color.split(',').map(Number);
      viewers.forEach(apply);
      $$('.swatch', groupEl).forEach(b => {
        const on = b === sw;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      if (label) label.textContent = sw.dataset.name || '';
    });
  });

  /* ======================================================================
     Sound demo: generative soundscapes (Web Audio) + live waveform
     Replace with your own audio if you have it; this needs no files.
     ====================================================================== */
  const soundSection = $('#sound');
  const canvas = $('#sound-canvas');
  if (soundSection && canvas) {
    const g2d = canvas.getContext('2d');
    const playBtn = $('#sound-play');
    const playText = $('.play-btn__text', playBtn);
    const modesEl = $('[data-sound-modes]');
    const MODES = {
      focus:    { chord: [146.83, 220.0, 277.18, 329.63], type: 'sine', cutoff: 1100, noise: 0.05, chime: null },
      calm:     { chord: [130.81, 196.0, 246.94, 329.63, 392.0], type: 'triangle', cutoff: 650, noise: 0.02,
                  chime: { notes: [523.25, 659.25, 783.99, 880.0, 1046.5], every: 3200, gain: 0.05 } },
      doorbell: { chord: [196.0, 246.94, 293.66], type: 'sine', cutoff: 800, noise: 0,
                  chime: { seq: [659.25, 523.25], every: 2600, gain: 0.12 } },
    };
    let ac, master, analyser, wave, padBus, padFilter, noiseGain, chimeBus, chimeTimer;
    let voices = [];
    let mode = 'focus';
    let playing = false;
    let level = 0;

    function initAudio() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = 0;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      wave = new Uint8Array(analyser.fftSize);
      master.connect(comp).connect(analyser).connect(ac.destination);

      padBus = ac.createGain();
      padFilter = ac.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.Q.value = 0.7;
      padFilter.frequency.value = 900;
      const lfo = ac.createOscillator();
      const lfoAmt = ac.createGain();
      lfo.frequency.value = 0.06;
      lfoAmt.gain.value = 260;
      lfo.connect(lfoAmt).connect(padFilter.frequency);
      lfo.start();
      padBus.connect(padFilter).connect(master);

      const buf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const nf = ac.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = 600;
      noiseGain = ac.createGain();
      noiseGain.gain.value = 0;
      noise.connect(nf).connect(noiseGain).connect(master);
      noise.start();

      chimeBus = ac.createGain();
      const delay = ac.createDelay(1);
      const fb = ac.createGain();
      const wet = ac.createGain();
      delay.delayTime.value = 0.32;
      fb.gain.value = 0.3;
      wet.gain.value = 0.35;
      chimeBus.connect(master);
      chimeBus.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(wet).connect(master);
      return true;
    }

    function chime(c) {
      const t = ac.currentTime + 0.03;
      const notes = c.seq || [c.notes[Math.floor(Math.random() * c.notes.length)]];
      notes.forEach((f, i) => {
        const at = t + i * 0.42;
        [1, 2.01, 3.0].forEach((mult, h) => {
          const o = ac.createOscillator();
          const gn = ac.createGain();
          o.type = 'sine';
          o.frequency.value = f * mult;
          gn.gain.setValueAtTime(0, at);
          gn.gain.linearRampToValueAtTime(c.gain * [1, 0.28, 0.1][h], at + 0.008);
          gn.gain.exponentialRampToValueAtTime(0.0001, at + 1.8 - h * 0.4);
          o.connect(gn).connect(chimeBus);
          o.start(at);
          o.stop(at + 2);
        });
      });
    }

    function stopVoices(fade = 0.4) {
      const t = ac.currentTime;
      voices.forEach(v => {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, fade);
        v.oscs.forEach(o => o.stop(t + fade * 6));
      });
      voices = [];
      clearInterval(chimeTimer);
      chimeTimer = null;
    }

    function startMode(name) {
      const m = MODES[name];
      const t = ac.currentTime;
      stopVoices();
      voices = m.chord.map((f, i) => {
        const g = ac.createGain();
        g.gain.value = 0;
        g.connect(padBus);
        const oscs = [-5, 5].map(c => {
          const o = ac.createOscillator();
          o.type = m.type;
          o.frequency.value = f;
          o.detune.value = c + (i % 2 ? 3 : -3);
          o.connect(g);
          o.start(t);
          return o;
        });
        g.gain.setTargetAtTime(0.05 / Math.sqrt(m.chord.length / 3), t + 0.05, 0.9);
        return { g, oscs };
      });
      padFilter.frequency.setTargetAtTime(m.cutoff, t, 0.8);
      noiseGain.gain.setTargetAtTime(m.noise, t, 0.8);
      if (m.chime) {
        const ring = () => playing && chime(m.chime);
        setTimeout(ring, 500);
        chimeTimer = setInterval(ring, m.chime.every);
      }
    }

    async function setPlaying(on) {
      if (on === playing) return;
      if (on) {
        if (!ac && !initAudio()) { toast('Ez a böngésző nem támogatja a hanglejátszást'); return; }
        await ac.resume();
        playing = true;
        startMode(mode);
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(0.9, ac.currentTime, 0.3);
      } else {
        playing = false;
        master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
        stopVoices(0.15);
      }
      playBtn.setAttribute('aria-pressed', String(playing));
      playText.textContent = playing ? 'Szünet' : 'Hangtáj lejátszása';
    }

    playBtn.addEventListener('click', () => setPlaying(!playing));
    modesEl?.addEventListener('click', e => {
      const btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      mode = btn.dataset.mode;
      $$('button', modesEl).forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      if (playing) startMode(mode); else setPlaying(true);
    });

    // Waveform visual. Idles gently; follows the audio level while playing.
    const WAVES = [
      { c: '110,231,255', f: 1.4, s: 0.9, a: 1.0, p: 0 },
      { c: '109,107,255', f: 2.1, s: 1.25, a: 0.85, p: 1.7 },
      { c: '192,105,255', f: 2.9, s: 0.7, a: 0.7, p: 3.1 },
      { c: '255,107,161', f: 1.1, s: 1.6, a: 0.55, p: 4.4 },
    ];
    let visible = false;
    let rafId = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    const draw = now => {
      rafId = visible && !reduceMotion ? requestAnimationFrame(draw) : 0;
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return;
      let target = 0.16 + 0.05 * Math.sin(now / 1300);
      if (playing && analyser) {
        analyser.getByteTimeDomainData(wave);
        let sum = 0;
        for (let i = 0; i < wave.length; i++) { const v = (wave[i] - 128) / 128; sum += v * v; }
        target = clamp(0.3 + Math.sqrt(sum / wave.length) * 7);
      }
      level = lerp(level, target, 0.08);
      g2d.clearRect(0, 0, w, h);
      g2d.globalCompositeOperation = 'lighter';
      const mid = h / 2;
      const amp = h * 0.44;
      const stepX = 6 * dpr;
      WAVES.forEach(wv => {
        const t = now * 0.001 * wv.s + wv.p;
        const yAt = x => {
          const nx = (x / w) * 2 - 1;
          return Math.pow(1 - nx * nx, 2.4) * amp * level * wv.a * Math.sin(nx * wv.f * Math.PI * 2 + t);
        };
        g2d.beginPath();
        g2d.moveTo(0, mid);
        for (let x = 0; x <= w; x += stepX) g2d.lineTo(x, mid - yAt(x));
        for (let x = w; x >= 0; x -= stepX) g2d.lineTo(x, mid + yAt(x));
        g2d.closePath();
        const grad = g2d.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, `rgba(${wv.c},0)`);
        grad.addColorStop(0.5, `rgba(${wv.c},0.34)`);
        grad.addColorStop(1, `rgba(${wv.c},0)`);
        g2d.fillStyle = grad;
        g2d.fill();
      });
      g2d.globalCompositeOperation = 'source-over';
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { resize(); if (!rafId) rafId = requestAnimationFrame(draw); }
      else if (playing) setPlaying(false); // don't keep playing on other slides
    }, { threshold: 0.15 }).observe(soundSection);
    window.addEventListener('resize', () => visible && resize());
  }

  /* ======================================================================
     Photos, team pictures and the demo video: styled placeholders until added
     ====================================================================== */
  $$('img[data-fallback]').forEach(img => {
    const holder = img.parentElement;
    holder.dataset.file = img.getAttribute('src');
    const fail = () => holder.classList.add('is-empty');
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener('error', fail, { once: true });
  });

  const video = $('#demo-video');
  if (video) {
    const frame = video.closest('.video-frame');
    frame.dataset.file = video.getAttribute('src');
    const fail = () => frame.classList.add('is-empty');
    video.addEventListener('error', fail);
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) fail();
  }

  const gallery = $('#gallery');
  if (gallery) {
    const btns = $$('[data-gallery]');
    const sync = () => {
      const max = gallery.scrollWidth - gallery.clientWidth - 2;
      btns.forEach(b => { b.disabled = Number(b.dataset.gallery) < 0 ? gallery.scrollLeft <= 2 : gallery.scrollLeft >= max; });
    };
    btns.forEach(b => b.addEventListener('click', () => {
      const card = $('.shot', gallery);
      const stepPx = card ? card.getBoundingClientRect().width + 16 : 320;
      gallery.scrollBy({ left: stepPx * Number(b.dataset.gallery), behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
    gallery.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  /* ======================================================================
     Presentation mode (press P). Arrow keys / clicker step through slides.
     Every [data-slide] section is a slide; each design chapter is a slide too.
     ====================================================================== */
  const present = (() => {
    const hud = $('#present-hud');
    const countEl = $('.present-hud__count', hud);
    const barEl = $('.present-hud__bar i', hud);
    const timerEl = $('#present-timer');
    const blackout = $('#blackout');
    const LIMIT = 8 * 60; // the jury gives each team 8 minutes
    let on = false;
    let idx = 0;
    let busyUntil = 0;
    let hudTimer;
    let idleTimer;
    let timerInt;
    let t0 = 0;

    function stops() {
      const ys = [];
      $$('[data-slide]').forEach(el => ys.push(el.getBoundingClientRect().top + scrollY));
      $$('.story').forEach(st => {
        const top = st.getBoundingClientRect().top + scrollY;
        const n = $$('.story__step', st).length;
        const span = st.offsetHeight - innerHeight;
        for (let i = 0; i < n; i++) ys.push(top + (n > 1 ? (span * i) / (n - 1) : 0));
      });
      ys.sort((a, b) => a - b);
      return ys.filter((y, i) => i === 0 || y - ys[i - 1] > 8).map(y => Math.max(0, Math.round(y)));
    }
    function nearest(list) {
      let best = 0;
      list.forEach((y, i) => { if (Math.abs(y - scrollY) < Math.abs(list[best] - scrollY)) best = i; });
      return best;
    }
    function showHud(total) {
      countEl.textContent = `${idx + 1} / ${total}`;
      barEl.style.setProperty('--p', `${((idx + 1) / total) * 100}%`);
      hud.classList.add('is-visible');
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => hud.classList.remove('is-visible'), 1800);
    }
    function go(i) {
      const list = stops();
      idx = clamp(i, 0, list.length - 1);
      busyUntil = performance.now() + 1100;
      window.scrollTo({ top: list[idx], behavior: reduceMotion ? 'auto' : 'smooth' });
      showHud(list.length);
    }
    function step(dir) {
      if (performance.now() > busyUntil) idx = nearest(stops());
      go(idx + dir);
    }
    function tickTimer() {
      const left = LIMIT - Math.floor((Date.now() - t0) / 1000);
      const a = Math.abs(left);
      timerEl.textContent = `${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
      timerEl.classList.toggle('is-warning', left <= 60 && left >= 0);
      timerEl.classList.toggle('is-over', left < 0);
    }
    function fullscreen() {
      if (!document.fullscreenElement) root.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    }
    function toggle(force) {
      const next = typeof force === 'boolean' ? force : !on;
      if (next === on) return;
      on = next;
      root.classList.toggle('is-presenting', on);
      if (on) {
        t0 = Date.now();
        tickTimer();
        timerInt = setInterval(tickTimer, 250);
        const list = stops();
        idx = nearest(list);
        showHud(list.length);
        toast('Prezentáció · <kbd>→</kbd> következő · <kbd>←</kbd> vissza · <kbd>F</kbd> teljes képernyő · <kbd>T</kbd> 8 perces időzítő · <kbd>B</kbd> sötét képernyő · <kbd>Esc</kbd> kilépés', 4500);
      } else {
        clearInterval(timerInt);
        timerEl.classList.remove('is-visible');
        blackout.classList.remove('is-on');
        root.classList.remove('is-idle');
        toast('Prezentáció mód kikapcsolva', 1400);
      }
    }

    window.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat && (e.key === 'p' || e.key === 'P')) return;
      if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key;
      if (k === 'p' || k === 'P') { toggle(); e.preventDefault(); return; }
      if (!on) return;
      let handled = true;
      switch (k) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': step(1); break;
        case ' ': step(e.shiftKey ? -1 : 1); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': step(-1); break;
        case 'Home': go(0); break;
        case 'End': go(stops().length - 1); break;
        case 'f': case 'F': fullscreen(); break;
        case 't': case 'T': timerEl.classList.toggle('is-visible'); break;
        case 'r': case 'R': t0 = Date.now(); tickTimer(); toast('Időzítő visszaállítva 8:00-ra', 1400); break;
        case 'b': case 'B': case '.': blackout.classList.toggle('is-on'); break;
        case 'Escape': if (!document.fullscreenElement) toggle(false); else handled = false; break;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    window.addEventListener('mousemove', () => {
      if (!on) return;
      root.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => root.classList.add('is-idle'), 2000);
    }, { passive: true });

    $$('[data-present]').forEach(b => b.addEventListener('click', () => { toggle(true); go(0); }));
    return { toggle, go };
  })();
  window.changarPresent = present; // handy from the browser console

  /* ======================================================================
     Edit mode: open the site with ?edit to place hotspots and camera angles
     ====================================================================== */
  if (EDIT) {
    root.classList.add('is-edit');
    const panel = document.createElement('aside');
    panel.className = 'edit-panel';
    panel.innerHTML = '<strong>Szerkesztő mód</strong>' +
      '<p>Kattints egy 3D modellre a hotspot pozíciójának másolásához. Húzd az interaktív modellt a <em>data-orbit</em> kameraszögek leolvasásához. A hiányzó fotók jelölve vannak.</p>' +
      '<code data-out="camera">Mozgass egy modellt…</code><code data-out="hotspot">Kattints egy modellre…</code>';
    document.body.append(panel);
    const camOut = $('[data-out="camera"]', panel);
    const hotOut = $('[data-out="hotspot"]', panel);
    const deg = r => Math.round((r * 1800) / Math.PI) / 10;
    mvDefined.then(() => viewers.forEach(mv => {
      mv.addEventListener('camera-change', () => {
        const o = mv.getCameraOrbit();
        camOut.textContent = `#${mv.id}\ndata-orbit="${deg(o.theta)}deg ${deg(o.phi)}deg ${o.radius.toFixed(3)}m"`;
      });
      let down = null;
      mv.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
      mv.addEventListener('click', e => {
        if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
        const hit = mv.positionAndNormalFromPoint(e.clientX, e.clientY);
        if (!hit) { toast('Nincs felület a kurzor alatt'); return; }
        const v = p => `${p.x.toFixed(4)}m ${p.y.toFixed(4)}m ${p.z.toFixed(4)}m`;
        const txt = `data-position="${v(hit.position)}" data-normal="${v(hit.normal)}"`;
        hotOut.textContent = txt;
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
          .then(() => toast('Hotspot pozíció másolva'), () => toast('Másold ki a hotspot szöveget a panelről'));
      });
    }));
  }

  /* ---------- run scroll-linked effects once per frame ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; scrollTasks.forEach(fn => fn()); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
