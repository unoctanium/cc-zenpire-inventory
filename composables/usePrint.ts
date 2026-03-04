/**
 * usePrint
 *
 * Wraps window.print() with a fallback for iOS PWA standalone mode,
 * where window.print() is silently blocked by the WKWebView runtime.
 *
 * Fallback: serialize the current page as a static HTML blob and open it in
 * Safari (blob: URLs bypass the WKWebView and always open in regular Safari).
 * Scripts are stripped so Nuxt doesn't try to re-hydrate or make API calls.
 * Relative asset paths are made absolute so CSS loads from the real server.
 * The user then prints via Safari's share sheet.
 */
export function usePrint() {
  /**
   * Print an arbitrary HTML string.
   * - PWA mode:     blob URL → window.open → Safari (print via share sheet)
   * - Browser mode: blob URL → hidden iframe src → iframe.contentWindow.print()
   *
   * Using a blob URL for the iframe avoids the WebKit race condition where
   * document.write() + document.close() fires onload synchronously before
   * the handler can be assigned.
   */
  function printHtml(html: string) {
    if (typeof window === 'undefined') return

    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)

    if (isStandalone) {
      const win = window.open(url, '_blank')
      if (win) {
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        URL.revokeObjectURL(url)
      }
    } else {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;border:0;opacity:0'
      iframe.onload = () => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => {
          try { document.body.removeChild(iframe) } catch {}
          URL.revokeObjectURL(url)
        }, 2000)
      }
      document.body.appendChild(iframe)
      iframe.src = url   // triggers onload asynchronously — no race condition
    }
  }

  function doPrint() {
    if (typeof window === 'undefined') return

    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches

    if (isStandalone) {
      const base    = window.location.origin
      const rawHtml = '<!DOCTYPE html>' + document.documentElement.outerHTML

      const html = rawHtml
        // Make relative asset paths absolute so CSS/fonts load in Safari
        .replace(/(href|src)="(\/[^"]*?)"/g, `$1="${base}$2"`)
        // Strip JS bundles — page is static; prevents Nuxt from re-hydrating
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const win  = window.open(url, '_blank')
      if (win) {
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        URL.revokeObjectURL(url)
      }
    } else {
      window.print()
    }
  }

  return { doPrint, printHtml }
}
