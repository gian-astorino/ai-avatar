/*! ai-avatar v0.2.0 */
// ---- src/core.js ----
/*
 * ai-avatar · core
 * Matematica della testa 3D, formato della posa, fusione tra pose, disegno e player.
 */

/* ------------------------------------------------------------------ */
/* Matematica condivisa (identica al generatore Python di riferimento)  */
/* ------------------------------------------------------------------ */

export const R = 7.0, NOSE_OUT = 1.2
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
export const cl = clamp01
const RAD = Math.PI / 180

/** cubic-bezier easing come in CSS */
export function cb(x1, y1, x2, y2) {
  return t => {
    t = clamp01(t)
    let lo = 0, hi = 1
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2
      const x = 3 * (1 - m) ** 2 * m * x1 + 3 * (1 - m) * m * m * x2 + m ** 3
      if (x < t) lo = m; else hi = m
    }
    const m = (lo + hi) / 2
    return 3 * (1 - m) ** 2 * m * y1 + 3 * (1 - m) * m * m * y2 + m ** 3
  }
}
export const IO = cb(.4, 0, .2, 1), SYM = cb(.45, 0, .55, 1), LIN = k => k
export const SMOOTH = k => k * k * (3 - 2 * k)

/** segmenti [a, b, da, a, easing] nel tempo normalizzato */
export function track(t, segs, v0 = 0) {
  let v = v0
  for (const [a, b, va, vb, e] of segs) {
    if (t <= a) return v
    if (t < b) return va + (vb - va) * e((t - a) / (b - a))
    v = vb
  }
  return v
}
export const lerp = (a, b, k) => a + (b - a) * k
export const lerpPts = (A, B, k) => A.map((p, i) => [p[0] + (B[i][0] - p[0]) * k, p[1] + (B[i][1] - p[1]) * k])
/** keyframe: valori scalari o liste di punti */
export function kf(t, kts, vals, eases) {
  if (t <= kts[0]) return vals[0]
  for (let i = 0; i < kts.length - 1; i++) {
    if (t <= kts[i + 1]) {
      const k = kts[i + 1] > kts[i] ? (t - kts[i]) / (kts[i + 1] - kts[i]) : 1
      const e = eases[i](k), a = vals[i], b = vals[i + 1]
      return Array.isArray(a) ? lerpPts(a, b, e) : a + (b - a) * e
    }
  }
  return vals[vals.length - 1]
}
export function blinkf(T, times, half = .08, ease = SYM) {
  for (const b of times) { const x = Math.abs(T - b); if (x < half) return 1 - ease(x / half) }
  return 0
}
export const zOf = (x, y) => Math.sqrt(Math.max(0, R * R - (x - 8) ** 2 - (y - 8) ** 2))
/** punto della faccia (spazio 16x16) proiettato sulla testa sferica ruotata; roll attorno a rc */
export function proj(x, y, extra = 0, yaw = 0, pitch = 0, roll = 0, tx = 0, ty = 0, rc = [8, 13]) {
  const zz = zOf(x, y) + extra, dx = x - 8, dy = y - 8
  const x1 = dx * Math.cos(yaw) + zz * Math.sin(yaw), z1 = -dx * Math.sin(yaw) + zz * Math.cos(yaw)
  const y2 = dy * Math.cos(pitch) + z1 * Math.sin(pitch)
  const X = 8 + x1, Y = 8 + y2, a = roll * RAD, [cx, cy] = rc
  return [cx + (X - cx) * Math.cos(a) - (Y - cy) * Math.sin(a) + tx, cy + (X - cx) * Math.sin(a) + (Y - cy) * Math.cos(a) + ty]
}
export const eye = (x, cy, h, gx = 0, gy = 0) => [[x + gx, cy + gy - h], [x + gx, cy + gy + h]]
export const SMILE = [[5, 11], [6.3215, 12.9822], [9.6785, 12.9822], [11, 11]]
export const SMILE2 = [[5, 11], [5.66075, 11.9911], [6.830375, 12.48665], [8, 12.48665], [9.169625, 12.48665], [10.33925, 11.9911], [11, 11]]
export const REST7 = [[5, 11], [6.3215, 12.9822], [9.6785, 12.9822], [11, 11], [9.6785, 12.9822], [6.3215, 12.9822], [5, 11]]
/** ellisse come catena chiusa di 2 cubiche (stessa costruzione del generatore) */
export const ellipse7 = (cx, cy, rx, ry) => { const k = 4 / 3; return [[cx - rx, cy], [cx - rx, cy - k * ry], [cx + rx, cy - k * ry], [cx + rx, cy], [cx + rx, cy + k * ry], [cx - rx, cy + k * ry], [cx - rx, cy]] }

/* ------------------------------------------------------------------ */
/* Geometria: catene di cubiche, polilinee, ricampionamento             */
/* ------------------------------------------------------------------ */

export const bez = (p0, p1, p2, p3, u) => {
  const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}
/** campiona una catena di cubiche (3k+1 punti di controllo); `per` campioni per segmento */
export function chain(ctrl, per = 16) {
  const out = [ctrl[0]]
  for (let i = 0; i + 3 < ctrl.length; i += 3)
    for (let j = 1; j <= per; j++) out.push(bez(ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3], j / per))
  return out
}
export const plen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s }
/** ricampiona una polilinea a n+1 punti equidistanti */
export function resample(pts, n) {
  const L = [0]
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const T = L[L.length - 1], out = []
  let k = 1
  for (let j = 0; j <= n; j++) {
    const d = T * j / n
    while (k < L.length - 1 && L[k] < d) k++
    const f = L[k] === L[k - 1] ? 0 : (d - L[k - 1]) / (L[k] - L[k - 1])
    out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f])
  }
  return out
}
/** primo `f` (0..1, per lunghezza) di una polilinea */
export function partial(pts, f) {
  if (f >= 1) return pts
  const T = plen(pts) * Math.max(0, f), out = [pts[0]]
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (acc + d >= T) { const u = d ? (T - acc) / d : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]); return out }
    acc += d; out.push(pts[i])
  }
  return out
}
/* La bocca è sempre un anello chiuso e pieno: una bocca "a linea" è un anello ad area zero
   (andata e ritorno sullo stesso tratto), una bocca aperta ha area e si riempie.
   Così qualsiasi bocca si trasforma in qualsiasi altra. */
/** bocca a linea da una catena di cubiche (già proiettata) */
export const lineMouth = (ctrl, per = 16) => { const f = chain(ctrl, per); return f.concat(f.slice(0, -1).reverse()) }
/** bocca a linea da una polilinea */
export const polyMouth = pts => pts.concat(pts.slice(0, -1).reverse())
/** bocca chiusa da una catena chiusa di cubiche (es. [L,t1,t2,R,b1,b2,L]) */
export const shapeMouth = (ctrl, per = 16) => chain(ctrl, per)

/* ------------------------------------------------------------------ */
/* Nodi SVG extra (accessori, maschere, note, gocce, fiore…)            */
/*   n(tag, attrs, children) — attrs.k = chiave stabile opzionale       */
/* ------------------------------------------------------------------ */

export const n = (tag, attrs = {}, children = []) => ({ tag, a: attrs, c: children })
export const fmt = p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)
export const polyD = pts => 'M' + pts.map(fmt).join('L')
export const cubicD = ctrl => { let s = 'M' + fmt(ctrl[0]); for (let i = 1; i < ctrl.length; i += 3) s += 'C' + ctrl.slice(i, i + 3).map(fmt).join(' '); return s }

/* ------------------------------------------------------------------ */
/* Posa                                                                 */
/*  { el, er, no: polilinee · mo: anello chiuso (pieno)                 */
/*    op?:{el,er,no,mo} opacità · sw?:{…} spessori (default 1.5)        */
/*    at?:{no:{mask:'url(#x)'}} attributi extra · fillMo?: false        */
/*    under?:[nodi] sotto la faccia · over?:[nodi] sopra · defs?:[nodi] }*/
/* ------------------------------------------------------------------ */

