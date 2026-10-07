// stato del motore → [commento della card nell'HTML di riferimento, pose campionate nel riferimento]
export const CARDS = {
  idle: ['1. IDLE', 240], thinking: ['2. THINKING', 240], 'thinking-loop': ['2b. THINKING LOOP', 240], speaking: ['3. SPEAKING', 240],
  listening: ['4. LISTENING', 180], pong: ['5. PROCESSING', 200], happy: ['6. HAPPY', 64], entrata: ['7. ENTRANCE', 0],
  imagining: ['9. IMAGINING', 200], loading: ['10. LOADING', 240], 'loading-loop': ['11. LOADING LOOP', 240],
  fischietta: ['12. WHISTLE', 250], sbadiglio: ['13. YAWN', 240], starnuto: ['14. SNEEZE', 204], distratto: ['15. DISTRACTED', 340],
  centrifuga: ['17. SPIN', 300], errore: ['18. ERROR', 400], cool: ['22. COOL', 240], 'empty-state': ['23. EMPTY', 475],
  clip: ['24. CLIP', 360], clicca: ['25. CLICCA', 330], follow: ['8. FOLLOW CURSOR', 0],
}
