<script setup lang="ts">
/**
 * RecipeNewIngredientModal
 *
 * Quick-create a new purchased ingredient from within the recipe editor.
 *
 * Emits:
 *   created(ingredient) — the newly created ingredient row
 *   update:open(false)  — close the modal
 */

type UnitOption = { id: string; code: string; name: string }

const props = defineProps<{
  open:  boolean
  units: UnitOption[]
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'created', ingredient: { id: string; name: string; kind: string; default_unit_id: string }): void
}>()

const { t } = useI18n()

const name              = ref('')
const default_unit_id   = ref('')
const standard_unit_cost = ref('')
const saving            = ref(false)
const errorMsg          = ref('')

watch(() => props.open, (v) => {
  if (v) {
    name.value               = ''
    default_unit_id.value    = props.units[0]?.id ?? ''
    standard_unit_cost.value = ''
    saving.value             = false
    errorMsg.value           = ''
  }
})

async function save() {
  if (!name.value.trim() || !default_unit_id.value) {
    errorMsg.value = t('ingredients.nameAndUnitRequired')
    return
  }
  const costValue = standard_unit_cost.value.trim() === ''
    ? null
    : Number(standard_unit_cost.value)
  if (standard_unit_cost.value.trim() !== '' && isNaN(costValue as number)) {
    errorMsg.value = t('ingredients.invalidCost')
    return
  }
  errorMsg.value = ''
  saving.value = true
  try {
    const ingredient = await $fetch<{ ok: boolean; ingredient: any }>('/api/ingredients', {
      method: 'POST',
      credentials: 'include',
      body: {
        name: name.value.trim(),
        default_unit_id: default_unit_id.value,
        standard_unit_cost: costValue,
      },
    })
    toast.add({ title: t('ingredients.created') })
    emit('created', ingredient.ingredient)
    emit('update:open', false)
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage ?? e?.message ?? String(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal :open="open" :title="$t('ingredients.add')" @update:open="emit('update:open', $event)">
    <template #body>
      <div class="space-y-3">
        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('ingredients.name') }} *
          </label>
          <input
            v-model="name"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('ingredients.namePlaceholder')"
            autocomplete="off"
          />
        </div>

        <!-- Default unit -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('ingredients.unit') }} *
          </label>
          <select
            v-model="default_unit_id"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }} – {{ u.name }}</option>
          </select>
        </div>

        <!-- Std cost (optional) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ $t('ingredients.standardCost') }}
          </label>
          <input
            v-model="standard_unit_cost"
            type="number" min="0" step="0.000001"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('ingredients.costPlaceholder')"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="space-y-2">
        <p v-if="errorMsg" class="text-sm text-red-600 dark:text-red-400">{{ errorMsg }}</p>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="soft" @click="emit('update:open', false)">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton :loading="saving" @click="save">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
