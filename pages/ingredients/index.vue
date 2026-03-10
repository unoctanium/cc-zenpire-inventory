<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()

// ─── types ────────────────────────────────────────────────────────────────────

type IngredientRow = {
  id: string; article_id: string | null; name: string; kind: string
  default_unit_id: string; default_unit_code: string; default_unit_type: string
  standard_unit_cost: number | null; standard_cost_currency: string
  produced_by_recipe_id: string | null; comment: string | null
}
type UnitOption     = { id: string; code: string; name: string; unit_type: string }
type AllergenOption = { id: string; name: string; comment: string | null }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data: ingredientData, refresh } = await useFetch<{ ok: boolean; ingredients: IngredientRow[] }>('/api/ingredients', { credentials: 'include' })
const { data: unitData }                = await useFetch<{ ok: boolean; units: UnitOption[] }>('/api/units', { credentials: 'include' })
const { data: allergenData }            = await useFetch<{ ok: boolean; allergens: AllergenOption[] }>('/api/allergens', { credentials: 'include' })

const ingredients = computed(() => ingredientData.value?.ingredients ?? [])
const units       = computed(() => unitData.value?.units ?? [])
const allergens   = computed(() => allergenData.value?.allergens ?? [])

// ─── list + search ────────────────────────────────────────────────────────────

const search = ref('')

const filteredIngredients = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = [...ingredients.value].sort((a, b) => a.name.localeCompare(b.name))
  if (!q) return list
  return list.filter(i => i.name.toLowerCase().includes(q))
})

// ─── selection ────────────────────────────────────────────────────────────────

const selectedId = ref<string | null>(null)
const showCreateModal = ref(false)

const selectedIngredient = computed(() => ingredients.value.find(i => i.id === selectedId.value) ?? null)

function selectIngredient(id: string) {
  selectedId.value = id
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
  navigateTo(`/ingredients/${id}`)
}
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">403 – {{ $t('ingredients.noPermission') }}</div>

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
      <!-- Name list -->
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        <div v-if="filteredIngredients.length === 0" class="px-3 py-3 text-sm text-gray-400 dark:text-gray-600">{{ $t('common.noData') }}</div>

        <!-- TABLET -->
        <button
          v-for="i in filteredIngredients" :key="i.id"
          class="hidden sm:flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          :class="selectedId === i.id
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-white dark:bg-gray-900'"
          @click="selectIngredient(i.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="text-[15px] font-medium text-gray-900 dark:text-gray-100 truncate">{{ i.name }}</div>
            <div v-if="i.article_id" class="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">{{ i.article_id }}</div>
          </div>
          <span
            v-if="i.kind === 'produced'"
            class="flex-none rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
          >p</span>
        </button>

        <!-- MOBILE -->
        <button
          v-for="i in filteredIngredients" :key="i.id + '-m'"
          class="sm:hidden flex w-full items-center gap-2 px-4 py-3.5 text-left bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="handleMobileTap(i.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="text-[17px] font-medium text-gray-900 dark:text-gray-100">{{ i.name }}</div>
            <div v-if="i.article_id" class="text-[11px] font-mono text-gray-400 dark:text-gray-500">{{ i.article_id }}</div>
          </div>
          <span
            v-if="i.kind === 'produced'"
            class="flex-none rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
          >p</span>
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-300 flex-none" />
        </button>
      </div>
    </template>

    <!-- ─── Detail panel ───────────────────────────────────────────────────── -->
    <template #detail>
      <AppIngredientDetail
        v-if="selectedIngredient"
        :key="selectedIngredient.id"
        :ingredient="selectedIngredient"
        :units="units"
        :allergens="allergens"
        :can-manage="canManage"
        @saved="onSaved"
        @deleted="onDeleted"
      />

      <div v-else class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-20">
        <UIcon name="i-heroicons-beaker" class="w-12 h-12" />
        <p class="text-sm">{{ $t('ingredients.selectPrompt') }}</p>
      </div>
    </template>

    <!-- FAB -->
    <template v-if="canManage" #fab>
      <AppFab @click="startCreate" />
    </template>

  </AppSplitLayout>

  <!-- New ingredient bottom sheet -->
  <AppBottomSheet :open="showCreateModal" @close="showCreateModal = false">
    <AppIngredientDetail
      :ingredient="null"
      :units="units"
      :allergens="allergens"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </AppBottomSheet>
</template>
