/**
 * Inject a full-screen splash screen into every HTML response.
 *
 * This runs server-side and embeds the splash as raw HTML+CSS in the
 * document *before* any JavaScript executes. The client plugin
 * (plugins/splash.client.ts) removes it once the app has mounted.
 *
 * Using a server plugin (not app.vue) means the splash is present even
 * when the browser serves old cached HTML — the new JS will find
 * #splash-screen and manage it the same way.
 */

const SPLASH_STYLE = `<style>
  #splash-screen {
    position: fixed; inset: 0; z-index: 9999;
    background: #0082c9;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 2rem;
    transition: opacity 0.35s ease;
  }
  #splash-screen .sp-logo {
    width: 6rem; height: 6rem; flex-shrink: 0;
    border-radius: 50%; overflow: hidden;
    border: 2px solid rgba(255,255,255,0.9);
  }
  #splash-screen .sp-logo img {
    width: 100%; height: 100%;
    object-fit: cover;
    filter: invert(1); mix-blend-mode: screen;
  }
  #splash-screen .sp-spinner {
    width: 36px; height: 36px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: sp-spin 0.8s linear infinite;
  }
  @keyframes sp-spin { to { transform: rotate(360deg); } }
</style>`

const SPLASH_HTML = `<div id="splash-screen">
  <div class="sp-logo"><img src="/logo.png" alt="Zenpire" /></div>
  <div class="sp-spinner"></div>
</div>`

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head.push(SPLASH_STYLE)
    html.bodyPrepend.push(SPLASH_HTML)
  })
})
