<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { contentLocaleParam } = useContentLocale()

type IngredientRow = {
  id: string; article_id: string | null; name: string; kind: string
  default_unit_id: string; default_unit_code: string; default_unit_type: string
  standard_unit_cost: number | null; standard_cost_currency: string
  produced_by_recipe_id: string | null; comment: string | null
}
type UnitOption     = { id: string; code: string; name: string; unit_type: string }
type AllergenOption = { id: string; name: string; comment: string | null }

const route = useRoute()
const id    = computed(() => route.params.id as string)

const { canManage } = useTablePermissions('recipe')

const { data: ingredientData, refresh } = await useFetch<{ ok: boolean; ingredient: IngredientRow }>(() => `/api/ingredients/${id.value}?${contentLocaleParam.value}`, { credentials: 'include' })
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
