<script setup lang="ts">
/**
 * RecipeEditModal
 *
 * Create or edit a recipe with inline sub-tables for components and steps.
 *
 * Props:
 *   open           — v-model, controls visibility
 *   recipe         — null for new recipe, RecipeRow for editing
 *   units          — available unit options
 *   ingredients    — purchased ingredients for component search
 *   allRecipes     — all recipes (for sub-recipe search: is_pre_product = true)
 *
 * Emits:
 *   update:open(false)
 *   saved — recipe was saved (list should refresh)
 */

type RecipeRow = {
  id: string; name: string; description: string
  output_quantity: number; output_unit_id: string; output_unit_code: string
  standard_unit_cost: number | null
  is_active: boolean; is_pre_product: boolean
  component_count: number; created_at: string; updated_at: string
}

type UnitOption       = { id: string; code: string; name: string }
type IngredientOption = { id: string; name: string; kind: string; default_unit_id: string }

type ComponentRow = {
  id: string; recipe_id: string
  ingredient_id: string | null; sub_recipe_id: string | null
  quantity: number; unit_id: string; unit_code: string
  sort_order: number; type: 'ingredient' | 'sub_recipe'; name: string
  std_cost: number | null; base_unit_factor: number | null; component_unit_factor: number | null
}

type StepRow = { recipe_id: string; step_no: number; instruction_text: string }

const props = defineProps<{
  open:        boolean
  recipe:      RecipeRow | null
  units:       UnitOption[]
  ingredients: IngredientOption[]
  allRecipes:  RecipeRow[]
  viewMode?:   boolean
  canManage?:  boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved'): void
  (e: 'listUpdated'): void
}>()

const { t }  = useI18n()
const toast  = useToast()

// ─── basic fields ─────────────────────────────────────────────────────────────

const draft = reactive({
  name:               '',
  description:        '',
  output_quantity:    '' as string | number,
  output_unit_id:     '',
  standard_unit_cost: '' as string | number,
  is_active:          true,
  is_pre_product:     false,
})

const saving         = ref(false)
const savedId        = ref<string | null>(null)   // id after first save (enables sections 2/3)
const inViewMode     = ref(false)
const hasImage       = ref(false)
const imageUploading = ref(false)
const imageVersion   = ref(0)

// Full detail fetched after save or when opening existing recipe
const components = ref<ComponentRow[]>([])
const steps      = ref<StepRow[]>([])
const detailLoading = ref(false)

watch(() => props.open, async (v) => {
  if (!v) return
  savedId.value    = null
  inViewMode.value = props.viewMode ?? false
  components.value = []
  steps.value      = []
  hasImage.value   = false

  if (props.recipe) {
    draft.name               = props.recipe.name
    draft.description        = props.recipe.description ?? ''
    draft.output_quantity    = props.recipe.output_quantity
    draft.output_unit_id     = props.recipe.output_unit_id
    draft.standard_unit_cost = props.recipe.standard_unit_cost ?? ''
    draft.is_active          = props.recipe.is_active
    draft.is_pre_product     = props.recipe.is_pre_product
    savedId.value            = props.recipe.id
    await loadDetail(props.recipe.id)
  } else {
    draft.name               = ''
    draft.description        = ''
    draft.output_quantity    = ''
    draft.output_unit_id     = props.units[0]?.id ?? ''
    draft.standard_unit_cost = ''
    draft.is_active          = true
    draft.is_pre_product     = false
  }
})

