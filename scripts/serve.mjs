// Serve la repo in locale per aprire il playground: npm run playground → http://localhost:5173/playground/
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const port = +process.env.PORT || 5173
createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'
  try { const body = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(body) }
  catch { res.writeHead(404); res.end('Non trovato') }
}).listen(port, () => console.log(`Playground: http://localhost:${port}/playground/`))
