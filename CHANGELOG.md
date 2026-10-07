# Changelog

## 0.2.0
- Tutte le 22 animazioni portate 1:1 dall'HTML di riferimento (`reference/avatar-animazioni.html`), verificate pixel per pixel.
- Transizioni: diretta, via faccia neutra (automatica per pong, loading, loading-loop, cool, centrifuga; forzabile con `{ via: 'neutral' }`), uscita propria dello stato (la graffetta di `clip` si srotola prima di passare oltre).
- Accessori (occhiali, note, gocce, fiore, barre) che sfumano con la transizione.
- Stato interattivo `follow` (segue il puntatore).
- Web Component `<ai-avatar>`, export statico `toSVG()`.

## 0.1.0
- Prima versione: motore, transizioni e 6 stati (idle, listening, thinking, speaking, loading, happy).