const FEAT = ['el', 'er', 'no', 'mo']
const DEF_SW = 1.5
function fitLen(A, B) {
  if (A.length === B.length) return [A, B]
  const m = Math.max(A.length, B.length) - 1
  return [resample(A, m), resample(B, m)]
}
function suffixIds(nodes, sfx) {
  const fix = v => (typeof v === 'string' ? v.replace(/url\(#([^)]+)\)/g, `url(#$1${sfx})`) : v)
  const walk = nd => n(nd.tag, Object.fromEntries(Object.entries(nd.a).map(([k, v]) => [k, k === 'id' ? v + sfx : fix(v)])), (nd.c || []).map(walk))
  return (nodes || []).map(walk)
}
const suffixAt = (at, sfx) => at && Object.fromEntries(Object.entries(at).map(([f, o]) => [f, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/url\(#([^)]+)\)/g, `url(#$1${sfx})`) : v]))]))

/* allinea l'anello della bocca B ad A (verso e punto di partenza) così la fusione non "attraversa" la bocca */
function alignRing(A, B) {
  const m = B.length - 1, cand = [B.slice(0, m), B.slice(0, m).reverse()]
  let best = null, bd = Infinity
  for (const ring of cand) for (let s = 0; s < m; s += Math.max(1, Math.floor(m / 32))) {
    let d = 0
    for (let i = 0; i < m; i += 2) { const q = ring[(i + s) % m]; d += (q[0] - A[i][0]) ** 2 + (q[1] - A[i][1]) ** 2 }
    if (d < bd) { bd = d; best = [ring, s] }
  }
  const [ring, s] = best, out = []
  for (let i = 0; i <= m; i++) out.push(ring[(i + s) % m])
  return out
}

/** fonde due pose: k=0 → A, k=1 → B */
export function mixPose(A, B, k) {
  if (k <= 0) return A
  if (k >= 1) return B
  const P = { op: {}, sw: {} }
  for (const f of FEAT) {
    let [a, b] = fitLen(A[f], B[f])
    if (f === 'mo') { const RN = 96; a = resample(a, RN); b = alignRing(a, resample(b, RN)) }
    P[f] = lerpPts(a, b, k)
    P.op[f] = lerp(A.op?.[f] ?? 1, B.op?.[f] ?? 1, k)
    P.sw[f] = lerp(A.sw?.[f] ?? DEF_SW, B.sw?.[f] ?? DEF_SW, k)
  }
  // riempimento della bocca: se una delle due è "filo" (niente riempimento) le forme intermedie non si riempiono
  const fA = A.fillMo === false ? 0 : (A.fillOp ?? 1), fB = B.fillMo === false ? 0 : (B.fillOp ?? 1)
  P.fillOp = fB * (fA ? 1 : k ** 3); P.fillMo = P.fillOp > .001
  const a = '_a', b = '_b'
  P.at = k < .5 ? suffixAt(A.at, a) : suffixAt(B.at, b)
  P.defs = [...suffixIds(A.defs, a), ...suffixIds(B.defs, b)]
  const side = (list, sfx, o) => (list && list.length ? [n('g', { k: sfx, opacity: o.toFixed(3) }, suffixIds(list, sfx))] : [])
  P.under = [...side(A.under, a, 1 - k), ...side(B.under, b, k)]
  P.over = [...side(A.over, a, 1 - k), ...side(B.over, b, k)]
  return P
}

/** la faccia neutra: punto di passaggio per le transizioni tra stati molto diversi */
export const NEUTRAL = { el: [[5, 5], [5, 7]], er: [[11, 5], [11, 7]], no: [[8, 3], [8, 9]], mo: lineMouth(SMILE) }

/* ------------------------------------------------------------------ */
/* Registro degli stati                                                 */
/* ------------------------------------------------------------------ */

const STATES = {}
/**
 * defineState(nome, { duration, loop=true, label, pose(t, T, ctx), viaNeutral?, exit? })
 *  t = 0..1 nel ciclo · T = secondi nel ciclo · ctx = { abs, pointer, mem, el, dt }
 *  viaNeutral: entrando/uscendo da questo stato si passa per la faccia neutra
 *  exit: { at(t) → t da cui recitare l'uscita (o null), end } — l'uscita propria dello stato
 */
export function defineState(name, def) { STATES[name] = { loop: true, label: name, ...def } }
export const states = () => Object.keys(STATES)
export const stateInfo = name => STATES[name] && { duration: STATES[name].duration, loop: STATES[name].loop, label: STATES[name].label, interactive: !!STATES[name].interactive }

/** posa di uno stato a un istante (secondi dall'inizio dello stato) */
export function poseAt(name, abs, ctx = {}) {
  const s = STATES[name]
  if (!s) throw new Error(`ai-avatar: stato sconosciuto "${name}"`)
  const T = s.loop ? ((abs % s.duration) + s.duration) % s.duration : Math.min(Math.max(0, abs), s.duration)
  return s.pose(T / s.duration, T, { abs, mem: {}, ...ctx })
}

/* ------------------------------------------------------------------ */
/* Disegno                                                              */
/* ------------------------------------------------------------------ */

const NS = 'http://www.w3.org/2000/svg'
let UID = 0

function makeRenderer(svg) {
  const uid = 'av' + (++UID)
  const fixIds = v => (typeof v === 'string' ? v.replace(/url\(#([^)]+)\)/g, `url(#${uid}-$1)`) : v)
  const mk = (tag, parent) => { const e = document.createElementNS(NS, tag); parent.appendChild(e); e._a = {}; return e }
  const setAttrs = (e, a) => {
    for (const k in e._a) if (!(k in a) && k !== 'k') { e.removeAttribute(k); delete e._a[k] }
    for (const k in a) {
      if (k === 'k') continue
      const v = k === 'id' ? `${uid}-${a[k]}` : fixIds(String(a[k]))
      if (e._a[k] !== v) { e.setAttribute(k, v); e._a[k] = v }
    }
  }
  // riconcilia una lista di nodi dentro un contenitore, per posizione + tag + chiave
  const sync = (parent, nodes) => {
    const kids = parent._kids || (parent._kids = [])
    nodes.forEach((nd, i) => {
      let e = kids[i]
      const key = nd.tag + ':' + (nd.a.k ?? i)
      if (!e || e._key !== key) {
        const fresh = document.createElementNS(NS, nd.tag); fresh._a = {}; fresh._key = key
        if (e) parent.replaceChild(fresh, e); else parent.appendChild(fresh)
        kids[i] = e = fresh
      }
      setAttrs(e, nd.a)
      sync(e, nd.c || [])
    })
    while (kids.length > nodes.length) kids.pop().remove()
  }
  const defs = mk('defs', svg), under = mk('g', svg)
  const g = mk('g', svg)
  setAttrs(g, { stroke: 'currentColor', 'stroke-width': DEF_SW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  const fp = {}; for (const f of FEAT) fp[f] = mk('path', g)
  const over = mk('g', svg)
  return function draw(p) {
    for (const f of FEAT) {
      const a = { d: polyD(p[f]) + (f === 'mo' ? 'Z' : '') }
      if (f === 'mo' && p.fillMo !== false) { a.fill = 'currentColor'; if (p.fillOp !== undefined && p.fillOp < .999) a['fill-opacity'] = p.fillOp.toFixed(3) }
      const o = p.op?.[f]; if (o !== undefined && o < .999) a.opacity = Math.max(0, o).toFixed(3)
      const w = p.sw?.[f]; if (w !== undefined && Math.abs(w - DEF_SW) > 1e-4) a['stroke-width'] = w.toFixed(3)
      if (p.at?.[f]) Object.assign(a, p.at[f])
      setAttrs(fp[f], a)
    }
    sync(defs, p.defs || []); sync(under, p.under || []); sync(over, p.over || [])
  }
}

/** SVG statico di uno stato a un istante (per email, Figma, <img>) */
export function toSVG(name, T = 0) {
  const p = poseAt(name, T)
  const attrs = a => Object.entries(a).filter(([k]) => k !== 'k').map(([k, v]) => `${k}="${v}"`).join(' ')
  const ser = nd => `<${nd.tag} ${attrs(nd.a)}>${(nd.c || []).map(ser).join('')}</${nd.tag}>`
  const fa = f => {
    const a = { d: polyD(p[f]) + (f === 'mo' ? 'Z' : '') }
    if (f === 'mo' && p.fillMo !== false) a.fill = 'currentColor'
    if (p.op?.[f] !== undefined && p.op[f] < .999) a.opacity = p.op[f].toFixed(3)
    if (p.sw?.[f] !== undefined) a['stroke-width'] = p.sw[f].toFixed(3)
    return `<path ${attrs({ ...a, ...(p.at?.[f] || {}) })}/>`
  }
  return `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><defs>${(p.defs || []).map(ser).join('')}</defs><g>${(p.under || []).map(ser).join('')}</g>` +
    `<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${FEAT.map(fa).join('')}</g><g>${(p.over || []).map(ser).join('')}</g></svg>`
}

/* ------------------------------------------------------------------ */
/* Player                                                               */
/* ------------------------------------------------------------------ */

export function createAvatar(el, opts = {}) {
  const o = { state: 'idle', size: 64, transition: 350, speed: 1, ...opts }
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('fill', 'none'); svg.setAttribute('overflow', 'hidden')
  svg.setAttribute('width', o.size); svg.setAttribute('height', o.size)
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'AI avatar')
  el.appendChild(svg)
  const draw = makeRenderer(svg)

  let clock = 0, last = null, raf = 0, visible = true, paused = false
  let cur = { name: o.state, start: 0, then: null, mem: {} }
  let from = null
  const pointer = { x: 0, y: 0, active: false }
  const listeners = {}
  const emit = (ev, d) => (listeners[ev] || []).forEach(f => f(d))

  const ctxFor = L => ({ pointer, mem: L.mem, el: svg, dt: lastDt })
  let lastDt = 0
  const layerPose = L => poseAt(L.name, Math.max(0, clock - L.start), ctxFor(L))
  function currentPose() {
    if (!from) return layerPose(cur)
    const local = clock - from.start
    if (local < 0) return from.pose()                       // lo stato uscente sta ancora facendo la sua uscita
    const k = clamp01(local / from.dur)
    if (k >= 1) { from = null; return layerPose(cur) }
    if (from.via) return k < .5 ? mixPose(from.pose(), NEUTRAL, SYM(k * 2)) : mixPose(NEUTRAL, layerPose(cur), SYM(k * 2 - 1))
    return mixPose(from.pose(), layerPose(cur), SYM(k))
  }
  function frame(now) {
    raf = 0
    if (paused) return
    lastDt = last !== null ? Math.min(.1, (now - last) / 1000) * o.speed : 0
    clock += lastDt; last = now
    const s = STATES[cur.name]
    if (!s.loop && clock - cur.start >= s.duration) {
      const done = cur.name
      go(cur.then || 'idle', { transition: o.transition })
      emit('end', done)
    }
    draw(currentPose())
    if (visible && !reduce) raf = requestAnimationFrame(frame)
  }
  function go(name, { transition = o.transition, then = null, via } = {}) {
    if (!STATES[name]) throw new Error(`ai-avatar: stato sconosciuto "${name}"`)
    // si parte sempre da ciò che si vede: lo stato uscente continua ad animarsi mentre sfuma;
    // se eravamo già a metà di una transizione si congela quel fotogramma
    const prev = cur, ps = STATES[prev.name], snap = from ? currentPose() : null
    let src = snap ? () => snap : () => layerPose(prev), delay = 0
    // se lo stato uscente ha una sua uscita (es. la graffetta che si srotola), la si recita prima di sfumare
    if (!snap && ps.exit && transition > 0) {
      const D = ps.duration, el = Math.max(0, clock - prev.start)
      const tn = ps.loop ? (el % D) / D : Math.min(el, D) / D
      const te = ps.exit.at(tn)
      if (te !== null && te !== undefined) {
        const L = { name: prev.name, start: clock - te * D, mem: prev.mem }
        src = () => layerPose(L); delay = Math.max(0, (ps.exit.end - te) * D)
      }
    }
    const dur = transition / 1000
    const viaN = via === 'neutral' || (via !== 'direct' && (ps.viaNeutral || STATES[name].viaNeutral))
    from = transition > 0 || delay > 0 ? { pose: src, start: clock + delay, dur: Math.max(dur, 1e-3), via: viaN && transition > 0 } : null
    cur = { name, start: clock + delay + (from && from.via ? dur / 2 : 0), then, mem: {} }
    emit('state', name)
  }
  const kick = () => { if (!raf && visible && !reduce && !paused) { last = null; raf = requestAnimationFrame(frame) } }

  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { visible = es[0].isIntersecting; kick() }) : null
  io && io.observe(svg)
  const onVis = () => { visible = !document.hidden; kick() }
  document.addEventListener('visibilitychange', onVis)
  // posizione del puntatore relativa all'avatar (per gli stati interattivi)
  const onMove = e => {
    const r = svg.getBoundingClientRect()
    pointer.x = e.clientX - (r.left + r.width / 2); pointer.y = e.clientY - (r.top + r.height / 2); pointer.active = true
  }
  addEventListener('pointermove', onMove, { passive: true })

  draw(currentPose()); kick()

  return {
    /** passa a uno stato con transizione (un one-shot viene eseguito e poi torna allo stato di prima) */
    set(name, opt = {}) {
      if (!STATES[name].loop) return this.play(name, opt)
      if (name !== cur.name) go(name, opt)
      kick(); return this
    },
    /** esegue uno stato one-shot e poi passa a `then` (default: lo stato di prima) */
    play(name, { then, ...opt } = {}) {
      const back = then || (STATES[cur.name].loop ? cur.name : cur.then || 'idle')
      go(name, { ...opt, then: back }); kick(); return this
    },
    get state() { return cur.name },
    get time() { return clock - cur.start },
    /** avanzamento della transizione in corso (0..1), 1 se non ce n'è */
    get blend() { return from ? clamp01((clock - from.start) / from.dur) : 1 },
    /** true mentre lo stato uscente recita la sua uscita o sta sfumando */
    get transitioning() { return !!from },
    pause() { paused = true; cancelAnimationFrame(raf); raf = 0; return this },
    resume() { paused = false; kick(); return this },
    set speed(v) { o.speed = v }, get speed() { return o.speed },
    set transition(ms) { o.transition = ms }, get transition() { return o.transition },
    set size(px) { svg.setAttribute('width', px); svg.setAttribute('height', px) },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return () => (listeners[ev] = listeners[ev].filter(f => f !== fn)) },
    /** disegna un istante preciso di uno stato (test / screenshot) */
    renderAt(name, T) { draw(poseAt(name, T, { pointer, mem: {}, el: svg, dt: 0 })) },
    svg,
    destroy() { cancelAnimationFrame(raf); io && io.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove); svg.remove() },
  }
}

// ---- src/states/base.js ----
{
/* ai-avatar · stati base: idle, thinking, speaking, listening, pong, happy, entrata, imagining, loading */
const face = (P, el, er, mo, extra = {}) => ({ el: el.map(q => P(...q)), er: er.map(q => P(...q)), no: [P(8, 3), P(8, 9, NOSE_OUT)], mo, ...extra })

/* IDLE — respiro, sguardo che vaga, battiti di ciglia irregolari */
defineState('idle', {
  label: 'Idle', duration: 8,
  pose(t, T) {
    const w = 2 * Math.PI / 8
    const yaw = .05 * Math.sin(w * T) + .02 * Math.sin(3 * w * T + 1.3), pitch = .03 * Math.sin(2 * w * T + .4), roll = 1.4 * Math.sin(w * T + 2.1)
    const ty = -.3 * (.5 - .5 * Math.cos(2 * w * T))
    const gx = kf(t, [0, .35, .40, .55, .60, .78, .83, 1], [0, 0, .3, .3, -.25, -.25, 0, 0], [LIN, IO, LIN, IO, LIN, IO, LIN])
    const h = Math.max(.02, 1 - blinkf(T, [2.1, 5.25, 5.55]))
    const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll, 0, ty)
    return face(P, eye(5, 6, h, gx), eye(11, 6, h, gx), lineMouth(SMILE.map(q => P(...q))))
  },
})

/* THINKING — guarda in alto da un lato, poi dall'altro con il sorrisetto, e torna dritto */
const smL = [[7, 11.6], [7.4, 11.95], [8, 12.1], [8.7, 12.1], [9.4, 12.1], [10, 11.95], [10.4, 11.6]]
const smR = [[5.8, 11.9], [6.2, 12.15], [6.8, 12.25], [7.4, 12.2], [8.1, 12.15], [8.6, 11.9], [9, 11.3]]
function thinkFace(T, D, v) {
  const hold = Math.sin(2 * Math.PI / D * T * 3) * .012
  const P = (x, y, e = 0) => proj(x, y, e, v.yaw + hold, v.pitch, v.roll)
  return face(P, eye(5, 6, 1, v.gx, v.gy), eye(11, 6 + (1 - v.hR) * -.4, v.hR, v.gx, v.gy), lineMouth(v.mo.map(q => P(...q))))
}
{
  const KT = [0, .06, .16, .44, .54, .62, .70, .82, .92, 1], E = [LIN, IO, LIN, IO, IO, IO, LIN, IO, LIN]
  defineState('thinking', {
    label: 'Thinking', duration: 6,
    pose(t, T) {
      return thinkFace(T, 6, {
        yaw: kf(t, KT, [0, 0, -.17, -.17, .18, .2, .18, .18, 0, 0], E), pitch: kf(t, KT, [0, 0, -.15, -.15, -.17, -.2, -.17, -.17, 0, 0], E),
        roll: kf(t, KT, [0, 0, -8, -8, 3, 3, 3, 3, 0, 0], E), gx: kf(t, KT, [0, 0, -.6, -.6, .6, .8, .6, .6, 0, 0], E),
        gy: kf(t, KT, [0, 0, -.8, -.8, -.8, -1.1, -.8, -.8, 0, 0], E), hR: kf(t, KT, [1, 1, 1, 1, .6, .6, .6, .6, 1, 1], E),
        mo: kf(t, KT, [SMILE2, SMILE2, smL, smL, smR, smR, smR, smR, SMILE2, SMILE2], E),
      })
    },
  })
}
/* THINKING LOOP — come Thinking ma passa da un lato all'altro senza tornare dritto */
{
  const KT = [0, .38, .5, .6, .68, .88, 1], seq = ['L', 'L', 'R', 'R2', 'R', 'R', 'L'], E = [LIN, IO, IO, IO, LIN, IO]
  const PV = {
    L: { yaw: -.17, pitch: -.15, roll: -8, gx: -.6, gy: -.8, hR: 1, mo: smL },
    R: { yaw: .18, pitch: -.17, roll: 3, gx: .6, gy: -.8, hR: .6, mo: smR },
    R2: { yaw: .2, pitch: -.2, roll: 3, gx: .8, gy: -1.1, hR: .6, mo: smR },
  }
  defineState('thinking-loop', {
    label: 'Thinking · loop', duration: 5.4,
    pose(t, T) {
      const v = {}
      for (const k of ['yaw', 'pitch', 'roll', 'gx', 'gy', 'hR', 'mo']) v[k] = kf(t, KT, seq.map(p => PV[p][k]), E)
      return thinkFace(T, 5.4, v)
    },
  })
}

/* SPEAKING — la bocca segue le sillabe, la testa accenta le parole */
{
  const D = 6
  const shape = (L, Rr, t1, t2, b1, b2) => [L, t1, t2, Rr, b1, b2, L]
  const raw = {
    rest: shape([5, 11], [11, 11], [6.3215, 12.9822], [9.6785, 12.9822], [9.6785, 12.9822], [6.3215, 12.9822]),
    M: shape([5.8, 11.6], [10.2, 11.6], [7.2, 11.6], [8.8, 11.6], [8.8, 11.6], [7.2, 11.6]),
    A: shape([5.2, 11], [10.8, 11], [6.8, 10.9], [9.2, 10.9], [9.9, 14.6], [6.1, 14.6]),
    E: shape([4.6, 11.2], [11.4, 11.2], [6.5, 11], [9.5, 11], [9.5, 13.1], [6.5, 13.1]),
    O: shape([6.9, 12.5], [9.1, 12.5], [6.9, 11.03], [9.1, 11.03], [9.1, 13.97], [6.9, 13.97]),
    I: shape([5, 11], [11, 11], [6.5, 11.6], [9.5, 11.6], [9.6, 13.4], [6.4, 13.4]),
    U: shape([7.3, 12.3], [8.7, 12.3], [7.3, 11.37], [8.7, 11.37], [8.7, 13.23], [7.3, 13.23]),
  }
  const K = .72, CX = 8, CY = 11.6, V = {}
  for (const k in raw) V[k] = k === 'rest' ? raw[k] : raw[k].map(([x, y]) => [CX + (x - CX) * K, CY + (y - CY) * K])
  V.a = lerpPts(V.A, V.M, .5); V.e = lerpPts(V.E, V.M, .5)
  const seq = [['rest', .35], ['M', .09], ['A', .17], ['e', .1], ['I', .12], ['M', .07], ['O', .2], ['a', .09], ['E', .15], ['rest', .45],
    ['U', .12], ['e', .09], ['A', .22], ['M', .08], ['I', .1], ['a', .11], ['O', .16], ['e', .08], ['E', .13], ['a', .1], ['rest', .4], ['M', .08], ['I', .12], ['a', .1], ['O', .22], ['e', .09], ['U', .11], ['A', .2], ['M', .07], ['e', .1], ['I', .11], ['a', .12], ['E', .16], ['M', .08], ['rest', 0]]
  const tot = seq.reduce((s, [, d]) => s + d, 0); seq[seq.length - 1] = ['rest', D - tot]
  const starts = []; { let t = 0; for (const [, d] of seq) { starts.push(t); t += d } }
  const mouthAt = T => {
    let i = 0
    for (; i < seq.length; i++) if (T < starts[i] + seq[i][1] || i === seq.length - 1) break
    const v = seq[i][0], nxt = seq[(i + 1) % seq.length][0], tr = Math.min(.09, seq[i][1] * .6)
    const k = T < starts[i] + seq[i][1] - tr ? 0 : SMOOTH((T - (starts[i] + seq[i][1] - tr)) / tr)
    return lerpPts(V[v], V[nxt], k)
  }
  const acc = seq.map(([v, d], i) => (['A', 'O', 'E'].includes(v) ? starts[i] + d * .4 : null)).filter(x => x !== null)
  const accent = T => Math.min(1, acc.reduce((s, a) => s + Math.exp(-(((T - a) / .18) ** 2)), 0))
  defineState('speaking', {
    label: 'Speaking', duration: D,
    pose(t, T) {
      const w = 2 * Math.PI / D, ac = accent(T)
      const yaw = .07 * Math.sin(w * T) + .025 * Math.sin(3 * w * T + 1), pitch = .03 * Math.sin(2 * w * T + .5) + .07 * ac, roll = 2.2 * Math.sin(w * T + 2)
      const hh = (1 + .15 * ac) * (1 - blinkf(T, [1.95, 3.55, 5.6], .09, SMOOTH)) + .02
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll)
      return face(P, [[5, 6 - hh], [5, 6 + hh]], [[11, 6 - hh], [11, 6 + hh]], shapeMouth(mouthAt(T).map(q => P(...q))))
    },
  })
}

/* LISTENING — occhi e naso pulsano come onde sonore, due piccoli cenni */
{
  const D = 6, PMAX = .17
  const wave = (t, vals, period) => {
    const ph = ((t * D) % period) / period * vals.length, i = Math.floor(ph) % vals.length, k = ph - Math.floor(ph)
    return vals[i] + (vals[(i + 1) % vals.length] - vals[i]) * SYM(k)
  }
  defineState('listening', {
    label: 'Listening', duration: D,
    pose(t) {
      const pitch = PMAX * track(t, [[.40, .425, 0, 1, SYM], [.425, .45, 1, 0, SYM], [.45, .475, 0, .8, SYM], [.475, .50, .8, 0, SYM]])
      const roll = track(t, [[.08, .18, 0, -6, IO], [.82, .92, -6, 0, IO]]), yaw = track(t, [[.08, .18, 0, .1, IO], [.82, .92, .1, 0, IO]])
      const hl = wave(t, [1, 1.35, .75, 1.2, .85, 1.4], 1.5), hr = wave(t, [1, .8, 1.3, .9, 1.4, .75], 2.0), hn = wave(t, [3, 3.4, 2.6, 3.25, 2.75, 3.5, 2.8], 1.2)
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll)
      return {
        el: [P(5, 6 - hl), P(5, 6 + hl)], er: [P(11, 6 - hr), P(11, 6 + hr)],
        no: [P(8, 6 - hn), P(8, 6 + hn, NOSE_OUT * (hn / 3))], mo: lineMouth(SMILE.map(q => P(...q))),
      }
    },
  })
}

/* PONG — il naso diventa una pallina che rimbalza tra gli occhi-racchetta */
{
  const KT = [0, .08, .16, .26, .38, .50, .62, .74, .84, .92, 1]
  const eE = [LIN, LIN, IO, IO, IO, IO, IO, IO, IO, LIN], bE = [LIN, IO, LIN, LIN, LIN, LIN, LIN, LIN, IO, LIN]
  const lc = [6, 6, 6, 5.6, 4.8, 6.2, 7.6, 6.4, 6, 6, 6], rc_ = [6, 6, 6, 7.5, 6.1, 6.8, 7.0, 5, 6, 6, 6], sp = [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0]
  const bx = [8, 8, 8, 10.5, 5.5, 10.5, 5.5, 10.5, 8, 8, 8], by = [6, 6, 6, 7.5, 4.8, 6.8, 7.6, 5, 6, 6, 6]
  const nl = [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1], mdx = [null, null, 0, .3, -.3, .3, -.3, .3, 0, null, null], mk = [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0]
  const flat = dx => [[6.6 + dx, 11.6], [7.5 + dx, 11.6], [8.5 + dx, 11.6], [9.4 + dx, 11.6]]
  const MO = mdx.map(d => (d === null ? SMILE : flat(d)))
  defineState('pong', {
    label: 'Pong', duration: 5, viaNeutral: true,
    pose(t) {
      const L = kf(t, KT, lc, eE), Rr = kf(t, KT, rc_, eE), s_ = kf(t, KT, sp, eE)
      const BX = kf(t, KT, bx, bE), BY = kf(t, KT, by, bE), NL = kf(t, KT, nl, bE), m = kf(t, KT, MO, eE)
      const yaw = .07 * (BX - 8) / 2.5 * kf(t, KT, mk, eE), pitch = .04 * (BY - 6) / 1.6 * kf(t, KT, mk, eE)
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch)
      const top = [8 + (BX - 8) * (1 - NL), BY - 3 * NL], bot = [8 + (BX - 8) * (1 - NL), BY + 3 * NL]
      return {
        el: eye(5 - s_, L, 1).map(q => P(...q)), er: eye(11 + s_, Rr, 1).map(q => P(...q)),
        no: [P(...top), P(...bot, NOSE_OUT * NL)], mo: lineMouth(m.map(q => P(...q))),
      }
    },
  })
}

/* HAPPY — salto con inclinazione, bocca aperta e occhiolino (one-shot) */
{
  const OUT = cb(.2, .6, .35, 1), LAND = cb(.45, 0, .25, 1)
  const rest = [[5, 11], [6.3215, 12.9822], [9.6785, 12.9822], [11, 11], [9.6785, 12.9822], [6.3215, 12.9822], [5, 11]]
  const grin = [[6, 11.4], [7, 11.7], [9, 11.7], [10, 11.4], [9.6, 13.9], [6.4, 13.9], [6, 11.4]]
  const eo = [[5, 5], [5, 6], [5, 7]], edot = [[5, 6], [5, 6], [5, 6]], ec = [[4.4, 6], [5, 6], [5.6, 6]]
  const wink = t => {
    const seg = (a, b, A, B) => lerpPts(A, B, IO((t - a) / (b - a)))
    if (t < .33 || t >= .82) return eo
    if (t < .37) return seg(.33, .37, eo, edot)
    if (t < .41) return seg(.37, .41, edot, ec)
    if (t < .74) return ec
    if (t < .78) return seg(.74, .78, ec, edot)
    return seg(.78, .82, edot, eo)
  }
  defineState('happy', {
    label: 'Happy', duration: 3.2, loop: false,
    pose(t) {
      const ty = track(t, [[.22, .32, 0, -1.0, OUT], [.32, .41, -1.0, 0, LAND]])
      const roll = track(t, [[.22, .32, 0, 10, OUT], [.82, .92, 10, 0, IO]])
      const pitch = track(t, [[.22, .32, 0, -.26, OUT], [.32, .41, -.26, -.08, LAND], [.82, .92, -.08, 0, IO]])
      const yaw = track(t, [[.22, .32, 0, .16, OUT], [.82, .92, .16, 0, IO]])
      const mo = track(t, [[.25, .35, 0, 1, IO], [.82, .92, 1, 0, IO]])
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll, 0, ty)
      return { el: wink(t).map(q => P(...q)), er: [P(11, 5), P(11, 7)], no: [P(8, 3), P(8, 9, NOSE_OUT)], mo: shapeMouth(lerpPts(rest, grin, mo).map(q => P(...q))) }
    },
  })
}

/* ENTRATA — i tratti si disegnano uno dopo l'altro (one-shot, poi idle); 2× più veloce del riferimento (4.2 s) */
{
  const D = 4.2 / 2, IN = cb(.4, 0, .2, 1)
  const feats = { el: [[[5, 5], [5, 7]], .0476, .10], er: [[[11, 5], [11, 7]], .1310, .1833], no: [[[8, 3], [8, 9]], .2143, .2810], mo: [chain(SMILE, 40), .3095, .3952] }
  defineState('entrata', {
    label: 'Entrata', duration: D * .3952 + .05, loop: false,
    pose(t, T) {
      const p = T / D, out = { op: {} }
      for (const [f, [pts, a, b]] of Object.entries(feats)) {
        const k = p <= a ? 0 : p >= b ? 1 : IN((p - a) / (b - a))
        const seg = k > 0 ? partial(pts, k) : [pts[0], pts[0]]
        out[f] = f === 'mo' ? polyMouth(seg) : seg
        out.op[f] = k > 0 ? 1 : 0
      }
      return out
    },
  })
}

/* IMAGINING — occhi chiusi, respiro, un fiore che sboccia e svanisce dietro la testa */
{
  const D = 5.5, w = 2 * Math.PI / D
  const cL = [[3.9, 6.3], [4.4, 6.6], [5.2, 6.6], [5.7, 6.3]], cR = [[10.3, 6.3], [10.8, 6.6], [11.6, 6.6], [12.1, 6.3]]
  const mr = [[6, 11.3], [7.1, 12.4], [8.9, 12.4], [10, 11.3]], mi = [[6.3, 11.2], [7.3, 12], [8.7, 12], [9.7, 11.2]]
  const FLOWER = 'M11.9996 2C13.9375 2 15.5529 3.37834 15.9205 5.20801C17.689 4.61093 19.6916 5.3214 20.6607 7C21.6296 8.6784 21.2433 10.7669 19.8423 12C21.2433 13.2331 21.6296 15.3216 20.6607 17C19.6915 18.6787 17.6891 19.3883 15.9205 18.791C15.5532 20.6212 13.9378 22 11.9996 22C10.0614 21.9998 8.44581 20.6211 8.07866 18.791C6.3102 19.3878 4.30845 18.6784 3.33941 17C2.37058 15.3218 2.7562 13.2332 4.15679 12C2.75619 10.7668 2.37058 8.67821 3.33941 7C4.3084 5.32165 6.31027 4.6114 8.07866 5.20801C8.44617 3.37839 10.0618 2.0002 11.9996 2Z'
  const grow = cb(.35, 0, .5, 1), fade = cb(.45, 0, .55, 1)
  defineState('imagining', {
    label: 'Imagining', duration: D,
    pose(t, T, ctx) {
      const b = track(t, [[0, .42, 0, 1, SYM], [.52, 1, 1, 0, SYM]])
      const pitch = -.07 * b, ty = -.45 * b, roll = 1.6 * Math.sin(w * T + .8), yaw = .035 * Math.sin(w * T + 2)
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll, 0, ty)
      // il fiore ha il suo ritmo (3 s di vita, 9 s di rotazione), indipendente dal respiro
      const abs = ctx.abs ?? T, ph = (abs % 3) / 3
      const sc = .45 + (1.18 - .45) * grow(ph)
      const op = ph < .45 ? .16 * fade(ph / .45) : .16 * (1 - fade((ph - .45) / .55))
      const rot = 360 * ((abs % 9) / 9)
      return {
        el: chain(cL.map(q => P(...q)), 20), er: chain(cR.map(q => P(...q)), 20), no: [P(8, 3), P(8, 9, NOSE_OUT)],
        mo: lineMouth(lerpPts(mr, mi, b).map(q => P(...q))),
        under: [n('g', { k: 'flower', opacity: op.toFixed(3), transform: `translate(8 8) scale(${sc.toFixed(4)}) rotate(${rot.toFixed(2)}) translate(-8 -8)` },
          [n('path', { transform: 'translate(.08 .08) scale(.66)', d: FLOWER, fill: 'currentColor' })])],
      }
    },
  })
}

/* LOADING — il sorriso diventa un arco che gira intorno alla faccia, poi torna */
const r = 7.1, Lc = 4 / 3 * Math.tan(22.5 * Math.PI / 180) * r
const c_ = a => [8 + r * Math.cos(a * Math.PI / 180), 8 + r * Math.sin(a * Math.PI / 180)]
const P0 = c_(135), P1 = c_(45), kk = Lc * Math.sqrt(.5)
const ARC = [P0, [P0[0] + kk, P0[1] + kk], [P1[0] - kk, P1[1] + kk], P1]
const rotAbout8 = (pts, deg) => { const a = deg * Math.PI / 180; return pts.map(([x, y]) => [8 + (x - 8) * Math.cos(a) - (y - 8) * Math.sin(a), 8 + (x - 8) * Math.sin(a) + (y - 8) * Math.cos(a)]) }
defineState('loading', {
  label: 'Loading', duration: 4, viaNeutral: true,
  pose(t) {
    const D = 4
    const k = track(t, [[.08, .2, 0, 1, IO], [.8, .92, 1, 0, IO]]), th = track(t, [[.2, .8, 0, 1080, SYM]])
    const cy = track(t, [[.08, .2, 0, 2, IO], [.8, .92, 2, 0, IO]])
    const rot = rotAbout8(lerpPts(SMILE, ARC, k), th)
    const phi = (90 + th) * Math.PI / 180, act = track(t, [[.2, .3, 0, 1, IO], [.7, .8, 1, 0, IO]])
    const gx = .35 * Math.cos(phi) * act, gy = .3 * Math.sin(phi) * act, yaw = .07 * Math.cos(phi) * act, pitch = .05 * Math.sin(phi) * act
    const h = Math.max(.02, 1 - blinkf(t * D, [.43 * D, .685 * D, .715 * D], .07))
    const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, 0, 0, cy)
    return face(P, eye(5, 6, h, gx, gy), eye(11, 6, h, gx, gy), lineMouth(rot))
  },
})
/* LOADING LOOP — lo spinner gira senza fermarsi, a velocità costante */
defineState('loading-loop', {
  label: 'Loading · loop', duration: 4, viaNeutral: true,
  pose(t, T) {
    const th = 360 * T, phi = (90 + th - 25) * Math.PI / 180
    const gx = .35 * Math.cos(phi), gy = .3 * Math.sin(phi), yaw = .06 * Math.cos(phi), pitch = .045 * Math.sin(phi)
    const h = Math.max(.02, 1 - blinkf(T, [1.3, 3.05, 3.3], .07))
    const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, 0, 0, 2)
    return face(P, eye(5, 6, h, gx, gy), eye(11, 6, h, gx, gy), lineMouth(rotAbout8(ARC, th)))
  },
})

}

