<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t } = useI18n()

// ─── types ────────────────────────────────────────────────────────────────────

type AllergenRow = { id: string; name: string; code: string | null; comment: string | null; created_at: string; updated_at: string }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data, refresh } = await useFetch<{ ok: boolean; allergens: AllergenRow[] }>('/api/allergens', { credentials: 'include' })

const allergens = computed(() => data.value?.allergens ?? [])

// ─── list + search ────────────────────────────────────────────────────────────

const search = ref('')

const filteredAllergens = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = [...allergens.value].sort((a, b) => a.name.localeCompare(b.name))
  if (!q) return list
  return list.filter(a => a.name.toLowerCase().includes(q))
})

// ─── selection ────────────────────────────────────────────────────────────────

const selectedId = ref<string | null>(null)
const showCreateModal = ref(false)

const selectedAllergen = computed(() => allergens.value.find(a => a.id === selectedId.value) ?? null)

function selectAllergen(a: AllergenRow) {
  selectedId.value = a.id
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
  navigateTo(`/allergens/${id}`)
}
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">403 – {{ $t('allergens.noPermission') }}</div>

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
        <div v-if="filteredAllergens.length === 0" class="px-3 py-3 text-sm text-gray-400 dark:text-gray-600">{{ $t('common.noData') }}</div>

        <!-- TABLET -->
        <button
          v-for="a in filteredAllergens" :key="a.id"
          class="hidden sm:flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          :class="selectedId === a.id
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-white dark:bg-gray-900'"
          @click="selectAllergen(a)"
        >
          <span class="flex-1 text-[15px] font-medium text-gray-900 dark:text-gray-100 truncate">{{ a.name }}</span>
          <span v-if="a.code" class="flex-none text-[11px] font-mono text-gray-400 dark:text-gray-500">{{ a.code }}</span>
        </button>

        <!-- MOBILE -->
        <button
          v-for="a in filteredAllergens" :key="a.id + '-m'"
          class="sm:hidden flex w-full items-center gap-2 px-4 py-4 text-left bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="handleMobileTap(a.id)"
        >
          <span class="flex-1 text-[17px] font-medium text-gray-900 dark:text-gray-100">{{ a.name }}</span>
          <span v-if="a.code" class="flex-none text-[11px] font-mono text-gray-400 dark:text-gray-500 mr-1">{{ a.code }}</span>
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
        <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12" />
        <p class="text-sm">{{ $t('allergens.selectPrompt') }}</p>
      </div>

      <AppAllergenDetail
        v-else
        :key="selectedId"
        :allergen="selectedAllergen"
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

  <!-- New allergen bottom sheet -->
  <AppBottomSheet :open="showCreateModal" @close="showCreateModal = false">
    <AppAllergenDetail
      key="new"
      :allergen="null"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </AppBottomSheet>
</template>
