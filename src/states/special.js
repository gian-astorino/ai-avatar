/* ai-avatar · stati speciali: cool, empty-state, clip, clicca, follow */
import {
  R, NOSE_OUT, cb, IO, SYM, LIN, cl, track, kf, blinkf, proj, zOf, eye, lerpPts, bez, resample, plen,
  lineMouth, polyMouth, cubicD, polyD, defineState, n,
} from '../core.js'

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
