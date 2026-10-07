/* ai-avatar · stati base: idle, thinking, speaking, listening, pong, happy, entrata, imagining, loading */
import {
  NOSE_OUT, cb, IO, SYM, LIN, SMOOTH, cl, track, kf, blinkf, proj, eye, lerpPts, chain, partial,
  SMILE, SMILE2, lineMouth, shapeMouth, polyMouth, defineState, n,
} from '../core.js'

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
