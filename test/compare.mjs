// Confronta pixel per pixel il motore con l'HTML di riferimento (12 istanti per stato).
// Uso: npm test            → tutti gli stati
//      npm test -- cool    → solo alcuni (separati da virgola)
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { CARDS, REF_SPEED } from './cards.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIMIT = 1.5      // % massima di pixel diversi (sui pixel di tratto) per considerare uno stato fedele
const only = process.argv[2]?.split(',')
const types = { '.html': 'text/html', '.js': 'text/javascript' }
const server = createServer(async (req, res) => {
  try { const p = join(root, decodeURIComponent(req.url.split('?')[0])); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)) }
  catch { res.writeHead(404); res.end() }
}).listen(0)
const port = server.address().port

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 900 } })
const errors = []; page.on('pageerror', e => errors.push(e.message))
await page.goto(`http://localhost:${port}/test/compare.html`)
await page.waitForFunction(() => window.ready, null, { timeout: 15000 })

// differenza tra due screenshot, calcolata nel browser (niente dipendenze extra)
const diff = (a, b) => page.evaluate(async ([a, b]) => {
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + src })
  const [A, B] = await Promise.all([load(a), load(b)]), c = document.createElement('canvas')
  c.width = A.width; c.height = A.height; const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data
  x.clearRect(0, 0, c.width, c.height); x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data
  let d = 0, ink = 0
  for (let i = 0; i < da.length; i += 4) { if (da[i] < 128) ink++; if (Math.abs(da[i] - db[i]) > 64) d++ }
  return d / Math.max(1, ink) * 100
}, [a.toString('base64'), b.toString('base64')])

let failed = 0
for (const [name, [, N]] of Object.entries(CARDS)) {
  if (only && !only.includes(name)) continue
  const D = await page.evaluate(n => { const a = document.querySelector(`#r-${n} animate`); return a ? parseFloat(a.getAttribute('dur')) : 4.2 }, name)
  const vals = []
  for (let i = 0; i < 12; i++) {
    const T = N ? Math.round(N * i / 12) * D / N + 1e-4 : name === 'entrata' ? 1.75 * i / 12 : 0
    await page.evaluate(([n, T, k]) => {
      const s = document.querySelector(`#r-${n} svg`); s.setCurrentTime(T)
      s.getAnimations({ subtree: true }).forEach(a => { a.currentTime = T * 1000 })
      eng[n].renderAt(n, T / k)
    }, [name, T, REF_SPEED[name] ?? 1])
    const a = await page.locator(`#r-${name} svg`).screenshot(), b = await page.locator(`#e-${name} svg`).screenshot()
    vals.push(await diff(a, b))
  }
  const worst = Math.max(...vals), ok = worst <= LIMIT
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(14)} medio ${(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)}%  peggiore ${worst.toFixed(2)}%`)
}
await browser.close(); server.close()
if (errors.length) { console.error('Errori nella pagina:', errors); process.exit(1) }
if (failed) { console.error(`${failed} stati non coincidono con il riferimento`); process.exit(1) }
console.log('Tutti gli stati coincidono con il riferimento.')