async function loadDetail(id: string) {
  detailLoading.value = true
  try {
    const res = await $fetch<{ ok: boolean; recipe: any; components: ComponentRow[]; steps: StepRow[] }>(
      `/api/recipes/${id}`, { credentials: 'include' }
    )
    components.value = res.components
    steps.value      = res.steps
    hasImage.value   = res.recipe?.has_image ?? false
  } catch (e: any) {
    toast.add({ title: t('recipes.loadError'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  } finally {
    detailLoading.value = false
  }
}

const imageUrl = computed(() =>
  hasImage.value && savedId.value
    ? `/api/recipes/${savedId.value}/image?v=${imageVersion.value}`
    : null
)

async function uploadImage(file: File) {
  if (!savedId.value) return
  imageUploading.value = true
  try {
    const fd = new FormData()
    fd.append('image', file)
    await $fetch(`/api/recipes/${savedId.value}/image`,
      { method: 'PUT', credentials: 'include', body: fd })
    hasImage.value = true
    imageVersion.value++
  } catch (e: any) {
    toast.add({
      title:       t('common.saveFailed'),
      description: e?.data?.statusMessage ?? e?.message ?? String(e),
      color:       'red',
    })
  } finally {
    imageUploading.value = false
  }
}

async function removeImage() {
  if (!savedId.value) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/image`,
      { method: 'DELETE', credentials: 'include' })
    hasImage.value = false
  } catch (e: any) {
    toast.add({
      title:       t('common.deleteFailed'),
      description: e?.data?.statusMessage ?? e?.message ?? String(e),
      color:       'red',
    })
  }
}

// ─── save basic fields ────────────────────────────────────────────────────────

async function saveBasic() {
  const qty = Number(draft.output_quantity)
  if (!draft.name.trim() || !draft.output_unit_id || !(qty > 0)) {
    toast.add({ title: t('common.missingFields'), description: t('recipes.nameRequired'), color: 'red' })
    return
  }
  saving.value = true
  try {
    const costRaw = String(draft.standard_unit_cost).trim()
    const body = {
      name:               draft.name.trim(),
      description:        draft.description.trim() || null,
      output_quantity:    qty,
      output_unit_id:     draft.output_unit_id,
      standard_unit_cost: costRaw === '' ? null : Number(costRaw),
      is_active:          draft.is_active,
      is_pre_product:     draft.is_pre_product,
    }
    if (savedId.value) {
      await $fetch(`/api/recipes/${savedId.value}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('recipes.updated') })
    } else {
      const res = await $fetch<{ ok: boolean; recipe: { id: string } }>(
        '/api/recipes', { method: 'POST', credentials: 'include', body }
      )
      savedId.value = res.recipe.id
      toast.add({ title: t('recipes.created') })
      await loadDetail(res.recipe.id)
    }
    emit('listUpdated')
  } catch (e: any) {
    toast.add({
      title: t('common.saveFailed'),
      description: e?.data?.statusMessage ?? e?.message ?? String(e),
      color: 'red',
    })
  } finally {
    saving.value = false
  }
}

// ─── components section ───────────────────────────────────────────────────────

const compError     = ref('')
const compSearch    = ref('')
const compSearchEl  = ref<HTMLInputElement | null>(null)
const showDropdown  = ref(false)

// Local copy of ingredients so newly created ones appear immediately in search
const localIngredients = ref<IngredientOption[]>([])
watch(() => props.ingredients, (v) => { localIngredients.value = [...v] }, { immediate: true })

type SearchResult = { id: string; name: string; group: 'ingredient' | 'sub_recipe' }

const searchResults = computed((): SearchResult[] => {
  const q = compSearch.value.toLowerCase().trim()
  if (!q) return []
  const recipeId = savedId.value

  const matched: SearchResult[] = []

  for (const ing of localIngredients.value) {
    if (ing.name.toLowerCase().includes(q)) {
      matched.push({ id: ing.id, name: ing.name, group: 'ingredient' })
    }
  }
  for (const r of props.allRecipes) {
    if (r.is_pre_product && r.id !== recipeId && r.name.toLowerCase().includes(q)) {
      matched.push({ id: r.id, name: r.name, group: 'sub_recipe' })
    }
  }
  return matched.slice(0, 20)
})

watch(compSearch, (v) => { showDropdown.value = v.trim().length > 0 && searchResults.value.length > 0 })
watch(searchResults, (v) => { showDropdown.value = compSearch.value.trim().length > 0 && v.length > 0 })

