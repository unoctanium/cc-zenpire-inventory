const PRINT_ID = '__zp_print'

/**
 * Scope plain CSS selectors to #PRINT_ID so injected print styles
 * don't bleed into the host app.  @-rules (e.g. @media, @page) are
 * left as-is because they are block-level and don't need prefixing.
 */
function scopeStyles(css: string): string {
  // Pull out @-rules first so we don't accidentally rewrite their inner selectors.
  const atRules: string[] = []
  const plain = css.replace(
    /@[^{]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    m => { atRules.push(m); return '' },
  )

  const scoped = plain.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, rules) => {
    const prefixed = sel.trim().split(',').map((s: string) => {
      s = s.trim()
      if (!s)           return ''
      if (s === '*')    return `#${PRINT_ID} *`
      if (s === 'body') return `#${PRINT_ID}`
      return `#${PRINT_ID} ${s}`
    }).filter(Boolean).join(', ')
    return prefixed ? `${prefixed}{${rules}}` : ''
  })

  return scoped + '\n' + atRules.join('\n')
}

export function usePrint() {
  /**
   * Print an arbitrary HTML string without opening an iframe or a new
   * window — both of which trigger Safari's "blocked from automatic
   * printing" popup.
   *
   * Strategy:
   *   1. Parse the HTML with DOMParser.
   *   2. Inject the body content into a hidden #__zp_print div.
   *   3. Inject scoped styles + @media print rules that hide the app
   *      and reveal only #__zp_print.
   *   4. Call window.print() on the main window (no cross-frame call).
   *   5. Clean up via the afterprint event.
   */
  function printHtml(html: string) {
    if (typeof window === 'undefined') return

    const printDoc = new DOMParser().parseFromString(html, 'text/html')
    const rawCss   = Array.from(printDoc.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n')

    const styleEl       = document.createElement('style')
    styleEl.textContent = [
      `#${PRINT_ID}{display:none}`,
      `@media print{body>*:not(#${PRINT_ID}){display:none!important}#${PRINT_ID}{display:block!important}}`,
      scopeStyles(rawCss),
    ].join('\n')

    const div   = document.createElement('div')
    div.id      = PRINT_ID
    div.innerHTML = printDoc.body.innerHTML

    document.head.appendChild(styleEl)
    document.body.appendChild(div)

    const cleanup = () => { styleEl.remove(); div.remove() }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
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
