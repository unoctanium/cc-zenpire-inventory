<script setup lang="ts">
/**
 * IngredientDetail
 *
 * Self-contained ingredient detail + edit form (no modal).
 * View mode for existing, edit mode for new.
 *
 * Props:
 *   ingredient  — null for new, IngredientRow for existing
 *   units       — available unit options
 *   allergens   — all allergens for checkbox list
 *   canManage   — whether edit/delete are allowed
 *
 * Emits:
 *   saved(id: string)  — ingredient was saved; caller should refresh list
 *   deleted()          — ingredient was deleted; caller should refresh list
 */

type IngredientRow = {
  id: string; article_id: string | null; name: string; kind: string
  default_unit_id: string; default_unit_code: string; default_unit_type: string
  standard_unit_cost: number | null; standard_cost_currency: string
  produced_by_recipe_id: string | null; comment: string | null
  yield_pct: number
  purchase_quantity: number | null; purchase_unit_id: string | null
  purchase_unit_code: string | null; purchase_price: number | null
  purchase_price_currency: string
}

type UnitOption     = { id: string; code: string; name: string; unit_type: string }
type AllergenOption = { id: string; name: string; code: string | null; comment: string | null }

// ─── cost scale helpers ───────────────────────────────────────────────────────
// standard_unit_cost is stored per base unit (per g or per ml).
// We display and accept input as per 100g / per 100ml for readability.
function costScale(unitType: string): number {
  return (unitType === 'mass' || unitType === 'volume') ? 100 : 1
}
function costDisplayUnit(unitType: string): string {
  if (unitType === 'mass')   return '100g'
  if (unitType === 'volume') return '100ml'
  return 'pcs'
}

const props = defineProps<{
  ingredient: IngredientRow | null
  units:      UnitOption[]
  allergens:  AllergenOption[]
  canManage:  boolean
}>()

const emit = defineEmits<{
  (e: 'saved', id: string): void
  (e: 'deleted'): void
  (e: 'cancelled'): void
}>()

const { t, locale } = useI18n()
const toast          = useToast()
const { printHtml }  = usePrint()
const auth           = useAuth()
const { sourceLang, reload: reloadSourceLang } = useClientSettings()

// ─── editing locale ────────────────────────────────────────────────────────────
const SUPPORTED_LOCALES = ['de', 'en', 'ja']
const LOCALE_LABELS: Record<string, string> = { de: 'DE', en: 'EN', ja: 'JA' }
const editingLocale = ref('')
const isSourceEdit  = computed(() => !editingLocale.value || editingLocale.value === sourceLang.value)

// Draft for i18n (non-source) edits only
const i18nDraft = reactive({ name: '', comment: '' })
const loadingI18n = ref(false)

async function switchEditingLocale(loc: string) {
  editingLocale.value = loc
  if (loc === sourceLang.value || !props.ingredient?.id) return
  loadingI18n.value = true
  try {
    const res = await $fetch<any>(
      `/api/ingredients/${props.ingredient.id}/i18n/${loc}`,
      { credentials: 'include' }
    )
    i18nDraft.name    = res.name    ?? ''
    i18nDraft.comment = res.comment ?? ''
  } catch {
    i18nDraft.name    = ''
    i18nDraft.comment = ''
  } finally {
    loadingI18n.value = false
  }
}

// ─── translate ────────────────────────────────────────────────────────────────
const translating         = ref(false)
const showTranslatePrompt = ref(false)
const pendingTranslateId  = ref<string | null>(null)

