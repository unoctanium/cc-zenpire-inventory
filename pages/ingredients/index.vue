<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()

type IngredientKind = 'purchased' | 'produced'

type IngredientRow = {
  id: string
  name: string
  kind: IngredientKind
  default_unit_id: string
  default_unit_code: string
  standard_unit_cost: number | null
  standard_cost_currency: string
  produced_by_recipe_id: string | null
}

type DraftFields = {
  name: string
  kind: IngredientKind
  default_unit_id: string
  standard_unit_cost: string // string for input binding, parsed on save
}

type UiRow =
  | (IngredientRow & { _mode: 'view' | 'edit'; _draft?: DraftFields })
  | {
      id: '__new__'
      name: ''
      kind: 'purchased'
      default_unit_id: ''
      default_unit_code: ''
      standard_unit_cost: null
      standard_cost_currency: 'EUR'
      produced_by_recipe_id: null
      _mode: 'edit'
      _draft: DraftFields
    }

type UnitOption = { id: string; code: string; name: string }

const { data: ingredientData, pending, refresh, error } = await useFetch<{
  ok: boolean
  ingredients: IngredientRow[]
}>('/api/ingredients', { credentials: 'include' })

const { data: unitData } = await useFetch<{ ok: boolean; units: UnitOption[] }>(
  '/api/units',
  { credentials: 'include' }
)

const { data: me } = await useFetch<{ ok: boolean; permissions: string[] }>(
  '/api/auth/me',
  { credentials: 'include', retry: 0 }
)

const units = computed(() => unitData.value?.units ?? [])

function hasPermission(code: string) {
  return (me.value?.permissions ?? []).includes(code)
}

const canRead   = computed(() => hasPermission('ingredient.manage') || hasPermission('ingredient.read'))
const canManage = computed(() => hasPermission('ingredient.manage'))

const rows = ref<UiRow[]>([])

watchEffect(() => {
  const apiRows = ingredientData.value?.ingredients ?? []
  const hasNew  = rows.value.some((r) => r.id === '__new__')
  const mapped: UiRow[] = apiRows.map((i) => ({ ...i, _mode: 'view' }))
  rows.value = hasNew
    ? [{ ...(rows.value.find((r) => r.id === '__new__') as any) }, ...mapped]
    : mapped
})

function unitCodeById(id: string) {
  return units.value.find((u) => u.id === id)?.code ?? id
}

function showError(title: string, e: any) {
  toast.add({
    title,
    description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e),
    color: 'red',
  })
}

function isDraftValid(d: DraftFields) {
  return d.name.trim().length > 0 && d.default_unit_id.length > 0
}

function startAdd() {
  if (!canManage.value) return
  if (rows.value.some((r) => r.id === '__new__')) return
  const firstUnitId = units.value[0]?.id ?? ''
  rows.value.unshift({
    id: '__new__',
    name: '',
    kind: 'purchased',
    default_unit_id: '',
    default_unit_code: '',
    standard_unit_cost: null,
    standard_cost_currency: 'EUR',
    produced_by_recipe_id: null,
    _mode: 'edit',
    _draft: { name: '', kind: 'purchased', default_unit_id: firstUnitId, standard_unit_cost: '' },
  })
}

function startEdit(row: UiRow) {
  if (!canManage.value || row.id === '__new__') return
  if (row.kind === 'produced') return
  row._mode = 'edit'
  row._draft = {
    name:              row.name,
    kind:              row.kind,
    default_unit_id:   row.default_unit_id,
    standard_unit_cost: row.standard_unit_cost != null ? String(row.standard_unit_cost) : '',
  }
}

function discard(row: UiRow) {
  if (row.id === '__new__') {
    rows.value = rows.value.filter((r) => r.id !== '__new__')
    return
  }
  row._mode  = 'view'
  row._draft = undefined
}

async function commit(row: UiRow) {
  const draft = row._draft
  if (!draft || !canManage.value) return

  if (!isDraftValid(draft)) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.nameAndUnitRequired'), color: 'red' })
    return
  }

  const costValue = draft.standard_unit_cost.trim() === ''
    ? null
    : Number(draft.standard_unit_cost)

  if (draft.standard_unit_cost.trim() !== '' && isNaN(costValue as number)) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.invalidCost'), color: 'red' })
    return
  }

  try {
    if (row.id === '__new__') {
      await $fetch('/api/ingredients', {
        method: 'POST',
        credentials: 'include',
        body: {
          name:              draft.name.trim(),
          default_unit_id:   draft.default_unit_id,
          standard_unit_cost: costValue,
        },
      })
      toast.add({ title: t('ingredients.created') })
      rows.value = rows.value.filter((r) => r.id !== '__new__')
      await refresh()
      return
    }

    await $fetch(`/api/ingredients/${row.id}`, {
      method: 'PUT',
      credentials: 'include',
      body: {
        name:              draft.name.trim(),
        default_unit_id:   draft.default_unit_id,
        standard_unit_cost: costValue,
      },
    })
    toast.add({ title: t('ingredients.updated') })
    row._mode  = 'view'
    row._draft = undefined
    await refresh()
  } catch (e: any) {
    showError(t('common.saveFailed'), e)
  }
}

