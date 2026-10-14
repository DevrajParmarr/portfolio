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
      const s = d.createElement('span'); s.className = 'ch'; s.textContent = c;
      el.appendChild(s); return s;
    });
  }
  $$('.hero-name .line').forEach(splitChars);

  /* ------------------------------------------------------------------ */
  /* Loader → intro                                                      */
  /* ------------------------------------------------------------------ */
  function runLoader(done) {
    const loader = $('#loader');
    if (!loader) return done();
    const count = $('.loader-count span', loader), bar = $('.loader-bar i', loader), status = $('.loader-status', loader);
    const quick = REDUCED || !HAS_GSAP || store.get('dp-visited');
    store.set('dp-visited', '1');

    let glReady = !!window.__glReady, fontsReady = false;
    addEventListener('gl:ready', () => { glReady = true; }, { once: true });
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; });

    const msgs = ['Loading typefaces', 'Compiling shaders', 'Assembling particles', 'Calibrating', 'Ready'];
    const start = performance.now(), minT = quick ? 300 : 1700, maxT = 5000;
    let shown = 0;
    function tick(now) {
      const t = now - start;
      const ready = (fontsReady && glReady) || t > maxT;
      const goal = ready && t > minT ? 100 : Math.min(94, (t / minT) * 80 + (fontsReady ? 7 : 0) + (glReady ? 7 : 0));
      shown += (goal - shown) * (quick ? 0.3 : 0.085);
      if (goal === 100 && shown > 99.5) shown = 100;
      count.textContent = Math.round(shown);
      bar.style.transform = `scaleX(${shown / 100})`;
      status.textContent = msgs[Math.min(msgs.length - 1, Math.floor(shown / 22))];
      if (shown >= 100) return exit();
      requestAnimationFrame(tick);
    }
    function exit() {
      if (MOTION) {
        G.timeline({ onComplete: () => loader.remove() })
          .to($$('.loader-inner > *', loader), { y: -30, opacity: 0, duration: 0.45, ease: 'power2.in', stagger: 0.05 })
          .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, '-=.1')
          .add(done, '-=.6');
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
    if (!MOTION) return;
    G.timeline({ defaults: { ease: 'expo.out', duration: 1.4 } })
      .from('.nav', { yPercent: -100, opacity: 0, duration: 1.2 }, 0)
      .from('.hero-name .ch', { yPercent: 118, rotate: 7, stagger: 0.035 }, 0.05)
      .from('.hero [data-intro]', { y: 26, opacity: 0, stagger: 0.08, duration: 1.1 }, 0.35)
      .from('.hero-foot .wrap > *', { y: 18, opacity: 0, stagger: 0.1, duration: 1 }, 0.65)
      .from('.hud', { opacity: 0, duration: 1 }, 0.8);
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
    const roles = ['full-stack systems', 'GenAI pipelines', 'agentic AI', 'distributed backends', 'real-time UIs'];
    let i = 0;
    setInterval(() => {
      if (d.hidden) return;
      i = (i + 1) % roles.length;
      scramble(el, roles[i]);
    }, 2800);
  }

  const hud = $('.hud');
  if (hud) {
    const hx = $('[data-hud="x"]', hud), hy = $('[data-hud="y"]', hud), hs = $('[data-hud="scroll"]', hud);
    let raf = 0, mx = 0, my = 0;
    addEventListener('pointermove', (e) => {
      mx = (e.clientX / innerWidth) * 2 - 1; my = -(e.clientY / innerHeight) * 2 + 1;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        hx.textContent = (mx >= 0 ? '+' : '') + mx.toFixed(3);
        hy.textContent = (my >= 0 ? '+' : '') + my.toFixed(3);
      });
    }, { passive: true });
    onScroll(() => {
      const max = d.documentElement.scrollHeight - innerHeight;
      hs.textContent = String(Math.round((scrollY / Math.max(1, max)) * 100)).padStart(3, '0') + '%';
    });
    const fill = (det) => {
      const p = $('[data-hud="pts"]', hud), r = $('[data-hud="api"]', hud);
      if (det && det.ok) { p.textContent = det.count.toLocaleString('en-IN'); r.textContent = det.webgl2 ? 'WebGL2' : 'WebGL'; }
      else { p.textContent = '—'; r.textContent = 'off'; }
    };
    if (window.__gl) fill({ ok: true, ...window.__gl });
    addEventListener('gl:ready', (e) => fill(e.detail));
  }

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

    G.fromTo('.tl-fill', { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 55%', scrub: 0.6 },
    });
    $$('.job').forEach((j) => ST.create({
      trigger: j, start: 'top 68%',
      onEnter: () => j.classList.add('is-on'), onLeaveBack: () => j.classList.remove('is-on'),
    }));

    // the giant footer wordmark drifts up as it enters
    G.from('.bigname', { yPercent: 35, ease: 'none', scrollTrigger: { trigger: '.bigname', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  } else {
    $$('.job').forEach((j) => j.classList.add('is-on'));
  }

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
    const measure = () => { R = el.clientWidth * 0.38; };
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
      ax += vx; ay += vy;
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
