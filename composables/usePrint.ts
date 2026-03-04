/**
 * usePrint
 *
 * Wraps window.print() with a fallback for iOS PWA standalone mode,
 * where window.print() is silently blocked by the WKWebView runtime.
 *
 * Fallback: open the current URL in a new Safari tab (not the PWA webview),
 * where the user can print normally via Safari's share sheet / print dialog.
 */
export function usePrint() {
  function doPrint() {
    if (typeof window === 'undefined') return

    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches

    if (isStandalone) {
      // PWA mode: open same page in regular browser tab so print works
      window.open(window.location.href, '_blank')
    } else {
      window.print()
    }
  }

  return { doPrint }
}
