<script setup lang="ts">
/**
 * RecipeDetail
 *
 * Self-contained recipe detail + edit form (no modal wrapper).
 * Opens in view mode for existing recipes, edit mode for new.
 *
 * Props:
 *   recipe      — null for new recipe, RecipeRow for existing
 *   units       — available unit options
 *   ingredients — purchased ingredients for component search
 *   allRecipes  — all recipes (for sub-recipe search)
 *   canManage   — whether edit/delete are allowed
 *
 * Emits:
 *   saved(id: string)  — recipe was saved; caller should refresh list
 *   deleted()          — recipe was deleted; caller should refresh list
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
  recipe:      RecipeRow | null
  units:       UnitOption[]
  ingredients: IngredientOption[]
  allRecipes:  RecipeRow[]
  canManage:   boolean
}>()

const emit = defineEmits<{
  (e: 'saved', id: string): void
  (e: 'deleted'): void
}>()

const { t }  = useI18n()
const toast  = useToast()

// ─── mode ─────────────────────────────────────────────────────────────────────

const editMode         = ref(false)
const confirmingDelete = ref(false)

const isNew = computed(() => !props.recipe)

// ─── basic fields draft ───────────────────────────────────────────────────────

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
const savedId        = ref<string | null>(null)
const hasImage       = ref(false)
const imageUploading = ref(false)
const imageVersion   = ref(0)

// ─── sub-data ─────────────────────────────────────────────────────────────────

const components    = ref<ComponentRow[]>([])
const steps         = ref<StepRow[]>([])
const detailLoading = ref(false)

// ─── reset when recipe prop changes ──────────────────────────────────────────

watch(
  () => props.recipe,
  async (recipe) => {
    confirmingDelete.value = false
    components.value = []
    steps.value      = []
    hasImage.value   = false

    if (recipe) {
      editMode.value   = false
      savedId.value    = recipe.id
      const loadQty    = Number(recipe.output_quantity) || 1
      draft.name               = recipe.name
      draft.description        = recipe.description ?? ''
      draft.output_quantity    = recipe.output_quantity
      draft.output_unit_id     = recipe.output_unit_id
      draft.standard_unit_cost = recipe.standard_unit_cost != null
        ? recipe.standard_unit_cost * loadQty
        : ''
      draft.is_active      = recipe.is_active
      draft.is_pre_product = recipe.is_pre_product
      await loadDetail(recipe.id)
    } else {
      // New recipe
      editMode.value           = true
      savedId.value            = null
      draft.name               = ''
      draft.description        = ''
      draft.output_quantity    = ''
      draft.output_unit_id     = props.units[0]?.id ?? ''
      draft.standard_unit_cost = ''
      draft.is_active          = true
      draft.is_pre_product     = false
    }
  },
  { immediate: true }
)

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

// ─── image ────────────────────────────────────────────────────────────────────

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
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally {
    imageUploading.value = false
  }
}

async function removeImage() {
  if (!savedId.value) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/image`, { method: 'DELETE', credentials: 'include' })
    hasImage.value = false
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
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
      standard_unit_cost: costRaw === '' ? null : Number(costRaw) / qty,
      is_active:          draft.is_active,
      is_pre_product:     draft.is_pre_product,
    }
    if (savedId.value) {
      await $fetch(`/api/recipes/${savedId.value}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('recipes.updated') })
      editMode.value = false
      emit('saved', savedId.value)
    } else {
      const res = await $fetch<{ ok: boolean; recipe: { id: string } }>(
        '/api/recipes', { method: 'POST', credentials: 'include', body }
      )
      savedId.value = res.recipe.id
      toast.add({ title: t('recipes.created') })
      await loadDetail(res.recipe.id)
      // Stay in edit mode so user can add components/steps
      emit('saved', res.recipe.id)
    }
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  if (props.recipe) {
    // Revert to saved recipe values
    const r = props.recipe
    const loadQty = Number(r.output_quantity) || 1
    draft.name               = r.name
    draft.description        = r.description ?? ''
    draft.output_quantity    = r.output_quantity
    draft.output_unit_id     = r.output_unit_id
    draft.standard_unit_cost = r.standard_unit_cost != null ? r.standard_unit_cost * loadQty : ''
    draft.is_active          = r.is_active
    draft.is_pre_product     = r.is_pre_product
    editMode.value = false
  }
}

// ─── delete ───────────────────────────────────────────────────────────────────

async function doDelete() {
  if (!savedId.value) return
  try {
    await $fetch(`/api/recipes/${savedId.value}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('recipes.deleted') })
    confirmingDelete.value = false
    emit('deleted')
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  }
}

// ─── components section ───────────────────────────────────────────────────────

const compSearch    = ref('')
const showDropdown  = ref(false)
const compError     = ref('')

const localIngredients = ref<IngredientOption[]>([])
watch(() => props.ingredients, (v) => { localIngredients.value = [...v] }, { immediate: true })

type SearchResult = { id: string; name: string; group: 'ingredient' | 'sub_recipe' }

const searchResults = computed((): SearchResult[] => {
  const q = compSearch.value.toLowerCase().trim()
  if (!q) return []
  const matched: SearchResult[] = []
  for (const ing of localIngredients.value) {
    if (ing.name.toLowerCase().includes(q)) {
      matched.push({ id: ing.id, name: ing.name, group: 'ingredient' })
    }
  }
  for (const r of props.allRecipes) {
    if (r.is_pre_product && r.id !== savedId.value && r.name.toLowerCase().includes(q)) {
      matched.push({ id: r.id, name: r.name, group: 'sub_recipe' })
    }
  }
  return matched.slice(0, 20)
})

watch(compSearch, (v) => { showDropdown.value = v.trim().length > 0 && searchResults.value.length > 0 })
watch(searchResults, (v) => { showDropdown.value = compSearch.value.trim().length > 0 && v.length > 0 })

const pendingComp = ref<{
  type: 'ingredient' | 'sub_recipe'
  ref_id: string; name: string; quantity: string; unit_id: string
} | null>(null)

function selectSearchResult(item: SearchResult) {
  showDropdown.value = false
  compSearch.value   = ''
  let defaultUnitId  = props.units[0]?.id ?? ''
  if (item.group === 'ingredient') {
    const ing = props.ingredients.find(i => i.id === item.id)
    defaultUnitId = ing?.default_unit_id ?? defaultUnitId
  } else {
    const rec = props.allRecipes.find(r => r.id === item.id)
    defaultUnitId = rec?.output_unit_id ?? defaultUnitId
  }
  pendingComp.value = { type: item.group, ref_id: item.id, name: item.name, quantity: '', unit_id: defaultUnitId }
}

async function confirmAddComponent() {
  const pc = pendingComp.value
  if (!pc || !savedId.value) return
  const qty = Number(pc.quantity)
  if (!(qty > 0)) { compError.value = t('recipes.nameRequired'); return }
  compError.value = ''
  try {
    await $fetch(`/api/recipes/${savedId.value}/components`, {
      method: 'POST', credentials: 'include',
      body: {
        ingredient_id: pc.type === 'ingredient' ? pc.ref_id : null,
        sub_recipe_id: pc.type === 'sub_recipe'  ? pc.ref_id : null,
        quantity: qty, unit_id: pc.unit_id,
      },
    })
    pendingComp.value = null
    await loadDetail(savedId.value)
  } catch (e: any) { compError.value = e?.data?.statusMessage ?? e?.message ?? String(e) }
}

function cancelPendingComp() { pendingComp.value = null; compError.value = '' }

const isDeleteCompOpen = ref(false)
const deletingComp     = ref<ComponentRow | null>(null)

function requestDeleteComp(comp: ComponentRow) { deletingComp.value = comp; isDeleteCompOpen.value = true }

async function confirmDeleteComp() {
  const comp = deletingComp.value
  if (!comp || !savedId.value) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/components/${comp.id}`,
      { method: 'DELETE', credentials: 'include' })
    isDeleteCompOpen.value = false; deletingComp.value = null
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

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

function startEditComp(row: CompUi) { row._mode = 'edit'; row._draft = { quantity: String(row.quantity), unit_id: row.unit_id } }
function discardComp(row: CompUi)   { row._mode = 'view'; row._draft = undefined }

async function saveComp(row: CompUi) {
  if (!savedId.value || !row._draft) return
  const qty = Number(row._draft.quantity)
  if (!(qty > 0)) { toast.add({ title: t('common.missingFields'), color: 'red' }); return }
  try {
    await $fetch(`/api/recipes/${savedId.value}/components/${row.id}`, {
      method: 'PUT', credentials: 'include',
      body: { quantity: qty, unit_id: row._draft.unit_id },
    })
    row._mode = 'view'; row._draft = undefined
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

// ─── new ingredient modal ─────────────────────────────────────────────────────

const isNewIngredientOpen = ref(false)

function onIngredientCreated(ingredient: any) {
  localIngredients.value.push({
    id: ingredient.id, name: ingredient.name,
    kind: ingredient.kind ?? 'purchased',
    default_unit_id: ingredient.default_unit_id ?? '',
  })
  pendingComp.value = {
    type: 'ingredient', ref_id: ingredient.id, name: ingredient.name,
    quantity: '', unit_id: ingredient.default_unit_id ?? props.units[0]?.id ?? '',
  }
}

// ─── steps section ────────────────────────────────────────────────────────────

type StepUi = StepRow & { _editing: boolean; _draft: string }
const stepsUi    = ref<StepUi[]>([])
const addingStep = ref(false)
const newStepText = ref('')

watch(steps, (v) => {
  stepsUi.value = v.map(s => ({ ...s, _editing: false, _draft: s.instruction_text }))
}, { immediate: true })

function startEditStep(su: StepUi) { su._editing = true; su._draft = su.instruction_text }
function discardEditStep(su: StepUi) { su._editing = false; su._draft = su.instruction_text }

async function saveStep(su: StepUi) {
  if (!savedId.value || !su._draft.trim()) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/steps/${su.step_no}`,
      { method: 'PUT', credentials: 'include', body: { instruction_text: su._draft.trim() } })
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

const isDeleteStepOpen = ref(false)
const deletingStep     = ref<StepUi | null>(null)

function requestDeleteStep(su: StepUi) { deletingStep.value = su; isDeleteStepOpen.value = true }

async function confirmDeleteStep() {
  const su = deletingStep.value
  if (!su || !savedId.value) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/steps/${su.step_no}`,
      { method: 'DELETE', credentials: 'include' })
    isDeleteStepOpen.value = false; deletingStep.value = null
    await loadDetail(savedId.value)
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  }
}

async function addStep() {
  if (!savedId.value || !newStepText.value.trim()) return
  try {
    await $fetch(`/api/recipes/${savedId.value}/steps`,
      { method: 'POST', credentials: 'include', body: { instruction_text: newStepText.value.trim() } })
    newStepText.value = ''; addingStep.value = false
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
  return `€ ${n.toFixed(2)}`
}

const totalCost = computed((): number | null => {
  const costs = components.value.map(componentCost).filter((c): c is number => c !== null)
  if (costs.length === 0) return null
  return costs.reduce((a, b) => a + b, 0)
})

const outputUnitCode = computed(() =>
  props.units.find(u => u.id === draft.output_unit_id)?.code ?? ''
)

const perUnitCost = computed((): number | null => {
  const batch = Number(draft.standard_unit_cost)
  const qty   = Number(draft.output_quantity)
  if (!batch || !qty) return null
  return batch / qty
})

// ─── print ────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printRecipe() {
  if (!savedId.value) return
  const imgSrc = imageUrl.value ? window.location.origin + imageUrl.value.split('?')[0] : null
  const imgTag = imgSrc
    ? `<img src="${imgSrc}" style="width:140px;height:140px;object-fit:cover;border-radius:8px;float:right;margin:0 0 16px 20px">`
    : ''

  const compRows = components.value.map(c =>
    `<tr>
      <td style="padding:5px 10px 5px 0;border-bottom:1px solid #f3f4f6">${esc(c.name)}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:11px">${c.type === 'ingredient' ? 'Ingredient' : 'Sub-recipe'}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${c.quantity}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #f3f4f6">${esc(c.unit_code)}</td>
      <td style="padding:5px 0 5px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${formatCost(componentCost(c))}</td>
    </tr>`
  ).join('')

  const stepItems = steps.value.map(s =>
    `<li style="display:flex;gap:12px;margin-bottom:8px">
      <span style="min-width:22px;text-align:right;color:#9ca3af;font-weight:500;flex-shrink:0">${s.step_no}.</span>
      <span style="line-height:1.5">${esc(s.instruction_text)}</span>
    </li>`
  ).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(draft.name)} — Zenpire</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;font-size:14px;color:#111827;background:#fff;padding:24px}
.toolbar{display:flex;gap:12px;align-items:center;padding:12px 0 16px;border-bottom:2px solid #e5e7eb;margin-bottom:24px}
.btn{padding:7px 18px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid #d1d5db;background:#f9fafb;color:#374151}
h1{font-size:24px;font-weight:700;margin-bottom:6px}h2{font-size:15px;font-weight:600;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:24px 0 10px}
.desc{color:#4b5563;margin-bottom:16px;line-height:1.6}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-bottom:24px;clear:both}
.meta label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:600;display:block;margin-bottom:2px}
table{width:100%;border-collapse:collapse;font-size:13px}thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:600;padding:4px 10px 8px 0;border-bottom:1px solid #e5e7eb}
ol{list-style:none;padding:0}.footer{margin-top:32px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af}
@media print{.toolbar{display:none}@page{margin:1.5cm}}</style>
<script>window.onload=function(){window.print()}<\/script></head>
<body>
<div class="toolbar"><button class="btn" onclick="window.close()">✕&nbsp;Close</button></div>
${imgTag}<h1>${esc(draft.name)}</h1>
${draft.description ? `<p class="desc">${esc(draft.description)}</p>` : ''}
<div class="meta">
  <div><label>Batch Amount</label><span>${draft.output_quantity} ${esc(outputUnitCode.value)}</span></div>
  ${draft.standard_unit_cost !== '' && draft.standard_unit_cost != null
    ? `<div><label>Batch cost</label><span>€ ${Number(draft.standard_unit_cost).toFixed(2)}</span></div>` : ''}
  <div><label>Status</label><span>${draft.is_active ? 'Active' : 'Inactive'}${draft.is_pre_product ? ' · Pre-product' : ''}</span></div>
  ${totalCost.value != null ? `<div><label>Total comp. cost</label><span>${formatCost(totalCost.value)}</span></div>` : ''}
</div>
${components.value.length > 0 ? `<h2>Components</h2><table><thead><tr><th>Name</th><th>Type</th><th style="text-align:right">Qty</th><th>Unit</th><th style="text-align:right">Cost</th></tr></thead><tbody>${compRows}</tbody></table>` : ''}
${steps.value.length > 0 ? `<h2>Steps</h2><ol>${stepItems}</ol>` : ''}
<div class="footer">Zenpire Inventory — printed ${new Date().toLocaleString()}</div>
</body></html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) { URL.revokeObjectURL(url); toast.add({ title: 'Print blocked', description: 'Please allow pop-ups.', color: 'error' }); return }
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
</script>

<template>
  <div class="p-4 space-y-4">

    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
        <template v-if="isNew">{{ $t('recipes.newTitle') }}</template>
        <template v-else-if="editMode">{{ $t('recipes.editTitle') }}</template>
        <template v-else>{{ $t('recipes.viewTitle') }}</template>
      </h2>
      <div v-if="!isNew && !editMode" class="flex items-center gap-1">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-printer" @click="printRecipe">
          {{ $t('common.print') }}
        </UButton>
        <UButton v-if="canManage" size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" @click="editMode = true">
          {{ $t('common.edit') }}
        </UButton>
        <UButton v-if="canManage" size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="confirmingDelete = true">
          {{ $t('common.delete') }}
        </UButton>
      </div>
    </div>

    <!-- ─── Inline delete confirmation ──────────────────────────────────────── -->
    <div
      v-if="confirmingDelete"
      class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center justify-between gap-3"
    >
      <p class="text-sm text-red-700 dark:text-red-300">
        {{ $t('recipes.deleteConfirmExisting', { name: recipe?.name ?? '' }) }}
      </p>
      <div class="flex gap-2 flex-none">
        <UButton size="xs" color="neutral" variant="soft" @click="confirmingDelete = false">{{ $t('common.cancel') }}</UButton>
        <UButton size="xs" color="error" @click="doDelete">{{ $t('common.delete') }}</UButton>
      </div>
    </div>

    <!-- ─── Image ────────────────────────────────────────────────────────────── -->
    <AdminImageUpload
      v-if="savedId"
      :image-url="imageUrl"
      :uploading="imageUploading"
      :can-manage="canManage && editMode"
      @upload="uploadImage"
      @remove="removeImage"
    />

    <!-- ─── Basic fields (view mode) ─────────────────────────────────────────── -->
    <div v-if="!editMode" class="space-y-3">

      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('recipes.name') }}</div>
        <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ draft.name }}</div>
      </div>

      <div v-if="draft.description">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('recipes.description') }}</div>
        <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ draft.description }}</div>
      </div>

      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('recipes.output') }}</div>
        <div class="text-sm text-gray-900 dark:text-gray-100">{{ draft.output_quantity }} {{ outputUnitCode }}</div>
      </div>

      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('recipes.batchCostLabel') }}</div>
        <div class="text-sm text-gray-900 dark:text-gray-100">
          {{ draft.standard_unit_cost !== '' && draft.standard_unit_cost != null
             ? `€ ${Number(draft.standard_unit_cost).toFixed(2)}`
             : '—' }}
        </div>
        <div v-if="perUnitCost != null" class="text-xs text-gray-400 mt-0.5">
          = € {{ perUnitCost.toFixed(4) }} / {{ outputUnitCode }}
        </div>
      </div>

      <div class="flex gap-4">
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('recipes.active') }}</div>
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
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('recipes.preProduct') }}</div>
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

    <!-- ─── Basic fields (edit mode) ─────────────────────────────────────────── -->
    <div v-else class="space-y-3">

      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('recipes.name') }} *</label>
        <input v-model="draft.name"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('recipes.namePlaceholder')" autocomplete="off" />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('recipes.description') }}</label>
        <textarea v-model="draft.description" rows="2"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('recipes.descPlaceholder')" />
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('recipes.output') }} *</label>
          <input v-model="draft.output_quantity" type="number" min="0.001" step="any"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('recipes.outputQtyPlaceholder')" />
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">&nbsp;</label>
          <select v-model="draft.output_unit_id"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
            <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          {{ $t('recipes.batchCostLabel') }}
          <span class="font-normal normal-case tracking-normal ml-1">({{ draft.output_quantity || '?' }} {{ outputUnitCode || '?' }})</span>
        </label>
        <input v-model="draft.standard_unit_cost" type="number" min="0" step="any"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('recipes.stdCostPlaceholder')" />
        <p v-if="perUnitCost != null" class="text-xs text-gray-400 mt-0.5">= € {{ perUnitCost.toFixed(4) }} / {{ outputUnitCode }}</p>
        <button v-if="totalCost != null" type="button"
          class="mt-1 text-xs text-blue-500 hover:underline"
          @click="draft.standard_unit_cost = totalCost">
          {{ $t('recipes.autoFillFromComponents') }} (€ {{ totalCost.toFixed(2) }})
        </button>
      </div>

      <div class="flex gap-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="draft.is_active" type="checkbox" class="rounded border-gray-300 dark:border-gray-700" />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ $t('recipes.active') }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="draft.is_pre_product" type="checkbox" class="rounded border-gray-300 dark:border-gray-700" />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ $t('recipes.preProduct') }}</span>
        </label>
      </div>

      <!-- Save / Cancel -->
      <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
        <UButton v-if="!isNew" color="neutral" variant="soft" @click="cancelEdit">{{ $t('common.cancel') }}</UButton>
        <UButton :loading="saving" @click="saveBasic">{{ $t('common.save') }}</UButton>
      </div>

    </div>

    <!-- ─── Components section (available after first save) ─────────────────── -->
    <div v-if="savedId" class="pt-2">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 border-t border-gray-100 dark:border-gray-800 pt-3">
        {{ $t('recipes.componentsSection') }}
      </h3>

      <div v-if="detailLoading" class="text-xs text-gray-400 py-2">{{ $t('common.loading') }}</div>

      <div v-else>
        <!-- Component rows -->
        <div v-if="compUiRows.length > 0" class="overflow-x-auto rounded border border-gray-200 dark:border-gray-800 mb-2 text-xs">
          <table class="w-full border-separate border-spacing-0">
            <thead>
              <tr class="bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">
                <th class="text-left px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.name') }}</th>
                <th class="text-right px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.qty') }}</th>
                <th class="text-left px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.unit') }}</th>
                <th class="text-right px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.cost') }}</th>
                <th class="px-2 py-1 border-b border-gray-200 dark:border-gray-800"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in compUiRows" :key="row.id" class="border-b border-gray-100 dark:border-gray-900">
                <td class="px-2 py-1.5 text-gray-900 dark:text-gray-100">
                  <div class="font-medium">{{ row.name }}</div>
                  <div class="text-gray-400 text-[10px]">{{ row.type === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}</div>
                </td>
                <td class="px-2 py-1.5 text-right">
                  <input v-if="row._mode === 'edit'" v-model="row._draft!.quantity" type="number" min="0.001" step="any"
                    class="w-20 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-right text-gray-900
                           focus:outline-none focus:ring-1 focus:ring-gray-400
                           dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                  <span v-else class="text-gray-800 dark:text-gray-200">{{ row.quantity }}</span>
                </td>
                <td class="px-2 py-1.5">
                  <select v-if="row._mode === 'edit'" v-model="row._draft!.unit_id"
                    class="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs text-gray-900
                           focus:outline-none focus:ring-1 focus:ring-gray-400
                           dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                    <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
                  </select>
                  <span v-else class="text-gray-800 dark:text-gray-200">{{ row.unit_code }}</span>
                </td>
                <td class="px-2 py-1.5 text-right text-gray-600 dark:text-gray-400">{{ formatCost(componentCost(row)) }}</td>
                <td class="px-2 py-1.5 text-right whitespace-nowrap">
                  <AdminInlineRowActions
                    :mode="row._mode"
                    :can-edit="canManage" :can-delete="canManage"
                    @edit="startEditComp(row)" @save="saveComp(row)" @discard="discardComp(row)" @delete="requestDeleteComp(row)"
                  />
                </td>
              </tr>
            </tbody>
            <tfoot v-if="totalCost != null">
              <tr>
                <td colspan="3" class="px-2 py-1.5 text-right text-xs text-gray-400 uppercase tracking-wide font-semibold">{{ $t('recipes.totalCost') }}</td>
                <td class="px-2 py-1.5 text-right text-xs font-semibold text-gray-800 dark:text-gray-200">{{ formatCost(totalCost) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p v-else class="text-xs text-gray-400 py-1">{{ $t('recipes.noComponents') }}</p>

        <!-- Component search (edit mode) -->
        <div v-if="editMode" class="space-y-2">
          <div class="relative">
            <input
              v-model="compSearch"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                     focus:outline-none focus:ring-1 focus:ring-gray-400
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              :placeholder="$t('recipes.searchIngredientOrRecipe')"
              autocomplete="off"
              @blur="setTimeout(() => showDropdown = false, 150)"
              @focus="showDropdown = searchResults.length > 0 && compSearch.trim().length > 0"
            />
            <div v-if="showDropdown"
              class="absolute z-30 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 shadow-lg max-h-48 overflow-y-auto">
              <button
                v-for="item in searchResults" :key="item.id"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                @mousedown.prevent="selectSearchResult(item)"
              >
                <span class="flex-1 text-gray-900 dark:text-gray-100">{{ item.name }}</span>
                <span class="text-xs text-gray-400">{{ item.group === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}</span>
              </button>
            </div>
          </div>

          <!-- Pending component row -->
          <div v-if="pendingComp" class="rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-2 space-y-2">
            <div class="text-xs font-medium text-blue-700 dark:text-blue-300">{{ pendingComp.name }}</div>
            <div class="flex gap-2 items-end">
              <div class="flex-1">
                <label class="block text-xs text-gray-500 mb-0.5">{{ $t('recipes.qty') }}</label>
                <input v-model="pendingComp.quantity" type="number" min="0.001" step="any"
                  class="w-full rounded border border-gray-300 bg-white px-1.5 py-0.5 text-sm text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-400
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              </div>
              <div class="flex-1">
                <label class="block text-xs text-gray-500 mb-0.5">{{ $t('recipes.unit') }}</label>
                <select v-model="pendingComp.unit_id"
                  class="w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-sm text-gray-900
                         focus:outline-none focus:ring-1 focus:ring-gray-400
                         dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                  <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
                </select>
              </div>
              <UButton size="xs" @click="confirmAddComponent">{{ $t('common.add') }}</UButton>
              <UButton size="xs" color="neutral" variant="ghost" @click="cancelPendingComp">{{ $t('common.cancel') }}</UButton>
            </div>
            <p v-if="compError" class="text-xs text-red-600">{{ compError }}</p>
          </div>

          <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-plus" @click="isNewIngredientOpen = true">
            {{ $t('recipes.addIngredient') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- ─── Steps section ────────────────────────────────────────────────────── -->
    <div v-if="savedId" class="pt-2">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 border-t border-gray-100 dark:border-gray-800 pt-3">
        {{ $t('recipes.stepsSection') }}
      </h3>

      <ol class="space-y-1 mb-2">
        <li v-for="su in stepsUi" :key="su.step_no"
          class="flex items-start gap-2 text-sm"
        >
          <span class="flex-none text-gray-400 font-medium w-5 text-right pt-1">{{ su.step_no }}.</span>
          <div class="flex-1">
            <textarea v-if="su._editing" v-model="su._draft" rows="2"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                     focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
            <span v-else class="text-gray-800 dark:text-gray-200">{{ su.instruction_text }}</span>
          </div>
          <div v-if="editMode" class="flex items-center gap-0.5 pt-0.5">
            <template v-if="su._editing">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-check" @click="saveStep(su)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-x-mark" @click="discardEditStep(su)" />
            </template>
            <template v-else>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" @click="startEditStep(su)" />
              <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="requestDeleteStep(su)" />
            </template>
          </div>
        </li>
      </ol>
      <p v-if="stepsUi.length === 0" class="text-xs text-gray-400 py-1">{{ $t('recipes.noSteps') }}</p>

      <!-- Add step (edit mode) -->
      <div v-if="editMode && !addingStep">
        <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-plus" @click="addingStep = true">
          {{ $t('recipes.addStep') }}
        </UButton>
      </div>
      <div v-else-if="editMode && addingStep" class="space-y-2">
        <textarea v-model="newStepText" rows="2"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('recipes.instruction')" />
        <div class="flex gap-2">
          <UButton size="xs" @click="addStep">{{ $t('common.add') }}</UButton>
          <UButton size="xs" color="neutral" variant="ghost" @click="addingStep = false; newStepText = ''">{{ $t('common.cancel') }}</UButton>
        </div>
      </div>
    </div>

    <!-- ─── Modals ────────────────────────────────────────────────────────────── -->

    <AdminDeleteModal v-model:open="isDeleteCompOpen" :title="$t('recipes.deleteComponentTitle')" @confirm="confirmDeleteComp">
      <p>{{ $t('recipes.deleteComponentConfirm', { name: deletingComp?.name ?? '' }) }}</p>
    </AdminDeleteModal>

    <AdminDeleteModal v-model:open="isDeleteStepOpen" :title="$t('recipes.deleteStepTitle')" @confirm="confirmDeleteStep">
      <p>{{ $t('recipes.deleteStepConfirm', { no: deletingStep?.step_no ?? '' }) }}</p>
    </AdminDeleteModal>

    <AdminRecipeNewIngredientModal
      v-model:open="isNewIngredientOpen"
      :units="units"
      @created="onIngredientCreated"
    />

  </div>
</template>
