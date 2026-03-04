<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

type IngredientRow = {
  id: string; name: string; kind: string
  default_unit_id: string; default_unit_code: string
  standard_unit_cost: number | null; standard_cost_currency: string
  produced_by_recipe_id: string | null; comment: string | null
}
type UnitOption     = { id: string; code: string; name: string }
type AllergenOption = { id: string; name: string; comment: string | null }

const route = useRoute()
const id    = computed(() => route.params.id as string)

const { canManage } = useTablePermissions('recipe')

const { data: ingredientData, refresh } = await useFetch<{ ok: boolean; ingredient: IngredientRow }>(() => `/api/ingredients/${id.value}`, { credentials: 'include' })
const { data: unitData }                = await useFetch<{ ok: boolean; units: UnitOption[] }>('/api/units', { credentials: 'include' })
const { data: allergenData }            = await useFetch<{ ok: boolean; allergens: AllergenOption[] }>('/api/allergens', { credentials: 'include' })

const ingredient = computed(() => ingredientData.value?.ingredient ?? null)
const units      = computed(() => unitData.value?.units ?? [])
const allergens  = computed(() => allergenData.value?.allergens ?? [])

function onSaved() { refresh() }
function onDeleted() { navigateTo('/ingredients') }
</script>

<template>
  <div>
    <div class="sm:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" @click="navigateTo('/ingredients')">
        <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
        {{ $t('nav.ingredients') }}
      </button>
    </div>

    <AppIngredientDetail
      v-if="ingredient"
      :ingredient="ingredient"
      :units="units"
      :allergens="allergens"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
    />
    <div v-else class="p-6 text-sm text-gray-500">{{ $t('common.loading') }}</div>
  </div>
</template>
