<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

type RecipeRow        = { id: string; name: string; description: string; output_quantity: number; output_unit_id: string; output_unit_code: string; standard_unit_cost: number | null; comp_cost: number | null; is_active: boolean; is_pre_product: boolean; component_count: number; created_at: string; updated_at: string }
type UnitOption       = { id: string; code: string; name: string }
type IngredientOption = { id: string; name: string; kind: string; default_unit_id: string }

const { canManage } = useTablePermissions('recipe')

const { data: unitData }       = await useFetch<{ ok: boolean; units: UnitOption[] }>('/api/units', { credentials: 'include' })
const { data: ingredientData } = await useFetch<{ ok: boolean; ingredients: IngredientOption[] }>('/api/ingredients', { credentials: 'include' })
const { data: allRecipeData }  = await useFetch<{ ok: boolean; recipes: RecipeRow[] }>('/api/recipes', { credentials: 'include' })

const units       = computed(() => unitData.value?.units ?? [])
const ingredients = computed(() => (ingredientData.value?.ingredients ?? []).filter(i => i.kind === 'purchased'))
const allRecipes  = computed(() => allRecipeData.value?.recipes ?? [])

function onSaved(id: string) { navigateTo(`/recipes/${id}`) }
function onDeleted()         { navigateTo('/recipes') }
function onCancelled()       { navigateTo('/recipes') }
</script>

<template>
  <div>
    <AppRecipeDetail
      :recipe="null"
      :units="units"
      :ingredients="ingredients"
      :all-recipes="allRecipes"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </div>
</template>
