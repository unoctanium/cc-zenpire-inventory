<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()
const toast  = useToast()

// ─── types ────────────────────────────────────────────────────────────────────

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

type Draft = {
  name: string
  kind: IngredientKind
  default_unit_id: string
  standard_unit_cost: string
}

type UiRow =
  | (IngredientRow & { _mode: 'view' | 'edit'; _draft?: Draft })
  | {
      id: '__new__'; name: ''; kind: 'purchased'
      default_unit_id: ''; default_unit_code: ''
      standard_unit_cost: null; standard_cost_currency: 'EUR'
      produced_by_recipe_id: null; _mode: 'edit'; _draft: Draft
    }

type UnitOption = { id: string; code: string; name: string }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('ingredient')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data: ingredientData, pending, refresh, error } = await useFetch<{
  ok: boolean; ingredients: IngredientRow[]
}>('/api/ingredients', { credentials: 'include' })

const { data: unitData } = await useFetch<{ ok: boolean; units: UnitOption[] }>(
  '/api/units', { credentials: 'include' }
)

const units = computed(() => unitData.value?.units ?? [])

const rows = ref<UiRow[]>([])

watchEffect(() => {
  const api    = ingredientData.value?.ingredients ?? []
  const hasNew = rows.value.some(r => r.id === '__new__')
  const mapped = api.map(i => ({ ...i, _mode: 'view' as const }))
  rows.value   = hasNew
    ? [rows.value.find(r => r.id === '__new__') as UiRow, ...mapped]
    : mapped
})

function unitCodeById(id: string) {
  return units.value.find(u => u.id === id)?.code ?? id
}

// ─── sort + filter ────────────────────────────────────────────────────────────

