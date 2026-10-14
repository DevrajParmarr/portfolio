/* ==========================================================================
   Devraj Parmar — interaction layer
   Progressive enhancement: every feature checks for its library / element
   and the page stays fully readable if any of them is missing.
   ========================================================================== */
(() => {
  'use strict';
  window.__app = true;

  const d = document, root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap, ST = window.ScrollTrigger, FLIP = window.Flip;
  const HAS_GSAP = !!(G && ST);
  const MOTION = HAS_GSAP && !REDUCED;
  const EMAIL = 'devrajparmar232@gmail.com';

  if (HAS_GSAP) G.registerPlugin(ST, ...(FLIP ? [FLIP] : []));
  if (MOTION) root.classList.add('motion');

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  /* ------------------------------------------------------------------ */
  /* Smooth scroll                                                       */
  /* ------------------------------------------------------------------ */
  let lenis = null;
  if (!REDUCED && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    if (HAS_GSAP) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    lenis.stop();
  }
  const onScroll = (fn) => (lenis ? lenis.on('scroll', fn) : addEventListener('scroll', fn, { passive: true }));

  function scrollToTarget(target, opts = {}) {
    const el = typeof target === 'string' ? d.querySelector(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.5, ...opts });
    else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  }

  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 && d.querySelector(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(el);
    history.replaceState(null, '', id === '#hero' ? location.pathname : id);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------------ */
  /* Text splitting                                                      */
  /* ------------------------------------------------------------------ */
  function splitWords(el) {
    if (el.dataset.splitDone) return $$('.wi', el);
    el.dataset.splitDone = '1';
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
            const w = d.createElement('span'); w.className = 'w';
            const i = d.createElement('span'); i.className = 'wi'; i.textContent = part;
            w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    el.classList.add('is-split');
    return $$('.wi', el);
  }
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = '';
    return Array.from(text).map((c) => {
      const w = d.createElement('span'); w.className = 'chw';
      const s = d.createElement('span'); s.className = 'ch'; s.textContent = c;
      w.appendChild(s); el.appendChild(w); return s;
    });
  }
  $$('.hero-name .line').forEach(splitChars);

  /* ------------------------------------------------------------------ */
  /* Loader → intro                                                      */
  /* ------------------------------------------------------------------ */
  function runLoader(done) {
    const loader = $('#loader');
    if (!loader) return done();
    const pct = $('.loader-pct span', loader), nameEl = $('.loader-name', loader), log = $('.loader-log', loader);
    const quick = REDUCED || !HAS_GSAP || store.get('dp-visited');
    store.set('dp-visited', '1');
    const t0 = performance.now(), now = new Date();
    const line = (k, v, ok = true) => {
      const li = d.createElement('li');
      li.innerHTML = `<span class="t">${((performance.now() - t0) / 1000).toFixed(2)}</span><span class="k">${k}</span><span class="v">${v}</span><span class="s ${ok ? 'ok' : 'warn'}">${ok ? 'ok' : 'fallback'}</span>`;
      log.appendChild(li);
      while (log.children.length > 5) log.firstChild.remove();
    };
    line('boot', `devraj.portfolio · v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`);

    let gl = window.__glReady ? (window.__gl ? { ok: true, ...window.__gl } : { ok: false }) : null, fontsReady = false, glLogged = false;
    addEventListener('gl:ready', (e) => { gl = e.detail || { ok: false }; }, { once: true });
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; line('fonts', 'Syne · Outfit · JetBrains Mono'); });

    const minT = quick ? 350 : 1900, maxT = 5000;
    let shown = 0, done_ = false;
    function tick(t) {
      const el = t - t0;
      if (gl && !glLogged) {
        glLogged = true;
        if (gl.ok) {
          line('webgl', `${gl.webgl2 ? 'WebGL2' : 'WebGL'} · ${gl.count.toLocaleString('en-IN')} particles`);
          if (window.__PORTRAIT) line('portrait', `density map · ${window.__PORTRAIT.w}×${window.__PORTRAIT.h} → 3D`);
        } else line('webgl', 'unavailable · 2D portrait', false);
      }
      const ready = (fontsReady && gl) || el > maxT;
      const goal = ready && el > minT ? 100 : Math.min(93, (el / minT) * 78 + (fontsReady ? 7 : 0) + (gl ? 8 : 0));
      shown += (goal - shown) * (quick ? 0.3 : 0.07);
      if (goal === 100 && shown > 99.6) shown = 100;
      nameEl.style.setProperty('--p', shown.toFixed(2) + '%');
      pct.textContent = String(Math.round(shown)).padStart(3, '0');
      if (shown >= 100 && !done_) { done_ = true; line('scene', 'ready · entering'); setTimeout(exit, quick ? 120 : 380); return; }
      requestAnimationFrame(tick);
    }
    function exit() {
      if (MOTION) {
        G.timeline({ onComplete: () => loader.remove() })
          .to($$('.loader-inner > *', loader), { y: -28, opacity: 0, duration: 0.5, ease: 'power2.in', stagger: 0.06 })
          .to($$('.loader-strips i', loader), { yPercent: -101, duration: 1, ease: 'expo.inOut', stagger: { each: 0.06, from: 'center' } }, '-=.2')
          .add(done, '-=.8');
      } else {
        loader.style.transition = 'opacity .3s';
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 320);
        done();
      }
    }
    requestAnimationFrame(tick);
  }

  function intro() {
    d.body.classList.remove('is-loading');
    if (lenis) lenis.start();
    window.__introDone = true;
    window.dispatchEvent(new Event('intro'));
    if (location.hash.length > 1 && $(location.hash)) scrollToTarget(location.hash, { immediate: true });

    $$('.hero [data-count]').forEach(countUp);
    startRoles();
    if (!MOTION) { dispatchEvent(new Event('name:ready')); return; }
    G.timeline({ defaults: { ease: 'expo.out', duration: 1.4 }, onComplete: () => dispatchEvent(new Event('name:ready')) })
      .from('.nav', { yPercent: -100, opacity: 0, duration: 1.2 }, 0)
      .from('.hero-name .ch', { yPercent: 118, rotate: 7, stagger: 0.035 }, 0.05)
      .from('.hero-name .outline .ch', { color: '#00e5ff', duration: 1.8, ease: 'power2.out', stagger: 0.06, clearProps: 'color' }, 0.45)
      .from('.hero [data-intro]', { y: 26, opacity: 0, stagger: 0.08, duration: 1.1 }, 0.35)
      .from('.hero-foot .wrap > *', { y: 18, opacity: 0, stagger: 0.1, duration: 1 }, 0.65);
  }

  /* ------------------------------------------------------------------ */
  /* Hero: role scramble + HUD                                           */
  /* ------------------------------------------------------------------ */
  const GLYPHS = '!/\\[]{}=+*^?#_01ABCDEFGHJKLMNPQRSTUVWXYZ';
  function scramble(el, text) {
    const from = el.textContent, len = Math.max(from.length, text.length);
    const q = Array.from({ length: len }, (_, i) => {
      const s = Math.floor(Math.random() * 16);
      return { from: from[i] || '', to: text[i] || '', start: s, end: s + 10 + Math.floor(Math.random() * 18), ch: '' };
    });
    let frame = 0;
    cancelAnimationFrame(el._raf);
    const update = () => {
      let out = '', done = 0;
      for (const c of q) {
        if (frame >= c.end) { done++; out += c.to; }
        else if (frame >= c.start) {
          if (!c.ch || Math.random() < 0.3) c.ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          out += `<span class="glyph">${c.ch}</span>`;
        } else out += c.from;
      }
      el.innerHTML = out;
      if (done < q.length) { frame++; el._raf = requestAnimationFrame(update); }
    };
    update();
  }
  let rolesStarted = false;
  function startRoles() {
    const el = $('#role');
    if (!el || rolesStarted || REDUCED) return;
    rolesStarted = true;
    const roles = ['full-stack systems', 'conversational AI', 'GenAI pipelines', 'agentic AI', 'distributed backends'];
    let i = 0;
    setInterval(() => {
      if (d.hidden) return;
      i = (i + 1) % roles.length;
      scramble(el, roles[i]);
    }, 2800);
  }

  /* ------------------------------------------------------------------ */
  /* Hero portrait styles: 3D particles → ASCII → halftone (auto-cycles)  */
  /* ------------------------------------------------------------------ */
  (function portraitModes() {
    const P = window.__PORTRAIT, stage = $('.pstage');
    if (!stage) return;
    if (!P || !P.a) { stage.remove(); return; }
    const NL = String.fromCharCode(10), GLYPHS = '.:-=+*#%@';
    const TARGET = P.a, LINES = TARGET.split(NL), ROWS = LINES.length;
    const COLS = Math.max.apply(null, LINES.map((l) => l.length));
    const MODES = ['particles', 'ascii', 'halftone'];
    const asciiEls = $$('.ascii', stage), hi = $('.ascii-hi', stage);
    const cvs = $('.halftone', stage), ctx = cvs.getContext('2d');
    const small = matchMedia('(max-width: 900px), (max-aspect-ratio: 9/10)');
    let mode = 'particles', glOk = !!window.__gl, inView = true, wasOut = false, started = false, timer = 0;
    let decodeRaf = 0, htRaf = 0, htGrow = 0, mx = -999, my = -999, dots = [];

    // decode order: mostly top-to-bottom, with noise — reads like a scan
    const order = new Float32Array(TARGET.length);
    for (let i = 0, row = 0; i < TARGET.length; i++) {
      if (TARGET[i] === NL) row++;
      order[i] = 0.5 * Math.random() + 0.5 * (row / ROWS);
    }

    function place() {
      const r = window.__gl && window.__gl.portraitRect ? window.__gl.portraitRect() : null;
      if (r && r.width > 0) Object.assign(stage.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', right: 'auto' });
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      const fs = h / ROWS;
      const m = d.createElement('canvas').getContext('2d');
      m.font = `500 ${fs}px "JetBrains Mono", monospace`;
      const ls = w / COLS - m.measureText('M').width;
      asciiEls.forEach((el) => { el.style.fontSize = fs + 'px'; el.style.letterSpacing = ls + 'px'; });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots(w, h);
      if (mode === 'halftone' && REDUCED) drawHalftone(performance.now());
    }

    function decode() {
      cancelAnimationFrame(decodeRaf);
      if (REDUCED) { asciiEls.forEach((el) => { el.textContent = TARGET; }); return; }
      const t0 = performance.now(), dur = 1300;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur) * 1.25;
        let out = '';
        for (let i = 0; i < TARGET.length; i++) {
          const c = TARGET[i];
          out += (c === ' ' || c === NL || order[i] < p - 0.2) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        asciiEls.forEach((el) => { el.textContent = out; });
        if (p < 1.25) decodeRaf = requestAnimationFrame(step);
        else asciiEls.forEach((el) => { el.textContent = TARGET; });
      };
      decodeRaf = requestAnimationFrame(step);
    }

    const L = Uint8Array.from(atob(P.l), (c) => c.charCodeAt(0));
    const SHADES = ['#3b2470', '#5b3fc4', '#7469ee', '#4fa8f5', '#2fd8ff', '#b8f5ff'];
    function buildDots(w, h) {
      const step = 2, cols = P.w / step, rows = P.h / step, sx = w / cols, sy = h / rows;
      dots = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = L[y * step * P.w + x * step] / 255;
          if (v < 0.06) continue;
          dots.push({ x: (x + 0.5) * sx, y: (y + 0.5) * sy, r: sx * 0.58 * Math.sqrt(v), b: Math.min(SHADES.length - 1, (v * SHADES.length) | 0), k: (x + y) * 0.16 });
        }
      }
      dots.sort((a, b) => a.b - b.b);
    }
    function drawHalftone(now) {
      htRaf = 0;
      const target = mode === 'halftone' ? 1 : 0;
      htGrow = REDUCED ? target : htGrow + (target - htGrow) * 0.07;
      const w = stage.clientWidth, h = stage.clientHeight, t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      const rect = stage.getBoundingClientRect(), lx = mx - rect.left, ly = my - rect.top, R2 = 100 * 100;
      let shade = -1;
      for (let i = 0; i < dots.length; i++) {
        const p = dots[i];
        if (p.b !== shade) { if (shade >= 0) ctx.fill(); shade = p.b; ctx.fillStyle = SHADES[shade]; ctx.beginPath(); }
        let r = p.r * htGrow * (REDUCED ? 1 : 1 + 0.14 * Math.sin(t * 2.2 - p.k));
        const dx = p.x - lx, dy = p.y - ly, d2 = dx * dx + dy * dy;
        if (d2 < R2) r *= 1 + 0.75 * (1 - d2 / R2);
        if (r < 0.15) continue;
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      if (shade >= 0) ctx.fill();
      if (!REDUCED && inView && (target === 1 || htGrow > 0.01)) htRaf = requestAnimationFrame(drawHalftone);
    }

    function setMode(m) {
      if (m === 'particles' && !glOk) m = 'ascii';
      if (m === mode && started) return;
      mode = m;
      stage.dataset.mode = m;
      dispatchEvent(new CustomEvent('gl:portrait', { detail: { visible: m === 'particles' } }));
      if (m === 'ascii') decode();
      if (!htRaf) htRaf = requestAnimationFrame(drawHalftone);
    }
    const reroll = () => {
      const opts = MODES.filter((m) => m !== mode && (m !== 'particles' || glOk));
      setMode(opts[(Math.random() * opts.length) | 0]);
    };
    function schedule() {
      clearTimeout(timer);
      if (REDUCED || !inView || small.matches || !started) return;
      timer = setTimeout(() => { reroll(); schedule(); }, 7000 + Math.random() * 4000);
    }

    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (mode === 'ascii') {
        const r = stage.getBoundingClientRect();
        hi.style.setProperty('--sx', (mx - r.left) + 'px');
        hi.style.setProperty('--sy', (my - r.top) + 'px');
      }
    }, { passive: true });
    new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (!inView) { wasOut = true; clearTimeout(timer); return; }
      if (wasOut && started && !REDUCED && !small.matches) reroll();   // a fresh look every time you come back
      wasOut = false;
      schedule();
      if (mode === 'halftone' && !htRaf) htRaf = requestAnimationFrame(drawHalftone);
    }).observe($('#hero'));
    addEventListener('resize', place);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(place);
    addEventListener('gl:ready', (e) => {
      glOk = !!(e.detail && e.detail.ok);
      place();
      if (!glOk && mode === 'particles') setMode('ascii');
    });
    place();
    // every visit opens on a random style
    const begin = () => {
      if (!small.matches) setMode(MODES[(Math.random() * MODES.length) | 0]);
      started = true;
      schedule();
    };
    if (window.__introDone) begin(); else addEventListener('intro', begin, { once: true });
  })();

  /* ------------------------------------------------------------------ */
  /* Hero name: letters thin out near the cursor, then lift off on scroll */
  /* ------------------------------------------------------------------ */
  (function nameFx() {
    const h1 = $('.hero-name');
    if (!h1) return;
    const chars = $$('.ch', h1), wraps = $$('.chw', h1);
    if (MOTION) {
      G.to(wraps, {
        yPercent: (i) => -70 - ((i * 47) % 9) * 24,
        rotate: (i) => (((i * 31) % 7) - 3) * 5,
        opacity: 0, ease: 'none', stagger: 0.035,
        scrollTrigger: { trigger: '#hero', start: 'top top', end: '75% top', scrub: 0.6 },
      });
    }
    addEventListener('name:ready', () => h1.classList.add('is-free'), { once: true });
    if (!FINE || REDUCED) return;
    const hero = $('#hero'), k = chars.map(() => 0);
    let pts = [], mx = -1e4, my = -1e4, raf = 0, armed = false;
    const measure = () => {
      pts = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2 + scrollY]; });
    };
    function frame() {
      raf = 0;
      let moving = false;
      chars.forEach((c, i) => {
        const target = Math.max(0, 1 - Math.hypot(mx - pts[i][0], my + scrollY - pts[i][1]) / 250);
        k[i] += (target - k[i]) * 0.14;
        if (Math.abs(target - k[i]) > 0.002) moving = true;
        c.style.fontWeight = String(Math.round(800 - 440 * k[i]));
      });
      if (moving) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (armed && !raf) raf = requestAnimationFrame(frame); };
    hero.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; kick(); });
    hero.addEventListener('pointerleave', () => { mx = -1e4; my = -1e4; kick(); });
    addEventListener('resize', () => { if (armed) measure(); });
    addEventListener('name:ready', () => { measure(); armed = true; }, { once: true });
  })();

  /* ------------------------------------------------------------------ */
  /* Cursor + magnetic                                                   */
  /* ------------------------------------------------------------------ */
  if (FINE && MOTION) {
    root.classList.add('has-cursor');
    const dot = $('.cursor-dot'), ring = $('.cursor-ring'), label = $('.cursor-ring span');
    const dx = G.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' }), dy = G.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = G.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = G.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    root.classList.add('c-hide');
    addEventListener('pointermove', (e) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      root.classList.remove('c-hide');
    }, { passive: true });
    d.documentElement.addEventListener('pointerleave', () => root.classList.add('c-hide'));
    addEventListener('pointerdown', () => root.classList.add('c-down'));
    addEventListener('pointerup', () => root.classList.remove('c-down'));
    const MODES = ['c-link', 'c-drag', 'c-lens', 'c-text'];
    d.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, input, label');
      root.classList.remove(...MODES);
      if (!t) return;
      const mode = t.dataset.cursor || (t.matches('input') ? 'text' : 'link');
      root.classList.add('c-' + mode);
      if (mode === 'drag') label.textContent = 'Drag';
    });
  }

  if (FINE && MOTION) {
    $$('[data-magnetic]').forEach((el) => {
      const k = parseFloat(el.dataset.magnetic) || 0.3;
      const xTo = G.quickTo(el, 'x', { duration: 0.9, ease: 'elastic.out(1,.4)' });
      const yTo = G.quickTo(el, 'y', { duration: 0.9, ease: 'elastic.out(1,.4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * k);
        yTo((e.clientY - (r.top + r.height / 2)) * k);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Card spotlight + tilt                                               */
  /* ------------------------------------------------------------------ */
  if (FINE) {
    d.addEventListener('pointermove', (e) => {
      const c = e.target.closest('.card');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }
  if (FINE && !REDUCED) {
    $$('[data-tilt]').forEach((el) => {
      const max = parseFloat(el.dataset.tilt) || 6;
      let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0;
      const loop = () => {
        rx = lerp(rx, tx, 0.12); ry = lerp(ry, ty, 0.12);
        el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
        raf = Math.abs(rx - tx) + Math.abs(ry - ty) > 0.01 ? requestAnimationFrame(loop) : 0;
        if (!raf && tx === 0 && ty === 0) el.style.transform = '';
      };
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ty = (px - 0.5) * max * 2; tx = -(py - 0.5) * max * 2;
        el.style.setProperty('--hx', `${px * 100}%`); el.style.setProperty('--hy', `${py * 100}%`);
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Nav: progress, smart hide, active section, mobile menu              */
  /* ------------------------------------------------------------------ */
  const nav = $('#nav'), progress = $('.progress');
  let lastY = scrollY, menuOpen = false;
  function navScroll() {
    const y = scrollY, max = d.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    nav.classList.toggle('is-scrolled', y > 30);
    if (!menuOpen && !nav.contains(d.activeElement)) {
      if (y > lastY + 6 && y > 400) nav.classList.add('is-hidden');
      else if (y < lastY - 6) nav.classList.remove('is-hidden');
    }
    lastY = y;
  }
  onScroll(navScroll);
  navScroll();
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  const navLinks = $$('.nlinks a'), mLinks = $$('.mmenu a[href^="#"]'), ind = $('.nind');
  function setActive(id) {
    let active = null;
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('is-active', on);
      if (on) { a.setAttribute('aria-current', 'location'); active = a; } else a.removeAttribute('aria-current');
    });
    mLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    if (ind) {
      if (active) {
        ind.style.width = active.offsetWidth + 'px';
        ind.style.transform = `translateX(${active.offsetLeft}px)`;
        ind.style.opacity = '1';
      } else ind.style.opacity = '0';
    }
  }
  const secObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => secObserver.observe(s));

  const menuBtn = $('#menu-btn'), mmenu = $('#mmenu');
  function openMenu() {
    menuOpen = true;
    mmenu.classList.add('is-open'); mmenu.inert = false;
    menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.setAttribute('aria-label', 'Close menu');
    nav.classList.remove('is-hidden');
    if (lenis) lenis.stop(); else d.body.style.overflow = 'hidden';
    setTimeout(() => { const f = $('a', mmenu); if (f) f.focus(); }, 350);
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    mmenu.classList.remove('is-open'); mmenu.inert = true;
    menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-label', 'Open menu');
    if (lenis) lenis.start(); else d.body.style.overflow = '';
  }
  if (menuBtn) menuBtn.addEventListener('click', () => (menuOpen ? (closeMenu(), menuBtn.focus()) : openMenu()));
  addEventListener('resize', () => { if (innerWidth > 1040) closeMenu(); });

  /* ------------------------------------------------------------------ */
  /* Marquee — speed and skew follow scroll velocity                     */
  /* ------------------------------------------------------------------ */
  (function marquee() {
    const box = $('.marquee'), rows = $$('.mq-row');
    if (!box || !rows.length) return;
    rows.forEach((r) => { r.innerHTML += r.innerHTML; });
    if (REDUCED) return;
    const state = rows.map((el, i) => ({ el, x: i % 2 ? -50 : 0, dir: i % 2 ? 1 : -1 }));
    let visible = false, skew = 0, sign = 1, last = performance.now();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(box);
    const step = (now) => {
      requestAnimationFrame(step);
      const dt = Math.min(64, now - last); last = now;
      if (!visible) return;
      const v = lenis ? lenis.velocity : 0;
      if (v > 0.5) sign = 1; else if (v < -0.5) sign = -1;
      skew = lerp(skew, clamp(-v * 0.3, -9, 9), 0.1);
      const speed = (2.2 + Math.min(Math.abs(v) * 0.6, 22)) * (dt / 1000);
      state.forEach((s) => {
        s.x += s.dir * sign * speed;
        if (s.x <= -50) s.x += 50; else if (s.x > 0) s.x -= 50;
        s.el.style.transform = `translate3d(${s.x.toFixed(3)}%,0,0) skewX(${skew.toFixed(2)}deg)`;
      });
    };
    requestAnimationFrame(step);
  })();

  /* ------------------------------------------------------------------ */
  /* Scroll reveals                                                      */
  /* ------------------------------------------------------------------ */
  function countUp(el) {
    const end = parseFloat(el.dataset.count), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    if (!MOTION || isNaN(end)) return;
    const o = { v: 0 };
    el.textContent = pre + '0' + suf;
    G.to(o, {
      v: end, duration: 2.2, ease: 'power3.out', delay: 0.3,
      onUpdate: () => { el.textContent = pre + Math.round(o.v).toLocaleString('en-IN') + suf; },
    });
  }

  if (MOTION) {
    $$('.title').forEach((t) => {
      const words = splitWords(t);
      G.from(words, { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: t, start: 'top 86%', once: true } });
    });
    $$('.eyebrow').forEach((e) => {
      G.from(e, { x: -24, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: e, start: 'top 90%', once: true } });
    });
    const lead = $('.lead');
    if (lead) {
      const words = splitWords(lead);
      G.fromTo(words, { opacity: 0.16 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 50%', scrub: true },
      });
    }
    G.set('[data-reveal]', { y: 46, opacity: 0 });
    ST.batch('[data-reveal]', {
      start: 'top 90%', once: true,
      onEnter: (b) => G.to(b, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.09, overwrite: true }),
    });
    $$('[data-count]').forEach((el) => {
      if (el.closest('.hero')) return;
      ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => countUp(el) });
    });

    // credentials tilt up in a 3D wave as they scroll in
    const wave = (sel, trig) => {
      const els = $$(sel);
      if (!els.length) return;
      G.fromTo(els, { rotateX: 58, y: 90, opacity: 0, transformPerspective: 900, transformOrigin: '50% 100%' }, {
        rotateX: 0, y: 0, opacity: 1, ease: 'power2.out', stagger: 0.12,
        scrollTrigger: { trigger: trig, start: 'top 90%', end: 'top 35%', scrub: 0.8 },
      });
    };
    wave('.bento .ach', '.bento');
    wave('.certs .cert', '.certs');

    // the contact headline zooms into place
    G.fromTo('.contact-title', { scale: 0.72, opacity: 0.25 }, {
      scale: 1, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '#contact', start: 'top 95%', end: 'top 30%', scrub: 0.6 },
    });

    // the giant footer wordmark rises letter by letter
    const bn = $('.bigname');
    if (bn) {
      bn.innerHTML = Array.from(bn.textContent).map((ch) => `<span class="bc">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
      G.from($$('.bc', bn), {
        yPercent: 110, ease: 'none', stagger: 0.06,
        scrollTrigger: { trigger: bn, start: 'top bottom', end: 'bottom 80%', scrub: 0.6 },
      });
    }

    // the project grid leans with scroll speed
    const grid = $('.pgrid');
    if (grid && lenis) {
      const setSkew = G.quickSetter(grid, 'skewY', 'deg');
      let sk = 0;
      G.ticker.add(() => {
        sk += (clamp(-(lenis.velocity || 0) * 0.12, -3, 3) - sk) * 0.1;
        if (Math.abs(sk) < 0.005) sk = 0;
        setSkew(sk);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* About: cinematic intro (pinned, scroll-scrubbed) + flippable ID card */
  /* ------------------------------------------------------------------ */
  (function cinematic() {
    const cine = $('#cine');
    if (!cine || !MOTION) return;
    const lines = $$('.cine-line', cine), count = $('.cine-count', cine), n = lines.length;
    G.set(lines, { yPercent: -50 });
    const tl = G.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: cine, start: 'top top', end: () => '+=' + innerHeight * n * 0.85,
        pin: true, scrub: 0.8, invalidateOnRefresh: true, refreshPriority: 2,
        onUpdate: (self) => { count.textContent = String(Math.min(n, 1 + Math.floor(self.progress * n * 0.999))).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'); },
      },
    });
    lines.forEach((l, i) => {
      tl.fromTo(l, { opacity: 0, y: 70, filter: 'blur(16px)', letterSpacing: '0.1em' },
        { opacity: 1, y: 0, filter: 'blur(0px)', letterSpacing: '-0.035em', duration: 1, ease: 'power3.out' });
      tl.to({}, { duration: 0.7 });
      if (i < n - 1) tl.to(l, { opacity: 0, y: -70, filter: 'blur(12px)', duration: 0.8, ease: 'power2.in' });
    });
    tl.fromTo($('.cine-bar i', cine), { scaleX: 0 }, { scaleX: 1, duration: tl.duration() }, 0);
  })();

  (function idCard() {
    const card = $('#idc'), btn = $('.idc-flip');
    if (!card) return;
    const front = $('.idc-front', card), back = $('.idc-back', card);
    const flip = (on) => {
      card.classList.toggle('is-flipped', on);
      if (btn) btn.setAttribute('aria-pressed', String(on));
      front.inert = on; back.inert = !on;
    };
    flip(false);
    if (btn) btn.addEventListener('click', () => flip(!card.classList.contains('is-flipped')));
    card.addEventListener('click', (e) => { if (!e.target.closest('a')) flip(!card.classList.contains('is-flipped')); });

    // ASCII "photo" — head & shoulders slice of the portrait
    const P = window.__PORTRAIT, pre = $('.idc-ascii', card), box = $('.idc-photo', card);
    if (!P || !P.a || !pre) return;
    const NL = String.fromCharCode(10), rows = P.a.split(NL).slice(5, 43);
    const text = rows.join(NL), GL = '.:-=+*#%@';
    const fit = () => { pre.style.fontSize = (box.clientHeight - 4) / rows.length + 'px'; };
    pre.textContent = text;
    fit();
    addEventListener('resize', fit);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(fit);
    if (REDUCED) return;
    // a subtle "live feed" flicker: a few characters glitch now and then
    setInterval(() => {
      if (d.hidden || card.classList.contains('is-flipped')) return;
      const arr = text.split('');
      for (let k = 0; k < 18; k++) {
        const i = (Math.random() * arr.length) | 0;
        if (arr[i] !== ' ' && arr[i] !== NL) arr[i] = GL[(Math.random() * GL.length) | 0];
      }
      pre.textContent = arr.join('');
      setTimeout(() => { pre.textContent = text; }, 120);
    }, 1600);
  })();

  /* ------------------------------------------------------------------ */
  /* Experience: vertical scroll drives a horizontal timeline            */
  /* ------------------------------------------------------------------ */
  (function horizontal() {
    const hx = $('#hx');
    if (!hx || !MOTION) return;
    const track = $('.hx-track', hx), fill = $('.hx-fill', hx), marks = $$('.hx-marks li', hx), panels = $$('.panel', track);
    G.matchMedia().add('(min-width: 1000px) and (min-height: 620px)', () => {
      hx.classList.add('is-h');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tween = G.to(track, { x: () => -dist(), ease: 'none' });
      ST.create({
        trigger: hx, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8,
        animation: tween, invalidateOnRefresh: true, refreshPriority: 1,
        onUpdate: (self) => {
          fill.style.transform = `scaleX(${self.progress})`;
          const on = Math.round(self.progress * (marks.length - 1));
          marks.forEach((m, i) => m.classList.toggle('is-on', i <= on));
        },
      });
      panels.forEach((p, i) => {
        if (i === 0) return;
        G.fromTo(p, { opacity: 0.35, scale: 0.94 }, {
          opacity: 1, scale: 1, ease: 'none',
          scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left 92%', end: 'left 45%', scrub: true },
        });
      });
      return () => { hx.classList.remove('is-h'); G.set(track, { clearProps: 'transform' }); G.set(panels, { clearProps: 'opacity,transform' }); };
    });
  })();

  /* Umbrella panel: HTTP polling (stale steps) vs WebSocket stream (every tick) */
  (function ticker() {
    const cvs = $('#ticker');
    if (!cvs) return;
    const ctx = cvs.getContext('2d'), N = 96, POLL = 9;
    let w = 0, h = 0, v = 100, tick = 0, visible = false, timer = 0;
    const stream = [], poll = [];
    const next = () => { v += (Math.random() - 0.5) * 2.6 + (100 - v) * 0.02; tick++; return v; };
    for (let i = 0; i < N; i++) { stream.push(next()); poll.push(i % POLL === 0 || !poll.length ? v : poll[poll.length - 1]); }
    function fit() {
      const r = cvs.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function draw() {
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      const lo = Math.min.apply(null, stream) - 1, hi = Math.max.apply(null, stream) + 1;
      const X = (i) => 12 + (i / (N - 1)) * (w - 70), Y = (val) => 34 + (1 - (val - lo) / (hi - lo)) * (h - 52);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) { const y = 34 + g * (h - 52) / 3; ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(w - 58, y); ctx.stroke(); }
      ctx.setLineDash([3, 4]); ctx.strokeStyle = '#7c7c9a'; ctx.lineWidth = 1.4; ctx.beginPath();
      poll.forEach((p, i) => { const x = X(i), y = Y(p); if (!i) ctx.moveTo(x, y); else { ctx.lineTo(x, Y(poll[i - 1])); ctx.lineTo(x, y); } });
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 8; ctx.beginPath();
      stream.forEach((p, i) => { const x = X(i), y = Y(p); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.shadowBlur = 0;
      const lx = X(N - 1), ly = Y(stream[N - 1]), py = Y(poll[N - 1]);
      ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7c7c9a'; ctx.beginPath(); ctx.arc(lx, py, 3, 0, Math.PI * 2); ctx.fill();
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f59e0b'; ctx.fillText(stream[N - 1].toFixed(2), lx + 8, ly + 4);
      ctx.fillStyle = '#7c7c9a'; ctx.fillText(poll[N - 1].toFixed(2), lx + 8, py + (Math.abs(py - ly) < 14 ? 16 : 4));
    }
    function step() {
      timer = 0;
      if (!visible) return;
      stream.push(next()); stream.shift();
      poll.push(tick % POLL === 0 ? v : poll[poll.length - 1]); poll.shift();
      draw();
      timer = setTimeout(step, 140);
    }
    new ResizeObserver(fit).observe(cvs);
    if (REDUCED) return;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !timer) step(); }).observe(cvs);
  })();

  /* AlgoUniversity panel: submissions stream in with verdicts */
  (function judge() {
    const box = $('#judge');
    if (!box) return;
    const SUBS = [
      ['two_sum.cpp', 'ac', '12 ms'], ['lru_cache.py', 'tle', '2000 ms'], ['dijkstra.java', 'ac', '88 ms'],
      ['knapsack.cpp', 'wa', 'test 7'], ['trie.py', 'ac', '41 ms'], ['segment_tree.cpp', 're', 'SIGSEGV'],
      ['union_find.java', 'ac', '63 ms'], ['kmp.cpp', 'ac', '9 ms'],
    ];
    const LABEL = { ac: 'AC', wa: 'WA', tle: 'TLE', re: 'RE' };
    let n = 4127, k = 0, visible = false, timer = 0;
    const cmd = d.createElement('div');
    cmd.className = 'cmd';
    cmd.innerHTML = '$ docker run --rm <b>--cpus=1 --memory=256m</b> judge:sandbox';
    box.appendChild(cmd);
    function add() {
      const [file, v, ms] = SUBS[k++ % SUBS.length];
      const row = d.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span class="id">#${n++}</span><span>${file}</span><span class="v ${v}">${LABEL[v]}</span><span class="ms">${ms}</span>`;
      box.appendChild(row);
      const rows = $$('.row', box);
      if (rows.length > 6) rows[0].remove();
    }
    for (let i = 0; i < 5; i++) add();
    if (REDUCED) return;
    const loop = () => { timer = 0; if (!visible) return; add(); timer = setTimeout(loop, 1100); };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !timer) timer = setTimeout(loop, 600); }).observe(box);
  })();

  /* ------------------------------------------------------------------ */
  /* Skill sphere — built from the category lists (single source)        */
  /* ------------------------------------------------------------------ */
  (function sphere() {
    const el = $('#sphere');
    if (!el) return;
    const cats = $$('.cat');
    cats.forEach((c) => {
      const items = $$('.pill', c);
      const cnt = $('.cat-count', c);
      if (cnt) cnt.textContent = String(items.length).padStart(2, '0') + ' tools';
      items.forEach((p) => {
        const s = d.createElement('span');
        s.className = 'sk'; s.dataset.c = c.dataset.c; s.textContent = p.textContent;
        s.style.setProperty('--c', getComputedStyle(c).getPropertyValue('--c'));
        el.appendChild(s);
      });
    });
    const tags = $$('.sk', el), n = tags.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts = tags.map((_, i) => {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r };
    });
    let ax = -0.3, ay = 0, vx = 0.0012, vy = 0.0035, R = 0, dragging = false, lx = 0, ly = 0, visible = false, raf = 0;
    const measure = () => { R = Math.min(el.clientWidth * 0.38, el.clientWidth * 0.5 - 56); };
    measure();
    new ResizeObserver(measure).observe(el);

    function render() {
      const sa = Math.sin(ax), ca = Math.cos(ax), sb = Math.sin(ay), cb = Math.cos(ay);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const x = p.x * cb + p.z * sb;
        let z = -p.x * sb + p.z * cb;
        const y = p.y * ca - z * sa;
        z = p.y * sa + z * ca;
        const s = (z + 2.2) / 3.2;
        const t = tags[i];
        t.style.transform = `translate3d(${(x * R).toFixed(1)}px,${(y * R).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
        t.style.opacity = (0.18 + 0.82 * ((z + 1) / 2)).toFixed(3);
        t.style.zIndex = String(Math.round((z + 1) * 100));
      }
    }
    function frame() {
      if (!dragging) { vx = lerp(vx, 0.0012, 0.02); vy = lerp(vy, 0.0035, 0.02); }
      ax += vx; ay += vy + (lenis ? lenis.velocity : 0) * 0.0012;
      render();
      raf = visible ? requestAnimationFrame(frame) : 0;
    }
    render();
    if (REDUCED) return;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(el);

    el.addEventListener('pointerdown', (e) => {
      dragging = true; lx = e.clientX; ly = e.clientY;
      el.setPointerCapture(e.pointerId); el.classList.add('is-drag');
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      vy = (e.clientX - lx) * 0.005; vx = -(e.clientY - ly) * 0.005;
      lx = e.clientX; ly = e.clientY;
    });
    const end = () => { dragging = false; el.classList.remove('is-drag'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    const highlight = (c) => tags.forEach((t) => t.classList.toggle('is-dim', !!c && t.dataset.c !== c));
    cats.forEach((c) => {
      c.addEventListener('mouseenter', () => highlight(c.dataset.c));
      c.addEventListener('mouseleave', () => highlight(null));
    });
  })();

  /* ------------------------------------------------------------------ */
  /* Project filter (GSAP Flip)                                          */
  /* ------------------------------------------------------------------ */
  (function projects() {
    const btns = $$('.fbtn'), cards = $$('.pc'), live = $('#pcount');
    if (!btns.length) return;
    const has = (c, f) => f === 'all' || c.dataset.cat.split(' ').includes(f);
    btns.forEach((b) => {
      const sup = $('sup', b);
      if (sup) sup.textContent = cards.filter((c) => has(c, b.dataset.f)).length;
    });
    let revealed = false;
    btns.forEach((b) => b.addEventListener('click', () => {
      const f = b.dataset.f;
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (MOTION && !revealed) { revealed = true; G.set(cards, { opacity: 1, y: 0 }); }
      const state = MOTION && FLIP ? FLIP.getState(cards) : null;
      cards.forEach((c) => c.classList.toggle('is-hidden', !has(c, f)));
      const shown = cards.filter((c) => !c.classList.contains('is-hidden')).length;
      if (live) live.textContent = `Showing ${shown} project${shown === 1 ? '' : 's'}`;
      if (state) {
        FLIP.from(state, {
          duration: 0.75, ease: 'expo.inOut', absolute: true,
          onEnter: (els) => G.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.25, ease: 'expo.out' }),
          onLeave: (els) => G.to(els, { opacity: 0, scale: 0.92, duration: 0.35 }),
          onComplete: () => ST.refresh(),
        });
      } else if (ST) ST.refresh();
    }));
  })();

  /* ------------------------------------------------------------------ */
  /* Route optimizer demo — sweep partition, greedy NN, then 2-opt       */
  /* ------------------------------------------------------------------ */
  (function routeDemo() {
    const svg = $('#route-svg');
    if (!svg) return;
    const W = 420, H = 300, depot = { x: 210, y: 150 }, COLORS = ['#00e5ff', '#9b5cf6', '#f59e0b'];
    const gGhost = $('.r-ghost', svg), gRoutes = $('.r-routes', svg), gStops = $('.r-stops', svg), gCars = $('.r-cars', svg);
    const out = { g: $('#r-greedy'), o: $('#r-opt'), gain: $('#r-gain') };
    let seed = 7, cars = [], visible = false, raf = 0, startedAt = 0, drawn = false;

    const rng = (a) => () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const len = (r) => r.reduce((s, p, i) => (i ? s + dist(r[i - 1], p) : 0), 0);
    function greedy(stops) {
      const left = stops.slice(), route = [depot];
      let cur = depot;
      while (left.length) {
        let bi = 0, bd = Infinity;
        left.forEach((p, i) => { const dd = dist(cur, p); if (dd < bd) { bd = dd; bi = i; } });
        cur = left.splice(bi, 1)[0]; route.push(cur);
      }
      route.push(depot);
      return route;
    }
    function twoOpt(route) {
      const r = route.slice();
      let improved = true;
      while (improved) {
        improved = false;
        for (let i = 1; i < r.length - 2; i++) {
          for (let k = i + 1; k < r.length - 1; k++) {
            const delta = dist(r[i - 1], r[k]) + dist(r[i], r[k + 1]) - dist(r[i - 1], r[i]) - dist(r[k], r[k + 1]);
            if (delta < -1e-9) { r.splice(i, k - i + 1, ...r.slice(i, k + 1).reverse()); improved = true; }
          }
        }
      }
      return r;
    }
    function solve() {
      const rand = rng(seed), stops = [];
      let guard = 0;
      while (stops.length < 24 && guard++ < 5000) {
        const p = { x: 26 + rand() * (W - 52), y: 26 + rand() * (H - 52) };
        if (dist(p, depot) > 36 && stops.every((q) => dist(p, q) > 18)) stops.push(p);
      }
      const off = rand() * Math.PI * 2;
      stops.forEach((p) => { p.a = (Math.atan2(p.y - depot.y, p.x - depot.x) - off + Math.PI * 4) % (Math.PI * 2); });
      stops.sort((a, b) => a.a - b.a);
      const size = Math.ceil(stops.length / 3);
      const groups = [0, 1, 2].map((i) => stops.slice(i * size, (i + 1) * size));
      const g = groups.map(greedy), o = g.map(twoOpt);
      return { groups, g, o, gl: g.reduce((s, r) => s + len(r), 0), ol: o.reduce((s, r) => s + len(r), 0) };
    }
    const pathD = (r) => 'M' + r.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L');

    function draw() {
      const res = solve();
      gGhost.innerHTML = res.g.map((r) => `<path d="${pathD(r)}"/>`).join('');
      gRoutes.innerHTML = res.o.map((r, i) => `<path d="${pathD(r)}" stroke="${COLORS[i]}"/>`).join('');
      gStops.innerHTML = res.groups.map((grp, i) => grp.map((p) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.6" fill="#05050a" stroke="${COLORS[i]}" stroke-width="1.6"/>`).join('')).join('');
      gCars.innerHTML = COLORS.map((c) => `<circle r="4.5" fill="${c}" style="filter:drop-shadow(0 0 5px ${c})" opacity="0"/>`).join('');
      const paths = $$('path', gRoutes);
      cars = paths.map((p, i) => ({ p, L: p.getTotalLength(), el: gCars.children[i], off: i * 0.31 }));
      paths.forEach((p, i) => {
        const L = p.getTotalLength();
        p.style.strokeDasharray = `${L}`;
        if (REDUCED) { p.style.strokeDashoffset = '0'; return; }
        p.style.transition = 'none';
        p.style.strokeDashoffset = `${L}`;
        p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset 1.8s cubic-bezier(.65,0,.35,1) ${i * 0.18}s`;
        p.style.strokeDashoffset = '0';
      });
      out.g.textContent = Math.round(res.gl).toLocaleString('en-IN');
      out.o.textContent = Math.round(res.ol).toLocaleString('en-IN');
      out.gain.textContent = `−${((1 - res.ol / res.gl) * 100).toFixed(1)}%`;
      startedAt = performance.now();
      drawn = true;
    }
    function tick(now) {
      raf = visible ? requestAnimationFrame(tick) : 0;
      const t = (now - startedAt) / 1000 - 2.2;
      if (t < 0) return;
      cars.forEach((c) => {
        const u = ((t * 0.075 + c.off) % 1) * c.L;
        const pt = c.p.getPointAtLength(u);
        c.el.setAttribute('cx', pt.x.toFixed(1)); c.el.setAttribute('cy', pt.y.toFixed(1));
        c.el.setAttribute('opacity', Math.min(1, t * 2).toFixed(2));
      });
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !drawn) draw();
      if (visible && !raf && !REDUCED) raf = requestAnimationFrame(tick);
    }, { threshold: 0.25 }).observe(svg);
    const btn = $('#resolve');
    if (btn) btn.addEventListener('click', () => { seed += 1; draw(); });
  })();

  /* ------------------------------------------------------------------ */
  /* NeuroAgent terminal — simulated run synced to the pipeline diagram  */
  /* ------------------------------------------------------------------ */
  (function terminal() {
    const body = $('#term-body');
    if (!body) return;
    const nodes = $$('#pipeline [data-agent]'), retry = $('#pipeline .retry');
    const stateEl = $('#term-state'), stepEl = $('#term-step'), playBtn = $('#term-play'), replayBtn = $('#term-replay');
    const AGENT_C = {
      planner: 'var(--cyan)', coder: 'var(--violet)', tester: 'var(--green)', reviewer: 'var(--amber)',
      deploy: 'var(--pink)', orchestrator: 'var(--blue)', memory: 'var(--green)',
    };
    const S = [
      { a: 'user', t: 'neuroagent run "Add rate limiting to POST /api/submit"', pause: 500 },
      { a: 'orchestrator', t: 'graph compiled · 5 agents · memory: redis + pgvector' },
      { a: 'memory', node: 'orchestrator', t: 'recalled 3 similar tasks (cosine ≥ 0.82)', cls: 'dim' },
      { a: 'planner', t: 'decomposed task into 3 subtasks' },
      { a: 'planner', t: '  ├─ token-bucket middleware backed by Redis', cls: 'dim', quick: true },
      { a: 'planner', t: '  ├─ wire middleware into routes/submit.ts', cls: 'dim', quick: true },
      { a: 'planner', t: '  └─ tests: burst + steady-state traffic', cls: 'dim', quick: true },
      { a: 'coder', t: 'wrote middleware/rateLimit.ts  (+64)' },
      { a: 'coder', t: 'patched routes/submit.ts  (+3 −1)' },
      { a: 'tester', t: 'sandbox up · docker node:20-alpine' },
      { a: 'tester', t: '11 passed · 1 failed  ✗ burst_limit_exceeded', cls: 'err' },
      { a: 'reviewer', t: 'quality gate FAILED → routing back to coder', cls: 'warn', retry: true, pause: 700 },
      { a: 'coder', t: 'fix: off-by-one in bucket.refill()  (+1 −1)', retry: true },
      { a: 'tester', t: '12 passed · 0 failed  ✓', cls: 'ok' },
      { a: 'reviewer', t: 'quality gate PASSED · no secrets · complexity ok', cls: 'ok' },
      { a: 'deploy', t: 'commit 3f9a1c2 "feat: rate-limit /api/submit" → main', cls: 'ok' },
      { a: 'deploy', t: 'GitHub Actions triggered · CI running', cls: 'ok' },
      { a: 'done', t: '✓ task complete in 47.2s · streamed over WebSocket', cls: 'ok', pause: 3800 },
    ];
    let li = 0, ci = 0, cur = null, txt = null, timer = 0, playing = true, visible = false;
    const seen = new Set();
    const caret = d.createElement('span'); caret.className = 'caret';

    function setAgent(a) {
      if (a && a !== 'user' && a !== 'done') seen.add(a);
      nodes.forEach((n) => {
        const id = n.dataset.agent, on = id === a;
        n.classList.toggle('is-active', on);
        n.classList.toggle('is-done', !on && seen.has(id));
        const st = $('.state', n);
        if (st) st.textContent = on ? 'running' : seen.has(id) ? 'done' : 'idle';
      });
    }
    function status(text, cls) {
      stateEl.textContent = text;
      stateEl.className = 'live' + (cls ? ' ' + cls : '');
    }
    function reset() {
      clearTimeout(timer); timer = 0;
      body.textContent = ''; li = 0; ci = 0; cur = null; seen.clear();
      setAgent(null); if (retry) retry.classList.remove('is-active');
      status('running');
    }
    function openLine(L) {
      cur = d.createElement('div');
      cur.className = 'tline ' + (L.a === 'user' ? 'user ' : '') + (L.cls || '');
      const tag = d.createElement('span'); tag.className = 'tag';
      tag.textContent = L.a === 'user' ? '$ ' : L.a === 'done' ? '' : `[${L.a}] `;
      if (AGENT_C[L.a]) tag.style.setProperty('--c', AGENT_C[L.a]);
      txt = d.createElement('span');
      cur.append(tag, txt, caret);
      body.appendChild(cur);
      setAgent(L.node || L.a);
      dispatchEvent(new CustomEvent('agent:active', { detail: L.node || L.a }));
      if (retry) retry.classList.toggle('is-active', !!L.retry);
      stepEl.textContent = `step ${String(li + 1).padStart(2, '0')}/${S.length}`;
    }
    function step() {
      timer = 0;
      if (!playing || !visible) return;
      if (li >= S.length) { status('complete', 'done'); timer = setTimeout(() => { reset(); step(); }, 3500); return; }
      const L = S[li];
      if (ci === 0) openLine(L);
      const inc = L.a === 'user' ? 1 : L.quick ? 6 : 3;
      ci = Math.min(L.t.length, ci + inc);
      txt.textContent = L.t.slice(0, ci);
      body.scrollTop = body.scrollHeight;
      if (ci >= L.t.length) {
        li++; ci = 0;
        if (L.a === 'done') setAgent(null);
        timer = setTimeout(step, L.pause || (L.quick ? 120 : 420));
      } else timer = setTimeout(step, L.a === 'user' ? 38 : 14);
    }
    function renderAll() {
      reset();
      S.forEach((L, i) => { li = i; openLine(L); txt.textContent = L.t; });
      li = S.length; caret.remove(); setAgent(null);
      if (retry) retry.classList.remove('is-active');
      status('complete', 'done');
    }
    function setPlaying(p) {
      playing = p;
      playBtn.setAttribute('aria-label', p ? 'Pause simulation' : 'Play simulation');
      playBtn.setAttribute('aria-pressed', String(!p));
      $('use', playBtn).setAttribute('href', p ? '#i-pause' : '#i-play');
      if (p) { status('running'); if (!timer) step(); }
      else { clearTimeout(timer); timer = 0; status('paused', 'paused'); }
    }

    if (REDUCED) {
      renderAll();
      playBtn.hidden = true;
      replayBtn.addEventListener('click', renderAll);
      return;
    }
    playBtn.addEventListener('click', () => setPlaying(!playing));
    replayBtn.addEventListener('click', () => { reset(); setPlaying(true); });
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && playing && !timer) step();
    }, { threshold: 0.3 }).observe(body);
  })();

  /* ------------------------------------------------------------------ */
  /* Current-role card: illustrative "free text → structured search" demo */
  /* ------------------------------------------------------------------ */
  (function nluDemo() {
    const box = $('#nlu');
    if (!box) return;
    const steps = $$('[data-step]', box), bubbles = $$('.bub', box);
    const chip = $('#nlu-adults', box), adults = $('b', chip);
    const texts = bubbles.map((b) => b.textContent);
    if (!MOTION) { adults.textContent = '3'; chip.classList.add('is-changed'); return; }
    let visible = false, running = false;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const show = (i) => steps[i].classList.add('is-in');
    async function type(el, text) {
      for (let i = 1; i <= text.length; i++) { el.textContent = text.slice(0, i); await wait(24); }
    }
    async function loop() {
      while (visible) {
        steps.forEach((s) => s.classList.remove('is-in'));
        bubbles.forEach((b) => { b.textContent = ''; });
        adults.textContent = '2'; chip.classList.remove('is-changed');
        await wait(450);
        show(0); await type(bubbles[0], texts[0]); await wait(300);
        show(1); await wait(1700);
        show(2); await type(bubbles[1], texts[1]); await wait(350);
        adults.textContent = '3'; chip.classList.add('is-changed'); show(3);
        await wait(4200);
      }
      running = false;
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !running) { running = true; loop(); }
    }, { threshold: 0.35 }).observe(box);
  })();

  /* ------------------------------------------------------------------ */
  /* Clipboard + toast                                                   */
  /* ------------------------------------------------------------------ */
  const toastEl = $('#toast');
  let toastT = 0;
  function toast(msg) {
    if (!toastEl) return;
    $('.toast-msg', toastEl).textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2800);
  }
  async function copyEmail(btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(EMAIL); ok = true; } catch (e) {
      const ta = d.createElement('textarea');
      ta.value = EMAIL; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      d.body.appendChild(ta); ta.select();
      try { ok = d.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
    }
    toast(ok ? 'Email copied to clipboard' : `Copy failed — ${EMAIL}`);
    if (ok && btn) {
      btn.classList.add('is-done');
      $('use', btn).setAttribute('href', '#i-check');
      setTimeout(() => { btn.classList.remove('is-done'); $('use', btn).setAttribute('href', '#i-copy'); }, 2000);
    }
  }
  $$('[data-copy-email]').forEach((b) => b.addEventListener('click', () => copyEmail(b)));
  addEventListener('gl:state', (e) => toast(e.detail.enabled ? '3D background resumed' : '3D background paused'));

  /* ------------------------------------------------------------------ */
  /* Projects: long descriptions collapse behind "Read more"             */
  /* ------------------------------------------------------------------ */
  (function readMore() {
    $$('.pc-desc').forEach((p) => {
      p.classList.add('is-clamped');
      if (p.scrollHeight <= p.clientHeight + 2) { p.classList.remove('is-clamped'); return; }
      const btn = d.createElement('button');
      btn.type = 'button'; btn.className = 'more-btn'; btn.textContent = 'Read more ↓';
      btn.setAttribute('aria-expanded', 'false');
      p.after(btn);
      btn.addEventListener('click', () => {
        const open = p.classList.toggle('is-clamped') === false;
        btn.textContent = open ? 'Show less ↑' : 'Read more ↓';
        btn.setAttribute('aria-expanded', String(open));
        if (ST) ST.refresh();
      });
    });
    $$('.rdetails').forEach((dt) => dt.addEventListener('toggle', () => { if (ST) ST.refresh(); }));
  })();

  /* ------------------------------------------------------------------ */
  /* NeuroAgent inspector: what each node takes in, emits, and why        */
  /* ------------------------------------------------------------------ */
  (function inspector() {
    const box = $('#inspect');
    if (!box) return;
    const INFO = {
      user: ['User input', 'A task in plain English', 'Task + repo context', 'No tickets or specs needed — ambiguity becomes clarifying questions.'],
      orchestrator: ['Orchestrator', 'Task + shared graph state', 'Which agent runs next', 'A LangGraph state machine: conditional edges route on test and review outcomes.'],
      planner: ['PlannerAgent', 'Task in plain English', 'Ordered subtasks with acceptance criteria', 'Small, testable steps keep generated diffs focused and reviewable.'],
      coder: ['CoderAgent', 'One subtask + relevant files', 'A code diff', 'GPT-4 / Claude with file-system tools, plus similar past fixes recalled from pgvector.'],
      tester: ['TestAgent', 'The diff', 'Test results + traces', 'Writes tests and runs them in an isolated Docker sandbox — no side effects on the host.'],
      reviewer: ['ReviewerAgent', 'Diff + test results', 'Pass, or retry with feedback', 'The quality gate: failures loop back to the coder with the trace instead of shipping.'],
      deploy: ['DeployAgent', 'An approved diff', 'A commit + CI run', 'Commits through the GitHub API and triggers CI/CD; the run streams live over WebSockets.'],
    };
    const h = $('.inspect-h', box), io = $$('.inspect-io dd', box), why = $('.inspect-why', box);
    let pinned = false;
    const show = (id) => {
      const it = INFO[id];
      if (!it) return;
      h.textContent = it[0]; io[0].textContent = it[1]; io[1].textContent = it[2]; why.textContent = it[3];
    };
    $$('#pipeline .pnode').forEach((n) => {
      n.tabIndex = 0;
      n.setAttribute('aria-describedby', 'inspect');
      const on = () => { pinned = true; show(n.dataset.agent); };
      const off = () => { pinned = false; };
      n.addEventListener('mouseenter', on); n.addEventListener('focus', on);
      n.addEventListener('mouseleave', off); n.addEventListener('blur', off);
    });
    addEventListener('agent:active', (e) => { if (!pinned && e.detail && e.detail !== 'done') show(e.detail); });
  })();

  /* ------------------------------------------------------------------ */
  /* Ask Devraj: a scripted, keyword-matched assistant (no LLM)          */
  /* ------------------------------------------------------------------ */
  let openChat = () => {};
  (function chat() {
    const panel = $('#chat'), log = $('#chat-log'), chipsBox = $('#chat-chips'), form = $('#chat-form'), input = $('#chat-input');
    const fab = $('.chat-fab');
    if (!panel) return;
    const LI = 'https://www.linkedin.com/in/devraj-parmar-459363187';
    const KB = [
      { id: 'flight planner', k: ['flight planner', 'flight', 'internal', 'internals'], a: 'Flight Planner lets people search, refine and book flights in plain English. It is a production product, so its internals stay confidential — Devraj is happy to discuss it at a high level in an interview.' },
      { id: 'resume', k: ['resume', 'cv'], a: 'Here you go — his one-page resume.', act: [['Download resume', 'resume']] },
      { id: 'cgpa', k: ['cgpa', 'gpa', 'grade', 'marks'], a: 'CGPA 7.05/10 — his shipped work tells the fuller story.' },
      { id: 'contact', k: ['contact', 'email', 'mail', 'reach', 'hire', 'phone', 'call', 'connect', 'linkedin', 'talk'], a: 'Email devrajparmar232@gmail.com or message him on LinkedIn — he replies quickly.', act: [['Copy email', 'copy'], ['LinkedIn', LI]] },
      { id: 'work', k: ['work', 'job', 'company', 'current', 'neural', 'nurture', 'experience', 'employ', 'role', 'intern', 'umbrella', 'algouniversity'], a: 'Now: SDE at Neural Nurture (Apr 2026 – present), working across Flight Planner, a conversational AI flight-booking product — NLP models, a streaming chat UI, payments, auth and release engineering. Before: Umbrella Corporate (real-time trading, −25% latency) and AlgoUniversity (an online judge built solo).', act: [['Experience', '#experience']] },
      { id: 'skills', k: ['skill', 'stack', 'tech', 'language', 'tools', 'framework', 'know'], a: 'Languages: C++, Python, JavaScript/TypeScript, SQL. Backend: Node.js, Express, FastAPI, microservices, WebSockets. AI: LLMs, RAG, LangChain/LangGraph, PyTorch, NER. Data & cloud: PostgreSQL, MongoDB, Redis, Pinecone, Docker, AWS, CI/CD.', act: [['Tech stack', '#stack']] },
      { id: 'projects', k: ['project', 'built', 'build', 'github', 'neuroagent', 'rag', 'route', 'judge'], a: 'Highlights: NeuroAgent (an autonomous coding agent on LangGraph), a multi-agent RAG system (90% retrieval precision), Route Optimizer (−20% distance vs a nearest-neighbour baseline) and Judge My Code (a Docker-sandboxed judge). Ten in total.', act: [['Browse projects', '#projects'], ['GitHub', 'https://github.com/DevrajParmarr']] },
      { id: 'ai', k: ['ai', 'ml', 'llm', 'nlp', 'agent', 'genai', 'machine', 'model', 'models'], a: 'At work he trains NER and intent models for a conversational product. On the side: NeuroAgent (multi-agent coding with LangGraph) and a self-correcting multi-agent RAG pipeline. Oracle-certified in Generative AI.', act: [['See NeuroAgent', '#sysdesign']] },
      { id: 'education', k: ['education', 'college', 'degree', 'university', 'study', 'studied', 'sgsits', 'graduat', 'btech', 'b.tech'], a: 'B.Tech in Computer Science & Engineering at SGSITS Indore (RGPV), 2022 – May 2026.' },
      { id: 'achievements', k: ['achievement', 'leetcode', 'codechef', 'codeforces', 'rating', 'competitive', 'dsa', 'jee', 'rank', 'certif', 'oracle'], a: '550+ LeetCode problems, CodeChef 3★ (1692, top 10% globally), Codeforces Specialist (1474), JEE Mains AIR ~40K, and two Oracle AI certifications.', act: [['Credentials', '#credentials']] },
      { id: 'location', k: ['where', 'location', 'based', 'live', 'city', 'relocat', 'remote', 'indore'], a: 'Based in Indore, India — and open to relocation.' },
      { id: 'hobbies', k: ['hobby', 'hobbies', 'sport', 'sports', 'fun', 'volleyball', 'free'], a: 'Off-screen: state-level volleyball and kho-kho.' },
      { id: 'about', k: ['who', 'about', 'yourself', 'introduce', 'name', 'devraj'], a: 'Devraj Parmar — a Software Development Engineer at Neural Nurture in Indore and a 2026 B.Tech CSE graduate of SGSITS. He builds full-stack systems and AI products end to end.', act: [['About', '#about']] },
      { id: 'meta', k: ['you ai', 'are you', 'chatgpt', 'gpt', 'bot', 'human', 'real'], a: 'I am a scripted assistant — keyword matching over pre-written answers, no LLM. A small nod to the intent classifiers Devraj builds for real.' },
      { id: 'greeting', k: ['hi', 'hello', 'hey', 'yo', 'namaste', 'morning', 'evening'], a: 'Hey! Ask me about Devraj’s work, skills, projects, education — or how to reach him.' },
      { id: 'thanks', k: ['thank', 'thanks', 'bye', 'great', 'cool', 'nice', 'awesome'], a: 'Anytime! The fastest way to talk properly is email.', act: [['Copy email', 'copy']] },
    ];
    const FALLBACK = 'I am a simple scripted bot, so I might have missed that. Try asking about skills, projects, experience, education or contact.';
    const SUGGEST = [['Who is Devraj?', 'who is devraj'], ['Where does he work?', 'where does he work'], ['Top skills', 'skills'], ['Best projects', 'projects'], ['AI work', 'ai work'], ['Education', 'education'], ['Achievements', 'achievements'], ['How to contact?', 'contact']];
    const asked = new Set();
    let busy = false, lastFocus = null;

    function classify(text) {
      const t = text.toLowerCase(), words = t.split(/[^a-z0-9.+#]+/).filter(Boolean);
      let best = null, bestScore = 0;
      KB.forEach((it) => {
        let sc = 0;
        it.k.forEach((k) => { if (k.includes(' ') ? t.includes(k) : words.some((w) => w.startsWith(k))) sc += k.includes(' ') ? 2 : 1; });
        if (sc > bestScore) { best = it; bestScore = sc; }
      });
      return best ? { it: best, conf: Math.min(0.98, 0.62 + 0.12 * bestScore) } : null;
    }
    function bubble(cls) {
      const m = d.createElement('div');
      m.className = 'msg ' + cls;
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
      return m;
    }
    function act(target) {
      if (target === 'copy') return copyEmail();
      if (target === 'resume') { const a = d.createElement('a'); a.href = 'Resume_Devraj_Parmar.pdf'; a.download = ''; d.body.appendChild(a); a.click(); a.remove(); return; }
      if (target.startsWith('#')) { if (innerWidth < 700) close(); scrollToTarget(target); return; }
      window.open(target, '_blank', 'noopener');
    }
    function botSay(text, opts = {}) {
      const m = bubble('bot');
      const p = d.createElement('span'); p.textContent = text; m.appendChild(p);
      if (opts.acts && opts.acts.length) {
        const row = d.createElement('div'); row.className = 'msg-acts';
        opts.acts.forEach(([label, target]) => {
          const b = d.createElement('button'); b.type = 'button'; b.textContent = label;
          b.addEventListener('click', () => act(target));
          row.appendChild(b);
        });
        m.appendChild(row);
      }
      if (opts.intent) { const tag = d.createElement('span'); tag.className = 'msg-intent'; tag.textContent = opts.intent; m.appendChild(tag); }
      log.scrollTop = log.scrollHeight;
    }
    function chips() {
      chipsBox.textContent = '';
      SUGGEST.filter(([, q]) => !asked.has(q)).slice(0, 4).forEach(([label, q]) => {
        const b = d.createElement('button'); b.type = 'button'; b.textContent = label;
        b.addEventListener('click', () => ask(label, q));
        chipsBox.appendChild(b);
      });
    }
    function ask(shown, query) {
      if (busy) return;
      const q = (query || shown).trim();
      if (!q) return;
      asked.add(q);
      const me = bubble('me'); me.textContent = shown;
      busy = true;
      const typing = bubble('bot typing'); typing.innerHTML = '<i></i><i></i><i></i>';
      const r = classify(q);
      setTimeout(() => {
        typing.remove(); busy = false;
        if (r) botSay(r.it.a, { acts: r.it.act, intent: `intent · ${r.it.id} · ${r.conf.toFixed(2)}` });
        else botSay(FALLBACK, { intent: 'intent · unknown' });
        chips();
      }, REDUCED ? 0 : 450 + Math.random() * 450);
    }
    function open() {
      if (!panel.hidden) return;
      lastFocus = d.activeElement;
      panel.hidden = false;
      if (fab) fab.setAttribute('aria-expanded', 'true');
      if (!log.children.length) { botSay('Hi! I’m Devraj’s portfolio assistant. Pick a question or type your own.'); chips(); }
      setTimeout(() => input.focus(), 60);
    }
    function close() {
      if (panel.hidden) return;
      panel.hidden = true;
      if (fab) fab.setAttribute('aria-expanded', 'false');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    openChat = open;
    d.addEventListener('click', (e) => { if (e.target.closest('[data-chat-open]')) { e.preventDefault(); open(); } });
    $$('[data-chat-close]', panel).forEach((b) => b.addEventListener('click', close));
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; ask(v); });
  })();

  /* ------------------------------------------------------------------ */
  /* Command palette (Ctrl/⌘ K)                                          */
  /* ------------------------------------------------------------------ */
  (function palette() {
    const wrap = $('#cmdk'), input = $('#cmdk-input'), list = $('#cmdk-list');
    if (!wrap) return;
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    $$('[data-mod]').forEach((k) => { k.textContent = isMac ? '⌘' : 'Ctrl'; });
    const go = (sel) => () => scrollToTarget(sel);
    const ext = (url) => () => window.open(url, '_blank', 'noopener');
    const CMDS = [
      { g: 'Navigate', label: 'Home', icon: 'home', run: go('#hero') },
      { g: 'Navigate', label: 'About', icon: 'user', run: go('#about') },
      { g: 'Navigate', label: 'Tech stack', icon: 'layers', run: go('#stack'), k: 'skills tools' },
      { g: 'Navigate', label: 'Experience', icon: 'briefcase', run: go('#experience'), k: 'work internship' },
      { g: 'Navigate', label: 'Projects', icon: 'code', run: go('#projects'), k: 'work portfolio' },
      { g: 'Navigate', label: 'NeuroAgent architecture', icon: 'bot', run: go('#sysdesign'), k: 'system design' },
      { g: 'Navigate', label: 'Credentials', icon: 'award', run: go('#credentials'), k: 'certifications achievements' },
      { g: 'Navigate', label: 'Contact', icon: 'mail', run: go('#contact') },
      { g: 'Actions', label: 'Ask Devraj (chat)', icon: 'message', run: () => openChat(), k: 'bot assistant questions' },
      { g: 'Actions', label: 'Copy email address', icon: 'copy', hint: EMAIL, run: () => copyEmail() },
      { g: 'Actions', label: 'Download resume', icon: 'download', hint: 'PDF', run: () => { const a = d.createElement('a'); a.href = 'Resume_Devraj_Parmar.pdf'; a.download = ''; d.body.appendChild(a); a.click(); a.remove(); }, k: 'cv' },
      { g: 'Actions', label: 'Write an email', icon: 'mail', run: () => { location.href = 'mailto:' + EMAIL; } },
      { g: 'Actions', label: 'Toggle 3D background', icon: 'cube', run: () => dispatchEvent(new Event('gl:toggle')), k: 'webgl particles performance' },
      { g: 'Links', label: 'GitHub', icon: 'github', hint: 'DevrajParmarr', run: ext('https://github.com/DevrajParmarr') },
      { g: 'Links', label: 'LinkedIn', icon: 'linkedin', run: ext('https://www.linkedin.com/in/devraj-parmar-459363187') },
      { g: 'Links', label: 'LeetCode', icon: 'terminal', hint: 'devrajparmar37', run: ext('https://leetcode.com/u/devrajparmar37/') },
      { g: 'Links', label: 'Codolio', icon: 'globe', run: ext('https://codolio.com/profile/Devraj_Parmar') },
    ];
    let shown = [], sel = 0, lastFocus = null;

    function render(q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      shown = CMDS.filter((c) => {
        const hay = `${c.label} ${c.g} ${c.k || ''} ${c.hint || ''}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
      sel = clamp(sel, 0, Math.max(0, shown.length - 1));
      if (!shown.length) {
        list.innerHTML = `<li class="cmdk-empty" role="presentation">No results for “${q.replace(/[<>&"]/g, '')}”</li>`;
        input.removeAttribute('aria-activedescendant');
        return;
      }
      let html = '', group = '';
      shown.forEach((c, i) => {
        if (c.g !== group) { group = c.g; html += `<li class="cmdk-group" role="presentation">${group}</li>`; }
        html += `<li class="cmdk-item" role="option" id="cmdk-o${i}" data-i="${i}" aria-selected="${i === sel}">` +
          `<svg class="icon" aria-hidden="true"><use href="#i-${c.icon}"/></svg><span>${c.label}</span>` +
          (c.hint ? `<span class="hint">${c.hint}</span>` : '') + '</li>';
      });
      list.innerHTML = html;
      input.setAttribute('aria-activedescendant', 'cmdk-o' + sel);
    }
    function move(delta) {
      if (!shown.length) return;
      sel = (sel + delta + shown.length) % shown.length;
      $$('.cmdk-item', list).forEach((li) => li.setAttribute('aria-selected', String(+li.dataset.i === sel)));
      input.setAttribute('aria-activedescendant', 'cmdk-o' + sel);
      const act = $(`#cmdk-o${sel}`);
      if (act) act.scrollIntoView({ block: 'nearest' });
    }
    function open() {
      if (!wrap.hidden) return;
      lastFocus = d.activeElement;
      closeMenu();
      wrap.hidden = false; input.value = ''; sel = 0; render('');
      input.setAttribute('aria-expanded', 'true');
      if (lenis) lenis.stop();
      requestAnimationFrame(() => input.focus());
    }
    function close() {
      if (wrap.hidden) return;
      wrap.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      if (lenis) lenis.start();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    function exec(i) {
      const c = shown[i];
      if (!c) return;
      close();
      setTimeout(c.run, 60);
    }

    $$('[data-cmdk-open]').forEach((b) => b.addEventListener('click', open));
    $$('[data-cmdk-close]', wrap).forEach((b) => b.addEventListener('click', close));
    input.addEventListener('input', () => { sel = 0; render(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); exec(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') e.preventDefault();
    });
    list.addEventListener('click', (e) => { const li = e.target.closest('.cmdk-item'); if (li) exec(+li.dataset.i); });
    list.addEventListener('pointermove', (e) => {
      const li = e.target.closest('.cmdk-item');
      if (li && +li.dataset.i !== sel) move(+li.dataset.i - sel);
    });
    addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(d.activeElement.tagName) || d.activeElement.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); wrap.hidden ? open() : close(); }
      else if (e.key === '/' && !typing && wrap.hidden) { e.preventDefault(); open(); }
      else if (e.key === 'Escape') { if (!wrap.hidden) close(); else if (menuOpen) { closeMenu(); menuBtn.focus(); } }
    });
  })();

  /* ------------------------------------------------------------------ */
  /* Footer: year + live Indore clock                                    */
  /* ------------------------------------------------------------------ */
  $$('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); });
  const clock = $('#clock');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const tickClock = () => { clock.textContent = `Indore · ${fmt.format(new Date())} IST`; };
    tickClock();
    setInterval(tickClock, 1000);
  }

  console.log(
    '%c DP %c Built with Three.js, GSAP & Lenis — say hi: ' + EMAIL,
    'background:linear-gradient(90deg,#00e5ff,#9b5cf6);color:#05050a;font-weight:800;padding:3px 8px;border-radius:4px',
    'color:#a1a1bd;padding-left:6px'
  );

  /* go */
  runLoader(intro);
})();