// ---- src/states/extra.js ----
{
/* ai-avatar · stati espressivi: fischietta, sbadiglio, starnuto, distratto, centrifuga, errore */
const STROKE = { stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }
const filled = (k, ctrl, op) => n('path', { k, d: cubicD(ctrl) + 'Z', fill: 'currentColor', stroke: 'none', opacity: op })
const nose = P => [P(8, 3), P(8, 9, NOSE_OUT)]

/* FISCHIETTA — la bocca si stringe in una "o" di lato e fischia qualche nota (one-shot) */
{
  const D = 5, w = 2 * Math.PI / D
  const mel = [0, .7, .15, .9, 0, .5, 1, .2, .8, 0, .6, .3, 1, .05, .7, .4, .9, .1, .6, 0]
  const NOTE_STARTS = [.2, .42, .62]
  const LINE7 = (cx, cy, hl) => [[cx - hl, cy], [cx - hl / 3, cy], [cx + hl / 3, cy], [cx + hl, cy], [cx + hl / 3, cy], [cx - hl / 3, cy], [cx - hl, cy]]
  const a0 = .08, a1 = .18, b0 = .84, b1 = .94
  defineState('fischietta', {
    label: 'Fischietta', duration: D, loop: false,
    pose(t, T) {
      const env = track(t, [[a0, a1 + .04, 0, 1, SYM], [b0 - .04, b1, 1, 0, SYM]])
      const roll = 3 * Math.sin(2 * w * T * 2) * env, yaw = (.06 * Math.sin(w * T * 2) - .04) * env, pitch = (-.05 + .02 * Math.sin(4 * w * T + 1)) * env
      const gx = (-.3 + .1 * Math.sin(2 * w * T + 1)) * env, gy = (-.5 + .08 * Math.sin(4 * w * T)) * env
      const h = Math.max(.02, 1 - blinkf(T, [2.4], .08))
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll)
      let r = 0
      if (t >= a1 && t <= b0) {
        const u = (t - a1) / (b0 - a1), M = mel.length, ph = u * (M - 1), j = Math.min(Math.floor(ph), M - 2)
        r = (mel[j] + (mel[j + 1] - mel[j]) * SYM(ph - j)) * Math.min(1, u / .04, (1 - u) / .04)
      }
      const k = track(t, [[a0, a1, 0, 1, IO], [b0, b1, 1, 0, IO]])
      const whistling = t >= a1 && t <= b0
      const over = [filled('o', ellipse7(10, 12.2, 1.0 + .12 * r, .75 + .32 * r).map(q => P(...q)), whistling ? 1 : 0)]
      NOTE_STARTS.forEach((st, ni) => {
        const tt = (t - st) / .32
        let x = 11.2, y = 11.2, o = 0
        if (tt >= 0 && tt <= 1) { x = 11.2 + 2.4 * tt + .25 * Math.sin(tt * Math.PI * 2 + ni); y = 11.2 - 4.0 * IO(tt); o = Math.min(1, tt / .15, (1 - tt) / .35) * .85 }
        over.push(n('g', { k: 'note' + ni, opacity: o.toFixed(3), stroke: 'currentColor', 'stroke-linecap': 'round' }, [
          n('path', { d: polyD([[x, y], [x, y]]), 'stroke-width': 1 }),
          n('path', { d: polyD([[x + .42, y - .05], [x + .42, y - 1.35]]), 'stroke-width': .4 }),
        ]))
      })
      return {
        el: eye(5, 6, h, gx, gy).map(q => P(...q)), er: eye(11, 6, h, gx, gy).map(q => P(...q)), no: nose(P),
        mo: shapeMouth(lerpPts(REST7, LINE7(10, 12.2, .25), k).map(q => P(...q))), fillMo: false,
        op: { mo: whistling ? 0 : 1 }, over,
      }
    },
  })
}

