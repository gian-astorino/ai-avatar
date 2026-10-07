/*!
 * ai-avatar — motore di animazione dell'avatar AI (occhi, naso, bocca su una testa 3D).
 * Nessuna dipendenza. ES module.
 *
 *   import { createAvatar } from 'ai-avatar'
 *   const av = createAvatar(document.querySelector('#bot'), { state: 'idle' })
 *   av.set('thinking')                       // transizione automatica
 *   av.play('happy')                         // one-shot, poi torna allo stato di prima
 *
 * oppure, come Web Component:  <ai-avatar state="listening" size="64"></ai-avatar>
 */
export * from './core.js'
import './states/base.js'
import './states/extra.js'
import './states/special.js'
import { createAvatar, stateInfo } from './core.js'

/* Web Component <ai-avatar state="idle" size="64" transition="350" speed="1"> */
if (typeof customElements !== 'undefined' && !customElements.get('ai-avatar')) {
  customElements.define('ai-avatar', class extends HTMLElement {
    static get observedAttributes() { return ['state', 'size', 'transition', 'speed'] }
    connectedCallback() {
      if (this.av) return
      this.style.display = this.style.display || 'inline-block'
      this.av = createAvatar(this, {
        state: this.getAttribute('state') || 'idle', size: +this.getAttribute('size') || 64,
        transition: this.hasAttribute('transition') ? +this.getAttribute('transition') : 350, speed: +this.getAttribute('speed') || 1,
      })
      this.av.on('state', s => this.dispatchEvent(new CustomEvent('statechange', { detail: s })))
      this.av.on('end', s => this.dispatchEvent(new CustomEvent('end', { detail: s })))
    }
    disconnectedCallback() { this.av && this.av.destroy(); this.av = null }
    attributeChangedCallback(name, _, v) {
      if (!this.av) return
      if (name === 'state' && stateInfo(v)) this.av.set(v)
      if (name === 'size') this.av.size = +v
      if (name === 'transition') this.av.transition = +v
      if (name === 'speed') this.av.speed = +v
    }
    set(s, o) { this.av.set(s, o) }
    play(s, o) { this.av.play(s, o) }
  })
}
