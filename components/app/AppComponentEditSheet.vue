<script setup lang="ts">
/**
 * AppComponentEditSheet
 *
 * iOS-style sub-sheet stacked above a parent AppBottomSheet.
 * Used to add or edit a single recipe component (ingredient or sub-recipe).
 *
 * Props:
 *   open        — show/hide
 *   component   — null for new component; DraftComp for editing
 *   ingredients — purchased ingredient options
 *   allRecipes  — all recipes (for sub-recipe picker)
 *   units       — unit options
 *
 * Emits:
 *   done(result)            — user confirmed; parent updates local draft
 *   remove                  — user tapped destructive Remove (existing only)
 *   close                   — user tapped ‹ Back
 *   ingredientCreated(ing)  — new ingredient was POST-ed; parent adds to list
 */

type UnitOption       = { id: string; code: string; name: string }
type IngredientOption = { id: string; name: string; kind: string; default_unit_id: string }
type RecipeRow        = { id: string; name: string; is_pre_product: boolean; output_unit_id: string }

type DraftComp = {
  _localId: string
  id: string | null
  ingredient_id: string | null; sub_recipe_id: string | null
  quantity: number; unit_id: string; unit_code: string
  sort_order: number; type: 'ingredient' | 'sub_recipe'; name: string
  std_cost: number | null; base_unit_factor: number | null; component_unit_factor: number | null
}

type DoneResult = {
  ingredient_id: string | null; sub_recipe_id: string | null
  name: string; quantity: number
  unit_id: string; unit_code: string
  type: 'ingredient' | 'sub_recipe'
}

const props = defineProps<{
  open:        boolean
  component:   DraftComp | null
  ingredients: IngredientOption[]
  allRecipes:  RecipeRow[]
  units:       UnitOption[]
}>()

const emit = defineEmits<{
  (e: 'done', result: DoneResult): void
  (e: 'remove'): void
  (e: 'close'): void
  (e: 'ingredientCreated', ing: IngredientOption): void
}>()

const { t }  = useI18n()
const toast  = useToast()

// ─── local form state ─────────────────────────────────────────────────────────

const selectedIngredientId = ref<string | null>(null)
const selectedSubRecipeId  = ref<string | null>(null)
const selectedType         = ref<'ingredient' | 'sub_recipe'>('ingredient')
const selectedName         = ref('')
const quantity             = ref('')
const unit_id              = ref('')

const searchQuery   = ref('')
const creatingNew   = ref(false)

const qtyInputRef = ref<HTMLInputElement | null>(null)

watch(() => props.open, (v) => {
  if (!v) return
  searchQuery.value = ''
  creatingNew.value = false
  if (props.component) {
    selectedIngredientId.value = props.component.ingredient_id
    selectedSubRecipeId.value  = props.component.sub_recipe_id
    selectedType.value         = props.component.type
    selectedName.value         = props.component.name
    quantity.value             = String(props.component.quantity)
    unit_id.value              = props.component.unit_id
  } else {
    selectedIngredientId.value = null
    selectedSubRecipeId.value  = null
    selectedType.value         = 'ingredient'
    selectedName.value         = ''
    quantity.value             = ''
    unit_id.value              = props.units[0]?.id ?? ''
  }
})

// ─── search ───────────────────────────────────────────────────────────────────

type SearchResult = { id: string; name: string; type: 'ingredient' | 'sub_recipe' }

const searchResults = computed((): SearchResult[] => {
  const q = searchQuery.value.toLowerCase().trim()
  const out: SearchResult[] = []
  for (const ing of props.ingredients) {
    if (!q || ing.name.toLowerCase().includes(q))
      out.push({ id: ing.id, name: ing.name, type: 'ingredient' })
  }
  for (const r of props.allRecipes) {
    if (r.is_pre_product && (!q || r.name.toLowerCase().includes(q)))
      out.push({ id: r.id, name: r.name, type: 'sub_recipe' })
  }
  return out.slice(0, 30)
})

const hasExactMatch = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return true
  return searchResults.value.some(r => r.name.toLowerCase() === q)
})

const showCreateRow = computed(() =>
  searchQuery.value.trim().length > 0 && !hasExactMatch.value
)

