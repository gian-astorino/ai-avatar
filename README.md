# ai-avatar

Motore di animazione dell'avatar AI. Disegna occhi, naso e bocca su una testa 3D in tempo reale e passa da uno stato all'altro con una transizione morbida. Nessuna dipendenza, un solo file da ~67 KB non minificato (`dist/ai-avatar.js`).

## Stati

| Tipo | Stati |
| --- | --- |
| Loop: restano finché non cambi | `idle`, `thinking`, `thinking-loop`, `speaking`, `listening`, `pong`, `imagining`, `loading`, `loading-loop`, `cool`, `empty-state`, `clicca` |
| One-shot: finiscono e tornano allo stato di prima | `happy`, `entrata`, `fischietta`, `sbadiglio`, `starnuto`, `distratto`, `centrifuga`, `errore`, `clip` |
| Interattivo | `follow` (guarda il puntatore) |

Tutti gli stati sono convertiti 1:1 da `avatar-animazioni.html`, che resta il riferimento visivo.

## Installazione

Da GitHub (repo privato, serve l'accesso):

```bash
npm i github:ORG/ai-avatar#v0.2.0
```

Oppure copia `dist/ai-avatar.js` nel progetto: è un unico file senza dipendenze.

## Uso rapido: Web Component

```html
<script type="module" src="./dist/ai-avatar.js"></script>

<ai-avatar id="bot" state="idle" size="64"></ai-avatar>

<script type="module">
  const bot = document.getElementById('bot')
  bot.setAttribute('state', 'thinking')          // transizione automatica
  bot.play('happy')                               // one-shot, poi torna allo stato di prima
  bot.addEventListener('statechange', e => console.log(e.detail))
  bot.addEventListener('end', e => console.log('finito', e.detail))
</script>
```

Attributi: `state`, `size` (px), `transition` (ms, default 350), `speed` (1 = normale).
Il colore segue `color` del contenitore (`currentColor`), quindi funziona in tema chiaro e scuro.

## Uso da JavaScript

```js
import { createAvatar } from 'ai-avatar'

const av = createAvatar(document.querySelector('#bot'), { state: 'idle', size: 64 })

av.set('listening')                            // loop
av.set('thinking', { transition: 500 })        // transizione più lenta
av.set('cool', { via: 'neutral' })             // passa dalla faccia neutra
av.play('happy')                               // one-shot, poi torna allo stato di prima
av.play('errore', { then: 'idle' })            // ...o a uno stato scelto

av.on('state', s => {})                        // ogni cambio di stato
av.on('end', s => {})                          // fine di un one-shot
av.pause(); av.resume(); av.speed = 1.5
av.destroy()
```

### In React

```jsx
import 'ai-avatar'   // registra <ai-avatar>

export function Bot({ state }) {
  return <ai-avatar state={state} size="48" />
}
```

## Transizioni

- **Diretta (default).** La posa che si vede in quel momento si fonde con quella del nuovo stato. Lo stato che esce continua ad animarsi mentre sfuma. Se cambi di nuovo durante una transizione, si riparte dal fotogramma visibile, quindi non ci sono mai salti.
- **Via faccia neutra.** Prima si torna alla faccia neutra, poi si va al nuovo stato. Si attiva da sola per gli stati molto lontani dal neutro (`pong`, `loading`, `loading-loop`, `cool`, `centrifuga`); la puoi forzare con `{ via: 'neutral' }` o evitare con `{ via: 'direct' }`.
- **Uscita propria.** Uno stato può recitare la sua uscita prima di sfumare. Per esempio `clip`, se la lasci a metà, si srotola nel sorriso e solo dopo passa al nuovo stato.
- **Accessori.** Occhiali, note, gocce, fiore e barre sfumano insieme alla transizione.

Sotto il cofano ogni stato restituisce una "posa" nello stesso formato:

- **Occhi e naso:** polilinee.
- **Bocca:** un anello chiuso. Una bocca a linea è un anello ad area zero, mentre una bocca aperta ha area e si riempie, quindi qualsiasi bocca si trasforma in qualsiasi altra.
- **Accessori:** nodi SVG extra (`under` sotto la faccia, `over` sopra, `defs` per le maschere).

## Aggiungere uno stato

```js
import { defineState, proj, track, IO, lineMouth, SMILE, NOSE_OUT } from 'ai-avatar'

defineState('annuisce', {
  label: 'Annuisce', duration: 2, loop: true,
  pose(t, T) {
    const pitch = .15 * track(t, [[.2, .35, 0, 1, IO], [.35, .5, 1, 0, IO]])
    const P = (x, y, e = 0) => proj(x, y, e, 0, pitch, 0)
    return {
      el: [P(5, 5), P(5, 7)], er: [P(11, 5), P(11, 7)],
      no: [P(8, 3), P(8, 9, NOSE_OUT)], mo: lineMouth(SMILE.map(q => P(...q))),
    }
  },
})
```

## Export statico

`toSVG('thinking', 1.2)` restituisce l'SVG di un singolo istante, utile per email, Figma o `<img>`.

## Accessibilità e prestazioni

- Con `prefers-reduced-motion` l'avatar resta fermo.
- Non anima quando non è visibile (fuori schermo o tab in background).
- `role="img"` e `aria-label="AI avatar"` sull'SVG.

## Fedeltà rispetto all'HTML di riferimento

Un test confronta motore e riferimento pixel per pixel su 12 istanti per ognuno dei 22 stati. La differenza è sotto lo 0,5% dei pixel di tratto: sono solo i bordi sfumati. Fa eccezione l'entrata, all'1,4% in un fotogramma, per il modo in cui il CSS sfuma l'ultimo tratto.

## Sviluppo

```bash
npm install          # installa playwright (serve solo per i test)
npx playwright install chromium
npm run playground   # http://localhost:5173/playground/ — prova stati e transizioni, confronto col riferimento
npm test             # confronta pixel per pixel tutti gli stati con reference/avatar-animazioni.html
npm run build        # rigenera dist/ai-avatar.js da src/
```

Per una nuova versione: modifica `src/`, `npm test`, `npm run build`, aggiorna `version` in `package.json` e `CHANGELOG.md`, poi crea il tag (`git tag v0.3.0 && git push --tags`).

## Struttura

```
dist/ai-avatar.js        tutto in un file (da usare nelle app)
reference/               l'HTML con le animazioni originali: il riferimento visivo
playground/              pagina per provare stati e transizioni
test/                    confronto automatico motore ↔ riferimento
scripts/                 build e server locale
src/core.js              matematica, posa, transizioni, disegno, player
src/states/base.js       idle, thinking, speaking, listening, pong, happy, entrata, imagining, loading
src/states/extra.js      fischietta, sbadiglio, starnuto, distratto, centrifuga, errore
src/states/special.js    cool, empty-state, clip, clicca, follow
src/index.js             registra gli stati e il Web Component
```