/* SBADIGLIO — testa indietro, occhi chiusi a trattino, bocca spalancata, poi si risveglia (one-shot) */
{
  const D = 5.5
  const YO = ellipse7(8, 12.9, 1.3, 1.55), YO2 = ellipse7(8, 13, 1.35, 1.7)
  const Mflat = [[6.4, 11.7], [7.2, 11.7], [8.8, 11.7], [9.6, 11.7], [8.8, 11.7], [7.2, 11.7], [6.4, 11.7]]
  defineState('sbadiglio', {
    label: 'Sbadiglio', duration: D, loop: false,
    pose(t) {
      let mo
      if (t < .12) mo = REST7
      else if (t < .30) mo = lerpPts(REST7, YO, IO((t - .12) / .18))
      else if (t < .55) mo = lerpPts(YO, YO2, SYM((t - .30) / .25))
      else if (t < .66) mo = lerpPts(YO2, Mflat, IO((t - .55) / .11))
      else if (t < .76) mo = lerpPts(Mflat, REST7, IO((t - .66) / .10))
      else mo = REST7
      const pitch = track(t, [[.10, .30, 0, -.22, IO], [.55, .70, -.22, .03, IO], [.70, .80, .03, 0, IO]])
      const roll = track(t, [[.25, .45, 0, -5, SYM], [.55, .72, -5, 0, IO]]), yaw = track(t, [[.25, .45, 0, -.05, SYM], [.55, .72, -.05, 0, IO]])
      const c = track(t, [[.17, .19, 0, 1, IO], [.63, .65, 1, 0, IO], [.862, .87, 0, 1, IO], [.892, .90, 1, 0, IO]])
      const hopen = track(t, [[.62, .64, 1, .55, LIN], [.90, .98, .55, 1, IO]], 1)
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll)
      const ho = Math.max(.05, hopen * (1 - .75 * c)), dwv = .6 * (.35 + .65 * c)
      const open = x => [P(x, 6 - ho + (1 - ho) * .2), P(x, 6 + ho + (1 - ho) * .2)]
      const dash = (k, x) => n('path', { k, ...STROKE, d: polyD([P(x - dwv, 6.25), P(x + dwv, 6.25)]), opacity: c.toFixed(3) })
      return {
        el: open(5), er: open(11), no: nose(P), mo: shapeMouth(mo.map(q => P(...q))),
        op: { el: 1 - c, er: 1 - c }, over: [dash('dl', 5), dash('dr', 11)],
      }
    },
  })
}

