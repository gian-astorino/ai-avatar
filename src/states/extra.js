/* ai-avatar · stati espressivi: fischietta, sbadiglio, starnuto, distratto, centrifuga, errore */
import {
  NOSE_OUT, cb, IO, SYM, LIN, cl, track, kf, blinkf, proj, eye, lerpPts, REST7, ellipse7,
  SMILE2, lineMouth, shapeMouth, polyD, cubicD, defineState, n,
} from '../core.js'

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
