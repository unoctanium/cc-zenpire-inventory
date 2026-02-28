<script setup lang="ts">
import { useTableWidths }      from '~/composables/useTableWidths'
import { useInlineTable }      from '~/composables/useInlineTable'
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()
const toast  = useToast()

// ─── types ────────────────────────────────────────────────────────────────────

type Role    = { id: string; code: string; name: string }
type AppUser = { id: string; email: string; display_name: string | null; is_active: boolean; created_at: string; roles: Role[] }
type Draft   = { is_active: boolean; role_ids: string[] }
type UiRow   = AppUser & { _mode: 'view' | 'edit'; _draft?: Draft }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('admin')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data, pending, refresh, error } = await useFetch<{ ok: boolean; users: AppUser[]; roles: Role[] }>(
  '/api/rbac/users', { credentials: 'include' }
)

const rows = ref<UiRow[]>([])

const allRoles = computed(() => data.value?.roles ?? [])

watchEffect(() => {
  rows.value = (data.value?.users ?? []).map(u => ({ ...u, _mode: 'view' as const }))
})

// ─── sort + filter ────────────────────────────────────────────────────────────

const { filterText, filterColumn, filterColumnOptions, clearFilter,
        sortKey, sortDir, toggleSort, visibleRows } = useInlineTable<UiRow>({
  rows,
  filterColumns: [
    { label: t('common.all'),   value: 'all'   },
    { label: t('rbac.email'),   value: 'email' },
  ],
  defaultSortKey: 'email',
  getSearchValue: (row, col) => col === 'email' ? row.email : row.email,
})

// ─── edit ─────────────────────────────────────────────────────────────────────

function showError(title: string, e: any) {
  toast.add({ title, description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'error' })
}

function startEdit(row: UiRow) {
  if (!canManage.value) return
  row._mode  = 'edit'
  row._draft = { is_active: row.is_active, role_ids: row.roles.map(r => r.id) }
}

function discard(row: UiRow) {
  row._mode  = 'view'
  row._draft = undefined
}

async function commit(row: UiRow) {
  const draft = row._draft
  if (!draft || !canManage.value) return
  try {
    const added   = draft.role_ids.filter(id => !row.roles.find(r => r.id === id))
    const removed = row.roles.filter(r => !draft.role_ids.includes(r.id))

    await Promise.all([
      ...added.map(role_id => $fetch(`/api/rbac/users/${row.id}/roles`, { method: 'POST', credentials: 'include', body: { role_id } })),
      ...removed.map(r => $fetch(`/api/rbac/users/${row.id}/roles/${r.id}`, { method: 'DELETE', credentials: 'include' })),
      ...(draft.is_active !== row.is_active
        ? [$fetch(`/api/rbac/users/${row.id}`, { method: 'PATCH', credentials: 'include', body: { is_active: draft.is_active } })]
        : []),
    ])

    toast.add({ title: t('rbac.updated') })
    row._mode  = 'view'
    row._draft = undefined
    await refresh()
  } catch (e: any) { showError(t('rbac.updateFailed'), e) }
}

// ─── column widths ────────────────────────────────────────────────────────────

const tableContainer = ref<HTMLElement | null>(null)

const { firstWidth, innerWidths, lastWidth, totalInnerWidth } = useTableWidths(
  tableContainer,
  computed(() => ({
    first: { header: t('rbac.email'),       candidates: rows.value.map(r => r.email) },
    inner: [
      { header: t('rbac.displayName'),      candidates: rows.value.map(r => r.display_name ?? '') },
      { header: t('rbac.roles'),            candidates: allRoles.value.map(r => r.name) },
      { header: t('rbac.active'),           candidates: [t('rbac.active'), t('rbac.inactive')] },
    ],
    last:  { header: '', candidates: [], minPx: 80 },
  }))
)

const errorText = computed(() =>
  error.value ? `${t('rbac.loadError')}: ${error.value.message}` : null
)
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('rbac.noPermission') }}
  </div>

  <AdminTableShell v-else :error-text="errorText">
    <template #toolbar>
      <AdminTableToolbar
        v-model:filter-text="filterText"
        v-model:filter-column="filterColumn"
        :filter-column-options="filterColumnOptions"
        :can-add="false"
        @refresh="refresh()"
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
              <th class="sticky left-0 z-30 px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800 border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ $t('rbac.email') }}</span>
                  <AdminSortButton :active="sortKey === 'email'" :dir="sortKey === 'email' ? sortDir : null"
                    :aria-label="$t('rbac.sortByEmail')" @click="toggleSort('email')" />
                </div>
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('rbac.displayName') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('rbac.roles') }}
              </th>
              <th class="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800">
                {{ $t('rbac.active') }}
              </th>
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
                class="border-b border-gray-100 dark:border-gray-900/60">

              <!-- Email — sticky left, read-only -->
              <td class="sticky left-0 z-10 px-2 py-1.5 align-middle bg-white dark:bg-gray-950
                         border-r border-gray-200 dark:border-gray-800">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.email }}</span>
              </td>

              <!-- Display name — read-only -->
              <td class="px-2 py-1.5 align-middle">
                <span class="text-gray-800 dark:text-gray-200">{{ row.display_name ?? '–' }}</span>
              </td>

              <!-- Roles -->
              <td class="px-2 py-1.5 align-middle">
                <div v-if="row._mode === 'edit'" class="flex flex-wrap gap-1.5">
                  <label v-for="role in allRoles" :key="role.id" class="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" :value="role.id" v-model="row._draft!.role_ids" class="rounded" />
                    {{ role.name }}
                  </label>
                </div>
                <div v-else class="flex flex-wrap gap-1">
                  <UBadge v-for="role in row.roles" :key="role.id" color="neutral" variant="subtle" size="sm">
                    {{ role.name }}
                  </UBadge>
                  <span v-if="row.roles.length === 0" class="text-gray-400 dark:text-gray-500 text-xs">{{ $t('rbac.noRoles') }}</span>
                </div>
              </td>

              <!-- Active -->
              <td class="px-2 py-1.5 align-middle">
                <label v-if="row._mode === 'edit'" class="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" v-model="row._draft!.is_active" class="rounded" />
                  {{ row._draft!.is_active ? $t('rbac.active') : $t('rbac.inactive') }}
                </label>
                <UBadge v-else
                  :color="row.is_active ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm">
                  {{ row.is_active ? $t('rbac.active') : $t('rbac.inactive') }}
                </UBadge>
              </td>

              <!-- Actions — sticky right -->
              <td class="sticky right-0 z-10 px-2 py-1.5 align-middle text-right bg-white dark:bg-gray-950
                         border-l border-gray-200 dark:border-gray-800">
                <AdminInlineRowActions
                  :mode="row._mode"
                  :can-edit="canManage"
                  :can-delete="false"
                  @edit="startEdit(row)"
                  @save="commit(row)"
                  @discard="discard(row)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminTableShell>
</template>
