<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()
const toast  = useToast()

// ─── types ────────────────────────────────────────────────────────────────────

type RecipeRow = {
  id:                 string
  name:               string
  description:        string
  output_quantity:    number
  output_unit_id:     string
  output_unit_code:   string
  standard_unit_cost: number | null
  comp_cost:          number | null
  is_active:          boolean
  is_pre_product:     boolean
  component_count:    number
  created_at:         string
  updated_at:         string
}

type UnitOption = { id: string; code: string; name: string }
type IngredientOption = { id: string; name: string; kind: string; default_unit_id: string }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data: recipeData, pending, refresh, error } = await useFetch<{
  ok: boolean; recipes: RecipeRow[]
}>('/api/recipes', { credentials: 'include' })

const { data: unitData } = await useFetch<{ ok: boolean; units: UnitOption[] }>(
  '/api/units', { credentials: 'include' }
)

const { data: ingredientData } = await useFetch<{ ok: boolean; ingredients: IngredientOption[] }>(
  '/api/ingredients', { credentials: 'include' }
)

const units       = computed(() => unitData.value?.units ?? [])
const ingredients = computed(() => (ingredientData.value?.ingredients ?? []).filter(i => i.kind === 'purchased'))

const rows = ref<RecipeRow[]>([])

watchEffect(() => {
  rows.value = recipeData.value?.recipes ?? []
})

// ─── sort + filter ────────────────────────────────────────────────────────────

