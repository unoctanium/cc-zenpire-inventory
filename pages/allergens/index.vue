<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()
const toast  = useToast()

// ─── types ────────────────────────────────────────────────────────────────────

type AllergenRow = { id: string; name: string; comment: string | null; created_at: string; updated_at: string }

type Draft = { name: string; comment: string }

type UiRow =
  | (AllergenRow & { _mode: 'view' | 'edit'; _draft?: Draft })
  | { id: '__new__'; name: ''; comment: null; created_at: ''; updated_at: ''; _mode: 'edit'; _draft: Draft }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data, pending, refresh, error } = await useFetch<{ ok: boolean; allergens: AllergenRow[] }>(
  '/api/allergens', { credentials: 'include' }
)

const rows = ref<UiRow[]>([])

watchEffect(() => {
  const api    = data.value?.allergens ?? []
  const hasNew = rows.value.some(r => r.id === '__new__')
  const mapped = api.map(a => ({ ...a, _mode: 'view' as const }))
  rows.value   = hasNew
    ? [rows.value.find(r => r.id === '__new__') as UiRow, ...mapped]
    : mapped
})

// ─── sort + filter ────────────────────────────────────────────────────────────

const { filterText, filterColumn, filterColumnOptions, clearFilter,
        sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<UiRow>({
  rows,
  filterColumns: [
    { label: t('common.all'),         value: 'all'     },
    { label: t('allergens.name'),     value: 'name'    },
    { label: t('allergens.comment'),  value: 'comment' },
  ],
  defaultSortKey: 'name',
  getSearchValue: (row, col) => {
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
  rows.value.unshift({
    id: '__new__', name: '', comment: null, created_at: '', updated_at: '',
    _mode: 'edit', _draft: { name: '', comment: '' },
  })
}

function startEdit(row: UiRow) {
  if (!canManage.value || row.id === '__new__') return
  row._mode  = 'edit'
  row._draft = { name: row.name, comment: row.comment ?? '' }
}

function discard(row: UiRow) {
  if (row.id === '__new__') { rows.value = rows.value.filter(r => r.id !== '__new__'); return }
  row._mode  = 'view'
  row._draft = undefined
}

async function commit(row: UiRow) {
  const d = row._draft
  if (!d || !canManage.value) return
  if (!d.name.trim()) {
    toast.add({ title: t('common.missingFields'), description: t('allergens.nameRequired'), color: 'red' })
    return
  }
  try {
    const body = { name: d.name.trim(), comment: d.comment.trim() || null }
    if (row.id === '__new__') {
      await $fetch('/api/allergens', { method: 'POST', credentials: 'include', body })
      toast.add({ title: t('allergens.created') })
      rows.value = rows.value.filter(r => r.id !== '__new__')
    } else {
      await $fetch(`/api/allergens/${row.id}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('allergens.updated') })
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
    await $fetch(`/api/allergens/${row.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('allergens.deleted') })
    isDeleteOpen.value = false; deletingRow.value = null
    await refresh()
  } catch (e: any) { showError(t('common.deleteFailed'), e) }
}

// ─── column widths ────────────────────────────────────────────────────────────

const tableContainer = ref<HTMLElement | null>(null)

const { firstWidth, innerWidths, lastWidth, totalInnerWidth } = useTableWidths(
  tableContainer,
  computed(() => ({
    first: { header: t('allergens.name'),    candidates: rows.value.map(r => r.name) },
    inner: [
      { header: t('allergens.comment'), candidates: rows.value.map(r => r.comment?.slice(0, 80) ?? '') },
    ],
    last:  { header: '', candidates: [], minPx: 108 },
  }))
)

const errorText = computed(() =>
  error.value ? `${t('allergens.loadError')}: ${error.value.message}` : null
)
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('allergens.noPermission') }}
  </div>

  <AdminTableShell v-else :error-text="errorText">
    <template #title>{{ $t('allergens.title') }}</template>
    <template #subtitle>{{ $t('allergens.subtitle') }}</template>

    <template #toolbar>
      <AdminTableToolbar
        v-model:filter-text="filterText"
        v-model:filter-column="filterColumn"
        :filter-column-options="filterColumnOptions"
        :can-add="canManage"
        :add-label="$t('allergens.add')"
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
            <col :style="{ width: lastWidth + 'px' }" />
          </colgroup>

          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <!-- Name — sticky left -->
              <th class="sticky left-0 z-30 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('allergens.name') }}</span>
                  <AdminSortButton :active="sortKey === 'name'" :dir="sortKey === 'name' ? sortDir : null"
                    :aria-label="$t('allergens.sortByName')" @click="toggleSort('name')" />
                </div>
              </th>
              <!-- Comment -->
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('allergens.comment') }}
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
              <td colspan="3" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</td>
            </tr>
            <tr v-else-if="visibleRows.length === 0">
              <td colspan="3" class="px-2 py-2 text-gray-500 dark:text-gray-400">{{ $t('common.noData') }}</td>
            </tr>

            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60">
              <!-- Name — sticky left -->
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950
                         border-r border-gray-200 dark:border-gray-800">
                <input v-if="row._mode === 'edit'" v-model="row._draft!.name"
                  class="w-full rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  :placeholder="$t('allergens.namePlaceholder')" autocomplete="off" />
                <span v-else class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
              </td>
              <!-- Comment -->
              <td class="px-2 py-1.5 align-middle">
                <input v-if="row._mode === 'edit'" v-model="row._draft!.comment"
                  class="w-full rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-300
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
                  :placeholder="$t('allergens.commentPlaceholder')" autocomplete="off" />
                <span v-else class="text-gray-600 dark:text-gray-400 truncate block" :title="row.comment ?? ''">
                  {{ row.comment || '–' }}
                </span>
              </td>
              <!-- Actions — sticky right -->
              <td class="sticky right-0 z-10 px-2 py-1.5 align-middle text-right bg-white dark:bg-gray-950
                         border-l border-gray-200 dark:border-gray-800">
                <AdminInlineRowActions :mode="row._mode" :can-edit="canManage" :can-delete="canManage"
                  @edit="startEdit(row)" @save="commit(row)" @discard="discard(row)" @delete="requestDelete(row)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template #footer>
      <AdminDeleteModal v-model:open="isDeleteOpen" :title="$t('allergens.deleteTitle')" @confirm="confirmDelete">
        <p v-if="deletingRow?.id === '__new__'">{{ $t('allergens.deleteConfirmNew') }}</p>
        <p v-else>{{ $t('allergens.deleteConfirmExisting', { name: (deletingRow as any)?.name }) }}</p>
      </AdminDeleteModal>
    </template>
  </AdminTableShell>
</template>
