/**
 * Splash screen lifecycle manager (client-side).
 *
 * Finds the #splash-screen injected by the Nitro server plugin.
 * If it isn't there (old cached HTML without the injection),
 * creates it via DOM so the old content is covered immediately.
 *
 * Fades the splash out 700 ms after the Nuxt app has fully mounted
 * (auth plugin has already resolved at that point).
 */
export default defineNuxtPlugin((nuxtApp) => {
  let splash = document.getElementById('splash-screen')

  if (!splash) {
    // Old cached HTML: create the splash via JS to cover stale content.
    const style = document.createElement('style')
    style.textContent = `
      #splash-screen {
        position: fixed; inset: 0; z-index: 9999;
        background: #0082c9;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 2rem; transition: opacity 0.35s ease;
      }
      #splash-screen .sp-logo {
        width: 6rem; height: 6rem; flex-shrink: 0;
        border-radius: 50%; overflow: hidden;
        border: 2px solid rgba(255,255,255,0.9);
      }
      #splash-screen .sp-logo img {
        width: 100%; height: 100%;
        object-fit: cover; filter: invert(1); mix-blend-mode: screen;
      }
      #splash-screen .sp-spinner {
        width: 36px; height: 36px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top-color: #fff; border-radius: 50%;
        animation: sp-spin 0.8s linear infinite;
      }
      @keyframes sp-spin { to { transform: rotate(360deg); } }
    `
    document.head.appendChild(style)

    splash = document.createElement('div')
    splash.id = 'splash-screen'
    splash.innerHTML = `
      <div class="sp-logo"><img src="/logo.png" alt="Zenpire" /></div>
      <div class="sp-spinner"></div>
    `
    document.body.insertBefore(splash, document.body.firstChild)
  }

  const el = splash

  nuxtApp.hook('app:mounted', () => {
    setTimeout(() => {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
      setTimeout(() => el.remove(), 400)
    }, 700)
  })
})