// Show search results pane when: nothing selected yet, or user started typing
const showSearchPane = computed(() =>
  !selectedName.value || searchQuery.value.trim().length > 0
)

function selectResult(item: SearchResult) {
  selectedType.value = item.type
  selectedName.value = item.name
  searchQuery.value  = ''
  if (item.type === 'ingredient') {
    selectedIngredientId.value = item.id
    selectedSubRecipeId.value  = null
    const ing = props.ingredients.find(i => i.id === item.id)
    unit_id.value = ing?.default_unit_id ?? props.units[0]?.id ?? ''
  } else {
    selectedIngredientId.value = null
    selectedSubRecipeId.value  = item.id
    const r = props.allRecipes.find(r => r.id === item.id)
    unit_id.value = r?.output_unit_id ?? props.units[0]?.id ?? ''
  }
  nextTick(() => qtyInputRef.value?.focus())
}

async function createIngredient() {
  const name = searchQuery.value.trim()
  if (!name) return
  const defaultUnitId = props.units[0]?.id ?? ''
  creatingNew.value = true
  try {
    const res = await $fetch<{ ok: boolean; ingredient: any }>('/api/ingredients', {
      method: 'POST', credentials: 'include',
      body: { name, default_unit_id: defaultUnitId },
    })
    const ing: IngredientOption = {
      id: res.ingredient.id, name: res.ingredient.name,
      kind: 'purchased', default_unit_id: res.ingredient.default_unit_id ?? defaultUnitId,
    }
    emit('ingredientCreated', ing)
    selectedIngredientId.value = ing.id
    selectedSubRecipeId.value  = null
    selectedType.value         = 'ingredient'
    selectedName.value         = ing.name
    unit_id.value              = ing.default_unit_id
    searchQuery.value          = ''
    nextTick(() => qtyInputRef.value?.focus())
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  } finally {
    creatingNew.value = false
  }
}

// ─── confirm ─────────────────────────────────────────────────────────────────

function done() {
  if (!selectedIngredientId.value && !selectedSubRecipeId.value) {
    toast.add({ title: t('common.missingFields'), description: t('recipes.selectIngredient'), color: 'red' })
    return
  }
  const qty = Number(quantity.value)
  if (!(qty > 0)) {
    toast.add({ title: t('common.missingFields'), description: t('recipes.nameRequired'), color: 'red' })
    return
  }
  const unitCode = props.units.find(u => u.id === unit_id.value)?.code ?? ''
  emit('done', {
    ingredient_id: selectedIngredientId.value,
    sub_recipe_id: selectedSubRecipeId.value,
    name:          selectedName.value,
    quantity:      qty,
    unit_id:       unit_id.value,
    unit_code:     unitCode,
    type:          selectedType.value,
  })
}
</script>

