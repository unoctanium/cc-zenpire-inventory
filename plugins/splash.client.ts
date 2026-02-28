/**
 * Splash screen lifecycle manager (client-side).
 *
 * The CSS in main.css renders the splash (blue overlay + logo + spinner)
 * via html::before, html::after, and body::before from first paint —
 * before any JS runs. This plugin removes it once the app is mounted.
 *
 * The Nitro server plugin may also have injected #splash-screen (logo +
 * spinner as real DOM elements); we fade that out at the same time.
 */
export default defineNuxtPlugin((nuxtApp) => {
  let hidden = false

  const hide = () => {
    if (hidden) return
    hidden = true

    // Fade: CSS pseudo-element splash (html::before/after, body::before)
    document.documentElement.classList.add('splash-fading')

    // Fade: server-injected DOM element if present
    const el = document.getElementById('splash-screen')
    if (el) {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
    }

    // After fade transition: remove pseudo-elements and DOM element
    setTimeout(() => {
      document.documentElement.classList.remove('splash-fading')
      document.documentElement.classList.add('splash-done')
      el?.remove()
    }, 380)
  }

  // Primary: hide once app is mounted and browser has painted
  nuxtApp.hook('app:mounted', () => {
    requestAnimationFrame(() => setTimeout(hide, 200))
  })

  // Hard fallback: never block for more than 4 s
  setTimeout(hide, 4000)
})
