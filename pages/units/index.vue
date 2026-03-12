<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

// ─── types ────────────────────────────────────────────────────────────────────

type UnitType = 'mass' | 'volume' | 'count'
type UnitRow  = { id: string; code: string; name: string; unit_type: UnitType; factor: number }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('unit')

// ─── data fetch ───────────────────────────────────────────────────────────────

const unitsStore = useUnitsStore()

const units   = computed(() => unitsStore.items as UnitRow[])
const refresh = () => unitsStore.load()

// ─── list + search ────────────────────────────────────────────────────────────

const search = ref('')

const filteredUnits = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = [...units.value].sort((a, b) => a.code.localeCompare(b.code))
  if (!q) return list
  return list.filter(u => u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
})

// ─── selection ────────────────────────────────────────────────────────────────

const selectedId = ref<string | null>(null)
const showCreateModal = ref(false)

const selectedUnit = computed(() => units.value.find(u => u.id === selectedId.value) ?? null)

function selectUnit(u: UnitRow) {
  selectedId.value = u.id
}

function startCreate() {
  if (!canManage.value) return
  showCreateModal.value = true
}

function onSaved(id: string) {
  showCreateModal.value = false
  selectedId.value = id
  refresh()
}

function onDeleted() {
  showCreateModal.value = false
  selectedId.value = null
  refresh()
}

function onCancelled() {
  showCreateModal.value = false
}

function handleMobileTap(id: string) {
  navigateTo(`/units/${id}`)
}
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">403 – {{ $t('common.noPermission') }}</div>

  <AppSplitLayout v-else>

    <!-- ─── List panel ─────────────────────────────────────────────────────── -->
    <template #search>
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="relative flex-1">
          <UIcon name="i-heroicons-magnifying-glass"
            class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            v-model="search" type="text"
            class="w-full rounded border border-gray-300 bg-white pl-7 pr-7 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('common.search') + '…'" />
          <button v-if="search" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" @click="search = ''">
            <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </template>

    <template #list>
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        <div v-if="filteredUnits.length === 0" class="px-3 py-3 text-sm text-gray-400 dark:text-gray-600">{{ $t('common.noData') }}</div>

        <!-- TABLET -->
        <button
          v-for="u in filteredUnits" :key="u.id"
          class="hidden sm:flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          :class="selectedId === u.id
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-white dark:bg-gray-900'"
          @click="selectUnit(u)"
        >
          <span class="font-mono text-xs font-semibold text-gray-600 dark:text-gray-400 w-8">{{ u.code }}</span>
          <span class="flex-1 text-[15px] text-gray-900 dark:text-gray-100 truncate">{{ u.name }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-600">{{ u.unit_type }}</span>
        </button>

        <!-- MOBILE -->
        <button
          v-for="u in filteredUnits" :key="u.id + '-m'"
          class="sm:hidden flex w-full items-center gap-2 px-4 py-4 text-left bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="handleMobileTap(u.id)"
        >
          <span class="font-mono text-xs font-semibold text-gray-600 dark:text-gray-400 w-8">{{ u.code }}</span>
          <span class="flex-1 text-[17px] text-gray-900 dark:text-gray-100">{{ u.name }}</span>
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-300 flex-none" />
        </button>
      </div>
    </template>

    <!-- ─── Detail panel ───────────────────────────────────────────────────── -->
    <template #detail>
      <div
        v-if="!selectedId"
        class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-20"
      >
        <UIcon name="i-heroicons-scale" class="w-12 h-12" />
        <p class="text-sm">{{ $t('units.selectPrompt') }}</p>
      </div>

      <AppUnitDetail
        v-else
        :key="selectedId"
        :unit="selectedUnit"
        :can-manage="canManage"
        @saved="onSaved"
        @deleted="onDeleted"
        @cancelled="onCancelled"
      />
    </template>

    <!-- FAB -->
    <template v-if="canManage" #fab>
      <AppFab @click="startCreate" />
    </template>

  </AppSplitLayout>

  <!-- New unit bottom sheet -->
  <AppBottomSheet :open="showCreateModal" @close="showCreateModal = false">
    <AppUnitDetail
      key="new"
      :unit="null"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </AppBottomSheet>
</template>
