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
  id: string; name: string; kind: string
  default_unit_id: string; default_unit_code: string
  standard_unit_cost: number | null; standard_cost_currency: string
  produced_by_recipe_id: string | null; comment: string | null
}

type UnitOption     = { id: string; code: string; name: string }
type AllergenOption = { id: string; name: string; comment: string | null }

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

const { t }  = useI18n()
const toast  = useToast()

// ─── mode ─────────────────────────────────────────────────────────────────────

const editMode      = ref(false)
const showEditSheet = ref(false)

const isNew      = computed(() => !props.ingredient)
const isProduced = computed(() => props.ingredient?.kind === 'produced')

// ─── draft ────────────────────────────────────────────────────────────────────

const draft = reactive({
  name:               '',
  default_unit_id:    '',
  standard_unit_cost: '' as string | number,
  comment:            '',
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
      draft.name               = ing.name
      draft.default_unit_id    = ing.default_unit_id
      draft.standard_unit_cost = ing.standard_unit_cost ?? ''
      draft.comment            = ing.comment ?? ''

      // Lazy-load allergens + image flag
      try {
        loadingDetail.value = true
        const detail = await $fetch<{ ok: boolean; ingredient: any }>(
          `/api/ingredients/${ing.id}`, { credentials: 'include' }
        )
        draft.comment             = detail.ingredient.comment ?? ''
        selectedAllergenIds.value = detail.ingredient.allergen_ids ?? []
        hasImage.value            = detail.ingredient.has_image ?? false
      } catch { /* non-fatal */ } finally {
        loadingDetail.value = false
      }
    } else {
      // New ingredient — open in edit mode
      editMode.value = true
      draft.name               = ''
      draft.default_unit_id    = props.units[0]?.id ?? ''
      draft.standard_unit_cost = ''
      draft.comment            = ''
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
  if (!draft.name.trim() || !draft.default_unit_id) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.nameAndUnitRequired'), color: 'red' })
    return
  }
  const costStr   = String(draft.standard_unit_cost ?? '').trim()
  const costValue = costStr === '' ? null : Number(costStr)
  if (costStr !== '' && isNaN(costValue as number)) {
    toast.add({ title: t('common.missingFields'), description: t('ingredients.invalidCost'), color: 'red' })
    return
  }

  saving.value = true
  try {
    const body = {
      name:               draft.name.trim(),
      default_unit_id:    draft.default_unit_id,
      standard_unit_cost: costValue,
      comment:            draft.comment.trim() || null,
      allergen_ids:       selectedAllergenIds.value,
    }
    if (props.ingredient) {
      await $fetch(`/api/ingredients/${props.ingredient.id}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('ingredients.updated') })
      editMode.value      = false
      showEditSheet.value = false
      emit('saved', props.ingredient.id)
    } else {
      const res = await $fetch<{ ok: boolean; ingredient: { id: string } }>(
        '/api/ingredients', { method: 'POST', credentials: 'include', body }
      )
      toast.add({ title: t('ingredients.created') })
      emit('saved', res.ingredient.id)
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

function startEdit() {
  editMode.value      = true
  showEditSheet.value = true
}

function cancelEdit() {
  if (isNew.value) { emit('cancelled'); return }
  // Revert draft from ingredient prop
  if (props.ingredient) {
    draft.name               = props.ingredient.name
    draft.default_unit_id    = props.ingredient.default_unit_id
    draft.standard_unit_cost = props.ingredient.standard_unit_cost ?? ''
    draft.comment            = props.ingredient.comment ?? ''
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
    ? `<h2>Allergens</h2><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${
        selectedAllergenNames.map(n =>
          `<span style="padding:2px 10px;background:#fee2e2;color:#991b1b;border-radius:999px;font-size:12px">${esc(n)}</span>`
        ).join('')
      }</div>`
    : ''

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(ing.name)} — Zenpire</title>
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
  <div><label>Kind</label><span>${esc(ing.kind)}</span></div>
  <div><label>Unit</label><span>${esc(ing.default_unit_code)}</span></div>
  ${ing.standard_unit_cost != null ? `<div><label>Unit Cost</label><span>€ ${ing.standard_unit_cost.toFixed(6)}</span></div>` : ''}
</div>
${draft.comment ? `<h2>Comment</h2><p class="comment">${esc(draft.comment)}</p>` : ''}
${allergenSection}
<div class="footer">Zenpire Inventory — printed ${new Date().toLocaleString()}</div>
</body></html>`

  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  if (isStandalone) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (!win) { URL.revokeObjectURL(url); toast.add({ title: 'Print blocked', description: 'Please allow pop-ups.', color: 'error' }); return }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } else {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;border:0;opacity:0'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document
    if (!doc) { document.body.removeChild(iframe); return }
    doc.open(); doc.write(html); doc.close()
    iframe.onload = () => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => { try { document.body.removeChild(iframe) } catch {} }, 2000)
    }
  }
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
  <div class="p-4 space-y-4 max-w-lg">

    <!-- Header -->
    <div class="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
        <template v-if="isNew">{{ $t('ingredients.newTitle') }}</template>
        <template v-else>{{ $t('ingredients.viewTitle') }}</template>
      </h2>
      <div v-if="!isNew" class="flex items-center gap-1">
        <UButton
          v-if="canManage && !isProduced"
          size="xs" color="neutral" variant="ghost"
          icon="i-heroicons-pencil-square"
          @click="startEdit"
        >{{ $t('common.edit') }}</UButton>
        <UButton
          size="xs" color="neutral" variant="ghost"
          icon="i-heroicons-printer"
          @click="printIngredient"
        >{{ $t('common.print') }}</UButton>
        <UButton
          v-if="canManage"
          size="xs" color="error" variant="ghost"
          icon="i-heroicons-trash"
          @click="confirmingDelete = true"
        >{{ $t('common.delete') }}</UButton>
      </div>
    </div>

    <!-- Inline delete confirmation -->
    <div v-if="confirmingDelete" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center justify-between gap-3">
      <p class="text-sm text-red-700 dark:text-red-300">
        {{ $t('ingredients.deleteConfirmExisting', { name: ingredient?.name ?? '' }) }}
      </p>
      <div class="flex gap-2 flex-none">
        <UButton size="xs" color="neutral" variant="soft" @click="confirmingDelete = false">{{ $t('common.cancel') }}</UButton>
        <UButton size="xs" color="error" @click="doDelete">{{ $t('common.delete') }}</UButton>
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
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{{ $t('ingredients.name') }}</div>
        <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ ingredient?.name }}</div>
      </div>
      <div>
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{{ $t('ingredients.kind') }}</div>
        <span
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          :class="ingredient!.kind === 'purchased'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'"
        >{{ ingredient!.kind }}</span>
      </div>
      <div>
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{{ $t('ingredients.unit') }}</div>
        <div class="text-sm text-gray-700 dark:text-gray-300">{{ ingredient?.default_unit_code }}</div>
      </div>
      <div>
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{{ $t('ingredients.unitCost') }}</div>
        <div class="text-sm text-gray-700 dark:text-gray-300">
          {{ ingredient?.standard_unit_cost != null ? `€ ${ingredient.standard_unit_cost.toFixed(6)}` : '—' }}
        </div>
      </div>
      <div>
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{{ $t('ingredients.comment') }}</div>
        <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ ingredient?.comment || '—' }}</div>
      </div>
      <div>
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.allergens') }}</div>
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
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.name') }} *</label>
        <input v-model="draft.name"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('ingredients.namePlaceholder')" autocomplete="off" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.unit') }} *</label>
        <select v-model="draft.default_unit_id"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.unitCost') }}</label>
        <input v-model="draft.standard_unit_cost" type="number" min="0" step="0.000001"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('ingredients.costPlaceholder')" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.comment') }}</label>
        <textarea v-model="draft.comment" rows="2"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('ingredients.commentPlaceholder')" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{{ $t('ingredients.allergens') }}</label>
        <div v-if="allergens.length === 0" class="text-sm text-gray-400 dark:text-gray-600">{{ $t('ingredients.noAllergens') }}</div>
        <div v-else class="grid grid-cols-2 gap-y-1 gap-x-4">
          <label v-for="al in allergens" :key="al.id" class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
            <input type="checkbox" :checked="selectedAllergenIds.includes(al.id)"
              class="rounded border-gray-300 dark:border-gray-700" @change="toggleAllergen(al.id)" />
            {{ al.name }}
          </label>
        </div>
      </div>
      <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
        <UButton color="neutral" variant="soft" @click="cancelEdit">{{ $t('common.cancel') }}</UButton>
        <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
      </div>
    </template>

  </div>

  <!-- Edit sheet (existing ingredient) -->
  <AppBottomSheet :open="showEditSheet" @close="cancelEdit">
    <div class="p-4 space-y-4 max-w-lg">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-200 dark:border-gray-800">
        {{ $t('ingredients.editTitle') }} — {{ ingredient?.name }}
      </h3>
      <AdminImageUpload
        v-if="ingredient?.id"
        :image-url="imageUrl"
        :uploading="imageUploading"
        :can-manage="canManage && !isProduced"
        @upload="uploadImage"
        @remove="removeImage"
      />
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.name') }} *</label>
        <input v-model="draft.name"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('ingredients.namePlaceholder')" autocomplete="off" />
      </div>
      <div v-if="!isProduced">
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.unit') }} *</label>
        <select v-model="draft.default_unit_id"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
        </select>
      </div>
      <div v-if="!isProduced">
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.unitCost') }}</label>
        <input v-model="draft.standard_unit_cost" type="number" min="0" step="0.000001"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('ingredients.costPlaceholder')" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('ingredients.comment') }}</label>
        <textarea v-model="draft.comment" rows="2"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          :placeholder="$t('ingredients.commentPlaceholder')" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{{ $t('ingredients.allergens') }}</label>
        <div v-if="allergens.length === 0" class="text-sm text-gray-400 dark:text-gray-600">{{ $t('ingredients.noAllergens') }}</div>
        <div v-else class="grid grid-cols-2 gap-y-1 gap-x-4">
          <label v-for="al in allergens" :key="al.id" class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
            <input type="checkbox" :checked="selectedAllergenIds.includes(al.id)"
              class="rounded border-gray-300 dark:border-gray-700" @change="toggleAllergen(al.id)" />
            {{ al.name }}
          </label>
        </div>
      </div>
      <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
        <UButton color="neutral" variant="soft" @click="cancelEdit">{{ $t('common.cancel') }}</UButton>
        <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
      </div>
    </div>
  </AppBottomSheet>
</template>
