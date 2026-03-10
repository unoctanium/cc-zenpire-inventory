const PRINT_ID = '__zp_print'

/**
 * Returns true when running as an iOS home-screen PWA (standalone mode).
 * window.print() is silently ignored in this context.
 */
function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window.navigator as any).standalone
}

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
   * Print an arbitrary HTML string.
   *
   * iOS standalone (home-screen PWA): window.print() is silently ignored.
   * Workaround: open the HTML as a blob URL in a new tab, which escapes the
   * PWA and opens Safari, where the user can Print via the share sheet.
   *
   * Desktop / iOS Safari (browser): inject body content into a hidden
   * #__zp_print div, apply @media print rules that hide the app, then
   * call window.print() on the main window (avoids cross-frame popup).
   * Cleaned up via the afterprint event.
   */
  function printHtml(html: string) {
    if (typeof window === 'undefined') return

    if (isIOSStandalone()) {
      const blob = new Blob([html], { type: 'text/html' })
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }

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
   *
   * iOS standalone: window.print() is silently ignored.
   * Open the page URL in a new tab so the user can print from Safari.
   *
   * All other contexts: window.print() directly.
   */
  function doPrint() {
    if (typeof window === 'undefined') return
    if (isIOSStandalone()) {
      window.open(window.location.href, '_blank')
      return
    }
    window.print()
  }

  return { doPrint, printHtml }
}
