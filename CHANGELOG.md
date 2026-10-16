# Changelog

## Non rilasciato
- `imagining`: tolto il fiore che sbocciava dietro la testa.
- Nuovo stato loop `regista` (7,5 s): video maker serio con basco, occhiali da sole squadrati e bocca piatta. Studia l'inquadratura a sinistra e a destra, abbassa piano gli occhiali scoprendo gli occhi, li rialza e chiude con un cenno. Riferimento in `reference/avatar-regista.svg`, verificato pixel per pixel; passa dalla faccia neutra come `cool`.

## 0.2.0
- Tutte le 22 animazioni portate 1:1 dall'HTML di riferimento (`reference/avatar-animazioni.html`), verificate pixel per pixel.
- Transizioni: diretta, via faccia neutra (automatica per pong, loading, loading-loop, cool, centrifuga; forzabile con `{ via: 'neutral' }`), uscita propria dello stato (la graffetta di `clip` si srotola prima di passare oltre).
- Accessori (occhiali, note, gocce, fiore, barre) che sfumano con la transizione.
- Stato interattivo `follow` (segue il puntatore).
- `entrata` 2× più veloce del riferimento (0,9 s invece di 1,7 s).
- Web Component `<ai-avatar>`, export statico `toSVG()`.

## 0.1.0
- Prima versione: motore, transizioni e 6 stati (idle, listening, thinking, speaking, loading, happy).
