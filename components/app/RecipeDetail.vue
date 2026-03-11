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
  id: string; recipe_id: string | null; name: string; description: string
  output_quantity: number; output_unit_id: string; output_unit_code: string; output_unit_type: string
  standard_unit_cost: number | null
  is_active: boolean; is_pre_product: boolean
  component_count: number; created_at: string; updated_at: string
}

type UnitOption       = { id: string; code: string; name: string; unit_type: string }
type IngredientOption = { id: string; name: string; kind: string; default_unit_id: string; default_unit_type: string }
type AllergenOption   = { id: string; name: string; code: string | null }

type ComponentRow = {
  id: string; recipe_id: string
  ingredient_id: string | null; sub_recipe_id: string | null
  quantity: number; unit_id: string; unit_code: string
  sort_order: number; type: 'ingredient' | 'sub_recipe'; name: string
  std_cost: number | null; base_unit_factor: number | null; component_unit_factor: number | null
  yield_pct: number
}

// Local draft component — same shape but id may be null (new, not yet saved)
type DraftComp = ComponentRow & { _localId: string; id: string | null }

const props = defineProps<{
  recipe:      RecipeRow | null
  units:       UnitOption[]
  ingredients: IngredientOption[]
  allRecipes:  RecipeRow[]
  allergens:   AllergenOption[]
  canManage:   boolean
}>()

const emit = defineEmits<{
  (e: 'saved', id: string): void
  (e: 'deleted'): void
  (e: 'cancelled'): void
}>()

const { t, locale }  = useI18n()
const toast          = useToast()
const auth           = useAuth()
const { sourceLang, reload: reloadSourceLang } = useClientSettings()

// ─── editing locale ────────────────────────────────────────────────────────────
const SUPPORTED_LOCALES = ['de', 'en', 'ja']
const LOCALE_LABELS: Record<string, string> = { de: 'DE', en: 'EN', ja: 'JA' }
const editingLocale = ref('')
const isSourceEdit  = computed(() => !editingLocale.value || editingLocale.value === sourceLang.value)

const i18nDraft = reactive({ name: '', description: '', production_notes: '' })
const loadingI18n = ref(false)

async function switchEditingLocale(loc: string) {
  editingLocale.value = loc
  if (loc === sourceLang.value || !savedId.value) return
  loadingI18n.value = true
  try {
    const res = await $fetch<any>(
      `/api/recipes/${savedId.value}/i18n/${loc}`,
      { credentials: 'include' }
    )
    i18nDraft.name             = res.name             ?? ''
    i18nDraft.description      = res.description      ?? ''
    i18nDraft.production_notes = res.production_notes ?? ''
  } catch {
    i18nDraft.name             = ''
    i18nDraft.description      = ''
    i18nDraft.production_notes = ''
  } finally {
    loadingI18n.value = false
  }
}

