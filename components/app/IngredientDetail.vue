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
}>()

const { t }  = useI18n()
const toast  = useToast()

// ─── mode ─────────────────────────────────────────────────────────────────────

const editMode = ref(false)

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
      editMode.value = false
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
      editMode.value = false
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

function cancelEdit() {
  if (isNew.value) {
    // Nothing to revert to — parent handles clearing selection
    return
  }
  // Revert draft from ingredient prop
  if (props.ingredient) {
    draft.name               = props.ingredient.name
    draft.default_unit_id    = props.ingredient.default_unit_id
    draft.standard_unit_cost = props.ingredient.standard_unit_cost ?? ''
    draft.comment            = props.ingredient.comment ?? ''
  }
  editMode.value = false
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
        <template v-else-if="editMode">{{ $t('ingredients.editTitle') }}</template>
        <template v-else>{{ $t('ingredients.viewTitle') }}</template>
      </h2>
      <div v-if="!isNew && !editMode" class="flex items-center gap-1">
        <UButton
          v-if="canManage && !isProduced"
          size="xs" color="neutral" variant="ghost"
          icon="i-heroicons-pencil-square"
          @click="editMode = true"
        >{{ $t('common.edit') }}</UButton>
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
      :can-manage="canManage && editMode && !isProduced"
      @upload="uploadImage"
      @remove="removeImage"
    />

    <!-- Name -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ $t('ingredients.name') }} *
      </label>
      <input
        v-if="editMode"
        v-model="draft.name"
        class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
               focus:outline-none focus:ring-1 focus:ring-gray-400
               dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        :placeholder="$t('ingredients.namePlaceholder')"
        autocomplete="off"
      />
      <div v-else class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ ingredient?.name }}</div>
    </div>

    <!-- Kind (always read-only) -->
    <div v-if="ingredient">
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ $t('ingredients.kind') }}
      </label>
      <span
        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        :class="ingredient.kind === 'purchased'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'"
      >
        {{ ingredient.kind }}
      </span>
    </div>

    <!-- Default unit -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ $t('ingredients.unit') }} *
      </label>
      <select
        v-if="editMode && !isProduced"
        v-model="draft.default_unit_id"
        class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
               focus:outline-none focus:ring-1 focus:ring-gray-400
               dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
      </select>
      <div v-else class="text-sm text-gray-700 dark:text-gray-300">
        {{ ingredient?.default_unit_code ?? units.find(u => u.id === draft.default_unit_id)?.code }}
      </div>
    </div>

    <!-- Unit cost -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ $t('ingredients.unitCost') }}
      </label>
      <input
        v-if="editMode && !isProduced"
        v-model="draft.standard_unit_cost"
        type="number" min="0" step="0.000001"
        class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
               focus:outline-none focus:ring-1 focus:ring-gray-400
               dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        :placeholder="$t('ingredients.costPlaceholder')"
      />
      <div v-else class="text-sm text-gray-700 dark:text-gray-300">
        {{ ingredient?.standard_unit_cost != null ? `€ ${ingredient.standard_unit_cost.toFixed(6)}` : '—' }}
      </div>
    </div>

    <!-- Comment -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ $t('ingredients.comment') }}
      </label>
      <textarea
        v-if="editMode"
        v-model="draft.comment"
        rows="2"
        class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
               focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
               dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        :placeholder="$t('ingredients.commentPlaceholder')"
      />
      <div v-else class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
        {{ ingredient?.comment || '—' }}
      </div>
    </div>

    <!-- Allergens -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {{ $t('ingredients.allergens') }}
      </label>
      <div v-if="loadingDetail" class="text-sm text-gray-400 dark:text-gray-600">{{ $t('common.loading') }}</div>
      <div v-else-if="allergens.length === 0" class="text-sm text-gray-400 dark:text-gray-600">
        {{ $t('ingredients.noAllergens') }}
      </div>
      <div v-else class="grid grid-cols-2 gap-y-1 gap-x-4">
        <label
          v-for="al in allergens"
          :key="al.id"
          class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
          :class="editMode ? 'cursor-pointer' : 'cursor-default'"
        >
          <input
            type="checkbox"
            :checked="selectedAllergenIds.includes(al.id)"
            :disabled="!editMode"
            class="rounded border-gray-300 dark:border-gray-700"
            @change="toggleAllergen(al.id)"
          />
          {{ al.name }}
        </label>
      </div>
    </div>

    <!-- Action buttons (edit mode) -->
    <div v-if="editMode" class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
      <UButton v-if="!isNew" color="neutral" variant="soft" @click="cancelEdit">
        {{ $t('common.cancel') }}
      </UButton>
      <UButton :loading="saving" @click="save">
        {{ $t('common.save') }}
      </UButton>
    </div>

  </div>
</template>
