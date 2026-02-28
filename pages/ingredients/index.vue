<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()
const toast  = useToast()

// ─── types ────────────────────────────────────────────────────────────────────

type IngredientRow = {
  id:                     string
  name:                   string
  kind:                   string
  default_unit_id:        string
  default_unit_code:      string
  standard_unit_cost:     number | null
  standard_cost_currency: string
  produced_by_recipe_id:  string | null
  comment:                string | null
}

type UnitOption    = { id: string; code: string; name: string }
type AllergenOption = { id: string; name: string; comment: string | null }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data: ingredientData, pending, refresh, error } = await useFetch<{
  ok: boolean; ingredients: IngredientRow[]
}>('/api/ingredients', { credentials: 'include' })

const { data: unitData } = await useFetch<{ ok: boolean; units: UnitOption[] }>(
  '/api/units', { credentials: 'include' }
)

const { data: allergenData } = await useFetch<{ ok: boolean; allergens: AllergenOption[] }>(
  '/api/allergens', { credentials: 'include' }
)

const units    = computed(() => unitData.value?.units ?? [])
const allergens = computed(() => allergenData.value?.allergens ?? [])
const rows     = ref<IngredientRow[]>([])

watchEffect(() => {
  rows.value = ingredientData.value?.ingredients ?? []
})

// ─── sort + filter ────────────────────────────────────────────────────────────

const { filterText, filterColumn, filterColumnOptions, clearFilter,
        sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<IngredientRow>({
  rows,
  filterColumns: [
    { label: t('common.all'),       value: 'all'               },
    { label: t('ingredients.name'), value: 'name'              },
    { label: t('ingredients.kind'), value: 'kind'              },
    { label: t('ingredients.unit'), value: 'default_unit_code' },
  ],
  defaultSortKey: 'name',
  getSearchValue: (row, col) => String((row as any)[col] ?? ''),
})

// ─── error ────────────────────────────────────────────────────────────────────

function showError(title: string, e: any) {
  toast.add({ title, description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
}

const errorText = computed(() =>
  error.value ? `${t('ingredients.loadError')}: ${error.value.message}` : null
)

// ─── modal ────────────────────────────────────────────────────────────────────

const isModalOpen       = ref(false)
const editingIngredient = ref<IngredientRow | null>(null)
const isViewMode        = ref(false)

function openNew() {
  if (!canManage.value) return
  editingIngredient.value = null
  isViewMode.value        = false
  isModalOpen.value       = true
}

function openView(row: IngredientRow) {
  editingIngredient.value = row
  isViewMode.value        = true
  isModalOpen.value       = true
}

function openEdit(row: IngredientRow) {
  editingIngredient.value = row
  isViewMode.value        = false
  isModalOpen.value       = true
}

function onSaved() {
  isModalOpen.value = false
  refresh()
}

// ─── delete ───────────────────────────────────────────────────────────────────

const isDeleteOpen = ref(false)
const deletingRow  = ref<IngredientRow | null>(null)

function requestDelete(row: IngredientRow) {
  if (!canManage.value) return
  deletingRow.value  = row
  isDeleteOpen.value = true
}

async function confirmDelete() {
  const row = deletingRow.value
  if (!row) return
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
      { header: t('ingredients.kind'),        candidates: ['purchased', 'produced'] },
      { header: t('ingredients.unit'),         candidates: [...units.value.map(u => u.code), ...units.value.map(u => `${u.code} – ${u.name}`)] },
      { header: t('ingredients.standardCost'), candidates: [...rows.value.map(r => r.standard_unit_cost != null ? String(r.standard_unit_cost) : ''), '0.000001'] },
    ],
    last: { header: '', candidates: [], minPx: 88 },
  }))
)
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('ingredients.noPermission') }}
  </div>

  <AdminTableShell v-else :error-text="errorText">
    <template #toolbar>
      <AdminTableToolbar
        v-model:filter-text="filterText"
        v-model:filter-column="filterColumn"
        :filter-column-options="filterColumnOptions"
        :can-add="canManage"
        @refresh="refresh()"
        @add="openNew"
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
              <td colspan="5" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</td>
            </tr>
            <tr v-else-if="visibleRows.length === 0">
              <td colspan="5" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.noData') }}</td>
            </tr>

            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
                :class="row.kind === 'produced' ? 'opacity-70' : ''"
                @click="openView(row)">
              <!-- Name — sticky left -->
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950
                         border-r border-gray-200 dark:border-gray-800">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              </td>
              <!-- Kind -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.kind }}</span>
              </td>
              <!-- Unit -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.default_unit_code }}</span>
              </td>
              <!-- Cost -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">
                  {{ row.standard_unit_cost != null ? `€ ${row.standard_unit_cost}` : '–' }}
                </span>
              </td>
              <!-- Actions — sticky right -->
              <td class="sticky right-0 z-10 px-2 py-1.5 align-middle text-right bg-white dark:bg-gray-950
                         border-l border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    v-if="canManage && row.kind !== 'produced'"
                    size="xs" color="neutral" variant="ghost"
                    :aria-label="$t('common.edit')"
                    icon="i-heroicons-pencil-square"
                    @click.stop="openEdit(row)"
                  />
                  <UButton
                    v-if="canManage"
                    size="xs" color="error" variant="ghost"
                    :aria-label="$t('common.delete')"
                    icon="i-heroicons-trash"
                    @click.stop="requestDelete(row)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template #footer>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('ingredients.producedReadOnly') }}</p>

      <AdminDeleteModal v-model:open="isDeleteOpen" :title="$t('ingredients.deleteTitle')" @confirm="confirmDelete">
        <p>{{ $t('ingredients.deleteConfirmExisting', { name: deletingRow?.name ?? '' }) }}</p>
      </AdminDeleteModal>

      <AdminIngredientEditModal
        v-model:open="isModalOpen"
        :ingredient="editingIngredient"
        :units="units"
        :allergens="allergens"
        :view-mode="isViewMode"
        :can-manage="canManage"
        @saved="onSaved"
      />
    </template>
  </AdminTableShell>
</template>
