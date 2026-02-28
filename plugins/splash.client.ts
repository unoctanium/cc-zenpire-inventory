/**
 * Splash screen lifecycle manager (client-side).
 *
 * The CSS in main.css renders body::before as a full-screen blue overlay
 * from first paint — before any JS runs and regardless of what HTML the
 * browser shows (fresh or stale). This plugin removes that overlay once
 * the Nuxt app is mounted and ready.
 *
 * The Nitro server plugin (server/plugins/inject-splash.ts) adds a logo +
 * spinner on top when the server has been restarted with the latest code.
 * We fade that out at the same time.
 */
export default defineNuxtPlugin((nuxtApp) => {
  let hidden = false

  const hide = () => {
    if (hidden) return
    hidden = true

    // Start fade: CSS overlay (body::before via main.css)
    document.body.classList.add('splash-fading')

    // Start fade: server-injected logo+spinner element (if present)
    const el = document.getElementById('splash-screen')
    if (el) {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
    }

    // After transition completes: remove both completely
    setTimeout(() => {
      document.body.classList.remove('splash-fading')
      document.body.classList.add('splash-done')
      el?.remove()
    }, 380)
  }

  // Primary trigger: app mounted + one animation frame so the browser
  // has painted the correct page content before we start fading.
  nuxtApp.hook('app:mounted', () => {
    requestAnimationFrame(() => setTimeout(hide, 200))
  })

  // Hard fallback: never block the app for more than 4 s
  setTimeout(hide, 4000)
})