/* STARNUTO — "ah… ah…" all'indietro a scatti, poi "ciù!" in avanti con qualche goccina (one-shot) */
{
  const D = 3.4
  const MF = [[6.6, 11.8], [7.3, 11.8], [8.7, 11.8], [9.4, 11.8], [8.7, 11.8], [7.3, 11.8], [6.6, 11.8]]
  const A1 = ellipse7(8, 12.6, .7, .75), A0 = ellipse7(8, 12.5, .5, .5), A2 = ellipse7(8, 12.8, .95, 1.15)
  const KT = [0, .08, .20, .26, .42, .47, .505, .60, .70, .76, 1]
  const MOS = [REST7, REST7, A1, A0, A2, A2, MF, MF, REST7, REST7, REST7]
  const E = [LIN, IO, IO, IO, LIN, cb(.6, 0, .9, .5), LIN, IO, LIN, LIN]
  const PIT = [0, 0, -.1, -.07, -.26, -.27, .22, .2, 0, 0, 0], VH = [1, 1, .7, .75, .35, .3, 0, 0, 1, 1, 1]
  const SPL = cb(.2, .6, .4, 1)
  const DROPS = [[4.6, 14.4, .3], [6.4, 15.4, .25], [9.6, 15.4, .25], [11.4, 14.4, .3], [8, 15.6, .22]]
  defineState('starnuto', {
    label: 'Starnuto', duration: D, loop: false,
    pose(t) {
      const mo = kf(t, KT, MOS, E), pitch = kf(t, KT, PIT, E)
      let vh = kf(t, KT, VH, E)
      const dw = track(t, [[.47, .505, 0, .55, IO], [.60, .65, .55, 0, IO]])
      if (t > .65) vh = t < .70 ? track(t, [[.65, .70, 0, 1, IO]], 0) : 1
      if (t >= .505 && t <= .65) vh = 0
      const yaw = t >= .76 ? .07 * Math.sin((t - .76) / .12 * 2 * Math.PI) * Math.max(0, 1 - (t - .76) / .24) : 0
      const roll = track(t, [[.28, .42, 0, -3, IO], [.47, .505, -3, 2, IO], [.60, .72, 2, 0, IO]])
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll)
      const eyep = x => {
        if (dw > .001) return [P(x - dw, 6.1), P(x + dw, 6.1)]
        const h = Math.max(.02, vh); return [P(x, 6 - h + (1 - vh) * .15), P(x, 6 + h + (1 - vh) * .15)]
      }
      // goccine: partono dalla bocca al "ciù" e volano via
      const over = DROPS.map(([x1, y1, rr], i) => {
        let cx = 8, cy = 13.4, o = 0
        if (t > .49 && t <= .51) o = .8 * (t - .49) / .02
        else if (t > .51 && t <= .68) { const k = SPL((t - .51) / .17); cx = 8 + (x1 - 8) * k; cy = 13.4 + (y1 - 13.4) * k; o = .8 * (1 - (t - .51) / .17) }
        else if (t > .68) { cx = x1; cy = y1 }
        return n('circle', { k: 'd' + i, cx: cx.toFixed(3), cy: cy.toFixed(3), r: rr, fill: 'currentColor', opacity: o.toFixed(3) })
      })
      return { el: eyep(5), er: eyep(11), no: nose(P), mo: shapeMouth(mo.map(q => P(...q))), over }
    },
  })
}

