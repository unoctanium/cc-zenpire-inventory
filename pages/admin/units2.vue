<script setup lang="ts">
type UnitType = 'mass' | 'volume' | 'count'

type UnitRow = {
  id: string
  code: string
  name: string
  unit_type: UnitType
}

type UiRow =
  | (UnitRow & { _mode: 'view' | 'edit'; _draft?: Pick<UnitRow, 'code' | 'name' | 'unit_type'> })
  | {
      id: '__new__'
      code: ''
      name: ''
      unit_type: UnitType
      _mode: 'edit'
      _draft: Pick<UnitRow, 'code' | 'name' | 'unit_type'>
    }

const toast = useToast()

const unitTypeOptions: { label: string; value: UnitType }[] = [
  { label: 'mass', value: 'mass' },
  { label: 'volume', value: 'volume' },
  { label: 'count', value: 'count' },
]

const { data, pending, refresh, error } = await useFetch<{ ok: boolean; units: UnitRow[] }>('/api/admin/units', {
  credentials: 'include',
})

const rows = ref<UiRow[]>([])

watchEffect(() => {
  const apiUnits = data.value?.units ?? []
  const hasNew = rows.value.some((r) => r.id === '__new__')
  const mapped: UiRow[] = apiUnits.map((u) => ({ ...u, _mode: 'view' }))
  rows.value = hasNew ? [{ ...(rows.value.find((r) => r.id === '__new__') as any) }, ...mapped] : mapped
})

const { data: me } = await useFetch<{ ok: boolean; email: string; permissions: string[] }>(
  '/api/me',
  { credentials: 'include', retry: 0 }
)

function hasPermission(code: string) {
  return (me.value?.permissions ?? []).includes(code)
}

const canRead = computed(() =>
  hasPermission('unit.manage') || hasPermission('unit.read')
)

const canManage = computed(() =>
  hasPermission('unit.manage')
)}

const canDelete = computed(() => hasPermission('unit.delete'))
function showError(title: string, e: any) {
  toast.add({
    title,
    description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e),
    color: 'red',
  })
}

function isDraftValid(d: Pick<UnitRow, 'code' | 'name' | 'unit_type'>) {
  return d.code.trim().length > 0 && d.name.trim().length > 0 && !!d.unit_type
}

function startAdd() {
  if (!canManage.value) return
  if (rows.value.some((r) => r.id === '__new__')) return

  rows.value.unshift({
    id: '__new__',
    code: '',
    name: '',
    unit_type: 'mass',
    _mode: 'edit',
    _draft: { code: '', name: '', unit_type: 'mass' },
  })
}

function startEdit(row: UiRow) {
  if (!canManage.value) return
  if (row.id === '__new__') return

  row._mode = 'edit'
  row._draft = {
    code: row.code,
    name: row.name,
    unit_type: row.unit_type,
  }
}
function discard(row: UiRow) {
  if (row.id === '__new__') {
    rows.value = rows.value.filter((r) => r.id !== '__new__')
    return
  }
  row._mode = 'view'
  row._draft = undefined
}

async function commit(row: UiRow) {
  const draft = row._draft
  if (!draft) return

  if (!canManage.value) return
  
  if (!isDraftValid(draft)) {
    toast.add({ title: 'Missing fields', description: 'Code and Name are required.', color: 'red' })
    return
  }

  try {
    if (row.id === '__new__') {
      await $fetch('/api/admin/units', {
        method: 'POST',
        credentials: 'include',
        body: {
          code: draft.code.trim(),
          name: draft.name.trim(),
          unit_type: draft.unit_type,
        },
      })
      toast.add({ title: 'Unit created' })
      rows.value = rows.value.filter((r) => r.id !== '__new__')
      await refresh()
      return
    }

    await $fetch(`/api/admin/units/${row.id}`, {
      method: 'PUT',
      credentials: 'include',
      body: {
        code: draft.code.trim(),
        name: draft.name.trim(),
        unit_type: draft.unit_type,
      },
    })

    toast.add({ title: 'Unit updated' })
    row._mode = 'view'
    row._draft = undefined
    await refresh()
  } catch (e: any) {
    showError('Save failed', e)
  }
}

/** Delete modal */
const isDeleteOpen = ref(false)
const deletingRow = ref<UiRow | null>(null)

function requestDelete(row: UiRow) {
  if (!canManage.value) return
  deletingRow.value = row
  isDeleteOpen.value = true
}