const { filterText, filterColumn, filterColumnOptions, clearFilter,
        sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<UiRow>({
  rows,
  filterColumns: [
    { label: t('common.all'),       value: 'all'               },
    { label: t('ingredients.name'), value: 'name'              },
    { label: t('ingredients.kind'), value: 'kind'              },
    { label: t('ingredients.unit'), value: 'default_unit_code' },
  ],
  defaultSortKey: 'name',
  getSearchValue: (row, col) => {
    if (col === 'default_unit_code') {
      return row._mode === 'edit' && row._draft
        ? unitCodeById(row._draft.default_unit_id)
        : row.default_unit_code
    }
    const src: any = row._mode === 'edit' && row._draft ? row._draft : row
    return String(src[col] ?? '')
  },
})

// ─── inline edit ──────────────────────────────────────────────────────────────

function showError(title: string, e: any) {
  toast.add({ title, description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
}

function startAdd() {
  if (!canManage.value || rows.value.some(r => r.id === '__new__')) return
  const firstUnitId = units.value[0]?.id ?? ''
  rows.value.unshift({
    id: '__new__', name: '', kind: 'purchased',
    default_unit_id: '', default_unit_code: '',
    standard_unit_cost: null, standard_cost_currency: 'EUR',
    produced_by_recipe_id: null, _mode: 'edit',
    _draft: { name: '', kind: 'purchased', default_unit_id: firstUnitId, standard_unit_cost: '' },
  })
}

function startEdit(row: UiRow) {
  if (!canManage.value || row.id === '__new__' || row.kind === 'produced') return
  row._mode  = 'edit'
  row._draft = {
    name:               row.name,
    kind:               row.kind,
    default_unit_id:    row.default_unit_id,
    standard_unit_cost: row.standard_unit_cost != null ? String(row.standard_unit_cost) : '',
  }
}

function discard(row: UiRow) {
  if (row.id === '__new__') { rows.value = rows.value.filter(r => r.id !== '__new__'); return }
  row._mode  = 'view'
  row._draft = undefined
}

async function commit(row: UiRow) {
  const d = row._draft
  if (!d || !canManage.value) return
  if (!d.name.trim() || !d.default_unit_id) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.nameAndUnitRequired'), color: 'red' })
    return
  }
  const costValue = d.standard_unit_cost.trim() === '' ? null : Number(d.standard_unit_cost)
  if (d.standard_unit_cost.trim() !== '' && isNaN(costValue as number)) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.invalidCost'), color: 'red' })
    return
  }
  try {
    const body = { name: d.name.trim(), default_unit_id: d.default_unit_id, standard_unit_cost: costValue }
    if (row.id === '__new__') {
      await $fetch('/api/ingredients', { method: 'POST', credentials: 'include', body })
      toast.add({ title: t('ingredients.created') })
      rows.value = rows.value.filter(r => r.id !== '__new__')
    } else {
      await $fetch(`/api/ingredients/${row.id}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('ingredients.updated') })
      row._mode  = 'view'
      row._draft = undefined
    }
    await refresh()
  } catch (e: any) { showError(t('common.saveFailed'), e) }
}

// ─── delete ───────────────────────────────────────────────────────────────────

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
    rows.value = rows.value.filter(r => r.id !== '__new__')
    isDeleteOpen.value = false; deletingRow.value = null; return
  }
  try {
    await $fetch(`/api/ingredients/${row.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('ingredients.deleted') })
    isDeleteOpen.value = false; deletingRow.value = null
    await refresh()
  } catch (e: any) { showError(t('common.deleteFailed'), e) }
}

// ─── column widths ────────────────────────────────────────────────────────────

const tableContainer = ref<HTMLElement | null>(null)

const { firstWidth, innerWidths, lastWidth, totalInnerWidth } = useTableWidths(
  tableContainer,
  computed(() => ({
    first: { header: t('ingredients.name'), candidates: rows.value.map(r => r.name) },
    inner: [
      { header: t('ingredients.kind'),         candidates: ['purchased', 'produced'] },
      { header: t('ingredients.unit'),          candidates: [...units.value.map(u => u.code), ...units.value.map(u => `${u.code} – ${u.name}`)] },
      { header: t('ingredients.standardCost'),  candidates: [...rows.value.map(r => r.standard_unit_cost != null ? String(r.standard_unit_cost) : ''), '0.000001'] },
      { header: t('ingredients.currency'),      candidates: rows.value.map(r => r.standard_cost_currency) },
    ],
    last: { header: '', candidates: [], minPx: 108 },
  }))
)

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
      <AdminTableToolbar
        v-model:filter-text="filterText"
        v-model:filter-column="filterColumn"
        :filter-column-options="filterColumnOptions"
        :can-add="canManage"
        :add-label="$t('ingredients.add')"
        @refresh="refresh()"
        @add="startAdd"
      />
    </template>

    <template #table>
      <div ref="tableContainer">
        <table
          class="table-fixed border-separate border-spacing-0 text-sm"
          :style="{ width: (firstWidth + totalInnerWidth + lastWidth) + 'px', minWidth: '100%' }"
        >
          <colgroup>
            <col :style="{ width: firstWidth + 'px' }" />
            <col :style="{ width: innerWidths[0] + 'px' }" />
            <col :style="{ width: innerWidths[1] + 'px' }" />
            <col :style="{ width: innerWidths[2] + 'px' }" />
            <col :style="{ width: innerWidths[3] + 'px' }" />
            <col :style="{ width: lastWidth + 'px' }" />
          </colgroup>

          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <!-- Name — sticky left -->
              <th class="sticky left-0 z-30 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('ingredients.name') }}</span>
                  <AdminSortButton :active="sortKey === 'name'" :dir="sortKey === 'name' ? sortDir : null"
                    :aria-label="$t('ingredients.sortByName')" @click="toggleSort('name')" />
                </div>
              </th>
              <!-- Kind -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('ingredients.kind') }}</span>
                  <AdminSortButton :active="sortKey === 'kind'" :dir="sortKey === 'kind' ? sortDir : null"
                    :aria-label="$t('ingredients.sortByKind')" @click="toggleSort('kind')" />
                </div>
              </th>
              <!-- Unit -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('ingredients.unit') }}</span>
                  <AdminSortButton :active="sortKey === 'default_unit_code'" :dir="sortKey === 'default_unit_code' ? sortDir : null"
                    :aria-label="$t('ingredients.sortByUnit')" @click="toggleSort('default_unit_code')" />
                </div>
              </th>
              <!-- Cost -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('ingredients.standardCost') }}
              </th>
              <!-- Currency -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('ingredients.currency') }}
              </th>
              <!-- Actions — sticky right -->
              <th class="sticky right-0 z-30 px-2 py-1.5 text-right font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-l border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                {{ $t('common.actions') }}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="pending">
              <td colspan="6" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</td>
            </tr>
            <tr v-else-if="visibleRows.length === 0">
              <td colspan="6" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.noData') }}</td>
            </tr>

            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60"
                :class="row.kind === 'produced' ? 'opacity-70' : ''">
              <!-- Name — sticky left -->
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950
                         border-r border-gray-200 dark:border-gray-800">
                <input v-if="row._mode === 'edit'" v-model="row._draft!.name"
                  class="w-full rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  :placeholder="$t('ingredients.namePlaceholder')" autocomplete="off" />
                <span v-else class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              </td>
              <!-- Kind — always read-only -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.kind }}</span>
              </td>
              <!-- Unit -->
              <td class="px-2 py-1.5 align-middle">
                <select v-if="row._mode === 'edit'" v-model="row._draft!.default_unit_id"
                  class="w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700">
                  <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
                </select>
                <span v-else class="text-gray-800 dark:text-gray-200">{{ row.default_unit_code }}</span>
              </td>
              <!-- Cost -->
              <td class="px-2 py-1.5 align-middle">
                <input v-if="row._mode === 'edit'" v-model="row._draft!.standard_unit_cost"
                  type="number" min="0" step="0.000001"
                  class="w-full rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  :placeholder="$t('ingredients.costPlaceholder')" />
                <span v-else class="text-gray-800 dark:text-gray-200">
                  {{ row.standard_unit_cost != null ? row.standard_unit_cost : '–' }}
                </span>
              </td>
              <!-- Currency — always read-only -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-500 dark:text-gray-400">{{ row.standard_cost_currency }}</span>
              </td>
              <!-- Actions — sticky right -->
              <td class="sticky right-0 z-10 px-2 py-1.5 align-middle text-right bg-white dark:bg-gray-950
                         border-l border-gray-200 dark:border-gray-800">
                <AdminInlineRowActions :mode="row._mode" :can-edit="canManage && row.kind !== 'produced'"
                  :can-delete="canManage" @edit="startEdit(row)" @save="commit(row)"
                  @discard="discard(row)" @delete="requestDelete(row)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template #footer>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('ingredients.producedReadOnly') }}</p>

      <AdminDeleteModal v-model:open="isDeleteOpen" :title="$t('ingredients.deleteTitle')" @confirm="confirmDelete">
        <p v-if="deletingRow?.id === '__new__'">{{ $t('ingredients.deleteConfirmNew') }}</p>
        <p v-else>{{ $t('ingredients.deleteConfirmExisting', { name: (deletingRow as any)?.name }) }}</p>
      </AdminDeleteModal>
    </template>
  </AdminTableShell>
</template>
