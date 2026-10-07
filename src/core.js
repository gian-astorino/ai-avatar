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
