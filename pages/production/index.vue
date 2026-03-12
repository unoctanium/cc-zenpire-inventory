<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()
const toast  = useToast()

// ─── types ────────────────────────────────────────────────────────────────────

type RecipeRow = {
  id: string; recipe_id: string | null; name: string; description: string
  output_quantity: number; output_unit_id: string; output_unit_code: string; output_unit_type: string
  standard_unit_cost: number | null; comp_cost: number | null
  is_active: boolean; is_pre_product: boolean
  component_count: number; created_at: string; updated_at: string
  is_machine_translation?: boolean
}
type UnitOption       = { id: string; code: string; name: string; unit_type: string }
type IngredientOption = { id: string; name: string; kind: string; default_unit_id: string; default_unit_type: string }
type AllergenOption   = { id: string; name: string; code: string | null }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('recipe')

// ─── data ─────────────────────────────────────────────────────────────────────

const { locale } = useI18n({ useScope: 'global' })
const recipesStore     = useRecipesStore()
const unitsStore       = useUnitsStore()
const ingredientsStore = useIngredientsStore()
const allergensStore   = useAllergensStore()

const recipes     = computed(() => recipesStore.forLocale(locale.value).value as RecipeRow[])
const units       = computed(() => unitsStore.items as UnitOption[])
const ingredients = computed(() => ingredientsStore.forLocale(locale.value).value as IngredientOption[])
const allergens   = computed(() => allergensStore.forLocale(locale.value).value as AllergenOption[])
const refresh     = () => recipesStore.load(locale.value)

watch(locale, () => recipesStore.load(locale.value))

// ─── list + search ────────────────────────────────────────────────────────────

const search = ref('')

const filteredRecipes = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = [...recipes.value].sort((a, b) => a.name.localeCompare(b.name))
  if (!q) return list
  return list.filter(r => r.name.toLowerCase().includes(q))
})

// ─── selection ────────────────────────────────────────────────────────────────

const route      = useRoute()
const selectedId = ref<string | null>(null)

// Pre-select from ?recipe=<id> query param (e.g. coming from ingredient "View recipe" link)
watch(
  recipes,
  (data) => {
    if (!selectedId.value && route.query.recipe) {
      const id = String(route.query.recipe)
      if (data.find(r => r.id === id)) selectedId.value = id
    }
  },
  { immediate: true }
)
const showCreateModal = ref(false)

const selectedRecipe = computed(() => recipes.value.find(r => r.id === selectedId.value) ?? null)

function selectRecipe(id: string) {
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

// ─── mobile navigation ────────────────────────────────────────────────────────

function handleMobileTap(id: string) {
  navigateTo(`/production/${id}`)
}
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">403 – {{ $t('recipes.noPermission') }}</div>

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
        <div v-if="filteredRecipes.length === 0" class="px-3 py-3 text-sm text-gray-400 dark:text-gray-600">{{ $t('common.noData') }}</div>

        <!-- TABLET: select in-place -->
        <button
          v-for="r in filteredRecipes" :key="r.id"
          class="hidden sm:flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          :class="selectedId === r.id
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-white dark:bg-gray-900'"
          @click="selectRecipe(r.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-[15px] font-medium text-gray-900 dark:text-gray-100 truncate">{{ r.name }}</span>
              <span v-if="r.is_machine_translation" class="flex-none text-[9px] font-semibold px-1 py-px rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-wide">{{ $t('adminTranslations.mtBadge') }}</span>
            </div>
            <div v-if="r.recipe_id" class="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">{{ r.recipe_id }}</div>
          </div>
          <span v-if="!r.is_active" class="flex-none text-xs text-gray-400 dark:text-gray-600">{{ $t('common.no') }}</span>
          <span v-if="r.is_pre_product" class="flex-none rounded-full px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">pre</span>
        </button>

        <!-- MOBILE: navigate to detail page -->
        <button
          v-for="r in filteredRecipes" :key="r.id + '-m'"
          class="sm:hidden flex w-full items-center gap-2 px-4 py-3.5 text-left bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="handleMobileTap(r.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-[17px] font-medium text-gray-900 dark:text-gray-100">{{ r.name }}</span>
              <span v-if="r.is_machine_translation" class="flex-none text-[9px] font-semibold px-1 py-px rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-wide">{{ $t('adminTranslations.mtBadge') }}</span>
            </div>
            <div v-if="r.recipe_id" class="text-[11px] font-mono text-gray-400 dark:text-gray-500">{{ r.recipe_id }}</div>
          </div>
          <span v-if="!r.is_active" class="flex-none text-xs text-gray-400">{{ $t('common.no') }}</span>
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-300 flex-none" />
        </button>
      </div>
    </template>

    <!-- ─── Detail panel ───────────────────────────────────────────────────── -->
    <template #detail>
      <!-- Viewing/editing existing recipe -->
      <AppRecipeDetail
        v-if="selectedRecipe"
        :key="selectedRecipe.id"
        :recipe="selectedRecipe"
        :units="units"
        :ingredients="ingredients"
        :all-recipes="recipes"
        :allergens="allergens"
        :can-manage="canManage"
        @saved="onSaved"
        @deleted="onDeleted"
      />

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-20">
        <UIcon name="i-heroicons-book-open" class="w-12 h-12" />
        <p class="text-sm">{{ $t('recipes.selectPrompt') }}</p>
      </div>
    </template>

    <!-- FAB -->
    <template v-if="canManage" #fab>
      <AppFab @click="startCreate" />
    </template>

  </AppSplitLayout>

  <!-- New recipe bottom sheet -->
  <AppBottomSheet :open="showCreateModal" @close="showCreateModal = false">
    <AppRecipeDetail
      :recipe="null"
      :units="units"
      :ingredients="ingredients"
      :all-recipes="recipes"
      :allergens="allergens"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </AppBottomSheet>
</template>