const { filterText, filterColumn, filterColumnOptions, clearFilter,
        sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<RecipeRow>({
  rows,
  filterColumns: [
    { label: t('common.all'),          value: 'all'       },
    { label: t('recipes.name'),        value: 'name'      },
    { label: t('recipes.active'),      value: 'is_active' },
  ],
  defaultSortKey: 'name',
  getSearchValue: (row, col) => {
    if (col === 'is_active') return String(row.is_active)
    return String((row as any)[col] ?? '')
  },
})

// ─── error ────────────────────────────────────────────────────────────────────

function showError(title: string, e: any) {
  toast.add({ title, description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
}

const errorText = computed(() =>
  error.value ? `${t('recipes.loadError')}: ${error.value.message}` : null
)

// ─── modal ───────────────────────────────────────────────────────────────────

const isModalOpen   = ref(false)
const editingRecipe = ref<RecipeRow | null>(null)
const isViewMode    = ref(false)

function openNew() {
  if (!canManage.value) return
  editingRecipe.value = null
  isViewMode.value    = false
  isModalOpen.value   = true
}

function openView(row: RecipeRow) {
  editingRecipe.value = row
  isViewMode.value    = true
  isModalOpen.value   = true
}

function openEdit(row: RecipeRow) {
  editingRecipe.value = row
  isViewMode.value    = false
  isModalOpen.value   = true
}

function onSaved() {
  isModalOpen.value = false
  refresh()
}

// ─── delete ───────────────────────────────────────────────────────────────────

const isDeleteOpen = ref(false)
const deletingRow  = ref<RecipeRow | null>(null)

function requestDelete(row: RecipeRow) {
  if (!canManage.value) return
  deletingRow.value  = row
  isDeleteOpen.value = true
}

async function confirmDelete() {
  const row = deletingRow.value
  if (!row) return
  try {
    await $fetch(`/api/recipes/${row.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('recipes.deleted') })
    isDeleteOpen.value = false
    deletingRow.value  = null
    await refresh()
  } catch (e: any) { showError(t('common.deleteFailed'), e) }
}

// ─── column widths ────────────────────────────────────────────────────────────

const tableContainer = ref<HTMLElement | null>(null)

const { firstWidth, innerWidths, lastWidth, totalInnerWidth } = useTableWidths(
  tableContainer,
  computed(() => ({
    first: { header: t('recipes.name'), candidates: rows.value.map(r => r.name) },
    inner: [
      { header: t('recipes.description'), candidates: rows.value.map(r => r.description.slice(0, 60)) },
      { header: t('recipes.output'),      candidates: rows.value.map(r => `${r.output_quantity} ${r.output_unit_code}`) },
      { header: t('recipes.stdCost'),     candidates: rows.value.map(r => r.standard_unit_cost != null ? `€ ${r.standard_unit_cost}` : '—') },
      { header: t('recipes.compCost'),    candidates: rows.value.map(r => r.comp_cost != null ? `€ ${r.comp_cost.toFixed(4)}` : '—') },
      { header: t('recipes.active'),      candidates: ['true', 'false'] },
      { header: t('recipes.preProduct'),  candidates: ['true', 'false'] },
      { header: t('recipes.components'),  candidates: rows.value.map(r => String(r.component_count)) },
    ],
    last: { header: '', candidates: [], minPx: 88 },
  }))
)
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('recipes.noPermission') }}
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
            <col :style="{ width: innerWidths[3] + 'px' }" />
            <col :style="{ width: innerWidths[4] + 'px' }" />
            <col :style="{ width: innerWidths[5] + 'px' }" />
            <col :style="{ width: innerWidths[6] + 'px' }" />
            <col :style="{ width: lastWidth + 'px' }" />
          </colgroup>

          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <!-- Name — sticky left -->
              <th class="sticky left-0 z-30 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('recipes.name') }}</span>
                  <AdminSortButton :active="sortKey === 'name'" :dir="sortKey === 'name' ? sortDir : null"
                    :aria-label="$t('recipes.sortByName')" @click="toggleSort('name')" />
                </div>
              </th>
              <!-- Description -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.description') }}
              </th>
              <!-- Output -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.output') }}
              </th>
              <!-- Std. cost -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.stdCost') }}
              </th>
              <!-- Comp. cost -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.compCost') }}
              </th>
              <!-- Active -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('recipes.active') }}</span>
                  <AdminSortButton :active="sortKey === 'is_active'" :dir="sortKey === 'is_active' ? sortDir : null"
                    :aria-label="$t('recipes.sortByActive')" @click="toggleSort('is_active')" />
                </div>
              </th>
              <!-- Pre-product -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.preProduct') }}
              </th>
              <!-- Components -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.components') }}
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
              <td colspan="9" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</td>
            </tr>
            <tr v-else-if="visibleRows.length === 0">
              <td colspan="9" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.noData') }}</td>
            </tr>

            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
                @click="openView(row)">
              <!-- Name — sticky left -->
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950
                         border-r border-gray-200 dark:border-gray-800">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              </td>
              <!-- Description -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-600 dark:text-gray-400 truncate block max-w-[200px]" :title="row.description">
                  {{ row.description ? row.description.slice(0, 60) + (row.description.length > 60 ? '…' : '') : '–' }}
                </span>
              </td>
              <!-- Output -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.output_quantity }} {{ row.output_unit_code }}</span>
              </td>
              <!-- Std. cost -->
              <td class="px-2 py-1.5 align-middle">
                <span
                  class="text-gray-800 dark:text-gray-200"
                  :class="row.comp_cost != null && row.standard_unit_cost != null && row.comp_cost > row.standard_unit_cost
                    ? 'rounded px-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : ''"
                >
                  {{ row.standard_unit_cost != null ? `€ ${row.standard_unit_cost}` : '—' }}
                </span>
              </td>
              <!-- Comp. cost -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">
                  {{ row.comp_cost != null ? `€ ${row.comp_cost.toFixed(4)}` : '—' }}
                </span>
              </td>
              <!-- Active -->
              <td class="px-2 py-1.5 align-middle">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="row.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
                >
                  {{ row.is_active ? $t('units.yes') : $t('units.no') }}
                </span>
              </td>
              <!-- Pre-product -->
              <td class="px-2 py-1.5 align-middle">
                <span
                  v-if="row.is_pre_product"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                         bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                >
                  {{ $t('units.yes') }}
                </span>
                <span v-else class="text-gray-400 dark:text-gray-600">–</span>
              </td>
              <!-- Components count -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.component_count }}</span>
              </td>
              <!-- Actions — sticky right -->
              <td class="sticky right-0 z-10 px-2 py-1.5 align-middle text-right bg-white dark:bg-gray-950
                         border-l border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    v-if="canManage"
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
      <AdminDeleteModal v-model:open="isDeleteOpen" :title="$t('recipes.deleteTitle')" @confirm="confirmDelete">
        <p>{{ $t('recipes.deleteConfirmExisting', { name: deletingRow?.name ?? '' }) }}</p>
      </AdminDeleteModal>

      <AdminRecipeEditModal
        v-model:open="isModalOpen"
        :recipe="editingRecipe"
        :units="units"
        :ingredients="ingredients"
        :all-recipes="rows"
        :view-mode="isViewMode"
        @saved="onSaved"
        @list-updated="refresh()"
      />
    </template>
  </AdminTableShell>
</template>
