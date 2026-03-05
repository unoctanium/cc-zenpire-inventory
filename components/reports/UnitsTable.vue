<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t } = useI18n()
const { doPrint } = usePrint()

type UnitType = 'mass' | 'volume' | 'count'
type UnitRow  = { id: string; code: string; name: string; unit_type: UnitType; factor: number }

const { canRead } = useTablePermissions('unit')

const { data, pending, refresh, error } = useFetch<{ ok: boolean; units: UnitRow[] }>(
  '/api/units', { credentials: 'include' }
)

const rows = ref<UnitRow[]>([])
watchEffect(() => { rows.value = data.value?.units ?? [] })

const { filterText, sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<UnitRow>({
  rows,
  filterColumns:  [{ label: t('units.name'), value: 'name' }],
  defaultSortKey: 'code',
  getSearchValue: (row) => row.name,
})

const errorText = computed(() =>
  error.value ? `${t('units.loadError')}: ${error.value.message}` : null
)

const tableContainer = ref<HTMLElement | null>(null)

const { firstWidth, innerWidths, totalInnerWidth } = useTableWidths(
  tableContainer,
  computed(() => ({
    first: { header: t('units.code'),   candidates: rows.value.map(r => r.code) },
    inner: [
      { header: t('units.name'),   candidates: rows.value.map(r => r.name) },
      { header: t('units.type'),   candidates: ['mass', 'volume', 'count'] },
      { header: t('units.factor'), candidates: rows.value.map(r => String(r.factor)) },
    ],
  }))
)
</script>

<template>
  <div>
  <!-- iOS nav bar -->
  <div class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 relative flex items-center justify-end px-2 min-h-[44px]">
    <span class="absolute inset-x-0 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 px-20 truncate pointer-events-none">{{ $t('nav.units') }}</span>
    <div class="relative z-10 flex items-center">
      <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="refresh()">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
      </button>
      <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="doPrint()">
        <UIcon name="i-heroicons-printer" class="w-5 h-5" />
      </button>
    </div>
  </div>

  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('units.noPermission') }}
  </div>

  <div v-else class="p-4">
  <AdminTableShell :error-text="errorText">
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
            <col v-for="(w, i) in innerWidths" :key="i" :style="{ width: w + 'px' }" />
          </colgroup>

          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <th class="sticky left-0 z-30 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('units.code') }}</span>
                  <AdminSortButton :active="sortKey === 'code'" :dir="sortKey === 'code' ? sortDir : null"
                    :aria-label="$t('units.sortByCode')" @click="toggleSort('code')" />
                </div>
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('units.name') }}</span>
                  <AdminSortButton :active="sortKey === 'name'" :dir="sortKey === 'name' ? sortDir : null"
                    :aria-label="$t('units.sortByName')" @click="toggleSort('name')" />
                </div>
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('units.type') }}</span>
                  <AdminSortButton :active="sortKey === 'unit_type'" :dir="sortKey === 'unit_type' ? sortDir : null"
                    :aria-label="$t('units.sortByType')" @click="toggleSort('unit_type')" />
                </div>
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800">{{ $t('units.factor') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="pending"><td colspan="4" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</td></tr>
            <tr v-else-if="visibleRows.length === 0"><td colspan="4" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.noData') }}</td></tr>

            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
                <span class="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">{{ row.code }}</span>
              </td>
              <td class="px-2 py-1.5 align-middle"><span class="text-gray-800 dark:text-gray-200">{{ row.name }}</span></td>
              <td class="px-2 py-1.5 align-middle"><span class="text-gray-800 dark:text-gray-200">{{ row.unit_type }}</span></td>
              <td class="px-2 py-1.5 align-middle"><span class="text-gray-800 dark:text-gray-200">{{ row.factor }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminTableShell>
  </div>
  </div>
</template>
