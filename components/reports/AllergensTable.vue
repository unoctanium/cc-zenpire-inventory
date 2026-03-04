<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t } = useI18n()

type AllergenRow = { id: string; name: string; comment: string | null; created_at: string; updated_at: string }

const { canRead } = useTablePermissions('recipe')

const { data, pending, refresh, error } = useFetch<{ ok: boolean; allergens: AllergenRow[] }>(
  '/api/allergens', { credentials: 'include' }
)

const rows = ref<AllergenRow[]>([])
watchEffect(() => { rows.value = data.value?.allergens ?? [] })

const { filterText, sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<AllergenRow>({
  rows,
  filterColumns:  [{ label: t('allergens.name'), value: 'name' }],
  defaultSortKey: 'name',
  getSearchValue: (row) => row.name,
})

const errorText = computed(() =>
  error.value ? `${t('allergens.loadError')}: ${error.value.message}` : null
)

const tableContainer = ref<HTMLElement | null>(null)

const { firstWidth, innerWidths, totalInnerWidth } = useTableWidths(
  tableContainer,
  computed(() => ({
    first: { header: t('allergens.name'),    candidates: rows.value.map(r => r.name) },
    inner: [
      { header: t('allergens.comment'), candidates: rows.value.map(r => r.comment?.slice(0, 80) ?? '') },
    ],
  }))
)
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('allergens.noPermission') }}
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
          </colgroup>

          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <th class="sticky left-0 z-30 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('allergens.name') }}</span>
                  <AdminSortButton :active="sortKey === 'name'" :dir="sortKey === 'name' ? sortDir : null"
                    :aria-label="$t('allergens.sortByName')" @click="toggleSort('name')" />
                </div>
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800">{{ $t('allergens.comment') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="pending"><td colspan="2" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</td></tr>
            <tr v-else-if="visibleRows.length === 0"><td colspan="2" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.noData') }}</td></tr>

            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              </td>
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-600 dark:text-gray-400 truncate block" :title="row.comment ?? ''">
                  {{ row.comment || '–' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminTableShell>
</template>