/** Delete modal */
const isDeleteOpen = ref(false)
const deletingRow  = ref<UiRow | null>(null)

function requestDelete(row: UiRow) {
  if (!canManage.value) return
  deletingRow.value  = row
  isDeleteOpen.value = true
}

async function confirmDelete() {
  const row = deletingRow.value
  if (!row) return

  if (row.id === '__new__') {
    rows.value         = rows.value.filter((r) => r.id !== '__new__')
    isDeleteOpen.value = false
    deletingRow.value  = null
    return
  }

  try {
    await $fetch(`/api/ingredients/${row.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('ingredients.deleted') })
    isDeleteOpen.value = false
    deletingRow.value  = null
    await refresh()
  } catch (e: any) {
    showError(t('common.deleteFailed'), e)
  }
}

/** Filter */
type FilterColumn = 'all' | 'name' | 'kind' | 'default_unit_code'
const filterText   = ref('')
const filterColumn = ref<FilterColumn>('all')

const filterColumnOptions = computed(() => [
  { label: t('common.all'),          value: 'all'               },
  { label: t('ingredients.name'),    value: 'name'              },
  { label: t('ingredients.kind'),    value: 'kind'              },
  { label: t('ingredients.unit'),    value: 'default_unit_code' },
])

function normalize(s: unknown) {
  return String(s ?? '').toLowerCase()
}

function rowValue(row: UiRow, col: Exclude<FilterColumn, 'all'>) {
  if (col === 'default_unit_code') {
    if (row._mode === 'edit' && row._draft) {
      return unitCodeById(row._draft.default_unit_id)
    }
    return row.default_unit_code
  }
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
        normalize(rowValue(r, 'name')).includes(q) ||
        normalize(rowValue(r, 'kind')).includes(q) ||
        normalize(rowValue(r, 'default_unit_code')).includes(q)
      )
    }
    return normalize(rowValue(r, col)).includes(q)
  })
})

/** Sort */
type SortKey = 'name' | 'kind' | 'default_unit_code'
type SortDir = 'asc' | 'desc' | null
const sortKey = ref<SortKey>('name')
const sortDir = ref<SortDir>(null)

function toggleSort(key: SortKey) {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = 'asc'
    return
  }
  if (sortDir.value === null)       sortDir.value = 'asc'
  else if (sortDir.value === 'asc') sortDir.value = 'desc'
  else                              sortDir.value = null
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
    const c = compare(rowValue(ra, key), rowValue(rb, key))
    return dir === 'asc' ? c : -c
  })
  return base
})

const errorText = computed(() =>
  error.value ? `${t('ingredients.loadError')}: ${error.value.message}` : null
)
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('ingredients.noPermission') }}
  </div>

  <AdminTableShell v-else :error-text="errorText">
    <template #title>{{ $t('ingredients.title') }}</template>
    <template #subtitle>{{ $t('ingredients.subtitle') }}</template>

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
              :placeholder="$t('common.search')"
              autocomplete="off"
              inputmode="search"
            />
            <button
              type="button"
              :disabled="!filterText"
              :aria-label="$t('common.clearFilter')"
              class="flex items-center justify-center px-3
                     border-t border-b border-r border-gray-300 rounded-r-md
                     bg-gray-100 text-gray-600 hover:bg-gray-200
                     disabled:opacity-40 disabled:cursor-not-allowed
                     dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="clearFilter"
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
          <UButton icon="i-heroicons-arrow-path" color="gray" variant="soft" @click="refresh()">
            {{ $t('common.refresh') }}
          </UButton>
          <UButton v-if="canManage" icon="i-heroicons-plus" @click="startAdd">
            {{ $t('ingredients.add') }}
          </UButton>
        </div>
      </div>
    </template>

    <template #table>
      <table class="min-w-[860px] w-full table-fixed border-separate border-spacing-0 text-sm">
        <colgroup>
          <col style="width: 260px" />
          <col style="width: 120px" />
          <col style="width: 140px" />
          <col style="width: 130px" />
          <col style="width: 80px" />
          <col style="width: 130px" />
        </colgroup>

        <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
          <tr>
            <!-- NAME -->
            <th class="sticky left-0 z-30 px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                       border-b border-gray-200 dark:border-gray-800
                       border-r border-gray-200 dark:border-gray-800
                       bg-white dark:bg-gray-950">
              <div class="flex items-center justify-between gap-2">
                <span>{{ $t('ingredients.name') }}</span>
                <AdminSortButton
                  :active="sortKey === 'name'"
                  :dir="sortKey === 'name' ? sortDir : null"
                  :aria-label="$t('ingredients.sortByName')"
                  @click="toggleSort('name')"
                />
              </div>
            </th>

            <!-- KIND -->
            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                       border-b border-gray-200 dark:border-gray-800">
              <div class="flex items-center justify-between gap-2">
                <span>{{ $t('ingredients.kind') }}</span>
                <AdminSortButton
                  :active="sortKey === 'kind'"
                  :dir="sortKey === 'kind' ? sortDir : null"
                  :aria-label="$t('ingredients.sortByKind')"
                  @click="toggleSort('kind')"
                />
              </div>
            </th>

            <!-- DEFAULT UNIT -->
            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                       border-b border-gray-200 dark:border-gray-800">
              <div class="flex items-center justify-between gap-2">
                <span>{{ $t('ingredients.unit') }}</span>
                <AdminSortButton
                  :active="sortKey === 'default_unit_code'"
                  :dir="sortKey === 'default_unit_code' ? sortDir : null"
                  :aria-label="$t('ingredients.sortByUnit')"
                  @click="toggleSort('default_unit_code')"
                />
              </div>
            </th>

            <!-- STD COST -->
            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                       border-b border-gray-200 dark:border-gray-800">
              {{ $t('ingredients.standardCost') }}
            </th>

            <!-- CURRENCY -->
            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                       border-b border-gray-200 dark:border-gray-800">
              {{ $t('ingredients.currency') }}
            </th>

            <!-- ACTIONS -->
            <th class="sticky right-0 z-30 px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-200
                       border-b border-gray-200 dark:border-gray-800
                       border-l border-gray-200 dark:border-gray-800
                       bg-white dark:bg-gray-950">
              {{ $t('common.actions') }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="pending">
            <td colspan="6" class="px-3 py-3 text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</td>
          </tr>

          <tr v-else-if="visibleRows.length === 0">
            <td colspan="6" class="px-3 py-3 text-gray-500 dark:text-gray-400">{{ $t('common.noData') }}</td>
          </tr>

          <tr
            v-for="row in visibleRows"
            :key="row.id"
            class="border-b border-gray-100 dark:border-gray-900/60"
            :class="row.kind === 'produced' ? 'opacity-70' : ''"
          >
            <!-- NAME -->
            <td class="sticky left-0 z-10 px-3 py-2 align-middle
                       bg-white dark:bg-gray-950
                       border-r border-gray-200 dark:border-gray-800">
              <template v-if="row._mode === 'edit'">
                <input
                  v-model="row._draft!.name"
                  class="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  :placeholder="$t('ingredients.namePlaceholder')"
                  autocomplete="off"
                />
              </template>
              <template v-else>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              </template>
            </td>

            <!-- KIND -->
            <td class="px-3 py-2 align-middle">
              <span class="text-gray-800 dark:text-gray-200">{{ row.kind }}</span>
            </td>

            <!-- DEFAULT UNIT -->
            <td class="px-3 py-2 align-middle">
              <template v-if="row._mode === 'edit'">
                <select
                  v-model="row._draft!.default_unit_id"
                  class="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                >
                  <option v-for="u in units" :key="u.id" :value="u.id">
                    {{ u.code }} – {{ u.name }}
                  </option>
                </select>
              </template>
              <template v-else>
                <span class="text-gray-800 dark:text-gray-200">{{ row.default_unit_code }}</span>
              </template>
            </td>

            <!-- STD COST -->
            <td class="px-3 py-2 align-middle">
              <template v-if="row._mode === 'edit'">
                <input
                  v-model="row._draft!.standard_unit_cost"
                  type="number"
                  min="0"
                  step="0.000001"
                  class="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  :placeholder="$t('ingredients.costPlaceholder')"
                />
              </template>
              <template v-else>
                <span class="text-gray-800 dark:text-gray-200">
                  {{ row.standard_unit_cost != null ? row.standard_unit_cost : '–' }}
                </span>
              </template>
            </td>

            <!-- CURRENCY -->
            <td class="px-3 py-2 align-middle">
              <span class="text-gray-500 dark:text-gray-400">{{ row.standard_cost_currency }}</span>
            </td>

            <!-- ACTIONS -->
            <td class="sticky right-0 z-10 px-3 py-2 align-middle text-right
                       bg-white dark:bg-gray-950
                       border-l border-gray-200 dark:border-gray-800">
              <AdminInlineRowActions
                :mode="row._mode"
                :can-edit="canManage && row.kind !== 'produced'"
                :can-delete="canManage"
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
        {{ $t('ingredients.producedReadOnly') }}
      </p>

      <UModal v-model:open="isDeleteOpen" :title="$t('ingredients.deleteTitle')">
        <template #body>
          <p v-if="deletingRow?.id === '__new__'">{{ $t('ingredients.deleteConfirmNew') }}</p>
          <p v-else>
            {{ $t('ingredients.deleteConfirmExisting', { name: (deletingRow as any)?.name }) }}
          </p>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="soft" @click="isDeleteOpen = false">{{ $t('common.cancel') }}</UButton>
            <UButton color="red" @click="confirmDelete">{{ $t('common.delete') }}</UButton>
          </div>
        </template>
      </UModal>
    </template>
  </AdminTableShell>
</template>
