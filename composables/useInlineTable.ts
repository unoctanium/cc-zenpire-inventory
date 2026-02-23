/**
 * useInlineTable
 *
 * Shared sort + filter logic for all inline-edit admin tables.
 *
 * The only thing that varies per table is how to extract a searchable
 * string for each filterable column from a row — that's the `getSearchValue`
 * callback. Everything else (state, computed, helpers) is identical.
 *
 * Usage:
 *
 *   const { filterText, filterColumn, filterColumnOptions, clearFilter,
 *           sortKey, sortDir, toggleSort, visibleRows } = useInlineTable({
 *     rows,
 *     filterColumns: [
 *       { label: t('common.all'), value: 'all' },
 *       { label: t('units.code'), value: 'code' },
 *       { label: t('units.name'), value: 'name' },
 *     ],
 *     defaultSortKey: 'name',
 *     getSearchValue: (row, col) => {
 *       const src = row._draft ?? row
 *       return String(src[col] ?? '')
 *     },
 *   })
 */

export interface FilterOption {
  label: string
  value: string   // 'all' | any column key
}

export interface UseInlineTableOptions<TRow> {
  rows:           Ref<TRow[]>
  filterColumns:  FilterOption[]        // first entry must have value: 'all'
  defaultSortKey: string
  /** Return a lowercase-safe string for the given column key on the given row */
  getSearchValue: (row: TRow, col: string) => string
}

export function useInlineTable<TRow extends { id: string }>(
  options: UseInlineTableOptions<TRow>,
) {
  const { rows, filterColumns, defaultSortKey, getSearchValue } = options

  // ── filter ──────────────────────────────────────────────────────────────────

  const filterText   = ref('')
  const filterColumn = ref(filterColumns[0]?.value ?? 'all')

  const filterColumnOptions = computed(() => filterColumns)

  function clearFilter() {
    filterText.value = ''
  }

  function normalize(s: unknown): string {
    return String(s ?? '').toLowerCase()
  }

  const searchableCols = computed(() =>
    filterColumns.filter(f => f.value !== 'all').map(f => f.value)
  )

  const filteredRows = computed(() => {
    const q = normalize(filterText.value).trim()
    if (!q) return rows.value
    const col = filterColumn.value
    return rows.value.filter(r => {
      if (col === 'all') {
        return searchableCols.value.some(c =>
          normalize(getSearchValue(r, c)).includes(q)
        )
      }
      return normalize(getSearchValue(r, col)).includes(q)
    })
  })

  // ── sort ────────────────────────────────────────────────────────────────────

  const sortKey = ref(defaultSortKey)
  const sortDir = ref<'asc' | 'desc' | null>(null)

  function toggleSort(key: string) {
    if (sortKey.value !== key) {
      sortKey.value = key
      sortDir.value = 'asc'
      return
    }
    if (sortDir.value === null)       sortDir.value = 'asc'
    else if (sortDir.value === 'asc') sortDir.value = 'desc'
    else                              sortDir.value = null
  }

  const visibleRows = computed(() => {
    const base = filteredRows.value.slice()
    if (!sortDir.value) return base
    const key = sortKey.value
    const dir = sortDir.value
    base.sort((a, b) => {
      const aa = normalize(getSearchValue(a, key))
      const bb = normalize(getSearchValue(b, key))
      if (aa < bb) return dir === 'asc' ? -1 : 1
      if (aa > bb) return dir === 'asc' ?  1 : -1
      return 0
    })
    return base
  })

  return {
    filterText,
    filterColumn,
    filterColumnOptions,
    clearFilter,
    sortKey,
    sortDir,
    toggleSort,
    visibleRows,
  }
}
