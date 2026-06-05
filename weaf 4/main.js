/* ═══════════════════════════════════════════════════════════════
   WEAF — main.js  v8
   - pacchetto chiuso.glb  → idle hero, poi 360° su Y, poi esce a sx
   ═══════════════════════════════════════════════════════════════ */

gsap.registerPlugin(ScrollTrigger);

/* ─── reset scroll on load ─── */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.addEventListener('load', () => { // Assicurati che tutto sia caricato
  requestAnimationFrame(() => { // Esegui nel prossimo frame per sovrascrivere il ripristino del browser
    window.scrollTo(0, 0);
    // Forza ScrollTrigger a ricalcolare tutte le posizioni partendo dall'alto
    ScrollTrigger.refresh();
  });
});

/* ─── stato ─── */
let groupChiuso = null;
let animProg    = 0;
let loadedCount = 0;

const BASE_Y      = 0;             /* faccia frontale verso camera */
const OFFSCREEN_R =  5.0;      /* fuori campo a destra */
const OFFSCREEN_L = -5.0;      /* fuori campo a sinistra */

/* ═══ CURSOR ═══ */
const cur = document.createElement('div'); cur.className = 'cursor'; document.body.appendChild(cur);
let mX = innerWidth / 2, mY = innerHeight / 2, cX = mX, cY = mY;
const darkSections = ['#scrollStage', '#manifesto', '#newsletter'].map(s => document.querySelector(s)).filter(Boolean);
addEventListener('mousemove', e => {
  mX = e.clientX; mY = e.clientY;
  const onDark = darkSections.some(s => { const r = s.getBoundingClientRect(); return e.clientY >= r.top && e.clientY <= r.bottom; });
  cur.classList.toggle('on-dark', onDark);
});
(function mv() { cX += (mX - cX) * .16; cY += (mY - cY) * .16; cur.style.transform = `translate(${cX}px,${cY}px)`; requestAnimationFrame(mv); })();
document.querySelectorAll('a,button,input').forEach(el => {
  el.addEventListener('mouseenter', () => cur.classList.add('hovering'));
  el.addEventListener('mouseleave', () => cur.classList.remove('hovering'));
});

/* ═══ PROGRESS + NAV ═══ */
const pbEl = document.createElement('div'); pbEl.id = 'scrollProgress'; document.body.appendChild(pbEl);
addEventListener('scroll', () => { pbEl.style.width = (scrollY / (document.body.scrollHeight - innerHeight) * 100) + '%'; }, { passive: true });
const nav = document.getElementById('navbar');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 50), { passive: true });

/* ═══════════════════════════════════════════════
   THREE SETUP
   ═══════════════════════════════════════════════ */
const canvas = document.getElementById('threeCanvas');
Object.assign(canvas.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '5', pointerEvents: 'none', opacity: '1' });

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.01, 500);
camera.position.set(0, 0, 4.8);

/* luci morbide */
const amb  = new THREE.AmbientLight(0xffffff, 1.9); scene.add(amb);
const key  = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(2, 3, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0xd3e8d3, 0.65); fill.position.set(-3, 1, 2); scene.add(fill);
const back = new THREE.DirectionalLight(0xaaccbb, 0.4);  back.position.set(0, -2, -3); scene.add(back);

/* env map procedurale */
try {
  const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 4); grd.addColorStop(0, '#eaf3ea'); grd.addColorStop(1, '#9fc0a8');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 4);
  const et = new THREE.CanvasTexture(c); et.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(et).texture; pm.dispose();
} catch (e) {}

/* ═══════════════════════════════════════════════
   CARICAMENTO GLB — helper comune
   ═══════════════════════════════════════════════ */
const loader = new THREE.GLTFLoader();

