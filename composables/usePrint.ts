export function usePrint() {
  /**
   * Print an arbitrary HTML string by opening it as a blob URL in a new tab.
   * The new tab auto-triggers window.print() once the document has loaded.
   * Works on desktop browsers, iOS Safari, and iOS home-screen PWA (where
   * window.print() on the main window is silently ignored).
   */
  function printHtml(html: string) {
    if (typeof window === 'undefined') return
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (win) {
      win.addEventListener('load', () => {
        setTimeout(() => {
          win.print()
          URL.revokeObjectURL(url)
        }, 300)
      }, { once: true })
    } else {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * Print the current page (no custom HTML).
   */
  function doPrint() {
    if (typeof window === 'undefined') return
    window.print()
  }

  return { doPrint, printHtml }
}