// ─── translate ────────────────────────────────────────────────────────────────
const translating = ref(false)
async function translateItem() {
  if (!props.recipe?.id) return
  translating.value = true
  try {
    await $fetch('/api/admin/translations/item', {
      method: 'POST', credentials: 'include',
      body: { kind: 'recipe', id: props.recipe.id },
    })
    toast.add({ title: t('adminTranslations.translationDone') })
  } catch (e: any) {
    toast.add({ title: t('adminTranslations.translationFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'error' })
  } finally {
    translating.value = false
  }
}

// ─── mode ─────────────────────────────────────────────────────────────────────

const editMode         = ref(false)
const showEditSheet    = ref(false)
const confirmingDelete = ref(false)

const isNew = computed(() => !props.recipe)

// ─── basic fields draft ───────────────────────────────────────────────────────

const draft = reactive({
  recipe_id:                 '',
  name:                      '',
  description:               '',
  production_notes:          '',
  output_quantity:           '' as string | number,
  output_unit_id:            '',
  standard_unit_cost:        '' as string | number,
  is_active:                 true,
  is_pre_product:            false,
  name_translation_locked:   false,
})

const saving         = ref(false)
const savedId        = ref<string | null>(null)
const hasImage       = ref(false)
const imageUploading = ref(false)
const imageVersion   = ref(0)

// ─── sub-data ─────────────────────────────────────────────────────────────────

const components            = ref<ComponentRow[]>([])
const detailLoading         = ref(false)
const loadedProductionNotes = ref('')
const allergenIds           = ref<string[]>([])

const effectiveAllergens = computed(() =>
  props.allergens.filter(a => allergenIds.value.includes(a.id))
)

// ─── component draft state ────────────────────────────────────────────────────

const draftComps      = ref<DraftComp[]>([])
const removedCompIds  = ref<string[]>([])

// Local ingredient list (may grow when user creates new ingredients inline)
const localIngredients = ref<IngredientOption[]>([])
watch(() => props.ingredients, (v) => { localIngredients.value = [...v] }, { immediate: true })

// ─── component edit sub-sheet ─────────────────────────────────────────────────

const showCompEditSheet = ref(false)
const editingComp       = ref<DraftComp | null>(null)

function openCompEditSheet(comp: DraftComp | null) {
  editingComp.value      = comp
  showCompEditSheet.value = true
}

function onCompSheetClose() {
  showCompEditSheet.value = false
  editingComp.value       = null
}

function onCompSheetDone(result: {
  ingredient_id: string | null; sub_recipe_id: string | null
  name: string; quantity: number
  unit_id: string; unit_code: string
  type: 'ingredient' | 'sub_recipe'
}) {
  showCompEditSheet.value = false
  if (editingComp.value) {
    // Update existing draft
    const idx = draftComps.value.findIndex(c => c._localId === editingComp.value!._localId)
    if (idx !== -1) {
      draftComps.value[idx] = {
        ...draftComps.value[idx],
        ingredient_id: result.ingredient_id,
        sub_recipe_id: result.sub_recipe_id,
        name:          result.name,
        quantity:      result.quantity,
        unit_id:       result.unit_id,
        unit_code:     result.unit_code,
        type:          result.type,
      }
    }
  } else {
    // Add new draft
    const maxOrder = draftComps.value.reduce((m, c) => Math.max(m, c.sort_order), 0)
    draftComps.value.push({
      _localId:      'new-' + Date.now(),
      id:            null,
      recipe_id:     savedId.value ?? '',
      ingredient_id: result.ingredient_id,
      sub_recipe_id: result.sub_recipe_id,
      name:          result.name,
      quantity:      result.quantity,
      unit_id:       result.unit_id,
      unit_code:     result.unit_code,
      sort_order:    maxOrder + 1,
      type:          result.type,
      std_cost:      null,
      base_unit_factor:      null,
      component_unit_factor: null,
    })
  }
  editingComp.value = null
}

function onCompSheetRemove() {
  showCompEditSheet.value = false
  if (!editingComp.value) return
  const comp = editingComp.value
  // Queue DB deletion if it has a real ID
  if (comp.id) removedCompIds.value.push(comp.id)
  draftComps.value = draftComps.value.filter(c => c._localId !== comp._localId)
  editingComp.value = null
}

function onIngredientCreated(ing: IngredientOption) {
  if (!localIngredients.value.find(i => i.id === ing.id)) {
    localIngredients.value.push(ing)
  }
}

// ─── swipe-to-delete ─────────────────────────────────────────────────────────

const swipeOffsets: Record<string, number> = reactive({})
const swipingId        = ref<string | null>(null)
const swipeTouchStartX = ref(0)
const didSwipeMove     = ref(false)
const SWIPE_THRESHOLD  = 55

function onSwipeTouchStart(e: TouchEvent, localId: string) {
  // Close any other open swipe
  if (swipingId.value && swipingId.value !== localId) {
    swipeOffsets[swipingId.value] = 0
  }
  swipingId.value        = localId
  swipeTouchStartX.value = e.touches[0].clientX
  didSwipeMove.value     = false
}

function onSwipeTouchMove(e: TouchEvent, localId: string) {
  if (swipingId.value !== localId) return
  const dx = e.touches[0].clientX - swipeTouchStartX.value
  if (Math.abs(dx) > 5) didSwipeMove.value = true
  swipeOffsets[localId] = Math.max(-80, Math.min(0, dx))
}

function onSwipeTouchEnd(_e: TouchEvent, localId: string) {
  if (swipingId.value !== localId) return
  const offset = swipeOffsets[localId] ?? 0
  swipeOffsets[localId] = offset < -SWIPE_THRESHOLD ? -80 : 0
  swipingId.value = null
}

function onRowClick(comp: DraftComp) {
  if (didSwipeMove.value) { didSwipeMove.value = false; return }
  const offset = swipeOffsets[comp._localId] ?? 0
  if (offset !== 0) { swipeOffsets[comp._localId] = 0; return }
  openCompEditSheet(comp)
}

function swipeDeleteComp(comp: DraftComp) {
  swipeOffsets[comp._localId] = 0
  if (comp.id) removedCompIds.value.push(comp.id)
  draftComps.value = draftComps.value.filter(c => c._localId !== comp._localId)
  delete swipeOffsets[comp._localId]
}

// ─── reset when recipe prop changes ──────────────────────────────────────────

watch(
  () => props.recipe,
  async (recipe) => {
    confirmingDelete.value = false
    components.value       = []
    hasImage.value         = false

    if (recipe) {
      editMode.value      = false
      showEditSheet.value = false
      savedId.value    = recipe.id
      const loadQty    = Number(recipe.output_quantity) || 1
      draft.recipe_id          = recipe.recipe_id ?? ''
      draft.name               = recipe.name
      draft.description        = recipe.description ?? ''
      draft.output_quantity    = recipe.output_quantity
      draft.output_unit_id     = recipe.output_unit_id
      draft.standard_unit_cost = recipe.standard_unit_cost != null
        ? recipe.standard_unit_cost * loadQty
        : ''
      draft.is_active                = recipe.is_active
      draft.is_pre_product           = recipe.is_pre_product
      draft.name_translation_locked  = (recipe as any).name_translation_locked ?? false
      await loadDetail(recipe.id)
    } else {
      // New recipe
      editMode.value           = true
      savedId.value            = null
      draft.recipe_id          = ''
      draft.name               = ''
      draft.description        = ''
      draft.production_notes   = ''
      draft.output_quantity    = ''
      draft.output_unit_id     = props.units[0]?.id ?? ''
      draft.standard_unit_cost = ''
      draft.is_active          = true
      draft.is_pre_product     = false
      draftComps.value         = []
      removedCompIds.value     = []
    }
  },
  { immediate: true }
)

async function loadDetail(id: string) {
  detailLoading.value = true
  try {
    const res = await $fetch<{ ok: boolean; recipe: any; components: ComponentRow[] }>(
      `/api/recipes/${id}?locale=${locale.value}`, { credentials: 'include' }
    )
    components.value = res.components
    hasImage.value   = res.recipe?.has_image ?? false
    draft.production_notes       = res.recipe?.production_notes ?? ''
    loadedProductionNotes.value  = res.recipe?.production_notes ?? ''
    allergenIds.value            = res.recipe?.allergen_ids ?? []
    // Sync draft comps from fresh DB state (only when not mid-edit)
    if (!showEditSheet.value) {
      syncDraftCompsFromDb()
    }
  } catch (e: any) {
    toast.add({ title: t('recipes.loadError'), description: e?.data?.statusMessage ?? e?.message, color: 'red' })
  } finally {
    detailLoading.value = false
  }
}

function syncDraftCompsFromDb() {
  draftComps.value     = components.value.map(c => ({ ...c, _localId: c.id }))
  removedCompIds.value = []
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

// ─── save components ──────────────────────────────────────────────────────────

async function saveComponents(recipeId: string) {
  // Delete removed
  for (const id of removedCompIds.value) {
    await $fetch(`/api/recipes/${recipeId}/components/${id}`,
      { method: 'DELETE', credentials: 'include' })
  }
  removedCompIds.value = []

  // Upsert all remaining draft comps
  for (const comp of draftComps.value) {
    if (comp.id) {
      await $fetch(`/api/recipes/${recipeId}/components/${comp.id}`, {
        method: 'PUT', credentials: 'include',
        body: { quantity: comp.quantity, unit_id: comp.unit_id },
      })
    } else {
      await $fetch(`/api/recipes/${recipeId}/components`, {
        method: 'POST', credentials: 'include',
        body: {
          ingredient_id: comp.ingredient_id,
          sub_recipe_id: comp.sub_recipe_id,
          quantity:      comp.quantity,
          unit_id:       comp.unit_id,
          sort_order:    comp.sort_order,
        },
      })
    }
  }
}

// ─── save basic fields ────────────────────────────────────────────────────────

async function saveBasic() {
  // ── Non-source locale: save only translation fields ──
  if (!isSourceEdit.value && savedId.value) {
    saving.value = true
    try {
      await $fetch(`/api/recipes/${savedId.value}/i18n/${editingLocale.value}`, {
        method: 'PUT', credentials: 'include',
        body: {
          name:             draft.name_translation_locked ? undefined : (i18nDraft.name.trim() || null),
          description:      i18nDraft.description.trim()      || null,
          production_notes: i18nDraft.production_notes.trim() || null,
        },
      })
      toast.add({ title: t('recipes.updated') })
      editMode.value      = false
      showEditSheet.value = false
      emit('saved', savedId.value)
    } catch (e: any) {
      toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
    } finally {
      saving.value = false
    }
    return
  }

  // ── Source locale: save main record ──
  const qty = Number(draft.output_quantity)
  if (!draft.name.trim() || !draft.output_unit_id || !(qty > 0)) {
    toast.add({ title: t('common.missingFields'), description: t('recipes.nameRequired'), color: 'red' })
    return
  }
  saving.value = true
  try {
    const costRaw = String(draft.standard_unit_cost).trim()
    const body = {
      recipe_id:                draft.recipe_id.trim() || null,
      name:                     draft.name.trim(),
      description:              draft.description.trim() || null,
      production_notes:         draft.production_notes.trim() || null,
      output_quantity:          qty,
      output_unit_id:           draft.output_unit_id,
      standard_unit_cost:       costRaw === '' ? null : Number(costRaw) / qty,
      is_active:                draft.is_active,
      is_pre_product:           draft.is_pre_product,
      name_translation_locked:  draft.name_translation_locked,
    }
    if (savedId.value) {
      await $fetch(`/api/recipes/${savedId.value}`, { method: 'PUT', credentials: 'include', body })
      await saveComponents(savedId.value)
      toast.add({
        title:   t('recipes.updated'),
        actions: auth.is_admin ? [{ label: t('adminTranslations.translateNow'), onClick: translateItem }] : undefined,
      })
      editMode.value      = false
      showEditSheet.value = false
      await loadDetail(savedId.value)
      emit('saved', savedId.value)
    } else {
      const res = await $fetch<{ ok: boolean; recipe: { id: string } }>(
        '/api/recipes', { method: 'POST', credentials: 'include', body }
      )
      savedId.value = res.recipe.id
      await saveComponents(res.recipe.id)
      toast.add({ title: t('recipes.created') })
      await loadDetail(res.recipe.id)
      emit('saved', res.recipe.id)
    }
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally {
    saving.value = false
  }
}

async function startEdit() {
  await reloadSourceLang()
  editingLocale.value = sourceLang.value || 'de'

  // Re-fetch source data (no locale param) so draft always holds source values
  if (savedId.value) {
    try {
      const res = await $fetch<{ ok: boolean; recipe: any; components: ComponentRow[] }>(
        `/api/recipes/${savedId.value}`, { credentials: 'include' }
      )
      draft.name               = res.recipe?.name               ?? draft.name
      draft.description        = res.recipe?.description        ?? ''
      draft.production_notes   = res.recipe?.production_notes   ?? ''
      draft.name_translation_locked = res.recipe?.name_translation_locked ?? false
      loadedProductionNotes.value   = draft.production_notes
    } catch { /* non-fatal */ }
  }

  // Sync draft comps from current DB state before opening edit sheet
  syncDraftCompsFromDb()
  editMode.value      = true
  showEditSheet.value = true
}

function cancelEdit() {
  if (isNew.value) { emit('cancelled'); return }
  if (props.recipe) {
    const r = props.recipe
    const loadQty = Number(r.output_quantity) || 1
    draft.recipe_id          = r.recipe_id ?? ''
    draft.name               = r.name
    draft.description        = r.description ?? ''
    draft.output_quantity    = r.output_quantity
    draft.output_unit_id     = r.output_unit_id
    draft.standard_unit_cost = r.standard_unit_cost != null ? r.standard_unit_cost * loadQty : ''
    draft.is_active                = r.is_active
    draft.is_pre_product           = r.is_pre_product
    draft.name_translation_locked  = (r as any).name_translation_locked ?? false
    draft.production_notes         = loadedProductionNotes.value
    // Revert component drafts to DB state
    syncDraftCompsFromDb()
    editMode.value      = false
    showEditSheet.value = false
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

// ─── cost helpers ─────────────────────────────────────────────────────────────

function componentCost(comp: ComponentRow): number | null {
  if (comp.std_cost == null || comp.base_unit_factor == null || comp.component_unit_factor == null) return null
  if (comp.base_unit_factor === 0) return null
  const yld = (comp.yield_pct ?? 100) / 100
  return comp.quantity * (comp.component_unit_factor / comp.base_unit_factor) * comp.std_cost / yld
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

// Cost for draft comps (no cost data for new unsaved comps)
const draftTotalCost = computed((): number | null => {
  const costs = draftComps.value
    .filter(c => c.id !== null)  // only saved comps have cost data
    .map(c => componentCost(c as ComponentRow))
    .filter((c): c is number => c !== null)
  if (costs.length === 0) return null
  return costs.reduce((a, b) => a + b, 0)
})

const outputUnitCode = computed(() =>
  props.units.find(u => u.id === draft.output_unit_id)?.code ?? ''
)

const outputUnitType = computed(() =>
  props.units.find(u => u.id === draft.output_unit_id)?.unit_type ?? 'count'
)

const costDisplayScale = computed(() =>
  (outputUnitType.value === 'mass' || outputUnitType.value === 'volume') ? 100 : 1
)

const costDisplayLabel = computed(() => {
  if (outputUnitType.value === 'mass')   return '100g'
  if (outputUnitType.value === 'volume') return '100ml'
  return outputUnitCode.value
})

const perUnitCost = computed((): number | null => {
  const batch = Number(draft.standard_unit_cost)
  const qty   = Number(draft.output_quantity)
  if (!batch || !qty) return null
  return (batch / qty) * costDisplayScale.value
})

// ─── print ────────────────────────────────────────────────────────────────────

const { printHtml } = usePrint()

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
      <td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:11px">${c.type === 'ingredient' ? t('recipes.typeIngredient') : t('recipes.typeSubRecipe')}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${c.quantity}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #f3f4f6">${esc(c.unit_code)}</td>
      <td style="padding:5px 0 5px 10px;border-bottom:1px solid #f3f4f6;text-align:right">${formatCost(componentCost(c))}</td>
    </tr>`
  ).join('')

  printHtml(`<!DOCTYPE html><html lang="${locale.value}"><head><meta charset="UTF-8"><title>${esc(draft.name)} — Zenpire</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;font-size:14px;color:#111827;background:#fff;padding:24px}
h1{font-size:24px;font-weight:700;margin-bottom:6px}h2{font-size:15px;font-weight:600;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:24px 0 10px}
.desc{color:#4b5563;margin-bottom:16px;line-height:1.6}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-bottom:24px;clear:both}
.meta label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:600;display:block;margin-bottom:2px}
table{width:100%;border-collapse:collapse;font-size:13px}thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:600;padding:4px 10px 8px 0;border-bottom:1px solid #e5e7eb}
.footer{margin-top:32px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af}
@media print{@page{margin:1.5cm}}</style></head>
<body>
${imgTag}<h1>${esc(draft.name)}</h1>
${draft.description ? `<p class="desc">${esc(draft.description)}</p>` : ''}
<div class="meta">
  <div><label>${t('recipes.output')}</label><span>${draft.output_quantity} ${esc(outputUnitCode.value)}</span></div>
  ${draft.standard_unit_cost !== '' && draft.standard_unit_cost != null
    ? `<div><label>${t('recipes.batchCostLabel')}</label><span>€ ${Number(draft.standard_unit_cost).toFixed(2)}</span></div>` : ''}
  <div><label>${t('recipes.status')}</label><span>${draft.is_active ? t('recipes.active') : t('recipes.inactive')}${draft.is_pre_product ? ' · ' + t('recipes.preProduct') : ''}</span></div>
  ${totalCost.value != null ? `<div><label>${t('recipes.totalCost')}</label><span>${formatCost(totalCost.value)}</span></div>` : ''}
</div>
${components.value.length > 0 ? `<h2>${t('recipes.componentsSection')}</h2><table><thead><tr><th>${t('recipes.name')}</th><th>${t('recipes.type')}</th><th style="text-align:right">${t('recipes.qty')}</th><th>${t('recipes.unit')}</th><th style="text-align:right">${t('recipes.compCost')}</th></tr></thead><tbody>${compRows}</tbody></table>` : ''}
${draft.production_notes ? `<h2>${t('recipes.productionNotes')}</h2><p style="white-space:pre-wrap;line-height:1.6;color:#374151">${esc(draft.production_notes)}</p>` : ''}
<div class="footer">Zenpire Inventory — ${t('common.printedOn')} ${new Date().toLocaleString(locale.value)}</div>
</body></html>`)
}

// ─── banner (show mode) ───────────────────────────────────────────────────────

const bannerLightboxOpen = ref(false)
const bannerFileInputRef  = ref<HTMLInputElement | null>(null)

function onBannerFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  if (file) {
    uploadImage(file)
    input.value = ''
  }
}
</script>

<template>
  <div class="p-4 space-y-4">

    <!-- ─── New mode: sticky iOS nav bar ────────────────────────────────────── -->
    <div v-if="isNew" class="sticky top-0 z-10 -mx-4 -mt-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 min-h-[44px]">
      <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
      <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('recipes.newTitle') }}</span>
      <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="saveBasic">{{ $t('common.save') }}</button>
    </div>

    <!-- ─── View mode: sticky iOS nav bar ───────────────────────────────────── -->
    <div v-if="!isNew" class="sticky top-0 z-10 -mx-4 -mt-4 relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end px-2 min-h-[44px]">
      <h2 class="absolute inset-x-0 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 px-28 truncate pointer-events-none">{{ draft.name }}</h2>
      <div class="relative z-10 flex items-center">
        <button v-if="canManage" class="w-9 h-9 flex items-center justify-center text-[#007AFF] dark:text-blue-400 active:opacity-50" @click="startEdit">
          <UIcon name="i-heroicons-pencil-square" class="w-5 h-5" />
        </button>
        <button
          v-if="auth.is_admin && !isNew"
          class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50"
          :class="{ 'opacity-50 pointer-events-none': translating }"
          :title="$t('adminTranslations.translateItem')"
          @click="translateItem"
        >
          <UIcon v-if="translating" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
          <UIcon v-else name="i-heroicons-language" class="w-5 h-5" />
        </button>
        <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="printRecipe">
          <UIcon name="i-heroicons-printer" class="w-5 h-5" />
        </button>
        <button v-if="canManage" class="w-9 h-9 flex items-center justify-center text-red-500 active:opacity-50" @click="confirmingDelete = true">
          <UIcon name="i-heroicons-trash" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         SHOW MODE
         ═══════════════════════════════════════════════════════════════════════ -->
    <template v-if="!isNew">

      <!-- Banner image: full-bleed, 25vh -->
      <div
        class="-mx-4 overflow-hidden relative bg-gray-100 dark:bg-gray-800"
        style="height: 25vh; min-height: 160px"
        :class="imageUrl ? 'cursor-zoom-in' : ''"
        @click="imageUrl && (bannerLightboxOpen = true)"
      >
        <img v-if="imageUrl" :src="imageUrl" class="w-full h-full object-cover" alt="" />
        <div v-else class="w-full h-full flex items-center justify-center">
          <UIcon name="i-heroicons-photo" class="w-14 h-14 text-gray-300 dark:text-gray-700" />
        </div>
        <button
          v-if="canManage"
          class="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/50 text-white backdrop-blur-sm active:bg-black/70"
          @click.stop="bannerFileInputRef?.click()"
        >
          <UIcon name="i-heroicons-camera" class="w-3.5 h-3.5" />
          {{ imageUrl ? $t('common.replaceImage') : $t('common.uploadImage') }}
        </button>
        <input ref="bannerFileInputRef" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onBannerFileChange" />
      </div>

      <!-- Name -->
      <h1 class="text-[26px] font-bold text-gray-900 dark:text-gray-100 leading-tight">{{ draft.name }}</h1>

      <!-- Recipe ID -->
      <p v-if="draft.recipe_id" class="text-[13px] text-gray-400 dark:text-gray-500 font-mono -mt-2">{{ draft.recipe_id }}</p>

      <!-- Description -->
      <p v-if="draft.description" class="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{{ draft.description }}</p>

      <!-- Flags row -->
      <div class="flex items-center gap-2 flex-wrap">
        <span
          class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
          :class="draft.is_active
            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
        >
          {{ draft.is_active ? $t('recipes.active') : $t('units.no') }}
        </span>
        <span
          v-if="draft.is_pre_product"
          class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
        >
          {{ $t('recipes.preProduct') }}
        </span>
      </div>

      <!-- Batch row: output tile + cost tile -->
      <div class="flex gap-3">
        <div class="flex-1 bg-gray-50 dark:bg-gray-800/60 rounded-2xl px-4 py-3">
          <div class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{{ $t('recipes.output') }}</div>
          <div class="text-[17px] font-semibold text-gray-900 dark:text-gray-100">{{ draft.output_quantity }} {{ outputUnitCode }}</div>
        </div>
        <div class="flex-1 bg-gray-50 dark:bg-gray-800/60 rounded-2xl px-4 py-3">
          <div class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{{ $t('recipes.batchCostLabel') }}</div>
          <div class="text-[17px] font-semibold text-gray-900 dark:text-gray-100">
            {{ draft.standard_unit_cost !== '' && draft.standard_unit_cost != null
               ? `€ ${Number(draft.standard_unit_cost).toFixed(2)}` : '—' }}
          </div>
          <div v-if="perUnitCost != null" class="text-[11px] text-gray-400 mt-0.5">
            € {{ perUnitCost.toFixed(4) }} / {{ costDisplayLabel }}
          </div>
        </div>
      </div>

      <!-- Components section (read-only) -->
      <div v-if="savedId" class="pt-1">
        <div class="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 mb-2">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ $t('recipes.componentsSection') }}
          </h3>
        </div>
        <div v-if="detailLoading" class="text-xs text-gray-400 py-2">{{ $t('common.loading') }}</div>
        <div v-else>
          <div v-if="components.length > 0" class="overflow-x-auto rounded border border-gray-200 dark:border-gray-800 mb-2 text-xs">
            <table class="w-full border-separate border-spacing-0">
              <thead>
                <tr class="bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">
                  <th class="text-left px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.name') }}</th>
                  <th class="text-right px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.qty') }}</th>
                  <th class="text-left px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.unit') }}</th>
                  <th class="text-right px-2 py-1 font-medium border-b border-gray-200 dark:border-gray-800">{{ $t('recipes.cost') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in components" :key="row.id" class="border-b border-gray-100 dark:border-gray-900">
                  <td class="px-2 py-1.5 text-gray-900 dark:text-gray-100">
                    <div class="font-medium">{{ row.name }}</div>
                    <div class="text-gray-400 text-[10px]">{{ row.type === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}</div>
                  </td>
                  <td class="px-2 py-1.5 text-right text-gray-800 dark:text-gray-200">{{ row.quantity }}</td>
                  <td class="px-2 py-1.5 text-gray-800 dark:text-gray-200">{{ row.unit_code }}</td>
                  <td class="px-2 py-1.5 text-right text-gray-600 dark:text-gray-400">{{ formatCost(componentCost(row)) }}</td>
                </tr>
              </tbody>
              <tfoot v-if="totalCost != null">
                <tr>
                  <td colspan="3" class="px-2 py-1.5 text-right text-xs text-gray-400 uppercase tracking-wide font-semibold">{{ $t('recipes.totalCost') }}</td>
                  <td class="px-2 py-1.5 text-right text-xs font-semibold text-gray-800 dark:text-gray-200">{{ formatCost(totalCost) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p v-else class="text-xs text-gray-400 py-1">{{ $t('recipes.noComponents') }}</p>
        </div>
      </div>

      <!-- Production notes -->
      <div v-if="draft.production_notes" class="pt-1">
        <div class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{{ $t('recipes.productionNotes') }}</div>
        <div class="text-[15px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{{ draft.production_notes }}</div>
      </div>

      <!-- Allergens (always shown, read-only) -->
      <div class="pt-1">
        <div class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{{ $t('recipes.allergens') }}</div>
        <div v-if="detailLoading" class="text-xs text-gray-400">{{ $t('common.loading') }}</div>
        <div v-else-if="effectiveAllergens.length === 0" class="text-sm text-gray-400">—</div>
        <div v-else class="flex flex-wrap gap-1.5">
          <span
            v-for="al in effectiveAllergens" :key="al.id"
            class="rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          >{{ al.name }}</span>
        </div>
      </div>

    </template>

    <!-- ═══════════════════════════════════════════════════════════════════════
         NEW MODE: inline form
         ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="isNew" class="space-y-5">

      <div>
        <label class="ios-label">{{ $t('recipes.name') }} *</label>
        <input v-model="draft.name" class="ios-input" :placeholder="$t('recipes.namePlaceholder')" autocomplete="off" />
      </div>

      <div>
        <label class="ios-label">{{ $t('recipes.recipeId') }}</label>
        <input v-model="draft.recipe_id" class="ios-input font-mono" :placeholder="$t('recipes.recipeIdPlaceholder')" autocomplete="off" />
      </div>

      <div>
        <label class="ios-label">{{ $t('recipes.description') }}</label>
        <textarea v-model="draft.description" rows="2" class="ios-input resize-none" :placeholder="$t('recipes.descPlaceholder')" />
      </div>

      <!-- Flags row -->
      <div class="flex gap-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="draft.is_active" type="checkbox" class="rounded border-gray-300 dark:border-gray-700" />
          <span class="text-[17px] text-gray-700 dark:text-gray-300">{{ $t('recipes.active') }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="draft.is_pre_product" type="checkbox" class="rounded border-gray-300 dark:border-gray-700" />
          <span class="text-[17px] text-gray-700 dark:text-gray-300">{{ $t('recipes.preProduct') }}</span>
        </label>
      </div>

      <!-- Batch row: qty + unit + cost in one row -->
      <div>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="ios-label">{{ $t('recipes.output') }} *</label>
            <input v-model="draft.output_quantity" type="number" min="0.001" step="any" class="ios-input" :placeholder="$t('recipes.outputQtyPlaceholder')" />
          </div>
          <div class="flex-1">
            <label class="ios-label">&nbsp;</label>
            <select v-model="draft.output_unit_id" class="ios-input">
              <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
            </select>
          </div>
          <div class="flex-1">
            <label class="ios-label">{{ $t('recipes.batchCostLabel') }}</label>
            <input v-model="draft.standard_unit_cost" type="number" min="0" step="any" class="ios-input" :placeholder="$t('recipes.stdCostPlaceholder')" />
          </div>
        </div>
        <p v-if="perUnitCost != null" class="text-xs text-gray-400 mt-1">= € {{ perUnitCost.toFixed(4) }} / {{ costDisplayLabel }}</p>
        <button v-if="draftTotalCost != null" type="button" class="mt-1 text-xs text-blue-500 hover:underline" @click="draft.standard_unit_cost = draftTotalCost">
          {{ $t('recipes.autoFillFromComponents') }} (€ {{ draftTotalCost.toFixed(2) }})
        </button>
      </div>

      <!-- Components section (new recipe inline) -->
      <div class="pt-2">
        <div class="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 mb-1">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ $t('recipes.componentsSection') }}
          </h3>
        </div>
        <div v-if="draftComps.length > 0" class="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-2">
          <div
            v-for="comp in draftComps" :key="comp._localId"
            class="relative overflow-hidden border-b border-gray-100 dark:border-gray-800 last:border-b-0"
          >
            <div
              class="flex items-center px-4 py-3 bg-white dark:bg-gray-900 select-none cursor-pointer active:bg-gray-50 dark:active:bg-gray-800"
              :style="{ transform: `translateX(${swipeOffsets[comp._localId] ?? 0}px)`, transition: swipingId === comp._localId ? 'none' : 'transform 0.2s ease' }"
              @touchstart="onSwipeTouchStart($event, comp._localId)"
              @touchmove="onSwipeTouchMove($event, comp._localId)"
              @touchend="onSwipeTouchEnd($event, comp._localId)"
              @click="onRowClick(comp)"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ comp.name }}</div>
                <div class="text-xs text-gray-400">{{ comp.type === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}</div>
              </div>
              <div class="flex-none flex items-center gap-1.5 ml-3 text-gray-500 dark:text-gray-400">
                <span class="text-sm">{{ comp.quantity }} {{ comp.unit_code }}</span>
                <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-300 dark:text-gray-600" />
              </div>
            </div>
            <button class="absolute right-0 top-0 bottom-0 w-20 bg-red-500 text-white text-sm font-medium active:bg-red-600" @click.stop="swipeDeleteComp(comp)">{{ $t('common.delete') }}</button>
          </div>
        </div>
        <button
          class="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm text-[#007AFF] dark:text-blue-400 active:bg-gray-50 dark:active:bg-gray-800"
          @click="openCompEditSheet(null)"
        >
          <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
          {{ $t('recipes.addComponent') }}
        </button>
      </div>

      <!-- Production notes (last) -->
      <div>
        <label class="ios-label">{{ $t('recipes.productionNotes') }}</label>
        <textarea v-model="draft.production_notes" rows="3" class="ios-input resize-none" :placeholder="$t('recipes.productionNotesPlaceholder')" />
      </div>

    </div>

  </div>

  <!-- ─── Edit sheet (existing recipe) ──────────────────────────────────────── -->
  <AppBottomSheet :open="showEditSheet" @close="cancelEdit">
    <!-- Sticky iOS nav bar -->
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 min-h-[44px]">
        <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
        <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('recipes.editTitle') }}</span>
        <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="saveBasic">{{ $t('common.save') }}</button>
      </div>
      <!-- Locale pill selector -->
      <div class="flex gap-1.5 px-4 pb-2">
        <button
          v-for="loc in SUPPORTED_LOCALES"
          :key="loc"
          class="px-2.5 py-0.5 text-xs rounded-full border transition-colors"
          :class="editingLocale === loc
            ? 'bg-blue-500 text-white border-blue-500'
            : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'"
          @click="switchEditingLocale(loc)"
        >
          {{ LOCALE_LABELS[loc] }}<span v-if="loc === sourceLang" class="ml-0.5 opacity-60 text-[9px]">↑</span>
        </button>
      </div>
    </div>

    <div class="p-4 space-y-5">

      <!-- ── Source locale edit (full form) ── -->
      <template v-if="isSourceEdit">

        <!-- Image (compact) at top -->
        <AdminImageUpload
          v-if="savedId"
          :image-url="imageUrl"
          :uploading="imageUploading"
          :can-manage="canManage"
          @upload="uploadImage"
          @remove="removeImage"
        />

        <!-- Name -->
        <div>
          <label class="ios-label">{{ $t('recipes.name') }} *</label>
          <input v-model="draft.name" class="ios-input" :placeholder="$t('recipes.namePlaceholder')" autocomplete="off" />
          <label class="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
            <input type="checkbox" v-model="draft.name_translation_locked" class="rounded" />
            <span class="text-[12px] text-gray-500 dark:text-gray-400">{{ $t('adminTranslations.lockName') }}</span>
          </label>
        </div>

        <!-- Recipe ID -->
        <div>
          <label class="ios-label">{{ $t('recipes.recipeId') }}</label>
          <input v-model="draft.recipe_id" class="ios-input font-mono" :placeholder="$t('recipes.recipeIdPlaceholder')" autocomplete="off" />
        </div>

        <!-- Description -->
        <div>
          <label class="ios-label">{{ $t('recipes.description') }}</label>
          <textarea v-model="draft.description" rows="2" class="ios-input resize-none" :placeholder="$t('recipes.descPlaceholder')" />
        </div>

        <!-- Flags row -->
        <div class="flex gap-6">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="draft.is_active" type="checkbox" class="rounded border-gray-300 dark:border-gray-700" />
            <span class="text-[17px] text-gray-700 dark:text-gray-300">{{ $t('recipes.active') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="draft.is_pre_product" type="checkbox" class="rounded border-gray-300 dark:border-gray-700" />
            <span class="text-[17px] text-gray-700 dark:text-gray-300">{{ $t('recipes.preProduct') }}</span>
          </label>
        </div>

        <!-- Batch row: qty + unit + cost in one row -->
        <div>
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="ios-label">{{ $t('recipes.output') }} *</label>
              <input v-model="draft.output_quantity" type="number" min="0.001" step="any" class="ios-input" :placeholder="$t('recipes.outputQtyPlaceholder')" />
            </div>
            <div class="flex-1">
              <label class="ios-label">&nbsp;</label>
              <select v-model="draft.output_unit_id" class="ios-input">
                <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="ios-label">{{ $t('recipes.batchCostLabel') }}</label>
              <input v-model="draft.standard_unit_cost" type="number" min="0" step="any" class="ios-input" :placeholder="$t('recipes.stdCostPlaceholder')" />
            </div>
          </div>
          <p v-if="perUnitCost != null" class="text-xs text-gray-400 mt-1">= € {{ perUnitCost.toFixed(4) }} / {{ costDisplayLabel }}</p>
          <button v-if="totalCost != null" type="button" class="mt-1 text-xs text-blue-500 hover:underline" @click="draft.standard_unit_cost = totalCost">
            {{ $t('recipes.autoFillFromComponents') }} (€ {{ totalCost.toFixed(2) }})
          </button>
        </div>

        <!-- Components section (edit sheet) -->
        <div class="pt-2">
          <div class="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 mb-1">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ $t('recipes.componentsSection') }}</h3>
          </div>
          <div v-if="draftComps.length > 0" class="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-2">
            <div
              v-for="comp in draftComps" :key="comp._localId"
              class="relative overflow-hidden border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              <div
                class="flex items-center px-4 py-3 bg-white dark:bg-gray-900 select-none cursor-pointer active:bg-gray-50 dark:active:bg-gray-800"
                :style="{ transform: `translateX(${swipeOffsets[comp._localId] ?? 0}px)`, transition: swipingId === comp._localId ? 'none' : 'transform 0.2s ease' }"
                @touchstart="onSwipeTouchStart($event, comp._localId)"
                @touchmove="onSwipeTouchMove($event, comp._localId)"
                @touchend="onSwipeTouchEnd($event, comp._localId)"
                @click="onRowClick(comp)"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ comp.name }}</div>
                  <div class="text-xs text-gray-400">{{ comp.type === 'ingredient' ? $t('recipes.typeIngredient') : $t('recipes.typeSubRecipe') }}</div>
                </div>
                <div class="flex-none flex items-center gap-1.5 ml-3 text-gray-500 dark:text-gray-400">
                  <span class="text-sm">{{ comp.quantity }} {{ comp.unit_code }}</span>
                  <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-300 dark:text-gray-600" />
                </div>
              </div>
              <button class="absolute right-0 top-0 bottom-0 w-20 bg-red-500 text-white text-sm font-medium active:bg-red-600" @click.stop="swipeDeleteComp(comp)">{{ $t('common.delete') }}</button>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400 py-1">{{ $t('recipes.noComponents') }}</p>
          <button
            class="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm text-[#007AFF] dark:text-blue-400 active:bg-gray-50 dark:active:bg-gray-800"
            @click="openCompEditSheet(null)"
          >
            <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
            {{ $t('recipes.addComponent') }}
          </button>
        </div>

        <!-- Production notes -->
        <div>
          <label class="ios-label">{{ $t('recipes.productionNotes') }}</label>
          <textarea v-model="draft.production_notes" rows="3" class="ios-input resize-none" :placeholder="$t('recipes.productionNotesPlaceholder')" />
        </div>

        <!-- Allergens (read-only info) -->
        <div v-if="effectiveAllergens.length > 0">
          <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ $t('recipes.allergens') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="al in effectiveAllergens" :key="al.id"
              class="rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >{{ al.name }}</span>
          </div>
        </div>

      </template>

      <!-- ── Non-source locale edit (translatable fields only) ── -->
      <template v-else>
        <div v-if="loadingI18n" class="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">{{ $t('common.loading') }}</div>
        <template v-else>

          <!-- Name -->
          <div>
            <label class="ios-label">{{ $t('recipes.name') }}</label>
            <div class="mb-1.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-[13px] text-gray-400 dark:text-gray-500 italic">
              {{ draft.name || '—' }}
            </div>
            <div v-if="draft.name_translation_locked" class="flex items-center gap-1.5 text-[13px] text-amber-600 dark:text-amber-400">
              <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5" />
              {{ $t('adminTranslations.nameLocked') }}
            </div>
            <input v-else v-model="i18nDraft.name"
              class="ios-input"
              :placeholder="$t('recipes.namePlaceholder')" autocomplete="off" />
          </div>

          <!-- Description -->
          <div>
            <label class="ios-label">{{ $t('recipes.description') }}</label>
            <div v-if="draft.description" class="mb-1.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-[13px] text-gray-400 dark:text-gray-500 italic whitespace-pre-wrap">{{ draft.description }}</div>
            <textarea v-model="i18nDraft.description" rows="2" class="ios-input resize-none" :placeholder="$t('recipes.descPlaceholder')" />
          </div>

          <!-- Production notes -->
          <div>
            <label class="ios-label">{{ $t('recipes.productionNotes') }}</label>
            <div v-if="draft.production_notes" class="mb-1.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-[13px] text-gray-400 dark:text-gray-500 italic whitespace-pre-wrap">{{ draft.production_notes }}</div>
            <textarea v-model="i18nDraft.production_notes" rows="3" class="ios-input resize-none" :placeholder="$t('recipes.productionNotesPlaceholder')" />
          </div>

          <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ $t('adminTranslations.translatingLocale', { locale: LOCALE_LABELS[editingLocale] ?? editingLocale }) }}</p>

        </template>
      </template>

    </div>
  </AppBottomSheet>

  <!-- ─── Component edit sub-sheet ──────────────────────────────────────────── -->
  <AppComponentEditSheet
    :open="showCompEditSheet"
    :component="editingComp"
    :ingredients="localIngredients"
    :all-recipes="props.allRecipes"
    :units="units"
    @done="onCompSheetDone"
    @remove="onCompSheetRemove"
    @close="onCompSheetClose"
    @ingredient-created="onIngredientCreated"
  />

  <!-- ─── iOS delete alert ──────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="ios-alert">
      <div
        v-if="confirmingDelete"
        class="fixed inset-0 z-[200] flex items-center justify-center"
        style="background: rgba(0,0,0,0.35); backdrop-filter: blur(4px)"
      >
        <div class="ios-alert-card w-[270px] rounded-[13px] bg-white dark:bg-[#1c1c1e] shadow-2xl overflow-hidden">
          <div class="px-4 pt-5 pb-4 text-center">
            <h3 class="text-[17px] font-semibold text-gray-900 dark:text-white leading-snug">
              {{ $t('recipes.deleteConfirmExisting', { name: recipe?.name ?? '' }) }}
            </h3>
          </div>
          <div class="border-t border-gray-300/60 dark:border-gray-600/60 grid grid-cols-2 divide-x divide-gray-300/60 dark:divide-gray-600/60">
            <button
              class="py-[11px] text-[17px] text-[#007AFF] dark:text-blue-400 active:bg-gray-200/60 dark:active:bg-gray-700/60"
              @click="confirmingDelete = false"
            >{{ $t('common.cancel') }}</button>
            <button
              class="py-[11px] text-[17px] font-semibold text-red-500 active:bg-gray-200/60 dark:active:bg-gray-700/60"
              @click="doDelete"
            >{{ $t('common.delete') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ─── Banner lightbox ───────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="bannerLightboxOpen && imageUrl"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 pointer-events-auto"
      @click.self="bannerLightboxOpen = false"
    >
      <button
        class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
        @click.stop="bannerLightboxOpen = false"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <img :src="imageUrl" class="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl" alt="" @click.stop />
    </div>
  </Teleport>

</template>
