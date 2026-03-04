<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t } = useI18n()

// ─── types ────────────────────────────────────────────────────────────────────

type RecipeRow = {
  id: string; name: string; description: string
  output_quantity: number; output_unit_id: string; output_unit_code: string
  standard_unit_cost: number | null; comp_cost: number | null
  is_active: boolean; is_pre_product: boolean
  component_count: number; created_at: string; updated_at: string
}

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data: recipeData, pending, refresh, error } = await useFetch<{
  ok: boolean; recipes: RecipeRow[]
}>('/api/recipes', { credentials: 'include' })

const rows = ref<RecipeRow[]>([])

watchEffect(() => {
  rows.value = recipeData.value?.recipes ?? []
})

// ─── filter + sort (name only) ────────────────────────────────────────────────

const { filterText, sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<RecipeRow>({
  rows,
  filterColumns:  [{ label: t('recipes.name'), value: 'name' }],
  defaultSortKey: 'name',
  getSearchValue: (row) => row.name,
})

// ─── error ────────────────────────────────────────────────────────────────────

const errorText = computed(() =>
  error.value ? `${t('recipes.loadError')}: ${error.value.message}` : null
)

// ─── column widths ────────────────────────────────────────────────────────────

const tableContainer = ref<HTMLElement | null>(null)

const { firstWidth, innerWidths, totalInnerWidth } = useTableWidths(
  tableContainer,
  computed(() => ({
    first: { header: t('recipes.name'), candidates: rows.value.map(r => r.name) },
    inner: [
      { header: t('recipes.description'), candidates: rows.value.map(r => r.description.slice(0, 60)) },
      { header: t('recipes.output'),      candidates: rows.value.map(r => `${r.output_quantity} ${r.output_unit_code}`) },
      { header: t('recipes.batchCost'),   candidates: rows.value.map(r => r.standard_unit_cost != null ? `€ ${(r.standard_unit_cost * r.output_quantity).toFixed(2)}` : '—') },
      { header: t('recipes.compCost'),    candidates: rows.value.map(r => r.comp_cost != null ? `€ ${r.comp_cost.toFixed(2)}` : '—') },
      { header: t('recipes.unitCost'),    candidates: rows.value.map(r => r.standard_unit_cost != null ? `€ ${r.standard_unit_cost.toFixed(2)}` : '—') },
      { header: t('recipes.active'),      candidates: ['true', 'false'] },
      { header: t('recipes.preProduct'),  candidates: ['true', 'false'] },
      { header: t('recipes.components'),  candidates: rows.value.map(r => String(r.component_count)) },
    ],
  }))
)
</script>

<template>
  <div class="sm:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <button class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" @click="navigateTo('/reports')">
      <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
      {{ $t('nav.apps.reports') }}
    </button>
  </div>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('recipes.noPermission') }}
  </div>

  <AdminTableShell v-else :error-text="errorText">
    <template #toolbar>
      <div class="flex items-center gap-2">
        <div class="flex items-stretch">
          <input
            v-model="filterText"
            class="w-[180px] rounded-l-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-2 focus:ring-gray-300
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
            :placeholder="$t('common.search')"
            autocomplete="off" inputmode="search"
          />
          <button
            type="button" :disabled="!filterText"
            class="flex items-center justify-center px-2
                   border-t border-b border-r border-gray-300 rounded-r-md
                   bg-gray-100 text-gray-600 hover:bg-gray-200
                   disabled:opacity-40 disabled:cursor-not-allowed
                   dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="filterText = ''"
          >✕</button>
        </div>
        <div class="flex-1" />
        <UButton icon="i-heroicons-printer" color="neutral" variant="soft" @click="print()">{{ $t('common.print') }}</UButton>
        <UButton icon="i-heroicons-arrow-path" color="neutral" variant="soft" @click="refresh()">{{ $t('common.refresh') }}</UButton>
      </div>
    </template>

    <template #table>
      <div ref="tableContainer">
        <table
          class="table-fixed border-separate border-spacing-0 text-sm"
          :style="{ width: (firstWidth + totalInnerWidth) + 'px', minWidth: '100%' }"
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
            <col :style="{ width: innerWidths[7] + 'px' }" />
          </colgroup>

          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <th class="sticky left-0 z-30 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('recipes.name') }}</span>
                  <AdminSortButton :active="sortKey === 'name'" :dir="sortKey === 'name' ? sortDir : null"
                    :aria-label="$t('recipes.sortByName')" @click="toggleSort('name')" />
                </div>
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.description') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.output') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.batchCost') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.compCost') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.unitCost') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('recipes.active') }}</span>
                  <AdminSortButton :active="sortKey === 'is_active'" :dir="sortKey === 'is_active' ? sortDir : null"
                    :aria-label="$t('recipes.sortByActive')" @click="toggleSort('is_active')" />
                </div>
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.preProduct') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('recipes.components') }}
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
                class="border-b border-gray-100 dark:border-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950
                         border-r border-gray-200 dark:border-gray-800">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              </td>
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-600 dark:text-gray-400 truncate block max-w-[200px]" :title="row.description">
                  {{ row.description ? row.description.slice(0, 60) + (row.description.length > 60 ? '…' : '') : '–' }}
                </span>
              </td>
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.output_quantity }} {{ row.output_unit_code }}</span>
              </td>
              <td class="px-2 py-1.5 align-middle">
                <span
                  class="text-gray-800 dark:text-gray-200"
                  :class="row.comp_cost != null && row.standard_unit_cost != null
                    && row.comp_cost > row.standard_unit_cost * row.output_quantity
                    ? 'rounded px-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''"
                >
                  {{ row.standard_unit_cost != null ? `€ ${(row.standard_unit_cost * row.output_quantity).toFixed(2)}` : '—' }}
                </span>
              </td>
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">
                  {{ row.comp_cost != null ? `€ ${row.comp_cost.toFixed(2)}` : '—' }}
                </span>
              </td>
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">
                  {{ row.standard_unit_cost != null ? `€ ${row.standard_unit_cost.toFixed(2)}` : '—' }}
                </span>
              </td>
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
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.component_count }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminTableShell>
</template>
