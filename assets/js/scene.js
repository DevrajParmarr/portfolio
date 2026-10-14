/* ==========================================================================
   WebGL particle field — one GPU point cloud that morphs between seven
   sculptures as the page scrolls. All motion runs in the vertex shader;
   the CPU only updates a handful of uniforms per frame.
   Sections opt in with  data-gl="shape:0;x:2.6;s:1;a:1"  (+ data-gl-m for mobile).
   ========================================================================== */
(() => {
  'use strict';

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
  const root = document.documentElement;
  const canvas = document.getElementById('gl');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const announce = (detail) => {
    window.__glReady = true;
    window.dispatchEvent(new CustomEvent('gl:ready', { detail }));
  };
  const fail = (err) => {
    root.classList.remove('gl-on');
    root.classList.add('gl-off');
    if (err) console.warn('[gl] 3D background disabled:', err);
    announce({ ok: false });
  };

  if (!canvas) return;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return fail('WebGL unavailable');
  } catch (e) { return fail(e); }

  import(THREE_URL).then((THREE) => {
    try { run(THREE); } catch (e) { fail(e); }
  }).catch(fail);

  /* ---------- helpers ---------- */
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const gauss = (r) => (r() + r() + r() + r() - 2) * 0.85;
  function randDir(r) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(th), u, s * Math.sin(th)];
  }

  /* ---------- sculptures (each returns n xyz triples) ---------- */
  const SHAPES = [
    // 0 · neural sphere — fibonacci shell with a sparse core
    (n, r) => {
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let R = 2.25;
        if (r() < 0.16) R *= Math.cbrt(r()) * 0.92;
        const y = 1 - (2 * (i + 0.5)) / n, rad = Math.sqrt(1 - y * y), th = i * 2.399963229728653;
        a[i * 3] = Math.cos(th) * rad * R; a[i * 3 + 1] = y * R; a[i * 3 + 2] = Math.sin(th) * rad * R;
      }
      return a;
    },
    // 1 · double helix with base-pair rungs
    (n, r) => {
      const a = new Float32Array(n * 3), H = 6.4, turns = 2.4, R = 1.15, rungs = 30;
      for (let i = 0; i < n; i++) {
        const u = r(), k = r();
        let x, y, z;
        if (k < 0.8) {
          const ang = u * turns * Math.PI * 2 + (k < 0.4 ? 0 : Math.PI);
          x = Math.cos(ang) * R; z = Math.sin(ang) * R; y = (u - 0.5) * H;
        } else {
          const ur = Math.round(u * rungs) / rungs, ang = ur * turns * Math.PI * 2, s = r() * 2 - 1;
          x = Math.cos(ang) * R * s; z = Math.sin(ang) * R * s; y = (ur - 0.5) * H;
        }
        a[i * 3] = x + gauss(r) * 0.05; a[i * 3 + 1] = y + gauss(r) * 0.05; a[i * 3 + 2] = z + gauss(r) * 0.05;
      }
      return a;
    },
    // 2 · (2,3) torus knot with a soft tube
    (n, r) => {
      const a = new Float32Array(n * 3), S = 0.74;
      for (let i = 0; i < n; i++) {
        const t = r() * Math.PI * 2, rr = Math.cos(3 * t) + 2;
        const d = randDir(r), tube = 0.3 * Math.sqrt(r());
        a[i * 3] = (rr * Math.cos(2 * t) + d[0] * tube) * S;
        a[i * 3 + 1] = (rr * Math.sin(2 * t) + d[1] * tube) * S;
        a[i * 3 + 2] = (-Math.sin(3 * t) + d[2] * tube) * S;
      }
      return a;
    },
    // 3 · three-arm spiral galaxy with a bright bulge
    (n, r) => {
      const a = new Float32Array(n * 3), arms = 3, R = 3.7;
      for (let i = 0; i < n; i++) {
        if (r() < 0.12) {
          const d = randDir(r), rad = Math.pow(r(), 2) * 0.7;
          a[i * 3] = d[0] * rad; a[i * 3 + 1] = d[1] * rad * 0.6; a[i * 3 + 2] = d[2] * rad;
          continue;
        }
        const rad = Math.pow(r(), 1.5) * R, arm = ((i % arms) / arms) * Math.PI * 2, spin = rad * 1.15;
        const sc = 0.25 + rad * 0.12;
        const ox = Math.pow(r(), 2.5) * (r() < 0.5 ? 1 : -1) * sc;
        const oy = Math.pow(r(), 2.5) * (r() < 0.5 ? 1 : -1) * sc * 0.5;
        const oz = Math.pow(r(), 2.5) * (r() < 0.5 ? 1 : -1) * sc;
        a[i * 3] = Math.cos(arm + spin) * rad + ox; a[i * 3 + 1] = oy; a[i * 3 + 2] = Math.sin(arm + spin) * rad + oz;
      }
      return a;
    },
    // 4 · undulating terrain grid
    (n, r) => {
      const a = new Float32Array(n * 3), side = Math.ceil(Math.sqrt(n)), W = 9.5;
      for (let i = 0; i < n; i++) {
        const gx = (i % side) / (side - 1) - 0.5, gz = Math.floor(i / side) / (side - 1) - 0.5;
        const x = gx * W, z = gz * W;
        a[i * 3] = x + (r() - 0.5) * 0.02;
        a[i * 3 + 1] = Math.sin(x * 0.9) * 0.32 + Math.cos(z * 0.8 + x * 0.3) * 0.32;
        a[i * 3 + 2] = z;
      }
      return a;
    },
    // 5 · icosahedral knowledge graph — edges, nodes, inner core
    (n, r) => {
      const a = new Float32Array(n * 3), p = (1 + Math.sqrt(5)) / 2;
      const V = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
      const sc = 2.35 / Math.hypot(1, p), E = [];
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
        if (Math.abs(Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]) - 2) < 0.01) E.push([i, j]);
      }
      for (let i = 0; i < n; i++) {
        const k = r(); let x, y, z;
        if (k < 0.6) {
          const [s, e] = E[Math.floor(r() * E.length)], t = r();
          x = V[s][0] + (V[e][0] - V[s][0]) * t; y = V[s][1] + (V[e][1] - V[s][1]) * t; z = V[s][2] + (V[e][2] - V[s][2]) * t;
          x = x * sc + gauss(r) * 0.025; y = y * sc + gauss(r) * 0.025; z = z * sc + gauss(r) * 0.025;
        } else if (k < 0.88) {
          const v = V[Math.floor(r() * 12)], d = randDir(r), rad = Math.cbrt(r()) * 0.2;
          x = v[0] * sc + d[0] * rad; y = v[1] * sc + d[1] * rad; z = v[2] * sc + d[2] * rad;
        } else {
          const d = randDir(r), rad = Math.cbrt(r()) * 1.1;
          x = d[0] * rad; y = d[1] * rad; z = d[2] * rad;
        }
        a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
      }
      return a;
    },
    // 6 · portal ring with an inner orbit and halo
    (n, r) => {
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const k = r(), th = r() * Math.PI * 2; let R, z;
        if (k < 0.74) { R = 2.75 + gauss(r) * 0.08; z = gauss(r) * 0.1; }
        else if (k < 0.9) { R = 2.05 + gauss(r) * 0.03; z = gauss(r) * 0.04; }
        else { R = 3.1 + r() * 1.2; z = gauss(r) * 0.5; }
        a[i * 3] = Math.cos(th) * R; a[i * 3 + 1] = Math.sin(th) * R; a[i * 3 + 2] = z;
      }
      return a;
    },
  ];

  // 7 · portrait — sampled from a density map (assets/js/portrait-data.js, generated by
  // tools/make_portrait.py). Depth = head ellipsoid + luminance relief. Sphere if absent.
  function portrait(n, r) {
    const P = window.__PORTRAIT, lum = new Float32Array(n);
    if (!P) { lum.fill(1); return { pos: SHAPES[0](n, r), lum }; }
    const dec = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const D = dec(P.d), L = dec(P.l), W = P.w, H = P.h, cells = W * H;
    const cdf = new Float32Array(cells);
    let acc = 0;
    for (let i = 0; i < cells; i++) { acc += D[i]; cdf[i] = acc; }
    const HT = 5, WD = (HT * W) / H, hd = P.head || { cx: 0, cy: -0.12, rx: 0.25, ry: 0.3 };
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = r() * acc;
      let lo = 0, hi = cells - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < t) lo = m + 1; else hi = m; }
      const u = ((lo % W) + r()) / W - 0.5, v = (((lo / W) | 0) + r()) / H - 0.5;
      const l = L[lo] / 255;
      const hx = (u - hd.cx) / hd.rx, hy = (v - hd.cy) / hd.ry;
      const bulge = Math.sqrt(Math.max(0, 1 - hx * hx - hy * hy));
      pos[i * 3] = u * WD;
      pos[i * 3 + 1] = -v * HT;
      pos[i * 3 + 2] = bulge * 0.9 + (l - 0.5) * 0.35 + (r() - 0.5) * 0.05;
      lum[i] = l;
    }
    return { pos, lum };
  }

  /* ---------- shaders ---------- */
  const NOISE = /* glsl */`
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
    vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
      vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  const VERT = /* glsl */`
    attribute vec3 aS1; attribute vec3 aS2; attribute vec3 aS3;
    attribute vec3 aS4; attribute vec3 aS5; attribute vec3 aS6; attribute vec3 aS7;
    attribute vec4 aRand; attribute vec3 aScatter; attribute float aLum;
    uniform float uTime, uFrom, uTo, uProgress, uBloom, uBlob, uNoise, uIntro;
    uniform float uSize, uPixelRatio, uAlpha, uMouseK, uPulseT, uPortrait, uDisperse;
    uniform vec3 uMouse, uPulseO, uC1, uC2, uC3;
    varying vec3 vColor; varying float vAlpha;
    ${NOISE}
    vec3 shapeAt(float i){
      if(i<.5) return position; if(i<1.5) return aS1; if(i<2.5) return aS2;
      if(i<3.5) return aS3; if(i<4.5) return aS4; if(i<5.5) return aS5; if(i<6.5) return aS6; return aS7;
    }
    void main(){
      float p = clamp((uProgress - aRand.y * .35) / .65, 0., 1.);
      p = p * p * (3. - 2. * p);
      vec3 pos = mix(shapeAt(uFrom), shapeAt(uTo), p);
      pos += normalize(pos + 1e-4) * sin(p * 3.14159) * (.25 + aRand.x * .9) * uBloom;

      float t = uTime * .16;
      pos += normalize(pos + 1e-4) * snoise(pos * .55 + vec3(t * 1.6)) * uBlob;
      pos += vec3(
        snoise(pos * .42 + vec3(t, 0., aRand.w)),
        snoise(pos * .42 + vec3(0., t + 11.3, 0.)),
        snoise(pos * .42 + vec3(3.1, 0., t + 27.))
      ) * uNoise;

      // portrait style switch: the face drifts out into an ambient cloud
      float dsp = smoothstep(0., 1., uDisperse * uPortrait * 1.5 - aRand.y * .5);
      pos = mix(pos, aScatter * .55, dsp);

      float ip = clamp((uIntro - aRand.y * .45) / .55, 0., 1.);
      ip = 1. - pow(1. - ip, 3.);
      pos = mix(aScatter, pos, ip);

      vec4 world = modelMatrix * vec4(pos, 1.);
      vec2 toM = world.xy - uMouse.xy;
      float push = smoothstep(mix(1.7, .85, uPortrait), 0., length(toM)) * uMouseK * mix(1., .35, uPortrait);
      world.xyz += normalize(vec3(toM, .35) + 1e-4) * push * .85;

      float dp = length(world.xyz - uPulseO);
      float wave = exp(-pow((dp - uPulseT * 7.) * 1.5, 2.)) * max(0., 1. - uPulseT / 1.4);
      world.xyz += normalize(world.xyz - uPulseO + 1e-4) * wave * .55;

      vec4 mv = viewMatrix * world;
      gl_Position = projectionMatrix * mv;
      float size = uSize * (.35 + aRand.x * aRand.x * 1.45) * (1. + push * 1.4 + wave * 2.) * mix(1., .7 + .6 * aLum, uPortrait);
      gl_PointSize = size * uPixelRatio / -mv.z;

      float h = clamp(world.y * .17 + .5 + (aRand.z - .5) * .55, 0., 1.);
      vec3 col = mix(uC1, uC2, h);
      col = mix(col, uC3, step(.94, aRand.z));
      // portrait: colour follows the photo's light (violet shadows → cyan-white highlights)
      vec3 lit = mix(uC2 * .85, mix(uC1, vec3(.88, .97, 1.), .4), smoothstep(.1, .9, aLum));
      col = mix(col, mix(lit, uC3, step(.97, aRand.z)), uPortrait);
      vColor = col * mix(1., .4 + .9 * aLum, uPortrait) + push * .55 + wave * .8;
      vAlpha = uAlpha * mix(.22, 1., smoothstep(-15., -5.5, mv.z)) * (.4 + .6 * ip) * mix(1., .55 + .45 * aLum, uPortrait) * (1. - dsp * .75);
    }`;

  const FRAG = /* glsl */`
    varying vec3 vColor; varying float vAlpha;
    void main(){
      float d = length(gl_PointCoord - .5);
      if (d > .5) discard;
      float a = pow(1. - d * 2., 1.7);
      gl_FragColor = vec4(vColor, a * vAlpha);
    }`;

  const DUST_VERT = /* glsl */`
    attribute float aPhase;
    uniform float uTime, uScroll, uPixelRatio, uAlpha;
    varying float vA;
    void main(){
      vec3 p = position;
      p.y = mod(p.y + uScroll + 9., 18.) - 9.;
      p.x += sin(uTime * .1 + aPhase * 6.28) * .15;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (9. + fract(aPhase * 7.31) * 16.) * uPixelRatio / -mv.z;
      vA = uAlpha * (.3 + .7 * (.5 + .5 * sin(uTime * 1.3 + aPhase * 40.))) * smoothstep(-24., -7., mv.z);
    }`;
  const DUST_FRAG = /* glsl */`
    varying float vA;
    void main(){
      float d = length(gl_PointCoord - .5);
      if (d > .5) discard;
      gl_FragColor = vec4(vec3(.75, .85, 1.), pow(1. - d * 2., 2.) * vA);
    }`;

  /* ---------- section config parsing ---------- */
  const DEFAULTS = { shape: 0, x: 0, y: 0, s: 1, a: 0.5, rx: 0, rz: 0, n: 0.06, r: 0.1, lk: 0 };
  function parseCfg(str, base) {
    const o = { ...base };
    (str || '').split(';').forEach((kv) => {
      const [k, v] = kv.split(':').map((s) => s && s.trim());
      if (k && v !== undefined && k in DEFAULTS) o[k] = parseFloat(v);
    });
    return o;
  }

  /* ---------- main ---------- */
  function run(THREE) {
    const isMobileish = () => innerWidth < 900 || innerWidth / innerHeight < 0.9;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
    const COUNT = (coarse || innerWidth < 700) ? 6000 : lowPower ? 9000 : 14000;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    let dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.setClearColor(0x05050a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 0, 9);

    /* particle sculpture */
    const rnd = mulberry32(1337);
    const geo = new THREE.BufferGeometry();
    SHAPES.forEach((fn, i) => {
      geo.setAttribute(i === 0 ? 'position' : 'aS' + i, new THREE.BufferAttribute(fn(COUNT, rnd), 3));
    });
    const face = portrait(COUNT, rnd);
    geo.setAttribute('aS7', new THREE.BufferAttribute(face.pos, 3));
    geo.setAttribute('aLum', new THREE.BufferAttribute(face.lum, 1));
    const aRand = new Float32Array(COUNT * 4), aScatter = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      aRand[i * 4] = rnd(); aRand[i * 4 + 1] = rnd(); aRand[i * 4 + 2] = rnd(); aRand[i * 4 + 3] = rnd() * 6.283;
      const d = randDir(rnd), R = 6 + rnd() * 9;
      aScatter[i * 3] = d[0] * R; aScatter[i * 3 + 1] = d[1] * R; aScatter[i * 3 + 2] = d[2] * R - 4;
    }
    geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 4));
    geo.setAttribute('aScatter', new THREE.BufferAttribute(aScatter, 3));

    const U = {
      uTime: { value: 0 }, uFrom: { value: 0 }, uTo: { value: 0 }, uProgress: { value: 1 },
      uBloom: { value: 0 }, uBlob: { value: 0.32 }, uNoise: { value: 0.1 }, uIntro: { value: REDUCED ? 1 : 0 },
      uSize: { value: coarse ? 26 : 30 }, uPixelRatio: { value: dpr }, uAlpha: { value: 1 },
      uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseK: { value: 0 }, uPortrait: { value: 0 }, uDisperse: { value: 0 },
      uPulseO: { value: new THREE.Vector3(0, 0, 0) }, uPulseT: { value: 9 },
      uC1: { value: new THREE.Color('#00e5ff') }, uC2: { value: new THREE.Color('#9b5cf6') }, uC3: { value: new THREE.Color('#ec4899') },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: U,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    const group = new THREE.Group();
    group.add(points);
    scene.add(group);

    /* ambient dust */
    const DUST = coarse ? 500 : 1200;
    const dGeo = new THREE.BufferGeometry();
    const dPos = new Float32Array(DUST * 3), dPh = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      dPos[i * 3] = (rnd() - 0.5) * 26; dPos[i * 3 + 1] = (rnd() - 0.5) * 18; dPos[i * 3 + 2] = -14 + rnd() * 16;
      dPh[i] = rnd();
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dGeo.setAttribute('aPhase', new THREE.BufferAttribute(dPh, 1));
    const DU = { uTime: { value: 0 }, uScroll: { value: 0 }, uPixelRatio: { value: dpr }, uAlpha: { value: 0.55 } };
    const dust = new THREE.Points(dGeo, new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: DU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    dust.frustumCulled = false;
    scene.add(dust);

    /* sections */
    let secs = [];
    function readSections() {
      const mobile = isMobileish();
      secs = [...document.querySelectorAll('[data-gl]')].map((el) => {
        let cfg = parseCfg(el.dataset.gl, DEFAULTS);
        if (mobile && el.dataset.glM) cfg = parseCfg(el.dataset.glM, cfg);
        return { el, cfg, top: el.getBoundingClientRect().top + scrollY };
      });
    }
    readSections();
    if (!secs.length) secs = [{ el: document.body, cfg: { ...DEFAULTS, a: 1 }, top: 0 }];

    function target() {
      const y = scrollY, vh = innerHeight;
      let k = 0;
      for (let i = 1; i < secs.length; i++) if (secs[i].top - vh * 0.85 <= y) k = i;
      if (k === 0) return { from: secs[0].cfg, to: secs[0].cfg, p: 1 };
      const start = secs[k].top - vh * 0.85, end = secs[k].top - vh * 0.15;
      return { from: secs[k - 1].cfg, to: secs[k].cfg, p: clamp((y - start) / (end - start), 0, 1) };
    }

    /* pointer */
    const mouse = { x: 0, y: 0, sx: 0, sy: 0, active: 0, last: -1e9 };
    const ray = new THREE.Vector3(), dir = new THREE.Vector3();
    function toWorld(nx, ny, out) {
      ray.set(nx, ny, 0.5).unproject(camera);
      dir.copy(ray).sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      return out.copy(camera.position).addScaledVector(dir, dist);
    }
    addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      mouse.last = performance.now();
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (REDUCED || e.target.closest('a, button, input, [data-no-pulse], .sphere, .term, .viz, .cmdk')) return;
      toWorld((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1, U.uPulseO.value);
      U.uPulseT.value = 0;
    }, { passive: true });

    /* intro: particles converge from a scattered cloud */
    let intro = REDUCED ? 1 : 0, introOn = REDUCED;
    const startIntro = () => { introOn = true; };
    if (window.__introDone) startIntro(); else addEventListener('intro', startIntro, { once: true });

    /* pause toggle (command palette) — per-viewer preference */
    let enabled = true;
    try { enabled = localStorage.getItem('dp-gl') !== 'off'; } catch (e) { /* storage blocked */ }
    const applyEnabled = () => {
      root.classList.toggle('gl-paused', !enabled);
      window.dispatchEvent(new CustomEvent('gl:state', { detail: { enabled } }));
    };
    root.classList.toggle('gl-paused', !enabled);
    addEventListener('gl:toggle', () => {
      enabled = !enabled;
      try { localStorage.setItem('dp-gl', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
      applyEnabled();
      if (enabled && !looping) { looping = true; last = performance.now(); requestAnimationFrame(frame); }
    });

    /* resize */
    let lastW = innerWidth, lastH = innerHeight;
    function resize(force) {
      const w = innerWidth, h = innerHeight;
      if (!force && w === lastW && Math.abs(h - lastH) < 120 && coarse) return;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      readSections();
      dirty = true;
    }
    addEventListener('resize', () => resize(false));
    new ResizeObserver(() => readSections()).observe(document.body);

    /* where the portrait sits on screen when the hero is at the top (viewport px) */
    function portraitRect() {
      const sec = secs.find((x) => x.cfg.shape === 7);
      if (!sec || !window.__PORTRAIT) return null;
      const c = sec.cfg, P = window.__PORTRAIT;
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * 9, halfW = halfH * (innerWidth / innerHeight);
      const ht = 5 * c.s * 1.06, wd = (ht * P.w) / P.h;          // ×1.06 ≈ the head's depth bulge
      const px = (wx) => (wx / halfW * 0.5 + 0.5) * innerWidth, py = (wy) => (0.5 - wy / halfH * 0.5) * innerHeight;
      return { left: px(c.x - wd / 2), top: py(c.y + ht / 2), width: px(c.x + wd / 2) - px(c.x - wd / 2), height: py(c.y - ht / 2) - py(c.y + ht / 2) };
    }

    /* frame loop */
    const cur = { ...secs[0].cfg, a: 0 };
    const KEYS = ['x', 'y', 's', 'a', 'rx', 'rz', 'n', 'r', 'lk'];
    let spin = 0, last = performance.now(), time = 0, ft = 0, fn = 0, adapted = 0, lastScroll = -1, readyFired = false;
    let looping = enabled, dirty = true, disperse = 0, disperseTo = 0;
    addEventListener('gl:portrait', (e) => { disperseTo = e.detail && e.detail.visible === false ? 1 : 0; dirty = true; });

    function frame(now) {
      if (!enabled) { looping = false; return; }
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;

      // adaptive resolution: drop pixel ratio if we sustain < ~45fps
      ft += dt; fn++;
      if (fn === 90) {
        if (ft / fn > 0.022 && dpr > 1 && adapted < 3) {
          dpr = Math.max(1, dpr - 0.25); adapted++;
          renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
          U.uPixelRatio.value = DU.uPixelRatio.value = dpr;
        }
        ft = 0; fn = 0;
      }

      const sy = scrollY;
      if (REDUCED && sy === lastScroll && !dirty && readyFired) return;
      lastScroll = sy; dirty = false;

      if (!REDUCED) time += dt;
      U.uTime.value = DU.uTime.value = time;

      const { from, to, p } = target();
      const e = smooth(p), k = REDUCED ? 1 : 1 - Math.pow(0.0025, dt);
      for (const key of KEYS) cur[key] += (from[key] + (to[key] - from[key]) * e - cur[key]) * k;

      U.uFrom.value = from.shape; U.uTo.value = to.shape; U.uProgress.value = p;
      U.uBloom.value = from.shape !== to.shape ? 1 : 0;
      U.uBlob.value = 0.3 * ((from.shape === 0 ? 1 - e : 0) + (to.shape === 0 ? e : 0));
      U.uNoise.value = cur.n;
      U.uPortrait.value = (from.shape === 7 ? 1 - e : 0) + (to.shape === 7 ? e : 0);

      if (introOn && intro < 1) intro = Math.min(1, intro + dt / 2.6);
      U.uIntro.value = intro;
      disperse += (disperseTo - disperse) * (REDUCED ? 1 : 1 - Math.pow(0.04, dt));
      U.uDisperse.value = disperse;

      // pointer: smooth parallax + repulsion that fades when the mouse rests
      mouse.sx += (mouse.x - mouse.sx) * 0.06;
      mouse.sy += (mouse.y - mouse.sy) * 0.06;
      const moving = !coarse && now - mouse.last < 1800 ? 1 : 0;
      mouse.active += (moving - mouse.active) * 0.05;
      U.uMouseK.value = mouse.active;
      toWorld(mouse.x, mouse.y, U.uMouse.value);
      if (U.uPulseT.value < 3) U.uPulseT.value += dt;

      // lk → 1 eases the spin back to face-on (used by the portrait)
      spin += dt * cur.r * (1 - cur.lk);
      const facing = Math.atan2(Math.sin(spin), Math.cos(spin)) * (1 - cur.lk);
      group.position.set(cur.x, cur.y, 0);
      group.scale.setScalar(cur.s);
      group.rotation.set(cur.rx + mouse.sy * 0.12, facing + mouse.sx * (0.25 - 0.1 * cur.lk), cur.rz);
      U.uAlpha.value = cur.a;

      camera.position.x = mouse.sx * 0.35;
      camera.position.y = mouse.sy * 0.25;
      camera.lookAt(0, 0, 0);

      DU.uScroll.value = (sy / innerHeight) * 1.6;
      dust.rotation.y = mouse.sx * -0.06;

      renderer.render(scene, camera);

      if (!readyFired) {
        readyFired = true;
        root.classList.add('gl-on');
        window.__gl = { count: COUNT, webgl2: renderer.capabilities.isWebGL2, portraitRect };
        announce({ ok: true, ...window.__gl });
      }
    }
    requestAnimationFrame(frame);
    if (!enabled) { // still announce so the loader never waits on a paused scene
      root.classList.add('gl-on');
      window.__gl = { count: COUNT, webgl2: renderer.capabilities.isWebGL2, portraitRect };
      announce({ ok: true, ...window.__gl });
    }
  }
})();