/* DISTRATTO — qualcosa fuori schermo attira l'attenzione; poi si accorge di te: "oh" (one-shot) */
{
  const D = 8.5, D0 = 6.5, HOLD0 = 2.9, EXTRA = 2.0, w = 2 * Math.PI / D
  const SM = [[5, 11], [6.3215, 12.9822], [9.6785, 12.9822], [11, 11]]
  const CUR = [[7.4, 11.9], [8, 12.05], [8.8, 12.05], [9.4, 11.85]], DOT = [[7.9, 12.3], [7.97, 12.3], [8.03, 12.3], [8.1, 12.3]]
  defineState('distratto', {
    label: 'Distratto', duration: D, loop: false,
    pose(_, T) {
      let u, hk
      if (T < HOLD0) { u = T; hk = 0 } else if (T < HOLD0 + EXTRA) { u = HOLD0; hk = (T - HOLD0) / EXTRA } else { u = T - EXTRA; hk = 0 }
      const t = u / D0, ex = Math.sin(Math.PI * hk)
      const look = track(t, [[.09, .12, 0, 1, IO], [.57, .59, 1, 0, IO]]), head = track(t, [[.11, .25, 0, 1, IO], [.73, .84, 1, 0, IO]])
      const up = track(t, [[.25, .48, 0, 1, SYM]], 0) * (1 - track(t, [[.57, .62, 0, 1, IO]]))
      const oh = track(t, [[.66, .675, 0, 1, IO], [.705, .735, 1, 0, IO]])
      const gx = .9 * look + .2 * ex * look, gy = -.55 * up * look + .25 * Math.sin(2 * Math.PI * hk) * look * (hk ? 1 : 0)
      const yaw = .32 * head + .06 * ex + .012 * Math.sin(3 * w * T), pitch = -.1 * up * head + .01 * Math.sin(2 * w * T) - .05 * oh, roll = -2 * head
      let ms
      if (t < .12) ms = SM
      else if (t < .20) ms = lerpPts(SM, CUR, IO((t - .12) / .08))
      else if (t < .635) ms = CUR
      else if (t < .66) ms = lerpPts(CUR, DOT, IO((t - .635) / .025))
      else if (t < .735) ms = DOT
      else if (t < .82) ms = lerpPts(DOT, SM, IO((t - .735) / .085))
      else ms = SM
      const showO = t >= .66 && t < .735
      const h = Math.max(.02, (1 + .1 * oh) * (1 - blinkf(T, [2.5, 4.3, 7.7], .07)))
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll)
      const rr = .8 + .08 * oh
      return {
        el: eye(5, 6, h, gx, gy).map(q => P(...q)), er: eye(11, 6, h, gx, gy).map(q => P(...q)), no: [P(8, 3), P(8, 9, 1.9)],
        mo: lineMouth(ms.map(q => P(...q))), op: { mo: showO ? 0 : 1 },
        over: [filled('oh', ellipse7(8, 12.3, rr * 1.12, rr * .82).map(q => P(...q)), showO ? 1 : 0)],
      }
    },
  })
}

/* CENTRIFUGA — gira su sé stesso, poi frastornato con gli occhi che girano, e si scrolla (one-shot) */
{
  const D = 6
  const FLAT = [[6.4, 11.8], [6.9, 11.8], [7.5, 11.8], [8, 11.8], [8.5, 11.8], [9.1, 11.8], [9.6, 11.8]]
  const DOT = [[7.95, 12.2], [7.97, 12.2], [7.99, 12.2], [8, 12.2], [8.01, 12.2], [8.03, 12.2], [8.05, 12.2]]
  const DAZE = [[6.6, 11.85], [7.07, 11.85], [7.53, 11.85], [8, 11.85], [8.47, 11.85], [8.93, 11.85], [9.4, 11.85]]
  const SPIN = cb(.55, 0, .45, 1)
  const sp = u => 1080 * SPIN(cl((u - .06) / .30))
  const om = u => (u > .06 && u < .36 ? (sp(u) - sp(u - .002)) / .002 * .30 : 0)
  defineState('centrifuga', {
    label: 'Centrifuga', duration: D, loop: false, viaNeutral: true,
    pose(t, T) {
      const spin = track(t, [[.06, .36, 0, 1080, SPIN]])
      const dz = track(t, [[.234, .34, 0, 1, SYM], [.62, .66, 1, 0, IO]]), dk = Math.max(0, (t - .234) / .386)
      const sh = track(t, [[.62, .78, 0, 1, LIN]]), shake = t >= .62 && t <= .78 ? .26 * Math.sin(sh * 2 * Math.PI * 4) * (1 - sh) : 0
      const lol = dk * 2 * Math.PI * 1.25
      const roll = spin + 4 * Math.sin(lol) * dz, yaw = shake + .13 * Math.cos(lol) * dz, pitch = .09 * Math.sin(lol) * dz
      const ang = dk * 2 * Math.PI * 2.2
      const gx = .55 * Math.cos(ang) * dz, gy = .45 * Math.sin(ang) * dz, gx2 = .55 * Math.cos(-ang + Math.PI) * dz, gy2 = .45 * Math.sin(-ang + Math.PI) * dz
      const sq = track(t, [[.62, .65, 0, 1, IO], [.76, .80, 1, 0, IO]])
      const bl = blinkf(T, [.88 * D], .07)
      const hL = Math.max(.03, (1 - .45 * dz) * (1 - .65 * sq) * (1 - bl)), hR = hL
      let mo
      if (t < .04) mo = SMILE2
      else if (t < .08) mo = lerpPts(SMILE2, DOT, IO((t - .04) / .04))
      else if (t < .36) mo = DOT
      else if (t < .40) mo = lerpPts(DOT, DAZE, IO((t - .36) / .04))
      else if (t < .62) mo = DAZE
      else if (t < .66) mo = lerpPts(DAZE, FLAT, IO((t - .62) / .04))
      else if (t < .78) mo = FLAT
      else if (t < .86) mo = lerpPts(FLAT, SMILE2, IO((t - .78) / .08))
      else mo = SMILE2
      const showO = t >= .08 && t < .36
      const rr = .78 + .3 * track(t, [[.08, .13, 0, 1, IO], [.31, .36, 1, 0, IO]])
      // la bocca resta un po' indietro rispetto alla rotazione (trascinamento proporzionale alla velocità)
      const omega = t > .06 && t < .36 ? (sp(t) - sp(t - .002)) / .002 / (1 / .30) : 0
      const alpha = t > .06 && t < .36 ? (om(t) - om(t - .004)) / .004 : 0
      const lag = Math.min(42, omega * .0115 + Math.max(0, alpha) * .0008)
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll, 0, 0, [8, 8])
      const PM = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll - lag, 0, 0, [8, 8])
      return {
        el: eye(5, 6, hL, gx, gy).map(q => P(...q)), er: eye(11, 6, hR, gx2, gy2).map(q => P(...q)), no: nose(P),
        mo: lineMouth(mo.map(q => PM(...q))), op: { mo: showO ? 0 : 1 },
        over: [filled('o', ellipse7(8, 12.2, rr, rr * 1.12).map(q => PM(...q)), showO ? 1 : 0)],
      }
    },
  })
}

/* ERRORE — occhi a barre inclinate e un punto esclamativo che cala deciso: /!\ (one-shot) */
{
  const D = 4
  const SM = [[5, 11], [6.3215, 12.9822], [9.6785, 12.9822], [11, 11]], DOT = [[8, 11.1], [8, 11.1], [8, 11.1], [8, 11.1]]
  const UP = cb(.25, .6, .4, 1), SLAM = cb(.55, 0, .9, .55), SET = cb(.3, 0, .25, 1)
  defineState('errore', {
    label: 'Errore', duration: D, loop: false,
    pose(t) {
      const e = track(t, [[.12, .22, 0, 1, IO], [.80, .90, 1, 0, IO]]), c = track(t, [[.15, .20, 0, 1, IO], [.83, .86, 1, 0, IO]])
      const drop = track(t, [[.12, .22, 0, -1.7, UP], [.22, .275, -1.7, .45, SLAM], [.275, .33, .45, 0, SET]])
      const dropE = .45 * track(t, [[.135, .235, 0, -1.7, UP], [.235, .29, -1.7, .45, SLAM], [.29, .345, .45, 0, SET]])
      const jolt = track(t, [[.265, .285, 0, .3, cb(.3, .5, .4, 1)], [.285, .35, .3, 0, IO]])
      const P = (x, y, ex = 0) => proj(x, y, ex, 0, 0, 0, 0, jolt)
      const ho = Math.max(.05, 1 - .8 * c), bw = .85 * (.35 + .65 * c)
      const open = x => [P(x, 6 - ho), P(x, 6 + ho)]
      const bar = x => {
        const bx = x + (x < 8 ? -.4 : .4), dy = bw * Math.tan(20 * Math.PI / 180) * c, yb = 6 + dropE * e
        const pts = x < 8 ? [P(bx - bw, yb + dy), P(bx + bw, yb - dy)] : [P(bx - bw, yb - dy), P(bx + bw, yb + dy)]
        return n('path', { k: 'b' + x, ...STROKE, d: polyD(pts), opacity: c.toFixed(3) })
      }
      return {
        el: open(5), er: open(11), op: { el: 1 - c, er: 1 - c },
        no: [P(8, 3 + drop * e), P(8, 9 - .6 * e + drop * e, NOSE_OUT)],
        mo: lineMouth(lerpPts(SM, DOT, e).map(q => P(q[0], q[1] + drop * e))),
        over: [bar(5), bar(11)],
      }
    },
  })
}

}