<template>
  <Teleport to="body">

    <!-- Backdrop -->
    <Transition name="cs-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] bg-black/40"
        style="backdrop-filter: blur(1px)"
        @click="emit('close')"
      />
    </Transition>

    <!-- Sheet -->
    <Transition name="cs-slide">
      <div
        v-if="open"
        class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col bg-white dark:bg-gray-900 shadow-2xl"
        style="border-radius: 20px 20px 0 0; max-height: 92dvh"
      >
        <!-- Drag handle -->
        <div class="flex-none flex justify-center pt-3 pb-1">
          <div class="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <!-- iOS nav bar -->
        <div class="flex-none flex items-center px-4 min-h-[44px] border-b border-gray-200 dark:border-gray-800">
          <button
            class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50"
            @click="emit('close')"
          >‹ {{ $t('common.back') }}</button>
          <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">
            {{ $t('recipes.typeIngredient') }}
          </span>
          <button
            class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 active:opacity-50 disabled:opacity-40"
            :disabled="creatingNew"
            @click="done"
          >{{ $t('common.done') }}</button>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto overscroll-contain">

          <!-- ── Search field ────────────────────────────────────────────── -->
          <div class="px-4 pt-3 pb-2">
            <div class="relative">
              <UIcon
                name="i-heroicons-magnifying-glass"
                class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              />
              <input
                v-model="searchQuery"
                class="w-full rounded-lg bg-gray-100 dark:bg-gray-800 pl-8 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-1 focus:ring-blue-400 border-0"
                :placeholder="$t('recipes.ingredientSearchPlaceholder')"
                autocomplete="off"
              />
            </div>
          </div>

          <!-- ── Search results ─────────────────────────────────────────── -->
          <div v-if="showSearchPane" class="border-t border-gray-100 dark:border-gray-800">

            <!-- Create row -->
            <button
              v-if="showCreateRow"
              class="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#007AFF] dark:text-blue-400 border-b border-gray-100 dark:border-gray-800 bg-blue-50/60 dark:bg-blue-900/10 active:bg-blue-100 dark:active:bg-blue-900/20"
              :disabled="creatingNew"
              @click="createIngredient"
            >
              <span class="text-lg leading-none">＋</span>
              <span>{{ $t('recipes.createIngredient', { name: searchQuery.trim() }) }}</span>
              <UIcon v-if="creatingNew" name="i-heroicons-arrow-path" class="w-4 h-4 ml-auto animate-spin" />
            </button>

            <!-- Result rows -->
            <button
              v-for="item in searchResults"
              :key="item.id"
              class="w-full flex items-center gap-3 px-4 py-3 text-sm border-b border-gray-100 dark:border-gray-800 active:bg-gray-100 dark:active:bg-gray-800"
              @click="selectResult(item)"
            >
              <span class="flex-1 text-left text-gray-900 dark:text-gray-100 font-medium">{{ item.name }}</span>
              <span class="text-xs text-gray-400">
                {{ item.type === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}
              </span>
              <UIcon
                v-if="(item.type === 'ingredient' && item.id === selectedIngredientId) || (item.type === 'sub_recipe' && item.id === selectedSubRecipeId)"
                name="i-heroicons-check"
                class="w-4 h-4 text-[#007AFF] dark:text-blue-400 ml-1"
              />
            </button>

            <p v-if="searchResults.length === 0 && !showCreateRow" class="px-4 py-3 text-sm text-gray-400">
              {{ $t('recipes.noSearchResults') }}
            </p>
          </div>

          <!-- ── Selected indicator (when ingredient picked, no active search) ── -->
          <div
            v-else-if="selectedName"
            class="flex items-center gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800"
          >
            <div class="flex-1">
              <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                {{ selectedType === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}
              </div>
              <div class="text-[17px] font-medium text-gray-900 dark:text-gray-100">{{ selectedName }}</div>
            </div>
            <button
              class="text-sm text-[#007AFF] dark:text-blue-400 active:opacity-50"
              @click="searchQuery = ' '"
            >{{ $t('common.change') }}</button>
          </div>

          <!-- ── Quantity + Unit ─────────────────────────────────────────── -->
          <div class="px-4 pt-4 pb-3 space-y-3 border-t border-gray-100 dark:border-gray-800">
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="ios-label">
                  {{ $t('recipes.qty') }} *
                </label>
                <input
                  ref="qtyInputRef"
                  id="comp-sheet-qty"
                  v-model="quantity"
                  type="number" min="0.001" step="any"
                  class="ios-input"
                  :placeholder="$t('recipes.outputQtyPlaceholder')"
                />
              </div>
              <div class="flex-1">
                <label class="ios-label">
                  {{ $t('recipes.unit') }}
                </label>
                <select
                  v-model="unit_id"
                  class="ios-input"
                >
                  <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- ── Remove (existing only) ─────────────────────────────────── -->
          <div v-if="component" class="px-4 pb-6 pt-2">
            <button
              class="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-[15px] font-medium active:bg-red-100 dark:active:bg-red-900/30"
              @click="emit('remove')"
            >
              {{ $t('recipes.removeIngredient') }}
            </button>
          </div>

          <!-- bottom safe area -->
          <div class="pb-6" />

        </div>
      </div>
    </Transition>

  </Teleport>
</template>

<style scoped>
.cs-fade-enter-active  { transition: opacity 0.25s ease; }
.cs-fade-leave-active  { transition: opacity 0.18s ease; }
.cs-fade-enter-from,
.cs-fade-leave-to      { opacity: 0; }

.cs-slide-enter-active { transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
.cs-slide-leave-active { transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1); }
.cs-slide-enter-from,
.cs-slide-leave-to     { transform: translateY(100%); }
</style>
