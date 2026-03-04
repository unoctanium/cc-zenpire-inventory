export function usePrint() {
  /**
   * Print an arbitrary HTML string.
   *
   * PWA mode:     blob URL → window.open → Safari (user prints via share sheet)
   * Browser mode: blob URL → hidden iframe → iframe.contentWindow.print()
   *
   * The `printed` flag prevents double-firing: appending an iframe to the DOM
   * triggers onload for the initial about:blank document, then a second onload
   * fires when iframe.src (the blob) finishes loading. Without the guard, two
   * print dialogs would open.
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
      const iframe   = document.createElement('iframe')
      let   printed  = false
      iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;border:0;opacity:0'
      iframe.onload = () => {
        if (printed) return
        printed = true
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => {
          try { document.body.removeChild(iframe) } catch {}
          URL.revokeObjectURL(url)
        }, 2000)
      }
      document.body.appendChild(iframe)
      iframe.src = url
    }
  }

  /**
   * Print the current page.
   * Calls window.print() directly — works in all browsers.
   * iOS 16.4+ supports window.print() in WKWebView (PWA mode).
   */
  function doPrint() {
    if (typeof window === 'undefined') return
    window.print()
  }

  return { doPrint, printHtml }
}
