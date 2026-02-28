<script setup lang="ts">
/**
 * AdminIngredientEditModal
 *
 * Create or edit an ingredient with comment and allergen checkboxes.
 *
 * Props:
 *   open        — v-model, controls visibility
 *   ingredient  — null for new ingredient, IngredientRow for editing/viewing
 *   units       — available unit options
 *   allergens   — all allergens for checkbox list
 *   viewMode?   — read-only mode
 *
 * Emits:
 *   update:open(false)
 *   saved — ingredient was saved (list should refresh)
 */

type IngredientRow = {
  id: string; name: string; kind: string
  default_unit_id: string; default_unit_code: string
  standard_unit_cost: number | null; standard_cost_currency: string
  produced_by_recipe_id: string | null; comment: string | null
}

type UnitOption    = { id: string; code: string; name: string }
type AllergenOption = { id: string; name: string; comment: string | null }

const props = defineProps<{
  open:       boolean
  ingredient: IngredientRow | null
  units:      UnitOption[]
  allergens:  AllergenOption[]
  viewMode?:  boolean
  canManage?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved'): void
}>()

const { t }   = useI18n()
const toast   = useToast()

const draft = reactive({
  name:               '',
  default_unit_id:    '',
  standard_unit_cost: '' as string | number,
  comment:            '',
})

const selectedAllergenIds = ref<string[]>([])
const saving              = ref(false)
const loadingDetail       = ref(false)
const inViewMode          = ref(false)
const hasImage            = ref(false)
const imageUploading      = ref(false)

watch(() => props.open, async (v) => {
  if (!v) return
  inViewMode.value = props.viewMode ?? false
  selectedAllergenIds.value = []

  if (props.ingredient) {
    draft.name               = props.ingredient.name
    draft.default_unit_id    = props.ingredient.default_unit_id
    draft.standard_unit_cost = props.ingredient.standard_unit_cost ?? ''
    draft.comment            = props.ingredient.comment ?? ''

    // Fetch allergen_ids (and refresh comment) lazily
    try {
      loadingDetail.value = true
      const detail = await $fetch<{ ok: boolean; ingredient: any }>(
        `/api/ingredients/${props.ingredient.id}`,
        { credentials: 'include' }
      )
      draft.comment             = detail.ingredient.comment ?? ''
      selectedAllergenIds.value = detail.ingredient.allergen_ids ?? []
      hasImage.value            = detail.ingredient.has_image ?? false
    } catch { /* non-fatal */ } finally {
      loadingDetail.value = false
    }
  } else {
    draft.name               = ''
    draft.default_unit_id    = props.units[0]?.id ?? ''
    draft.standard_unit_cost = ''
    draft.comment            = ''
    hasImage.value           = false
  }
})

const imageUrl = computed(() =>
  hasImage.value && props.ingredient?.id
    ? `/api/ingredients/${props.ingredient.id}/image`
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
  if (!props.ingredient?.id) return
  try {
    await $fetch(`/api/ingredients/${props.ingredient.id}/image`,
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

function toggleAllergen(id: string) {
  const idx = selectedAllergenIds.value.indexOf(id)
  if (idx === -1) selectedAllergenIds.value.push(id)
  else            selectedAllergenIds.value.splice(idx, 1)
}

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
    } else {
      await $fetch('/api/ingredients', { method: 'POST', credentials: 'include', body })
      toast.add({ title: t('ingredients.created') })
    }
    emit('saved')
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
</script>

<template>
  <UModal :open="open" size="lg" @update:open="emit('update:open', $event)">
    <template #header>
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
        <template v-if="inViewMode">
          {{ $t('ingredients.viewTitle') }}
          <span class="ml-1 text-gray-500 font-normal">— {{ ingredient?.name }}</span>
        </template>
        <template v-else>
          {{ ingredient ? $t('ingredients.editTitle') : $t('ingredients.newTitle') }}
          <span v-if="ingredient" class="ml-1 text-gray-500 font-normal">— {{ ingredient.name }}</span>
        </template>
      </h2>
    </template>

    <template #body>
      <div class="space-y-4">

        <!-- Image -->
        <AdminImageUpload v-if="ingredient?.id"
          :image-url="imageUrl"
          :uploading="imageUploading"
          :can-manage="canManage && ingredient?.kind !== 'produced'"
          @upload="uploadImage"
          @remove="removeImage"
        />

        <!-- Name -->
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {{ $t('ingredients.name') }} *
          </label>
          <input v-if="!inViewMode" v-model="draft.name"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('ingredients.namePlaceholder')" autocomplete="off" />
          <div v-else class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ draft.name }}</div>
        </div>

        <!-- Kind — always read-only -->
        <div v-if="ingredient">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {{ $t('ingredients.kind') }}
          </label>
          <div class="text-sm text-gray-700 dark:text-gray-300">{{ ingredient.kind }}</div>
        </div>

        <!-- Default unit -->
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {{ $t('ingredients.unit') }} *
          </label>
          <select v-if="!inViewMode && (!ingredient || ingredient.kind !== 'produced')"
            v-model="draft.default_unit_id"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
            <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
          </select>
          <div v-else class="text-sm text-gray-700 dark:text-gray-300">{{ ingredient?.default_unit_code }}</div>
        </div>

        <!-- Standard cost -->
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {{ $t('ingredients.standardCost') }}
          </label>
          <input v-if="!inViewMode && (!ingredient || ingredient.kind !== 'produced')"
            v-model="draft.standard_unit_cost"
            type="number" min="0" step="0.000001"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('ingredients.costPlaceholder')" />
          <div v-else class="text-sm text-gray-700 dark:text-gray-300">
            {{ ingredient?.standard_unit_cost != null ? `€ ${ingredient.standard_unit_cost}` : '—' }}
          </div>
        </div>

        <!-- Comment -->
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {{ $t('ingredients.comment') }}
          </label>
          <textarea v-if="!inViewMode" v-model="draft.comment" rows="2"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('ingredients.commentPlaceholder')" />
          <div v-else class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {{ draft.comment || '—' }}
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
            <label v-for="al in allergens" :key="al.id"
              class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
              :class="inViewMode ? 'cursor-default' : 'cursor-pointer'">
              <input
                type="checkbox"
                :checked="selectedAllergenIds.includes(al.id)"
                :disabled="inViewMode"
                class="rounded border-gray-300 dark:border-gray-700"
                @change="toggleAllergen(al.id)"
              />
              {{ al.name }}
            </label>
          </div>
        </div>

      </div>
    </template>

    <template #footer>
      <!-- View mode: Close + Edit (for purchased only, and only when canManage) -->
      <div v-if="inViewMode" class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="soft" @click="emit('update:open', false)">
          {{ $t('common.close') }}
        </UButton>
        <UButton v-if="canManage && ingredient?.kind !== 'produced'" @click="inViewMode = false">
          {{ $t('common.edit') }}
        </UButton>
      </div>
      <!-- Edit mode: Cancel + Save -->
      <div v-else class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="soft" @click="emit('update:open', false)">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton :loading="saving" @click="save">
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