function setupGroup(gltf) {
  const root  = gltf.scene;
  const group = new THREE.Group();
  group.add(root);
  scene.add(group);
  group.updateMatrixWorld(true);

  /* centra e scala usando solo i mesh visibili (evita bbox sporcata da oggetti vuoti) */
  const box = new THREE.Box3();
  root.traverse(n => { if (n.isMesh) box.expandByObject(n); });
  const size = new THREE.Vector3(); const ctr = new THREE.Vector3();
  box.getSize(size); box.getCenter(ctr);
  root.position.sub(ctr);

  /* scala sull'asse Y per riempire ~40% dell'altezza viewport
     (camera z=4.8, FOV 36° → altezza frustum a z=0 ≈ 3.1 unità) */
  const targetH = 3.1 * 0.4;                       // ≈ 1.24 unità
  const targetW = targetH * (innerWidth / innerHeight);
  group.scale.setScalar(Math.min(targetH / size.y, targetW / size.x));

  /* materiali: finitura opaca */
  root.traverse(n => {
    if (n.isMesh && n.material) {
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(m => {
        m.side = THREE.DoubleSide;
        m.transparent = true;
        m.alphaTest = 0.5; // Scarta i pixel con trasparenza > 50%
        m.depthWrite = true;
        m.needsUpdate = true;
      });
    }
  });

  return group;
}

function onModelLoaded() {
  /* float verticale continuo */
  gsap.to(groupChiuso.position, { y: 0.06, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  initScroll();
  initReveal();
  console.log('[Weaf] ✅ pacchetto chiuso caricato');
}

/* ── pacchetto chiuso ── */
loader.load('pacchetto%20chiuso.glb',
  gltf => {
    groupChiuso = setupGroup(gltf);
    groupChiuso.rotation.y = BASE_Y;
    groupChiuso.rotation.x = -0.18;  /* vista leggermente dall'alto */
    if (++loadedCount === 1) onModelLoaded();
  },
  null,
  err => { console.error('[Weaf] errore pacchetto chiuso.glb:', err); if (++loadedCount === 1) onModelLoaded(); }
);

/* ═══════════════════════════════════════════════
   SCROLL / TIMELINE
   ═══════════════════════════════════════════════ */
function initScroll() {
  /* hint fade nell'hero */
  ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: s => { const h = document.getElementById('scrollHint'); if (h) h.style.opacity = Math.max(0, 1 - s.progress * 6); }
  });

  /* animazione 3D principale */
  ScrollTrigger.create({
    trigger: '#scrollStage',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.1,
    onUpdate: s => { animProg = s.progress; runAnim(s.progress); }
  });

  /* nascondi canvas uscendo dallo stage */
  ScrollTrigger.create({ trigger: '#superpotere', start: 'top 92%',
    onEnter:     () => gsap.to(canvas, { opacity: 0, duration: .6, onComplete: () => canvas.style.display = 'none' }),
    onLeaveBack: () => { canvas.style.display = 'block'; gsap.to(canvas, { opacity: 1, duration: .4 }); }
  });
}

/* ── easing helpers ── */
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const cl  = v => Math.max(0, Math.min(1, v));
const ph  = (p, s, e) => eio(cl((p - s) / (e - s)));
const lerp = (a, b, t) => a + (b - a) * t;

/* ── luci: hero (sfondo chiaro) → scroll stage (sfondo scuro) ── */
function updateLights(p) {
  const t = cl((p - 0.06) / 0.10);   /* transizione tra scroll 6% e 16% */
  amb.intensity           = lerp(1.9,  0.55, t);
  key.intensity           = lerp(1.35, 0.70, t);
  fill.intensity          = lerp(0.65, 0.35, t);
  renderer.toneMappingExposure = lerp(1.0, 0.62, t);
}

/* ── timeline a fasi ──
   0.00–0.10   fermo — chiuso al centro, aperto fuori dx
   0.10–0.50   chiuso ruota 360° su Y
   0.50–0.70   chiuso esce a sinistra
   0.70–1.00   frasi una alla volta
*/
const storiaEl = document.querySelector('.stage-storia');