async function confirmDelete() {
  const row = deletingRow.value
  if (!row) return

  if (row.id === '__new__') {
    rows.value = rows.value.filter((r) => r.id !== '__new__')
    isDeleteOpen.value = false
    deletingRow.value = null
    return
  }

  try {
    await $fetch(`/api/admin/units/${row.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: 'Unit deleted' })
    isDeleteOpen.value = false
    deletingRow.value = null
    await refresh()
  } catch (e: any) {
    showError('Delete failed', e)
  }
}

/** Filter */
type FilterColumn = 'all' | 'code' | 'name' | 'unit_type'
const filterText = ref('')
const filterColumn = ref<FilterColumn>('all')

const filterColumnOptions = [
  { label: 'All', value: 'all' },
  { label: 'Code', value: 'code' },
  { label: 'Name', value: 'name' },
  { label: 'Type', value: 'unit_type' },
] as const

function normalize(s: unknown) {
  return String(s ?? '').toLowerCase()
}
function rowValue(row: UiRow, col: Exclude<FilterColumn, 'all'>) {
  const src: any = row._mode === 'edit' && row._draft ? row._draft : row
  return src[col]
}
function clearFilter() {
  filterText.value = ''
}
const filteredRows = computed(() => {
  const q = normalize(filterText.value).trim()
  if (!q) return rows.value
  const col = filterColumn.value

  return rows.value.filter((r) => {
    if (col === 'all') {
      return (
        normalize(rowValue(r, 'code')).includes(q) ||
        normalize(rowValue(r, 'name')).includes(q) ||
        normalize(rowValue(r, 'unit_type')).includes(q)
      )
    }
    return normalize(rowValue(r, col)).includes(q)
  })
})

/** Sort */
type SortKey = 'code' | 'name' | 'unit_type'
type SortDir = 'asc' | 'desc' | null
const sortKey = ref<SortKey>('code')
const sortDir = ref<SortDir>(null)

function toggleSort(key: SortKey) {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = 'asc'
    return
  }
  if (sortDir.value === null) sortDir.value = 'asc'
  else if (sortDir.value === 'asc') sortDir.value = 'desc'
  else sortDir.value = null
}
function compare(a: unknown, b: unknown) {
  const aa = normalize(a)
  const bb = normalize(b)
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
}

const visibleRows = computed(() => {
  const base = filteredRows.value.slice()
  if (!sortDir.value) return base

  const key = sortKey.value
  const dir = sortDir.value
  base.sort((ra, rb) => {
    const va = rowValue(ra, key)
    const vb = rowValue(rb, key)
    const c = compare(va, vb)
    return dir === 'asc' ? c : -c
  })
  return base
})

const errorText = computed(() => (error.value ? `Failed to load units: ${error.value.message}` : null))
</script>

<template>

  <div v-if="!canRead" class="p-6 text-red-600">
    403 – You do not have permission to view Units.
  </div>

  <AdminTableShell v-else :error-text="errorText">
    <template #title>Units</template>
    <template #subtitle>Admin-only CRUD (permission: unit.manage)</template>

    <template #toolbar>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <!-- Filter -->
        <div class="flex items-center gap-2">
          <div class="flex items-stretch">
            <input
              v-model="filterText"
              class="w-[240px] rounded-l-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                     focus:outline-none focus:ring-2 focus:ring-gray-300
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
              placeholder="Filter…"
              autocomplete="off"
              inputmode="search"
            />
            <button
              type="button"
              :disabled="!filterText"
              @click="clearFilter"
              class="flex items-center justify-center px-3
                     border-t border-b border-r border-gray-300
                     rounded-r-md
                     bg-gray-100 text-gray-600
                     hover:bg-gray-200
                     disabled:opacity-40 disabled:cursor-not-allowed
                     dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              aria-label="Clear filter"
            >
              ✕
            </button>
          </div>

          <select
            v-model="filterColumn"
            class="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900
                   focus:outline-none focus:ring-2 focus:ring-gray-300
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
          >
            <option v-for="o in filterColumnOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>

        <!-- Refresh + Add -->
        <div class="flex items-center gap-2">
          <UButton icon="i-heroicons-arrow-path" color="gray" variant="soft" @click="refresh()">Refresh</UButton>
          
          <UButton
              v-if="canManage"
              icon="i-heroicons-plus"
              @click="startAdd"
          >
              Add unit
          </UButton>
          
        </div>
      </div>
    </template>

    <template #table>
      <table class="min-w-[720px] w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col style="width: 140px" />
          <col style="width: 360px" />
          <col style="width: 160px" />
          <col style="width: 140px" />
        </colgroup>

        <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
          <tr>
            <th
              class="sticky left-0 z-30 px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                     border-b border-gray-200 dark:border-gray-800
                     border-r border-gray-200 dark:border-gray-800
                     bg-white dark:bg-gray-950"
            >
              <div class="flex items-center justify-between gap-2">
                <span>Code</span>
                <AdminSortButton
                  :active="sortKey === 'code'"
                  :dir="sortKey === 'code' ? sortDir : null"
                  aria-label="Sort by code"
                  @click="toggleSort('code')"
                />
              </div>
            </th>

            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800">
              <div class="flex items-center justify-between gap-2">
                <span>Name</span>
                <AdminSortButton
                  :active="sortKey === 'name'"
                  :dir="sortKey === 'name' ? sortDir : null"
                  aria-label="Sort by name"
                  @click="toggleSort('name')"
                />
              </div>
            </th>

            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800">
              <div class="flex items-center justify-between gap-2">
                <span>Type</span>
                <AdminSortButton
                  :active="sortKey === 'unit_type'"
                  :dir="sortKey === 'unit_type' ? sortDir : null"
                  aria-label="Sort by type"
                  @click="toggleSort('unit_type')"
                />
              </div>
            </th>

            <th
              class="sticky right-0 z-30 px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-200
                     border-b border-gray-200 dark:border-gray-800
                     border-l border-gray-200 dark:border-gray-800
                     bg-white dark:bg-gray-950"
            >
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="pending">
            <td colspan="4" class="px-3 py-3 text-gray-500 dark:text-gray-400">Loading…</td>
          </tr>

          <tr v-else-if="visibleRows.length === 0">
            <td colspan="4" class="px-3 py-3 text-gray-500 dark:text-gray-400">No data</td>
          </tr>

          <tr v-for="row in visibleRows" :key="row.id" class="border-b border-gray-100 dark:border-gray-900/60">
            <td
              class="sticky left-0 z-10 px-3 py-2 align-middle bg-white dark:bg-gray-950
                     border-r border-gray-200 dark:border-gray-800"
            >
              <template v-if="row._mode === 'edit'">
                <input
                  v-model="row._draft!.code"
                  class="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  placeholder="e.g. g"
                  autocomplete="off"
                />
              </template>
              <template v-else>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.code }}</span>
              </template>
            </td>

            <td class="px-3 py-2 align-middle">
              <template v-if="row._mode === 'edit'">
                <input
                  v-model="row._draft!.name"
                  class="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  placeholder="e.g. Gram"
                  autocomplete="off"
                />
              </template>
              <template v-else>
                <span class="text-gray-800 dark:text-gray-200">{{ row.name }}</span>
              </template>
            </td>

            <td class="px-3 py-2 align-middle">
              <template v-if="row._mode === 'edit'">
                <select
                  v-model="row._draft!.unit_type"
                  class="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                >
                  <option v-for="o in unitTypeOptions" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </option>
                </select>
              </template>
              <template v-else>
                <span class="text-gray-800 dark:text-gray-200">{{ row.unit_type }}</span>
              </template>
            </td>

            <td
              class="sticky right-0 z-10 px-3 py-2 align-middle text-right bg-white dark:bg-gray-950
                     border-l border-gray-200 dark:border-gray-800"
            >
              <AdminInlineRowActions
                  :mode="row._mode"
                  :can-edit="canManage"
                  :can-delete="canMange"
                  @edit="startEdit(row)"
                  @save="commit(row)"
                  @discard="discard(row)"
                  @delete="requestDelete(row)"
            />
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <template #footer>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Note: Delete is enforced server-side (403 outside DEV_MODE). UI shows the button (MVP).
      </p>

      <UModal v-model:open="isDeleteOpen" title="Delete unit">
        <template #body>
          <p v-if="deletingRow?.id === '__new__'">Discard the new (unsaved) row?</p>
          <p v-else>Delete <strong>{{ (deletingRow as any)?.code }}</strong> ({{ (deletingRow as any)?.name }})?</p>
        </template>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="soft" @click="isDeleteOpen = false">Cancel</UButton>
            <UButton color="red" @click="confirmDelete">Delete</UButton>
          </div>
        </template>
      </UModal>
    </template>
  </AdminTableShell>
</template>