async function translateItem() {
  const id = pendingTranslateId.value ?? props.ingredient?.id
  if (!id) return
  translating.value = true
  try {
    await $fetch('/api/admin/translations/item', {
      method: 'POST', credentials: 'include',
      body: { kind: 'ingredient', id },
    })
    toast.add({ title: t('adminTranslations.translationDone') })
  } catch (e: any) {
    toast.add({ title: t('adminTranslations.translationFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'error' })
  } finally {
    translating.value = false
  }
}

async function confirmTranslate() {
  showTranslatePrompt.value = false
  await translateItem()
}

// ─── mode ─────────────────────────────────────────────────────────────────────

const editMode      = ref(false)
const showEditSheet = ref(false)

const isNew      = computed(() => !props.ingredient)
const isProduced = computed(() => props.ingredient?.kind === 'produced')

// Unit type of the currently selected unit (reactive while user changes unit in form)
const currentUnitType = computed(() =>
  props.units.find(u => u.id === draft.default_unit_id)?.unit_type ?? 'count'
)
const currentCostScale = computed(() => costScale(currentUnitType.value))
const currentCostLabel = computed(() => costDisplayUnit(currentUnitType.value))

// Whether all three purchase fields are filled in the draft
const hasPurchaseInput = computed(() => {
  const qty   = String(draft.purchase_quantity ?? '').trim()
  const price = String(draft.purchase_price    ?? '').trim()
  return qty !== '' && draft.purchase_unit_id !== '' && price !== ''
})

// Derived cost (display units) from purchase fields — shown as hint in edit form
const purchaseDerivedCostDisplay = computed((): number | null => {
  const qty   = Number(draft.purchase_quantity)
  const price = Number(draft.purchase_price)
  const unit  = props.units.find(u => u.id === draft.purchase_unit_id)
  if (!qty || !price || !unit?.factor) return null
  return (price / (qty * unit.factor)) * currentCostScale.value
})

// Effective cost after yield (in display units) — shown in edit form as hint
const effectiveCostDisplay = computed((): number | null => {
  const baseCost = hasPurchaseInput.value
    ? purchaseDerivedCostDisplay.value
    : (String(draft.standard_unit_cost ?? '').trim() === '' ? null : Number(draft.standard_unit_cost))
  if (baseCost == null) return null
  const yld = Number(draft.yield_pct)
  if (!yld || yld === 100) return null  // no need to show when yield is 100%
  return baseCost / (yld / 100)
})

// ─── draft ────────────────────────────────────────────────────────────────────

const draft = reactive({
  article_id:                '',
  name:                      '',
  default_unit_id:           '',
  standard_unit_cost:        '' as string | number,
  comment:                   '',
  yield_pct:                 100 as string | number,
  purchase_quantity:         '' as string | number,
  purchase_unit_id:          '',
  purchase_price:            '' as string | number,
  name_translation_locked:   false,
})

const selectedAllergenIds = ref<string[]>([])
const hasImage            = ref(false)
const imageUploading      = ref(false)
const imageVersion        = ref(0)
const loadingDetail       = ref(false)
const saving              = ref(false)
const confirmingDelete    = ref(false)

// ─── load when ingredient changes ─────────────────────────────────────────────

watch(
  () => props.ingredient,
  async (ing) => {
    confirmingDelete.value = false
    selectedAllergenIds.value = []
    hasImage.value = false

    if (ing) {
      editMode.value      = false
      showEditSheet.value = false
      draft.article_id         = ing.article_id ?? ''
      draft.name               = ing.name
      draft.default_unit_id    = ing.default_unit_id
      draft.standard_unit_cost = ing.standard_unit_cost != null
        ? ing.standard_unit_cost * costScale(ing.default_unit_type)
        : ''
      draft.comment            = ing.comment ?? ''
      draft.yield_pct          = ing.yield_pct ?? 100
      draft.purchase_quantity  = ing.purchase_quantity ?? ''
      draft.purchase_unit_id   = ing.purchase_unit_id ?? ''
      draft.purchase_price     = ing.purchase_price ?? ''

      // Lazy-load allergens + image flag
      try {
        loadingDetail.value = true
        const detail = await $fetch<{ ok: boolean; ingredient: any }>(
          `/api/ingredients/${ing.id}?locale=${locale.value}`, { credentials: 'include' }
        )
        draft.article_id          = detail.ingredient.article_id ?? ''
        draft.comment             = detail.ingredient.comment ?? ''
        // Re-apply scale after detail fetch (has more precise unit_type info)
        if (detail.ingredient.standard_unit_cost != null) {
          draft.standard_unit_cost = detail.ingredient.standard_unit_cost
            * costScale(detail.ingredient.default_unit_type)
        }
        draft.yield_pct           = detail.ingredient.yield_pct ?? 100
        draft.purchase_quantity   = detail.ingredient.purchase_quantity ?? ''
        draft.purchase_unit_id    = detail.ingredient.purchase_unit_id ?? ''
        draft.purchase_price      = detail.ingredient.purchase_price ?? ''
        selectedAllergenIds.value         = detail.ingredient.allergen_ids ?? []
        hasImage.value                    = detail.ingredient.has_image ?? false
        draft.name_translation_locked     = detail.ingredient.name_translation_locked ?? false
      } catch { /* non-fatal */ } finally {
        loadingDetail.value = false
      }
    } else {
      // New ingredient — open in edit mode
      editMode.value = true
      draft.article_id         = ''
      draft.name               = ''
      draft.default_unit_id    = props.units[0]?.id ?? ''
      draft.standard_unit_cost = ''
      draft.comment            = ''
      draft.yield_pct          = 100
      draft.purchase_quantity  = ''
      draft.purchase_unit_id   = ''
      draft.purchase_price     = ''
    }
  },
  { immediate: true }
)

// ─── image ────────────────────────────────────────────────────────────────────

const imageUrl = computed(() =>
  hasImage.value && props.ingredient?.id
    ? `/api/ingredients/${props.ingredient.id}/image?v=${imageVersion.value}`
    : null
)

async function uploadImage(file: File) {
  if (!props.ingredient?.id) return
  imageUploading.value = true
  try {
    const fd = new FormData()
    fd.append('image', file)
    await $fetch(`/api/ingredients/${props.ingredient.id}/image`,
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
  if (!props.ingredient?.id) return
  try {
    await $fetch(`/api/ingredients/${props.ingredient.id}/image`, { method: 'DELETE', credentials: 'include' })
    hasImage.value = false
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  }
}

// ─── allergens ────────────────────────────────────────────────────────────────

function toggleAllergen(id: string) {
  const idx = selectedAllergenIds.value.indexOf(id)
  if (idx === -1) selectedAllergenIds.value.push(id)
  else            selectedAllergenIds.value.splice(idx, 1)
}

// ─── save ─────────────────────────────────────────────────────────────────────

async function save() {
  // ── Non-source locale: save only translation fields ──
  if (!isSourceEdit.value && props.ingredient) {
    saving.value = true
    try {
      await $fetch(`/api/ingredients/${props.ingredient.id}/i18n/${editingLocale.value}`, {
        method: 'PUT', credentials: 'include',
        body: {
          name:    draft.name_translation_locked ? undefined : (i18nDraft.name.trim() || null),
          comment: i18nDraft.comment.trim() || null,
        },
      })
      toast.add({ title: t('ingredients.updated') })
      editMode.value      = false
      showEditSheet.value = false
      emit('saved', props.ingredient.id)
      if (auth.value?.is_admin) { pendingTranslateId.value = props.ingredient.id; showTranslatePrompt.value = true }
    } catch (e: any) {
      toast.add({
        title:       t('common.saveFailed'),
        description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e),
        color:       'red',
      })
    } finally {
      saving.value = false
    }
    return
  }

  // ── Source locale: save main record ──
  if (!draft.name.trim() || !draft.default_unit_id) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.nameAndUnitRequired'), color: 'red' })
    return
  }
  const costStr        = String(draft.standard_unit_cost ?? '').trim()
  const costDisplay    = costStr === '' ? null : Number(costStr)
  if (costStr !== '' && isNaN(costDisplay as number)) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.invalidCost'), color: 'red' })
    return
  }
  // Convert display value back to per-base-unit for storage.
  // When purchase fields are all filled, the server will derive cost — skip manual value.
  const costValue = hasPurchaseInput.value
    ? null
    : (costDisplay != null ? costDisplay / currentCostScale.value : null)

  saving.value = true
  try {
    const body = {
      article_id:                draft.article_id.trim() || null,
      name:                      draft.name.trim(),
      default_unit_id:           draft.default_unit_id,
      standard_unit_cost:        costValue,
      comment:                   draft.comment.trim() || null,
      allergen_ids:              selectedAllergenIds.value,
      yield_pct:                 Number(draft.yield_pct) || 100,
      purchase_quantity:         draft.purchase_quantity !== '' ? Number(draft.purchase_quantity) : null,
      purchase_unit_id:          draft.purchase_unit_id   || null,
      purchase_price:            draft.purchase_price !== '' ? Number(draft.purchase_price) : null,
      name_translation_locked:   draft.name_translation_locked,
    }
    if (props.ingredient) {
      await $fetch(`/api/ingredients/${props.ingredient.id}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('ingredients.updated') })
      editMode.value      = false
      showEditSheet.value = false
      emit('saved', props.ingredient.id)
      if (auth.value?.is_admin) { pendingTranslateId.value = props.ingredient.id; showTranslatePrompt.value = true }
    } else {
      const res = await $fetch<{ ok: boolean; ingredient: { id: string } }>(
        '/api/ingredients', { method: 'POST', credentials: 'include', body }
      )
      toast.add({ title: t('ingredients.created') })
      emit('saved', res.ingredient.id)
      if (auth.value?.is_admin) { pendingTranslateId.value = res.ingredient.id; showTranslatePrompt.value = true }
    }
  } catch (e: any) {
    toast.add({
      title:       t('common.saveFailed'),
      description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e),
      color:       'red',
    })
  } finally {
    saving.value = false
  }
}

async function startEdit() {
  await reloadSourceLang()
  editingLocale.value = sourceLang.value || 'de'

  // Re-fetch source data (no locale param) so draft always holds source values
  if (props.ingredient?.id) {
    try {
      const detail = await $fetch<{ ok: boolean; ingredient: any }>(
        `/api/ingredients/${props.ingredient.id}`, { credentials: 'include' }
      )
      draft.name               = detail.ingredient.name
      draft.comment            = detail.ingredient.comment ?? ''
      draft.article_id         = detail.ingredient.article_id ?? ''
      draft.name_translation_locked = detail.ingredient.name_translation_locked ?? false
      if (detail.ingredient.standard_unit_cost != null) {
        draft.standard_unit_cost = detail.ingredient.standard_unit_cost
          * costScale(detail.ingredient.default_unit_type)
      }
      draft.yield_pct         = detail.ingredient.yield_pct ?? 100
      draft.purchase_quantity = detail.ingredient.purchase_quantity ?? ''
      draft.purchase_unit_id  = detail.ingredient.purchase_unit_id ?? ''
      draft.purchase_price    = detail.ingredient.purchase_price ?? ''
    } catch { /* non-fatal */ }
  }

  editMode.value      = true
  showEditSheet.value = true
}

function cancelEdit() {
  if (isNew.value) { emit('cancelled'); return }
  // Revert draft from ingredient prop
  if (props.ingredient) {
    draft.article_id         = props.ingredient.article_id ?? ''
    draft.name               = props.ingredient.name
    draft.default_unit_id    = props.ingredient.default_unit_id
    draft.standard_unit_cost = props.ingredient.standard_unit_cost != null
      ? props.ingredient.standard_unit_cost * costScale(props.ingredient.default_unit_type)
      : ''
    draft.comment            = props.ingredient.comment ?? ''
    draft.yield_pct          = props.ingredient.yield_pct ?? 100
    draft.purchase_quantity  = props.ingredient.purchase_quantity ?? ''
    draft.purchase_unit_id   = props.ingredient.purchase_unit_id ?? ''
    draft.purchase_price     = props.ingredient.purchase_price ?? ''
  }
  editMode.value      = false
  showEditSheet.value = false
}

// ─── print ────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printIngredient() {
  if (!props.ingredient) return
  const ing = props.ingredient

  const imgSrc = hasImage.value && imageUrl.value
    ? window.location.origin + imageUrl.value.split('?')[0]
    : null
  const imgTag = imgSrc
    ? `<img src="${imgSrc}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;float:right;margin:0 0 16px 20px">`
    : ''

  const selectedAllergenNames = props.allergens
    .filter(a => selectedAllergenIds.value.includes(a.id))
    .map(a => a.name)

  const allergenSection = selectedAllergenNames.length
    ? `<h2>${t('ingredients.allergens')}</h2><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${
        selectedAllergenNames.map(n =>
          `<span style="padding:2px 10px;background:#fee2e2;color:#991b1b;border-radius:999px;font-size:12px">${esc(n)}</span>`
        ).join('')
      }</div>`
    : ''

  const html = `<!DOCTYPE html><html lang="${locale.value}"><head><meta charset="UTF-8"><title>${esc(ing.name)} — Zenpire</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;font-size:14px;color:#111827;background:#fff;padding:24px}
h1{font-size:24px;font-weight:700;margin-bottom:6px}h2{font-size:15px;font-weight:600;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:24px 0 10px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-bottom:24px;clear:both}
.meta label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:600;display:block;margin-bottom:2px}
.comment{color:#4b5563;line-height:1.6;white-space:pre-wrap}
.footer{margin-top:32px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af}
@media print{@page{margin:1.5cm}}</style></head>
<body>
${imgTag}<h1>${esc(ing.name)}</h1>
<div class="meta">
  <div><label>${t('ingredients.kind')}</label><span>${esc(ing.kind)}</span></div>
  <div><label>${t('ingredients.unit')}</label><span>${esc(ing.default_unit_code)}</span></div>
  ${ing.standard_unit_cost != null ? `<div><label>${t('ingredients.unitCost')}</label><span>€ ${ing.standard_unit_cost.toFixed(6)}</span></div>` : ''}
</div>
${draft.comment ? `<h2>${t('ingredients.comment')}</h2><p class="comment">${esc(draft.comment)}</p>` : ''}
${allergenSection}
<div class="footer">Zenpire Inventory — ${t('common.printedOn')} ${new Date().toLocaleString(locale.value)}</div>
</body></html>`

  printHtml(html)
}

// ─── delete ───────────────────────────────────────────────────────────────────

async function doDelete() {
  if (!props.ingredient) return
  try {
    await $fetch(`/api/ingredients/${props.ingredient.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('ingredients.deleted') })
    confirmingDelete.value = false
    emit('deleted')
  } catch (e: any) {
    toast.add({
      title:       t('common.deleteFailed'),
      description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e),
      color:       'red',
    })
  }
}
</script>

<template>
  <div class="p-4 space-y-4">

    <!-- New mode: sticky iOS nav bar -->
    <div v-if="isNew" class="sticky top-0 z-10 -mx-4 -mt-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 min-h-[44px]">
      <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
      <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('ingredients.newTitle') }}</span>
      <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="save">{{ $t('common.save') }}</button>
    </div>
    <!-- View mode: iOS nav bar -->
    <div v-if="!isNew" class="sticky top-0 z-10 -mx-4 -mt-4 relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end px-2 min-h-[44px]">
      <h2 class="absolute inset-x-0 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 px-28 truncate pointer-events-none">{{ ingredient?.name }}</h2>
      <div class="relative z-10 flex items-center">
        <button v-if="canManage" class="w-9 h-9 flex items-center justify-center text-[#007AFF] dark:text-blue-400 active:opacity-50" @click="startEdit">
          <UIcon name="i-heroicons-pencil-square" class="w-5 h-5" />
        </button>
        <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="printIngredient">
          <UIcon name="i-heroicons-printer" class="w-5 h-5" />
        </button>
        <button v-if="canManage" class="w-9 h-9 flex items-center justify-center text-red-500 active:opacity-50" @click="confirmingDelete = true">
          <UIcon name="i-heroicons-trash" class="w-5 h-5" />
        </button>
      </div>
    </div>


    <!-- Image (existing only) -->
    <AdminImageUpload
      v-if="ingredient?.id"
      :image-url="imageUrl"
      :uploading="imageUploading"
      :can-manage="false"
      @upload="uploadImage"
      @remove="removeImage"
    />

    <!-- View fields (existing ingredient) -->
    <template v-if="!isNew">
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.name') }}</div>
        <div class="text-[17px] font-medium text-gray-900 dark:text-gray-100">{{ ingredient?.name }}</div>
      </div>
      <div v-if="ingredient?.article_id">
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.articleId') }}</div>
        <div class="text-[17px] text-gray-700 dark:text-gray-300 font-mono">{{ ingredient.article_id }}</div>
      </div>
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.kind') }}</div>
        <span
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          :class="ingredient!.kind === 'purchased'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'"
        >{{ ingredient!.kind }}</span>
      </div>
      <div v-if="isProduced && ingredient?.produced_by_recipe_id">
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.producedByRecipe') }}</div>
        <button
          class="text-[15px] text-[#007AFF] dark:text-blue-400 active:opacity-50"
          @click="navigateTo(`/production?recipe=${ingredient!.produced_by_recipe_id}`)"
        >{{ $t('ingredients.viewRecipe') }} →</button>
      </div>
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.unit') }}</div>
        <div class="text-[17px] text-gray-700 dark:text-gray-300">{{ ingredient?.default_unit_code }}</div>
      </div>
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">
          {{ $t('ingredients.unitCost') }}
          <span class="text-gray-400 font-normal">/ {{ costDisplayUnit(ingredient!.default_unit_type) }}</span>
        </div>
        <div class="text-[17px] text-gray-700 dark:text-gray-300">
          {{ ingredient?.standard_unit_cost != null
              ? `€ ${(ingredient.standard_unit_cost * costScale(ingredient.default_unit_type)).toFixed(2)}`
              : '—' }}
          <template v-if="ingredient?.yield_pct != null && ingredient.yield_pct < 100 && ingredient.standard_unit_cost != null">
            <span class="text-gray-400 text-sm mx-1">→</span>
            <span class="text-orange-600 dark:text-orange-400">
              € {{ (ingredient.standard_unit_cost / (ingredient.yield_pct / 100) * costScale(ingredient.default_unit_type)).toFixed(2) }}
            </span>
            <span class="text-[12px] text-gray-400 ml-1">{{ $t('ingredients.afterYield') }}</span>
          </template>
        </div>
      </div>
      <div v-if="ingredient?.yield_pct != null && ingredient.yield_pct < 100">
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.yield') }}</div>
        <div class="text-[17px] text-gray-700 dark:text-gray-300">{{ ingredient.yield_pct }} %</div>
      </div>
      <div v-if="ingredient?.purchase_quantity != null && ingredient.purchase_price != null">
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.purchasePrice') }}</div>
        <div class="text-[17px] text-gray-700 dark:text-gray-300">
          {{ ingredient.purchase_quantity }} {{ ingredient.purchase_unit_code }}
          <span class="text-gray-400 mx-1">@</span>
          € {{ ingredient.purchase_price.toFixed(2) }}
        </div>
      </div>
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.comment') }}</div>
        <div class="text-[17px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ ingredient?.comment || '—' }}</div>
      </div>
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('ingredients.allergens') }}</div>
        <div v-if="loadingDetail" class="text-sm text-gray-400">{{ $t('common.loading') }}</div>
        <div v-else-if="selectedAllergenIds.length === 0" class="text-sm text-gray-400">—</div>
        <div v-else class="flex flex-wrap gap-1">
          <span
            v-for="al in allergens.filter(a => selectedAllergenIds.includes(a.id))"
            :key="al.id"
            class="rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          >{{ al.name }}</span>
        </div>
      </div>
    </template>

    <!-- Create mode (new — inline, parent already provides the sheet) -->
    <template v-if="isNew">
      <div>
        <label class="ios-label">{{ $t('ingredients.name') }} *</label>
        <input v-model="draft.name"
          class="ios-input"
          :placeholder="$t('ingredients.namePlaceholder')" autocomplete="off" />
      </div>
      <div>
        <label class="ios-label">{{ $t('ingredients.articleId') }}</label>
        <input v-model="draft.article_id"
          class="ios-input font-mono"
          :placeholder="$t('ingredients.articleIdPlaceholder')" autocomplete="off" />
      </div>
      <div>
        <label class="ios-label">{{ $t('ingredients.unit') }} *</label>
        <select v-model="draft.default_unit_id" class="ios-input">
          <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
        </select>
      </div>
      <!-- Purchase price section -->
      <div class="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-3">
        <div class="text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('ingredients.purchasePriceSection') }}</div>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="ios-label">{{ $t('ingredients.purchaseQty') }}</label>
            <input v-model="draft.purchase_quantity" type="number" min="0" step="any" class="ios-input" placeholder="1" />
          </div>
          <div class="flex-1">
            <label class="ios-label">{{ $t('ingredients.purchaseUnit') }}</label>
            <select v-model="draft.purchase_unit_id" class="ios-input">
              <option value="">—</option>
              <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
            </select>
          </div>
          <div class="flex-1">
            <label class="ios-label">{{ $t('ingredients.purchasePriceLabel') }} (€)</label>
            <input v-model="draft.purchase_price" type="number" min="0" step="any" class="ios-input" placeholder="0.00" />
          </div>
        </div>
        <p v-if="purchaseDerivedCostDisplay != null" class="text-xs text-gray-500 dark:text-gray-400">
          = € {{ purchaseDerivedCostDisplay.toFixed(4) }} / {{ currentCostLabel }}
        </p>
      </div>
      <!-- Manual cost fallback (only when no purchase fields filled) -->
      <div v-if="!hasPurchaseInput">
        <label class="ios-label">{{ $t('ingredients.unitCost') }} / {{ currentCostLabel }}</label>
        <input v-model="draft.standard_unit_cost" type="number" min="0" step="0.0001"
          class="ios-input"
          :placeholder="$t('ingredients.costPlaceholder')" />
      </div>
      <div>
        <label class="ios-label">{{ $t('ingredients.yield') }} %</label>
        <input v-model="draft.yield_pct" type="number" min="1" max="100" step="1" class="ios-input" placeholder="100" />
        <p v-if="effectiveCostDisplay != null" class="text-xs text-orange-600 dark:text-orange-400 mt-1">
          → {{ $t('ingredients.afterYield') }}: € {{ effectiveCostDisplay.toFixed(4) }} / {{ currentCostLabel }}
        </p>
      </div>
      <div>
        <label class="ios-label">{{ $t('ingredients.comment') }}</label>
        <textarea v-model="draft.comment" rows="2"
          class="ios-input resize-none"
          :placeholder="$t('ingredients.commentPlaceholder')" />
      </div>
      <div>
        <label class="ios-label">{{ $t('ingredients.allergens') }}</label>
        <div v-if="allergens.length === 0" class="text-sm text-gray-400 dark:text-gray-600">{{ $t('ingredients.noAllergens') }}</div>
        <div v-else class="grid grid-cols-2 gap-y-1 gap-x-4">
          <label v-for="al in allergens" :key="al.id" class="flex items-center gap-2 text-[17px] text-gray-800 dark:text-gray-200 cursor-pointer">
            <input type="checkbox" :checked="selectedAllergenIds.includes(al.id)"
              class="rounded border-gray-300 dark:border-gray-700" @change="toggleAllergen(al.id)" />
            {{ al.name }}
          </label>
        </div>
      </div>
    </template>

  </div>

  <!-- Edit sheet (existing ingredient) -->
  <AppBottomSheet :open="showEditSheet" @close="cancelEdit">
    <!-- Sticky iOS nav bar -->
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 min-h-[44px]">
        <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
        <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('ingredients.editTitle') }}</span>
        <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="save">{{ $t('common.save') }}</button>
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

    <div class="p-4 space-y-4">

      <!-- ── Source locale edit (full form) ── -->
      <template v-if="isSourceEdit">
        <AdminImageUpload
          v-if="ingredient?.id"
          :image-url="imageUrl"
          :uploading="imageUploading"
          :can-manage="canManage && !isProduced"
          @upload="uploadImage"
          @remove="removeImage"
        />
        <div>
          <label class="ios-label">{{ $t('ingredients.name') }} *</label>
          <input v-model="draft.name"
            class="ios-input"
            :placeholder="$t('ingredients.namePlaceholder')" autocomplete="off" />
          <label class="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
            <input type="checkbox" v-model="draft.name_translation_locked" class="rounded" />
            <span class="text-[12px] text-gray-500 dark:text-gray-400">{{ $t('adminTranslations.lockName') }}</span>
          </label>
        </div>
        <div>
          <label class="ios-label">{{ $t('ingredients.articleId') }}</label>
          <input v-model="draft.article_id"
            class="ios-input font-mono"
            :placeholder="$t('ingredients.articleIdPlaceholder')" autocomplete="off" />
        </div>
        <div v-if="!isProduced">
          <label class="ios-label">{{ $t('ingredients.unit') }} *</label>
          <select v-model="draft.default_unit_id" class="ios-input">
            <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
          </select>
        </div>
        <!-- Purchase price section (purchased ingredients only) -->
        <div v-if="!isProduced" class="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-3">
          <div class="text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ $t('ingredients.purchasePriceSection') }}</div>
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="ios-label">{{ $t('ingredients.purchaseQty') }}</label>
              <input v-model="draft.purchase_quantity" type="number" min="0" step="any" class="ios-input" placeholder="1" />
            </div>
            <div class="flex-1">
              <label class="ios-label">{{ $t('ingredients.purchaseUnit') }}</label>
              <select v-model="draft.purchase_unit_id" class="ios-input">
                <option value="">—</option>
                <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="ios-label">{{ $t('ingredients.purchasePriceLabel') }} (€)</label>
              <input v-model="draft.purchase_price" type="number" min="0" step="any" class="ios-input" placeholder="0.00" />
            </div>
          </div>
          <p v-if="purchaseDerivedCostDisplay != null" class="text-xs text-gray-500 dark:text-gray-400">
            = € {{ purchaseDerivedCostDisplay.toFixed(4) }} / {{ currentCostLabel }}
          </p>
        </div>
        <!-- Manual cost fallback (only when no purchase fields filled) -->
        <div v-if="!isProduced && !hasPurchaseInput">
          <label class="ios-label">{{ $t('ingredients.unitCost') }} / {{ currentCostLabel }}</label>
          <input v-model="draft.standard_unit_cost" type="number" min="0" step="0.0001"
            class="ios-input"
            :placeholder="$t('ingredients.costPlaceholder')" />
        </div>
        <!-- Yield percentage (purchased ingredients only) -->
        <div v-if="!isProduced">
          <label class="ios-label">{{ $t('ingredients.yield') }} %</label>
          <input v-model="draft.yield_pct" type="number" min="1" max="100" step="1" class="ios-input" placeholder="100" />
          <p v-if="effectiveCostDisplay != null" class="text-xs text-orange-600 dark:text-orange-400 mt-1">
            → {{ $t('ingredients.afterYield') }}: € {{ effectiveCostDisplay.toFixed(4) }} / {{ currentCostLabel }}
          </p>
        </div>
        <div>
          <label class="ios-label">{{ $t('ingredients.comment') }}</label>
          <textarea v-model="draft.comment" rows="2"
            class="ios-input resize-none"
            :placeholder="$t('ingredients.commentPlaceholder')" />
        </div>
        <div>
          <label class="ios-label">{{ $t('ingredients.allergens') }}</label>
          <!-- Produced: allergens derived from recipe — show read-only pills -->
          <template v-if="isProduced">
            <div v-if="selectedAllergenIds.length === 0" class="text-sm text-gray-400 dark:text-gray-600">—</div>
            <div v-else class="flex flex-wrap gap-1.5">
              <span
                v-for="al in allergens.filter(a => selectedAllergenIds.includes(a.id))" :key="al.id"
                class="rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              >{{ al.name }}</span>
            </div>
            <p class="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5">{{ $t('ingredients.allergensFromRecipe') }}</p>
          </template>
          <!-- Purchased: editable checkboxes -->
          <template v-else>
            <div v-if="allergens.length === 0" class="text-sm text-gray-400 dark:text-gray-600">{{ $t('ingredients.noAllergens') }}</div>
            <div v-else class="grid grid-cols-2 gap-y-1 gap-x-4">
              <label v-for="al in allergens" :key="al.id" class="flex items-center gap-2 text-[17px] text-gray-800 dark:text-gray-200 cursor-pointer">
                <input type="checkbox" :checked="selectedAllergenIds.includes(al.id)"
                  class="rounded border-gray-300 dark:border-gray-700" @change="toggleAllergen(al.id)" />
                {{ al.name }}
              </label>
            </div>
          </template>
        </div>
      </template>

      <!-- ── Non-source locale edit (translatable fields only) ── -->
      <template v-else>
        <div v-if="loadingI18n" class="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">{{ $t('common.loading') }}</div>
        <template v-else>
          <!-- Name -->
          <div>
            <label class="ios-label">{{ $t('ingredients.name') }}</label>
            <!-- Source reference -->
            <div class="mb-1.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-[13px] text-gray-400 dark:text-gray-500 italic">
              {{ draft.name || '—' }}
            </div>
            <div v-if="draft.name_translation_locked" class="flex items-center gap-1.5 text-[13px] text-amber-600 dark:text-amber-400">
              <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5" />
              {{ $t('adminTranslations.nameLocked') }}
            </div>
            <input v-else v-model="i18nDraft.name"
              class="ios-input"
              :placeholder="$t('ingredients.namePlaceholder')" autocomplete="off" />
          </div>
          <!-- Comment -->
          <div>
            <label class="ios-label">{{ $t('ingredients.comment') }}</label>
            <div v-if="draft.comment" class="mb-1.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-[13px] text-gray-400 dark:text-gray-500 italic whitespace-pre-wrap">{{ draft.comment }}</div>
            <textarea v-model="i18nDraft.comment" rows="3"
              class="ios-input resize-none"
              :placeholder="$t('ingredients.commentPlaceholder')" />
          </div>
          <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ $t('adminTranslations.translatingLocale', { locale: LOCALE_LABELS[editingLocale] ?? editingLocale }) }}</p>
        </template>
      </template>

    </div>
  </AppBottomSheet>

  <!-- iOS delete alert -->
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
              {{ $t('ingredients.deleteConfirmExisting', { name: ingredient?.name ?? '' }) }}
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

  <!-- Translate prompt -->
  <Teleport to="body">
    <Transition name="ios-alert">
      <div
        v-if="showTranslatePrompt"
        class="fixed inset-0 z-[200] flex items-center justify-center"
        style="background: rgba(0,0,0,0.35); backdrop-filter: blur(4px)"
      >
        <div class="ios-alert-card w-[270px] rounded-[13px] bg-white dark:bg-[#1c1c1e] shadow-2xl overflow-hidden">
          <div class="px-4 pt-5 pb-4 text-center">
            <h3 class="text-[17px] font-semibold text-gray-900 dark:text-white leading-snug">{{ $t('adminTranslations.translatePromptTitle') }}</h3>
            <p class="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400 leading-snug">{{ $t('adminTranslations.translatePromptDesc') }}</p>
          </div>
          <div class="border-t border-gray-300/60 dark:border-gray-600/60 grid grid-cols-2 divide-x divide-gray-300/60 dark:divide-gray-600/60">
            <button
              class="py-[11px] text-[17px] text-[#007AFF] dark:text-blue-400 active:bg-gray-200/60 dark:active:bg-gray-700/60"
              :disabled="translating"
              @click="showTranslatePrompt = false"
            >{{ $t('common.no') }}</button>
            <button
              class="py-[11px] text-[17px] font-semibold text-[#007AFF] dark:text-blue-400 active:bg-gray-200/60 dark:active:bg-gray-700/60 disabled:opacity-40"
              :disabled="translating"
              @click="confirmTranslate"
            >
              <span v-if="translating">{{ $t('adminTranslations.translating') }}</span>
              <span v-else>{{ $t('common.yes') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