function runAnim(p) {
  updateLights(p);
  const msgs = document.querySelectorAll('.testo-emozionale');
  const showStoria = p >= 0.70;
  if (storiaEl) storiaEl.classList.toggle('visible', showStoria);

  if (p < 0.10) {
    if (groupChiuso) { groupChiuso.rotation.y = BASE_Y; groupChiuso.position.x = 0; }
    setMsg(msgs, -1);
    return;
  }

  if (p < 0.50) {
    const t = ph(p, 0.10, 0.50);
    if (groupChiuso) { groupChiuso.rotation.y = BASE_Y + t * Math.PI * 2; groupChiuso.position.x = 0; }
    setMsg(msgs, -1);
    return;
  }

  if (p < 0.70) {
    const t = ph(p, 0.50, 0.70);
    if (groupChiuso) { groupChiuso.rotation.y = BASE_Y + Math.PI * 2; groupChiuso.position.x = OFFSCREEN_L * t; }
    setMsg(msgs, -1);
    return;
  }

  /* fase finale: frasi */
  const t = ph(p, 0.70, 1.0);
  if (groupChiuso) groupChiuso.position.x = OFFSCREEN_L;
  setMsg(msgs, Math.min(msgs.length - 1, Math.floor(t * msgs.length)));
}

function setMsg(msgs, idx) { msgs.forEach((m, i) => m.classList.toggle('visible', i === idx)); }

/* ═══ REVEAL sezioni ═══ */
function initReveal() {
  const o = new IntersectionObserver(
    es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: .1 }
  );
  document.querySelectorAll('.super-step,.reveal').forEach(el => o.observe(el));
}

/* ═══ RENDER LOOP ═══ */
const clock = new THREE.Clock();
(function render() {
  requestAnimationFrame(render);
  const t = clock.getElapsedTime();
  /* oscillazione Y leggera nell'hero (prima dello scroll) */
  if (groupChiuso && animProg < 0.08) groupChiuso.rotation.y = BASE_Y + Math.sin(t * 0.35) * 0.05;
  renderer.render(scene, camera);
})();

/* ═══ RESIZE ═══ */
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ═══ HERO TITLE PARALLAX ═══ */
const ht = document.getElementById('heroTitle');
addEventListener('scroll', () => { if (ht && scrollY < innerHeight * 1.5) ht.style.transform = `translateY(${scrollY * 0.22}px)`; }, { passive: true });

/* ═══ FOOTER PAYOFF DRIFT ═══ */
const pf = document.querySelector('.footer-payoff-big');
if (pf) gsap.fromTo(pf, { xPercent: 3 }, { xPercent: -3, ease: 'none', scrollTrigger: { trigger: '#footer', start: 'top bottom', end: 'bottom top', scrub: true } });

/* ═══ NEWSLETTER ═══ */
function handleNewsletterSubmit(e) { e.preventDefault(); const b = e.target.querySelector('.nl-btn'); b.textContent = 'Grazie 🌿'; e.target.querySelector('.nl-input').value = ''; setTimeout(() => b.textContent = 'Iscriviti', 3000); }

/* ═══ CTA RIPPLE ═══ */
document.head.insertAdjacentHTML('beforeend', '<style>@keyframes rpl{to{transform:scale(5);opacity:0}}</style>');
document.querySelectorAll('.cta-btn').forEach(b => b.addEventListener('click', e => {
  const r = b.getBoundingClientRect(), s = document.createElement('span');
  Object.assign(s.style, { position: 'absolute', borderRadius: '50%', background: 'rgba(255,255,255,.2)', width: '60px', height: '60px', left: (e.clientX - r.left - 30) + 'px', top: (e.clientY - r.top - 30) + 'px', transform: 'scale(0)', pointerEvents: 'none', animation: 'rpl .6s ease-out forwards' });
  b.appendChild(s); setTimeout(() => s.remove(), 650);
}));