// Pending new component (after selecting from dropdown)
const pendingComp = ref<{
  type: 'ingredient' | 'sub_recipe'
  ref_id: string
  name: string
  quantity: string
  unit_id: string
} | null>(null)

function selectSearchResult(item: SearchResult) {
  showDropdown.value = false
  compSearch.value   = ''

  // Default unit: for ingredient → its default unit; for sub-recipe → output unit
  let defaultUnitId = props.units[0]?.id ?? ''
  if (item.group === 'ingredient') {
    const ing = props.ingredients.find(i => i.id === item.id)
    defaultUnitId = ing?.default_unit_id ?? defaultUnitId
  } else {
    const rec = props.allRecipes.find(r => r.id === item.id)
    defaultUnitId = rec?.output_unit_id ?? defaultUnitId
  }

  pendingComp.value = {
    type:     item.group,
    ref_id:   item.id,
    name:     item.name,
    quantity: '',
    unit_id:  defaultUnitId,
  }
}

async function confirmAddComponent() {
  const pc = pendingComp.value
  if (!pc || !savedId.value) return
  const qty = Number(pc.quantity)
  if (!(qty > 0)) {
    compError.value = t('recipes.nameRequired')
    return
  }
  compError.value = ''
  try {
    await $fetch(`/api/recipes/${savedId.value}/components`, {
      method: 'POST',
      credentials: 'include',
      body: {
        ingredient_id: pc.type === 'ingredient' ? pc.ref_id : null,
        sub_recipe_id: pc.type === 'sub_recipe' ? pc.ref_id : null,
        quantity:      qty,
        unit_id:       pc.unit_id,
      },
    })
    pendingComp.value = null
    await loadDetail(savedId.value)
  } catch (e: any) {
    compError.value = e?.data?.statusMessage ?? e?.message ?? String(e)
  }
}

function cancelPendingComp() {
  pendingComp.value = null
  compError.value   = ''
}

const isDeleteCompOpen = ref(false)
const deletingComp     = ref<ComponentRow | null>(null)

function requestDeleteComp(comp: ComponentRow) {
  deletingComp.value     = comp
  isDeleteCompOpen.value = true
}

