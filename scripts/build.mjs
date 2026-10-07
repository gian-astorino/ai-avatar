// Crea dist/ai-avatar.js: un unico ES module senza dipendenze, da usare nelle app.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const order = ['src/core.js', 'src/states/base.js', 'src/states/extra.js', 'src/states/special.js', 'src/index.js']
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const parts = order.map(f => {
  let s = readFileSync(join(root, f), 'utf8')
  s = s.replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*\n/gm, '')   // import { … } from '…'
  s = s.replace(/^import ['"][^'"]+['"]\s*\n/gm, '')                // import '…'
  s = s.replace(/^export \* from .*\n/gm, '')
  if (f.includes('/states/')) s = `{\n${s}\n}\n`                     // ogni file di stati nel suo blocco
  return `// ---- ${f} ----\n${s}`
})
mkdirSync(join(root, 'dist'), { recursive: true })
writeFileSync(join(root, 'dist/ai-avatar.js'), `/*! ai-avatar v${version} */\n` + parts.join('\n'))
console.log(`dist/ai-avatar.js (v${version}) creato`)