// ---- src/states/special.js ----
{
/* ai-avatar · stati speciali: cool, empty-state, clip, clicca, follow */
const RAD = Math.PI / 180

/* COOL — occhiali da sole, sorrisetto, annuisce a tempo; ogni tanto un riflesso passa sulle lenti */
{
  const D = 4, w = 2 * Math.PI / D
  const SMIRK = [[5.6, 11.8], [7.1, 12.75], [9.7, 12.45], [11.0, 10.6]], SMIRK2 = [[5.6, 11.85], [7.1, 12.85], [9.8, 12.5], [11.2, 10.4]]
  const LENS = [[3.3, 4.75], [7.7, 4.75], [7.75, 6.0], [6.9, 8.2], [5.35, 8.2], [3.9, 8.2], [3.3, 7.3], [3.3, 6.0]]
  const GL = cb(.4, 0, .2, 1)
  defineState('cool', {
    label: 'Cool', duration: D, viaNeutral: true,
    pose(t, T) {
      const beat = .5 - .5 * Math.cos(2 * w * T)
      const pitch = .055 * beat - .03, roll = -4 + 1.4 * Math.sin(w * T), yaw = .07 + .04 * Math.sin(w * T + .8), ty = .12 * beat
      const sm = .5 - .5 * Math.cos(w * T)
      const P = (x, y, e = 0) => proj(x, y, e, yaw, pitch, roll, 0, ty)
      const lens = side => {
        const q = (side > 0 ? LENS.map(([x, y]) => [16 - x, y]) : LENS).map(p => P(...p))
        return `M${q.slice(0, 2).map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join('L')}C${q.slice(2, 5).map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join(' ')}C${q.slice(5, 8).map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join(' ')}Z`
      }
      const ll = lens(-1), lr = lens(1), br = polyD([P(7.3, 5.35), P(8.7, 5.35)])
      const gx = t < .55 ? -3 : t < .8 ? -3 + 20 * GL((t - .55) / .25) : 17
      return {
        // occhi nascosti dietro le lenti (servono per le transizioni)
        el: eye(5, 6, 1).map(q => P(...q)), er: eye(11, 6, 1).map(q => P(...q)), op: { el: 0, er: 0 },
        no: [P(8, 3), P(8, 9, NOSE_OUT)], at: { no: { mask: 'url(#cool-nose)' } },
        mo: lineMouth(lerpPts(SMIRK, SMIRK2, sm).map(q => P(...q))),
        defs: [
          n('mask', { id: 'cool-glint', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 16, height: 16 }, [
            n('rect', { width: 16, height: 16, fill: 'white' }),
            n('g', { transform: 'skewX(-25)' }, [n('rect', { x: gx.toFixed(3), y: 0, width: 1.65, height: 16, fill: 'black' })]),
          ]),
          n('mask', { id: 'cool-nose', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 16, height: 16 }, [
            n('rect', { width: 16, height: 16, fill: 'white' }),
            n('path', { d: ll, fill: 'black', stroke: 'none' }), n('path', { d: lr, fill: 'black', stroke: 'none' }),
            n('path', { d: br, stroke: 'black', 'stroke-width': 1.5 }),
          ]),
        ],
        over: [n('g', { k: 'glasses', mask: 'url(#cool-glint)', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
          n('path', { d: ll, fill: 'currentColor', 'stroke-width': 1 }), n('path', { d: lr, fill: 'currentColor', 'stroke-width': 1 }),
          n('path', { d: br, 'stroke-width': 1.5, fill: 'none' }),
        ])],
      }
    },
  })
}

/* EMPTY STATE — "uhm?": cerca intorno, si avvicina alla camera 😑, occhi a scatti, poi "boh" */
{
  const D = 9.5, w = 2 * Math.PI / D
  const FLAT = [[6.6, 11.85], [7.4, 11.8], [8.6, 11.8], [9.4, 11.85]]
  const D_L = [[6.4, 11.6], [7.3, 11.8], [8.5, 11.95], [9.3, 12.1]], D_R = [[6.7, 12.1], [7.5, 11.95], [8.7, 11.8], [9.6, 11.6]]
  const D_S = [[7.0, 11.95], [7.6, 11.85], [8.4, 11.85], [9.0, 11.95]], SIDE = [[6.5, 12.15], [7.4, 11.75], [8.6, 11.75], [9.5, 12.15]]
  const STRAIGHT = [[6.8, 11.9], [7.6, 11.9], [8.4, 11.9], [9.2, 11.9]], UHMD = [[6.6, 12.12], [7.4, 11.86], [8.6, 11.86], [9.4, 12.05]]
  const sh = (m, dx) => m.map(([x, y]) => [x + dx, y])
  const KT = [0, .04, .11, .20, .27, .36, .42, .50, .56, .78, .84, .90, 1], E = [LIN, IO, LIN, IO, LIN, IO, LIN, IO, SYM, IO, LIN, LIN]
  const YAW = [0, 0, -.22, -.22, .22, .22, .05, .05, 0, 0, 0, 0, 0], PIT = [0, 0, -.02, -.02, -.02, -.02, .12, .12, 0, 0, 0, 0, 0]
  const GX = [0, 0, -.65, -.65, .65, .65, .15, .15, 0, 0, 0, 0, 0], GY = [0, 0, -.1, -.1, -.1, -.1, .55, .55, 0, 0, 0, 0, 0]
  const MO = [FLAT, FLAT, sh(D_L, -.4), sh(D_L, -.4), sh(D_R, .4), sh(D_R, .4), D_S, D_S, STRAIGHT, UHMD, FLAT, SIDE, FLAT]
  const spots = [[0, 0], [-1, 0], [1, 0], [0, 0]], st = [.60, .65, .715]
  const sacc = (tt, speed) => {
    let [x, y] = spots[0]
    for (let j = 1; j < spots.length; j++) if (tt >= st[j - 1]) { const k = IO(Math.min(1, (tt - st[j - 1]) / speed)); x = spots[j - 1][0] + (spots[j][0] - spots[j - 1][0]) * k; y = spots[j - 1][1] + (spots[j][1] - spots[j - 1][1]) * k }
    return [x, y]
  }
  defineState('empty-state', {
    label: 'Empty state', duration: D,
    pose(t, T) {
      let yaw = kf(t, KT, YAW, E) + .01 * Math.sin(3 * w * T), pitch = kf(t, KT, PIT, E), gx = kf(t, KT, GX, E), gy = kf(t, KT, GY, E)
      let roll = -2.5 * Math.sin(w * T)
      const lean = track(t, [[.50, .57, 0, 1, cb(.4, 0, .2, 1)], [.78, .84, 1, 0, IO]]), sq = track(t, [[.55, .575, 0, 1, IO], [.775, .80, 1, 0, IO]])
      const ex_ = t >= .57 && t <= .78 ? sacc(t, .003)[0] : 0
      gx += .4 * ex_
      const shrug = track(t, [[.855, .885, 0, 1, cb(.3, 0, .2, 1)], [.935, .975, 1, 0, IO]])
      roll += 2.5 * shrug; pitch -= .05 * shrug
      const SW = 1.5 * (24 / (30 - 6.2 * lean - 6)) / (24 / (30 - 6))
      const h = Math.max(.03, 1 - blinkf(T, [.18 * D, .47 * D, .93 * D], .07))
      const K = 24.0, Dv = 30.0 - 6.2 * lean
      const P = (x, y, e = 0) => {
        const zz = zOf(x, y) + e, dx = x - 8, dy = y - 8
        const x1 = dx * Math.cos(yaw) + zz * Math.sin(yaw), z1 = -dx * Math.sin(yaw) + zz * Math.cos(yaw)
        const y2 = dy * Math.cos(pitch) + z1 * Math.sin(pitch), z2 = -dy * Math.sin(pitch) + z1 * Math.cos(pitch)
        const a = roll * RAD, cx = 8, cy = 13
        let X = 8 + x1, Y = 8 + y2
        ;[X, Y] = [cx + (X - cx) * Math.cos(a) - (Y - cy) * Math.sin(a), cy + (X - cx) * Math.sin(a) + (Y - cy) * Math.cos(a)]
        const s_ = (K / (Dv - z2)) / (K / (30.0 - zOf(x, y) - e))
        return [8 + (X - 8) * s_, 8.4 + (Y - 8.4) * s_ - .55 * shrug]
      }
      const ho = Math.max(.05, h * (1 - .8 * sq)), dw = .62 * (.35 + .65 * sq)
      const open = x => eye(x, 6 - .45 * shrug, ho * (1 + .15 * shrug), gx, gy).map(q => P(...q))
      const dash = x => n('path', { k: 'd' + x, d: polyD([P(x + gx - dw, 6.3), P(x + gx + dw, 6.3)]), stroke: 'currentColor', 'stroke-width': SW.toFixed(3), 'stroke-linecap': 'round', opacity: sq.toFixed(3) })
      return {
        el: open(5), er: open(11), no: [P(8, 3), P(8, 9, NOSE_OUT)], mo: lineMouth(kf(t, KT, MO, E).map(q => P(...q))),
        op: { el: 1 - sq, er: 1 - sq }, sw: { el: SW, er: SW, no: SW, mo: SW }, over: [dash(5), dash(11)],
      }
    },
  })
}

/* CLIP — il naso sparisce e la bocca si allunga e si avvolge in una graffetta, saluta e torna (one-shot) */
{
  const D = 6, S = 2 / 3, NP = 120, WIRE_SW = 2 * S
  const bz = (p0, p1, p2, p3, nn = 24) => Array.from({ length: nn + 1 }, (_, j) => bez(p0, p1, p2, p3, j / nn).map(v => v * S))
  const ln = (a, b, nn = 12) => Array.from({ length: nn + 1 }, (_, j) => [(a[0] + (b[0] - a[0]) * j / nn) * S, (a[1] + (b[1] - a[1]) * j / nn) * S])
  const bottom = [...bz([17.5, 11.5], [16.8562, 12.4658], [16.5, 13.3447], [16.5, 14.5]), ...bz([16.5, 14.5], [16.5, 16.7091], [14.7091, 18.5], [12.5, 18.5]).slice(1), ...bz([12.5, 18.5], [10.2909, 18.5], [8.5, 16.7091], [8.5, 14.5]).slice(1)]
  const rest = [...ln([8.5, 14.5], [8.5, 6.25]).slice(1), ...bz([8.5, 6.25], [8.5, 4.73122], [9.73122, 3.5], [11.25, 3.5]).slice(1), ...bz([11.25, 3.5], [12.7688, 3.5], [14, 4.73122], [14, 6.25]).slice(1),
    ...ln([14, 6.25], [14, 13.5]).slice(1), ...bz([14, 13.5], [14, 14.3284], [13.3284, 15], [12.5, 15]).slice(1), ...bz([12.5, 15], [11.6716, 15], [11, 14.3284], [11, 13.5]).slice(1), ...ln([11, 13.5], [11, 11], 6).slice(1)]
  const WP = [...bottom, ...rest], NB = bottom.length
  const EL = [[5.5 * S, 6.5 * S], [5.5 * S, 8.5 * S]], ER = [[17 * S, 6.5 * S], [17 * S, 8.5 * S]]
  const SM40 = resample(Array.from({ length: 41 }, (_, j) => bez([11, 11], [9.6785, 12.9822], [6.3215, 12.9822], [5, 11], j / 40)), 40)
  const waved = a => {                       // il polso della "manina" (la codina) saluta
    if (Math.abs(a) < 1e-6) return WP
    const out = WP.slice(), WR = WP[11]
    for (let j = 0; j < 11; j++) {
      const u = 1 - j / 11, wt = u * u * (3 - 2 * u), c = Math.cos(a * wt * RAD), s = Math.sin(a * wt * RAD)
      const dx = WP[j][0] - WR[0], dy = WP[j][1] - WR[1]
      out[j] = [WR[0] + dx * c - dy * s, WR[1] + dx * s + dy * c]
    }
    return out
  }
  const pen = (f, W) => {                    // disegna come una mano: più lento nelle curve
    if (f <= 0) return [W[0], W[0]]
    const cost = [0]
    for (let i = 1; i < W.length; i++) {
      const d = Math.hypot(W[i][0] - W[i - 1][0], W[i][1] - W[i - 1][1])
      let tw = 0
      if (i > 1) { const a1 = Math.atan2(W[i - 1][1] - W[i - 2][1], W[i - 1][0] - W[i - 2][0]), a2 = Math.atan2(W[i][1] - W[i - 1][1], W[i][0] - W[i - 1][0]); tw = Math.abs(((a2 - a1 + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) }
      cost.push(cost[i - 1] + d + 1.1 * tw)
    }
    const T = cost[cost.length - 1] * f, out = [W[0]]
    for (let i = 1; i < W.length; i++) {
      if (cost[i] >= T) { const u = cost[i] > cost[i - 1] ? (T - cost[i - 1]) / (cost[i] - cost[i - 1]) : 0; out.push([W[i - 1][0] + (W[i][0] - W[i - 1][0]) * u, W[i - 1][1] + (W[i][1] - W[i - 1][1]) * u]); break }
      out.push(W[i])
    }
    return out
  }
  defineState('clip', {
    label: 'Clip', duration: D, loop: false,
    // se la lasci a metà, la graffetta si srotola da sola nel sorriso prima di passare oltre
    exit: {
      end: .88,
      at: t => (t < .06 || t >= .88 ? null : t >= .80 ? t : .80 + (1 - track(t, [[.06, .14, 0, 1, LIN]])) * .08),
    },
    pose(t, T) {
      const k = track(t, [[.06, .14, 0, 1, LIN], [.80, .88, 1, 0, LIN]])
      const idle = track(t, [[.18, .34, 0, 1, SYM], [.66, .86, 1, 0, SYM]]), ik = cl((t - .18) / .68)
      let roll = 2.5 * Math.sin(ik * 2 * Math.PI) * idle
      const yaw = .035 * Math.sin(ik * 2 * Math.PI + .6) * idle
      const wu = cl((t - .38) / .24), wv = Math.sin(Math.PI * wu) ** 2, ang = 22 * wv * Math.sin(wu * 3 * 2 * Math.PI)
      const h = Math.max(.03, 1 - blinkf(T, [.68 * D, .02 * D], .07))
      const kn = SYM(cl(k / .45)), ks = SYM(cl((k - .08) / .5)), ke = SYM(cl(k / .32))
      let ud = cl((k - .15) / .85); ud = ud * ud * (3 - 2 * ud)
      roll += -3.5 * Math.sin(Math.PI * ud)
      const P = (x, y, e = 0) => proj(x, y, e, yaw, 0, roll)
      const eyeln = (a0, a1, b0, b1) => {
        const p0 = [a0[0] + (b0[0] - a0[0]) * ke, a0[1] + (b0[1] - a0[1]) * ke], p1 = [a1[0] + (b1[0] - a1[0]) * ke, a1[1] + (b1[1] - a1[1]) * ke]
        const c = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
        return [P(c[0] + (p0[0] - c[0]) * h, c[1] + (p0[1] - c[1]) * h), P(c[0] + (p1[0] - c[0]) * h, c[1] + (p1[1] - c[1]) * h)]
      }
      const W = waved(ang), BT = resample(W.slice(0, NB), 40), bt = lerpPts(SM40, BT, ks)
      const off = [bt[40][0] - BT[40][0], bt[40][1] - BT[40][1]]
      const rst = pen(ud, W.slice(NB - 1))
      const pts = [...bt, ...rst.slice(1).map(p => [p[0] + off[0], p[1] + off[1]])]
      return {
        el: eyeln([5, 5], [5, 7], EL[0], EL[1]), er: eyeln([11, 5], [11, 7], ER[0], ER[1]),
        no: [P(8, 3 + 6 * kn, 0), P(8, 9, 0)], mo: polyMouth(resample(pts, NP).map(p => P(...p))), fillMo: false,
        op: { no: cl((1 - kn) / .2) }, sw: { mo: 1.5 + (WIRE_SW - 1.5) * ks },
      }
    },
  })
}

/* CLICCA — testa girata verso destra: "wow" al bottone, ti guarda, due colpetti: "eh dai, fallo su" */
{
  const D = 6.0
  const SMIRK = [[5.4, 11.7], [6.6, 12.75], [9.5, 12.55], [10.9, 10.6]], OC = [8.2, 12.1]
  const pproj = (x, y, extra = 0, yaw = 0, pitch = 0, roll = 0, zy = null, cam = 26) => {
    const zz = zOf(x, zy === null ? y : zy) + extra, dx = x - 8, dy = y - 8
    const x1 = dx * Math.cos(yaw) + zz * Math.sin(yaw), z1 = -dx * Math.sin(yaw) + zz * Math.cos(yaw)
    const y2 = dy * Math.cos(pitch) + z1 * Math.sin(pitch), z2 = -dy * Math.sin(pitch) + z1 * Math.cos(pitch)
    const s = cam / (cam - (z2 - R)), X = 8 + x1 * s, Y = 8 + y2 * s, a = roll * RAD
    return [8 + (X - 8) * Math.cos(a) - (Y - 13) * Math.sin(a), 13 + (X - 8) * Math.sin(a) + (Y - 13) * Math.cos(a)]
  }
  defineState('clicca', {
    label: 'Clicca qui', duration: D,
    pose(t, T) {
      const back = track(t, [[.36, .41, 0, 1, IO], [.89, .95, 1, 0, IO]]), look = 1 - back
      const nud = a => track(t, [[a, a + .035, 0, 1, IO], [a + .035, a + .10, 1, 0, SYM]])
      const c = nud(.56) + nud(.665), tl = track(t, [[.49, .55, 0, 1, SYM], [.76, .85, 1, 0, SYM]])
      const oo = track(t, [[.13, .18, 0, 1, IO], [.235, .28, 1, 0, SYM]])
      const br = Math.sin(2 * Math.PI * t)
      const yaw = .32 + .08 * c + .02 * br, pitch = .04 - .04 * c - .03 * tl + .012 * Math.sin(4 * Math.PI * t), roll = 4.5 + 5 * tl + 3 * c + .8 * br
      const gx = .8 * look - .45 * back + .3 * c + .08 * Math.sin(2 * Math.PI * t * 2) * look
      const h = Math.max(.03, (1 + .12 * oo) * (1 - blinkf(T, [.04 * D, .83 * D], .07)))
      const P = (x, y, e = 0) => pproj(x, y, e, yaw, pitch, roll)
      const ml = .9 * track(t, [[.13, .22, 0, 1, SYM], [.235, .28, 1, 0, SYM]])
      const MP = 24, mouth = []
      for (const half of [0, 1]) for (let j = 0; j <= MP; j++) {
        const u = j / MP, us = half === 0 ? u : 1 - u
        const sp = bez(...SMIRK, us)
        const an = half === 0 ? Math.PI - Math.PI * u : -Math.PI * u
        const ep = [OC[0] + .38 * Math.cos(an), OC[1] + .08 + .72 * Math.sin(an)]
        mouth.push([sp[0] + (ep[0] - sp[0]) * oo - ml, sp[1] + (ep[1] - sp[1]) * oo])
      }
      const PM = (x, y) => pproj(x, y, 0, yaw, pitch, roll, OC[1] + (y - OC[1]) * .35)
      return {
        el: eye(5, 6, h, gx).map(q => P(...q)), er: eye(11, 6, h, gx).map(q => P(...q)),
        no: [P(8, 3), P(8, 9, .8)], mo: mouth.map(q => PM(...q)),
      }
    },
  })
}

/* FOLLOW — guarda il puntatore, con profondità tra occhi, naso e bocca (interattivo) */
{
  const RR = 8, FOCAL = 42, YAW = .30, PITCH = .24
  const zOn = (x, y) => Math.sqrt(Math.max(0, RR * RR - (x - 8) ** 2 - (y - 8) ** 2))
  const P3 = (x, y, extra = 0) => [x, y, zOn(x, y) + extra]
  const pts = { el: [P3(5, 5), P3(5, 7)], er: [P3(11, 5), P3(11, 7)], no: [P3(8, 3), P3(8, 9, NOSE_OUT)], mo: [P3(5, 11), P3(6.3215, 12.9822), P3(9.6785, 12.9822), P3(11, 11)] }
  const project = ([x, y, zz], yaw, pitch) => {
    const dx = x - 8, dy = y - 8
    const x1 = dx * Math.cos(yaw) + zz * Math.sin(yaw), z1 = -dx * Math.sin(yaw) + zz * Math.cos(yaw)
    const y2 = dy * Math.cos(pitch) + z1 * Math.sin(pitch), z2 = -dy * Math.sin(pitch) + z1 * Math.cos(pitch)
    const s = FOCAL / (FOCAL - (z2 - zz))
    return [8 + x1 * s, 8 + y2 * s]
  }
  defineState('follow', {
    label: 'Segue il cursore', duration: 1, interactive: true,
    pose(t, T, ctx) {
      const m = ctx.mem || {}, p = ctx.pointer || { x: 0, y: 0, active: false }
      let tx = 0, ty = 0
      if (p.active) { const d = Math.hypot(p.x, p.y) || 1, k = Math.min(1, d / 260); tx = p.x / d * k; ty = p.y / d * k }
      m.x = m.x ?? 0; m.y = m.y ?? 0
      const a = 1 - Math.pow(1 - .12, (ctx.dt || 0) * 60)      // stessa morbidezza a qualsiasi frame rate
      m.x += (tx - m.x) * a; m.y += (ty - m.y) * a
      const yaw = m.x * YAW, pitch = m.y * PITCH, pr = k => pts[k].map(q => project(q, yaw, pitch))
      return { el: pr('el'), er: pr('er'), no: pr('no'), mo: lineMouth(pr('mo')) }
    },
  })
}

}

// ---- src/index.js ----
/*!
 * ai-avatar — motore di animazione dell'avatar AI (occhi, naso, bocca su una testa 3D).
 * Nessuna dipendenza. ES module.
 *
 *   import { createAvatar } from 'ai-avatar'
 *   const av = createAvatar(document.querySelector('#bot'), { state: 'idle' })
 *   av.set('thinking')                       // transizione automatica
 *   av.play('happy')                         // one-shot, poi torna allo stato di prima
 *
 * oppure, come Web Component:  <ai-avatar state="listening" size="64"></ai-avatar>
 */
/* Web Component <ai-avatar state="idle" size="64" transition="350" speed="1"> */
if (typeof customElements !== 'undefined' && !customElements.get('ai-avatar')) {
  customElements.define('ai-avatar', class extends HTMLElement {
    static get observedAttributes() { return ['state', 'size', 'transition', 'speed'] }
    connectedCallback() {
      if (this.av) return
      this.style.display = this.style.display || 'inline-block'
      this.av = createAvatar(this, {
        state: this.getAttribute('state') || 'idle', size: +this.getAttribute('size') || 64,
        transition: this.hasAttribute('transition') ? +this.getAttribute('transition') : 350, speed: +this.getAttribute('speed') || 1,
      })
      this.av.on('state', s => this.dispatchEvent(new CustomEvent('statechange', { detail: s })))
      this.av.on('end', s => this.dispatchEvent(new CustomEvent('end', { detail: s })))
    }
    disconnectedCallback() { this.av && this.av.destroy(); this.av = null }
    attributeChangedCallback(name, _, v) {
      if (!this.av) return
      if (name === 'state' && stateInfo(v)) this.av.set(v)
      if (name === 'size') this.av.size = +v
      if (name === 'transition') this.av.transition = +v
      if (name === 'speed') this.av.speed = +v
    }
    set(s, o) { this.av.set(s, o) }
    play(s, o) { this.av.play(s, o) }
  })
}
