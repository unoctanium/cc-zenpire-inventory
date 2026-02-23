/**
 * useTableWidths
 *
 * Computes pixel widths for a three-zone sticky table:
 *   [first col — sticky left, max 33%]
 *   [inner cols — fill available space, scroll if overflow]
 *   [last col  — sticky right, shrinks to content]
 *
 * Width measurement uses canvas measureText (no DOM rendering needed).
 * Recomputes whenever containerEl resizes or inputs change.
 *
 * Usage:
 *   const { firstWidth, innerWidths, lastWidth, totalInnerWidth, containerWidth } =
 *     useTableWidths(containerRef, { first, inner, last })
 *
 * Each column descriptor:
 *   { header: string, candidates: string[] }
 *   candidates = all strings that could appear (values + dropdown options)
 */

export interface ColInput {
  header: string
  candidates: string[]
  minPx?: number
}

export interface TableWidthsInput {
  first: ColInput
  inner: ColInput[]
  last:  ColInput
}

const FONT     = '14px ui-sans-serif, system-ui, -apple-system, sans-serif'
const CELL_PAD = 20   // px left + right padding per cell (px-2 = 8px each side + 4px spare)
const SORT_BTN = 24   // extra space for sort icon in sortable headers
const MIN_COL  = 48   // absolute minimum column width

let _canvas: HTMLCanvasElement | null = null

function measure(text: string): number {
  if (typeof document === 'undefined') return 80
  if (!_canvas) _canvas = document.createElement('canvas')
  const ctx = _canvas.getContext('2d')!
  ctx.font = FONT
  return ctx.measureText(text).width
}

function naturalWidth(col: ColInput, extraPad = 0): number {
  const all = [col.header, ...col.candidates].filter(Boolean)
  const maxText = Math.max(...all.map(s => measure(s)), 0)
  return Math.max(Math.ceil(maxText) + CELL_PAD + extraPad, col.minPx ?? 0, MIN_COL)
}

export function useTableWidths(
  containerRef: Ref<HTMLElement | null>,
  input: ComputedRef<TableWidthsInput> | TableWidthsInput,
) {
  const containerWidth = ref(0)

  // ResizeObserver to track container width
  let ro: ResizeObserver | null = null
  onMounted(() => {
    const el = containerRef.value
    if (!el) return
    containerWidth.value = el.offsetWidth
    ro = new ResizeObserver(entries => {
      containerWidth.value = entries[0]?.contentRect.width ?? 0
    })
    ro.observe(el)
  })
  onUnmounted(() => ro?.disconnect())

  const cols = computed(() => (isRef(input) || isReactive(input) ? (input as ComputedRef<TableWidthsInput>).value : input))

  // First column: natural width capped at 33% of container
  const firstWidth = computed(() => {
    const natural = naturalWidth(cols.value.first, SORT_BTN)
    if (!containerWidth.value) return natural
    return Math.min(natural, Math.floor(containerWidth.value * 0.33))
  })

  // Last column: natural width only (max = content, no stretching)
  const lastWidth = computed(() => naturalWidth(cols.value.last))

  // Available space for inner columns
  const middleAvail = computed(() =>
    Math.max(0, containerWidth.value - firstWidth.value - lastWidth.value)
  )

  // Natural widths of each inner column
  const innerNaturals = computed(() =>
    cols.value.inner.map(c => naturalWidth(c, SORT_BTN))
  )

  const totalInnerNatural = computed(() =>
    innerNaturals.value.reduce((s, w) => s + w, 0)
  )

  // If inner cols are narrower than available space → stretch proportionally
  // If wider → keep natural widths (outer div scrolls)
  const innerWidths = computed((): number[] => {
    const naturals = innerNaturals.value
    const total    = totalInnerNatural.value
    const avail    = middleAvail.value
    if (!avail || !total) return naturals
    if (total < avail) {
      // distribute extra space proportionally
      return naturals.map(n => Math.floor((n / total) * avail))
    }
    return naturals
  })

  const totalInnerWidth = computed(() =>
    innerWidths.value.reduce((s, w) => s + w, 0)
  )

  return { firstWidth, innerWidths, lastWidth, totalInnerWidth, containerWidth }
}