async function confirmDeleteComp() {
  const comp = deletingComp.value
  if (!comp || !savedId.value) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/components/${comp.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    isDeleteCompOpen.value = false
    deletingComp.value     = null
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

// Per-row edit state for components
type CompUi = ComponentRow & { _mode: 'view' | 'edit'; _draft?: { quantity: string; unit_id: string } }
const compUiRows = ref<CompUi[]>([])

watch(components, (v) => {
  const prev = compUiRows.value
  compUiRows.value = v.map(c => {
    const existing = prev.find(r => r.id === c.id)
    if (existing?._mode === 'edit') return { ...c, _mode: 'edit', _draft: existing._draft }
    return { ...c, _mode: 'view' as const }
  })
}, { immediate: true })

function startEditComp(row: CompUi) {
  row._mode  = 'edit'
  row._draft = { quantity: String(row.quantity), unit_id: row.unit_id }
}

function discardComp(row: CompUi) {
  row._mode  = 'view'
  row._draft = undefined
}

async function saveComp(row: CompUi) {
  if (!savedId.value || !row._draft) return
  const qty = Number(row._draft.quantity)
  if (!(qty > 0)) {
    toast.add({ title: t('common.missingFields'), description: t('recipes.nameRequired'), color: 'red' })
    return
  }
  try {
    await $fetch(`/api/recipes/${savedId.value}/components/${row.id}`, {
      method: 'PUT',
      credentials: 'include',
      body: { quantity: qty, unit_id: row._draft.unit_id },
    })
    row._mode  = 'view'   // exit edit mode before watcher fires on loadDetail
    row._draft = undefined
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

// ─── new ingredient modal ─────────────────────────────────────────────────────

const isNewIngredientOpen = ref(false)

function onIngredientCreated(ingredient: any) {
  // Add to local list so it appears in search immediately (no page reload needed)
  localIngredients.value.push({
    id:              ingredient.id,
    name:            ingredient.name,
    kind:            ingredient.kind ?? 'purchased',
    default_unit_id: ingredient.default_unit_id ?? '',
  })
  // Auto-select as pending component
  pendingComp.value = {
    type:     'ingredient',
    ref_id:   ingredient.id,
    name:     ingredient.name,
    quantity: '',
    unit_id:  ingredient.default_unit_id ?? props.units[0]?.id ?? '',
  }
}

// ─── steps section ────────────────────────────────────────────────────────────

type StepUi = StepRow & { _editing: boolean; _draft: string }

const stepsUi = ref<StepUi[]>([])
const addingStep = ref(false)
const newStepText = ref('')

watch(steps, (v) => {
  stepsUi.value = v.map(s => ({ ...s, _editing: false, _draft: s.instruction_text }))
}, { immediate: true })

function startEditStep(su: StepUi) {
  su._editing = true
  su._draft   = su.instruction_text
}

function discardEditStep(su: StepUi) {
  su._editing = false
  su._draft   = su.instruction_text
}

async function saveStep(su: StepUi) {
  if (!savedId.value || !su._draft.trim()) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/steps/${su.step_no}`, {
      method: 'PUT',
      credentials: 'include',
      body: { instruction_text: su._draft.trim() },
    })
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

const isDeleteStepOpen = ref(false)
const deletingStep     = ref<StepUi | null>(null)

function requestDeleteStep(su: StepUi) {
  deletingStep.value     = su
  isDeleteStepOpen.value = true
}

async function confirmDeleteStep() {
  const su = deletingStep.value
  if (!su || !savedId.value) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/steps/${su.step_no}`, {
      method: 'DELETE', credentials: 'include',
    })
    isDeleteStepOpen.value = false
    deletingStep.value     = null
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

async function addStep() {
  if (!savedId.value || !newStepText.value.trim()) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/steps`, {
      method: 'POST',
      credentials: 'include',
      body: { instruction_text: newStepText.value.trim() },
    })
    newStepText.value = ''
    addingStep.value  = false
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

// ─── cost helpers ─────────────────────────────────────────────────────────────

function componentCost(comp: ComponentRow): number | null {
  if (comp.std_cost == null || comp.base_unit_factor == null || comp.component_unit_factor == null) return null
  if (comp.base_unit_factor === 0) return null
  return comp.quantity * (comp.component_unit_factor / comp.base_unit_factor) * comp.std_cost
}

function formatCost(n: number | null): string {
  if (n == null) return '—'
  return `€ ${n.toFixed(4)}`
}

const totalCost = computed((): number | null => {
  const costs = components.value.map(componentCost).filter((c): c is number => c !== null)
  if (costs.length === 0) return null
  return costs.reduce((a, b) => a + b, 0)
})
</script>

<template>
  <UModal :open="open" size="xl" @update:open="emit('update:open', $event)">
    <template #header>
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
        <template v-if="inViewMode">
          {{ $t('recipes.viewTitle') }}
          <span class="ml-1 text-gray-500 font-normal">— {{ recipe?.name }}</span>
        </template>
        <template v-else>
          {{ recipe ? $t('recipes.editTitle') : $t('recipes.newTitle') }}
          <span v-if="recipe" class="ml-1 text-gray-500 font-normal">— {{ recipe.name }}</span>
        </template>
      </h2>
    </template>

    <template #body>
      <div class="space-y-6">

        <!-- ── Image ──────────────────────────────────────────────────────── -->
        <AdminImageUpload v-if="savedId"
          :image-url="imageUrl"
          :uploading="imageUploading"
          :can-manage="canManage && !inViewMode"
          @upload="uploadImage"
          @remove="removeImage"
        />

        <!-- ── Section 1: Basic fields ──────────────────────────────────────── -->

        <!-- View mode: read-only display -->
        <div v-if="inViewMode" class="space-y-3">
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
              {{ $t('recipes.name') }}
            </div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ draft.name }}</div>
          </div>
          <div v-if="draft.description">
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
              {{ $t('recipes.description') }}
            </div>
            <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ draft.description }}</div>
          </div>
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
              {{ $t('recipes.output') }}
            </div>
            <div class="text-sm text-gray-900 dark:text-gray-100">
              {{ draft.output_quantity }}
              {{ units.find(u => u.id === draft.output_unit_id)?.code }}
            </div>
          </div>
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
              {{ $t('recipes.stdCost') }}
              <span class="text-gray-400 font-normal normal-case tracking-normal ml-1">{{ $t('recipes.perOutputUnit') }}</span>
            </div>
            <div class="text-sm text-gray-900 dark:text-gray-100">
              {{ draft.standard_unit_cost !== '' && draft.standard_unit_cost != null ? `€ ${draft.standard_unit_cost}` : '—' }}
            </div>
          </div>
          <div class="flex gap-4">
            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                {{ $t('recipes.active') }}
              </div>
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="draft.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
              >
                {{ draft.is_active ? $t('units.yes') : $t('units.no') }}
              </span>
            </div>
            <div>
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                {{ $t('recipes.preProduct') }}
              </div>
              <span
                v-if="draft.is_pre_product"
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                       bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {{ $t('units.yes') }}
              </span>
              <span v-else class="text-sm text-gray-400 dark:text-gray-600">–</span>
            </div>
          </div>
        </div>

        <!-- Edit mode: editable inputs -->
        <div v-else class="space-y-3">

          <!-- Name -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {{ $t('recipes.name') }} *
            </label>
            <input
              v-model="draft.name"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                     focus:outline-none focus:ring-1 focus:ring-gray-400
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              :placeholder="$t('recipes.namePlaceholder')"
              autocomplete="off"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {{ $t('recipes.description') }}
            </label>
            <textarea
              v-model="draft.description"
              rows="2"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                     focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              :placeholder="$t('recipes.descPlaceholder')"
            />
          </div>

          <!-- Output qty + unit -->
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ $t('recipes.output') }} *
              </label>
              <input
                v-model="draft.output_quantity"
                type="number" min="0.001" step="any"
                class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                       focus:outline-none focus:ring-1 focus:ring-gray-400
                       dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                :placeholder="$t('recipes.outputQtyPlaceholder')"
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                &nbsp;
              </label>
              <select
                v-model="draft.output_unit_id"
                class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                       focus:outline-none focus:ring-1 focus:ring-gray-400
                       dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
              </select>
            </div>
          </div>

          <!-- Std. cost -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {{ $t('recipes.stdCost') }}
              <span class="text-gray-400 font-normal normal-case tracking-normal ml-1">{{ $t('recipes.perOutputUnit') }}</span>
            </label>
            <input
              v-model="draft.standard_unit_cost"
              type="number" min="0" step="any"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                     focus:outline-none focus:ring-1 focus:ring-gray-400
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              :placeholder="$t('recipes.stdCostPlaceholder')"
            />
          </div>

          <!-- Flags -->
          <div class="flex gap-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="draft.is_active" type="checkbox"
                class="rounded border-gray-300 text-primary-500 dark:border-gray-700" />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ $t('recipes.active') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="draft.is_pre_product" type="checkbox"
                class="rounded border-gray-300 text-primary-500 dark:border-gray-700" />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ $t('recipes.preProduct') }}</span>
            </label>
          </div>

        </div>

        <!-- ── Section 2: Components (edit mode only) ────────────────────── -->
        <div v-if="savedId">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 border-t border-gray-100 dark:border-gray-800 pt-3">
            {{ $t('recipes.componentsSection') }}
          </h3>

          <div v-if="detailLoading" class="text-xs text-gray-400 py-2">{{ $t('common.loading') }}</div>

          <div v-else class="overflow-x-auto rounded border border-gray-200 dark:border-gray-800 mb-2">
            <table class="table-fixed border-separate border-spacing-0 text-xs"
                   style="min-width: 520px; width: 100%">
              <colgroup>
                <col style="width: 160px" />
                <col style="width: 80px" />
                <col style="width: 90px" />
                <col style="width: 90px" />
                <col style="width: 100px" />
              </colgroup>
              <thead>
                <tr class="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-950">
                  <th class="sticky left-0 z-20 text-left px-2 py-1 font-medium
                             border-b border-gray-200 dark:border-gray-800
                             border-r border-gray-200 dark:border-gray-800
                             bg-white dark:bg-gray-950">
                    {{ $t('recipes.name') }}
                  </th>
                  <th class="text-left px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">
                    {{ $t('recipes.qty') }}
                  </th>
                  <th class="text-left px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">
                    {{ $t('ingredients.unit') }}
                  </th>
                  <th class="text-right px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">
                    {{ $t('recipes.cost') }}
                  </th>
                  <th class="sticky right-0 z-20 text-right px-2 py-1 font-medium
                             border-b border-gray-200 dark:border-gray-800
                             border-l border-gray-200 dark:border-gray-800
                             bg-white dark:bg-gray-950">
                    {{ $t('common.actions') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="compUiRows.length === 0 && !pendingComp">
                  <td colspan="5" class="px-2 py-2 text-gray-400 dark:text-gray-600">
                    {{ $t('recipes.noComponents') }}
                  </td>
                </tr>

                <tr v-for="row in compUiRows" :key="row.id"
                    class="border-b border-gray-100 dark:border-gray-800">
                  <!-- Name + type badge (sticky left) -->
                  <td class="sticky left-0 z-10 px-2 py-1 align-middle
                             border-r border-gray-200 dark:border-gray-800
                             bg-white dark:bg-gray-950">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span
                        class="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium"
                        :class="row.type === 'ingredient'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'"
                      >
                        {{ row.type === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}
                      </span>
                      <span class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ row.name }}</span>
                    </div>
                  </td>
                  <!-- Qty -->
                  <td class="px-2 py-1 align-middle">
                    <input
                      v-if="!inViewMode && row._mode === 'edit'"
                      v-model="row._draft!.quantity"
                      type="number" min="0.001" step="any"
                      class="w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-xs
                             focus:outline-none focus:ring-1 focus:ring-gray-400
                             dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                    <span v-else class="text-gray-800 dark:text-gray-200">{{ row.quantity }}</span>
                  </td>
                  <!-- Unit -->
                  <td class="px-2 py-1 align-middle">
                    <select
                      v-if="!inViewMode && row._mode === 'edit'"
                      v-model="row._draft!.unit_id"
                      class="w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-xs
                             focus:outline-none focus:ring-1 focus:ring-gray-400
                             dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
                    </select>
                    <span v-else class="text-gray-800 dark:text-gray-200">{{ row.unit_code }}</span>
                  </td>
                  <!-- Cost -->
                  <td class="px-2 py-1 align-middle text-right text-gray-600 dark:text-gray-400">
                    {{ formatCost(componentCost(row)) }}
                  </td>
                  <!-- Actions (sticky right) -->
                  <td class="sticky right-0 z-10 px-2 py-1 align-middle
                             border-l border-gray-200 dark:border-gray-800
                             bg-white dark:bg-gray-950">
                    <AdminInlineRowActions v-if="!inViewMode"
                      :mode="row._mode"
                      :can-edit="true"
                      :can-delete="true"
                      @edit="startEditComp(row)"
                      @save="saveComp(row)"
                      @discard="discardComp(row)"
                      @delete="requestDeleteComp(row)"
                    />
                  </td>
                </tr>

                <!-- Pending new component row — always in edit mode -->
                <tr v-if="pendingComp && !inViewMode" class="bg-gray-50 dark:bg-gray-900/50">
                  <!-- Name + type badge (sticky left) -->
                  <td class="sticky left-0 z-10 px-2 py-1 align-middle
                             border-r border-gray-200 dark:border-gray-800
                             bg-gray-50 dark:bg-gray-900/50">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium
                                   bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {{ pendingComp.type === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}
                      </span>
                      <span class="font-medium text-gray-800 dark:text-gray-200 truncate">{{ pendingComp.name }}</span>
                    </div>
                  </td>
                  <!-- Qty -->
                  <td class="px-2 py-1 align-middle">
                    <input
                      v-model="pendingComp.quantity"
                      type="number" min="0.001" step="any"
                      class="w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-xs
                             focus:outline-none focus:ring-1 focus:ring-gray-400
                             dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      :placeholder="$t('recipes.outputQtyPlaceholder')"
                    />
                  </td>
                  <!-- Unit -->
                  <td class="px-2 py-1 align-middle">
                    <select
                      v-model="pendingComp.unit_id"
                      class="w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-xs
                             focus:outline-none focus:ring-1 focus:ring-gray-400
                             dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
                    </select>
                  </td>
                  <!-- Cost (n/a for pending) -->
                  <td class="px-2 py-1 align-middle text-right text-gray-400">—</td>
                  <!-- Actions (sticky right) -->
                  <td class="sticky right-0 z-10 px-2 py-1 align-middle
                             border-l border-gray-200 dark:border-gray-800
                             bg-gray-50 dark:bg-gray-900/50">
                    <AdminInlineRowActions
                      mode="edit"
                      :can-edit="true"
                      :can-delete="true"
                      @save="confirmAddComponent"
                      @discard="cancelPendingComp"
                      @delete="cancelPendingComp"
                    />
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t border-gray-200 dark:border-gray-700">
                  <td colspan="3" class="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">
                    {{ $t('recipes.totalCost') }}
                  </td>
                  <td class="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 text-right">
                    {{ formatCost(totalCost) }}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Component error -->
          <p v-if="compError && !inViewMode" class="text-xs text-red-600 dark:text-red-400 px-1">{{ compError }}</p>

          <!-- Add component row: search + quick-add button (edit mode only) -->
          <div v-if="!inViewMode" class="relative flex gap-2 items-center">
            <div class="relative flex-1">
              <input
                ref="compSearchEl"
                v-model="compSearch"
                class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                       focus:outline-none focus:ring-1 focus:ring-gray-400
                       dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                :placeholder="$t('recipes.searchIngredientOrRecipe')"
                autocomplete="off"
                @blur="() => setTimeout(() => { showDropdown = false }, 150)"
              />
              <!-- dropdown -->
              <div
                v-if="showDropdown && searchResults.length > 0"
                class="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto
                       rounded border border-gray-200 bg-white shadow-lg
                       dark:border-gray-700 dark:bg-gray-900"
              >
                <div v-for="item in searchResults" :key="item.id"
                     class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                     @mousedown.prevent="selectSearchResult(item)">
                  <span
                    class="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium shrink-0"
                    :class="item.group === 'ingredient'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'"
                  >
                    {{ item.group === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}
                  </span>
                  <span class="text-sm text-gray-800 dark:text-gray-200">{{ item.name }}</span>
                </div>
              </div>
            </div>
            <!-- Quick create ingredient button -->
            <UButton size="sm" color="neutral" variant="soft" icon="i-heroicons-plus"
              :title="$t('recipes.addIngredient')"
              @click="isNewIngredientOpen = true" />
          </div>
        </div>

        <!-- ── Section 3: Steps (edit mode only) ─────────────────────────── -->
        <div v-if="savedId">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 border-t border-gray-100 dark:border-gray-800 pt-3">
            {{ $t('recipes.stepsSection') }}
          </h3>

          <div v-if="detailLoading" class="text-xs text-gray-400 py-2">{{ $t('common.loading') }}</div>

          <div v-else class="space-y-1 mb-2">
            <div v-if="stepsUi.length === 0 && !addingStep" class="text-xs text-gray-400 dark:text-gray-600 px-1 py-2">
              {{ $t('recipes.noSteps') }}
            </div>

            <div v-for="su in stepsUi" :key="su.step_no"
                 class="flex gap-2 items-start border-b border-gray-100 dark:border-gray-800 pb-1">
              <!-- step number -->
              <span class="shrink-0 text-xs text-gray-400 dark:text-gray-600 pt-1.5 w-6 text-right">
                {{ su.step_no }}.
              </span>
              <!-- view / edit -->
              <div class="flex-1">
                <textarea v-if="su._editing"
                  v-model="su._draft"
                  rows="2"
                  class="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <span v-else class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {{ su.instruction_text }}
                </span>
              </div>
              <!-- actions (edit mode only) -->
              <div v-if="!inViewMode" class="flex items-center gap-1 shrink-0 pt-0.5">
                <template v-if="su._editing">
                  <UButton size="xs" color="green" variant="ghost" icon="i-heroicons-check"
                    @click="saveStep(su)" />
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-x-mark"
                    @click="discardEditStep(su)" />
                </template>
                <template v-else>
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square"
                    @click="startEditStep(su)" />
                  <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash"
                    @click="requestDeleteStep(su)" />
                </template>
              </div>
            </div>

            <!-- Add step row (edit mode only) -->
            <div v-if="addingStep && !inViewMode" class="flex gap-2 items-start pt-1">
              <span class="shrink-0 text-xs text-gray-400 pt-1.5 w-6 text-right">
                {{ stepsUi.length + 1 }}.
              </span>
              <textarea
                v-model="newStepText"
                rows="2"
                class="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900
                       focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                       dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                :placeholder="$t('recipes.instruction')"
                autofocus
              />
              <div class="flex items-center gap-1 pt-0.5">
                <UButton size="xs" color="green" variant="ghost" icon="i-heroicons-check"
                  @click="addStep" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-x-mark"
                  @click="addingStep = false; newStepText = ''" />
              </div>
            </div>
          </div>

          <UButton v-if="!addingStep && !inViewMode" size="sm" color="neutral" variant="soft" icon="i-heroicons-plus"
            @click="addingStep = true">
            {{ $t('recipes.addStep') }}
          </UButton>
        </div>


      </div>
    </template>

    <template #footer>
      <!-- View mode footer: Close + Edit (edit only when canManage) -->
      <div v-if="inViewMode" class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="soft" @click="emit('update:open', false)">
          {{ $t('common.close') }}
        </UButton>
        <UButton v-if="canManage" @click="inViewMode = false">
          {{ $t('common.edit') }}
        </UButton>
      </div>
      <!-- Edit mode footer: Cancel/Close + Save -->
      <div v-else class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="soft" @click="emit('saved')">
          {{ savedId ? $t('common.close') : $t('common.cancel') }}
        </UButton>
        <UButton :loading="saving" @click="saveBasic">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Delete confirmation: component -->
  <AdminDeleteModal v-model:open="isDeleteCompOpen" :title="$t('recipes.deleteComponentTitle')" @confirm="confirmDeleteComp">
    <p>{{ $t('recipes.deleteComponentConfirm', { name: deletingComp?.name ?? '' }) }}</p>
  </AdminDeleteModal>

  <!-- Delete confirmation: step -->
  <AdminDeleteModal v-model:open="isDeleteStepOpen" :title="$t('recipes.deleteStepTitle')" @confirm="confirmDeleteStep">
    <p>{{ $t('recipes.deleteStepConfirm', { no: deletingStep?.step_no ?? '' }) }}</p>
  </AdminDeleteModal>

  <!-- Nested: quick ingredient creator -->
  <AdminRecipeNewIngredientModal
    v-model:open="isNewIngredientOpen"
    :units="units"
    @created="onIngredientCreated"
  />
</template>
