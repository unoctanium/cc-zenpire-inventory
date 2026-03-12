import { defineStore, skipHydrate } from 'pinia'
import { ref, computed } from 'vue'

export type Recipe = {
  id: string; recipe_id: string | null; name: string; description: string
  output_quantity: number; output_unit_id: string; output_unit_code: string; output_unit_type: string
  standard_unit_cost: number | null; comp_cost: number | null
  is_active: boolean; is_pre_product: boolean
  component_count: number; created_at: string; updated_at: string
  is_machine_translation?: boolean
}

export type RecipeComponent = {
  id: string; recipe_id: string
  ingredient_id: string | null; sub_recipe_id: string | null
  quantity: number; unit_id: string; unit_code: string
  sort_order: number; type: 'ingredient' | 'sub_recipe'; name: string
  std_cost: number | null; base_unit_factor: number | null; component_unit_factor: number | null
  yield_pct: number
}

export type RecipeDetail = {
  recipe: {
    id: string; name: string; description: string
    production_notes: string; has_image: boolean
    allergen_ids: string[]; name_translation_locked: boolean
    [key: string]: any
  }
  components: RecipeComponent[]
}

export const useRecipesStore = defineStore('recipes', () => {
  const byLocale       = skipHydrate(ref<Record<string, Recipe[]>>({}))
  const detailByLocale = skipHydrate(ref<Record<string, RecipeDetail>>({}))
  const loading        = ref(false)
  const fetchedAt      = skipHydrate(ref<Record<string, number>>({}))

  function forLocale(locale: string) {
    return computed(() => byLocale.value[locale] ?? [])
  }

  function getDetail(id: string, locale: string) {
    return computed(() => detailByLocale.value[`${id}_${locale}`] ?? null)
  }

  async function load(locale: string) {
    if (!import.meta.client) return
    loading.value = true
    try {
      const res = await $fetch<{ recipes: Recipe[] }>(`/api/recipes?locale=${locale}`, { credentials: 'include' })
      byLocale.value  = { ...byLocale.value, [locale]: res.recipes ?? [] }
      fetchedAt.value = { ...fetchedAt.value, [locale]: Date.now() }
    } catch { /* offline — keep cached */ }
    finally { loading.value = false }
  }

  async function loadDetail(id: string, locale: string) {
    if (!import.meta.client) return
    try {
      const res = await $fetch<{ ok: boolean; recipe: any; components: RecipeComponent[] }>(
        `/api/recipes/${id}?locale=${locale}`, { credentials: 'include' }
      )
      detailByLocale.value = {
        ...detailByLocale.value,
        [`${id}_${locale}`]: { recipe: res.recipe, components: res.components ?? [] },
      }
    } catch { /* offline — keep cached */ }
  }

  return { byLocale, detailByLocale, loading, fetchedAt, forLocale, getDetail, load, loadDetail }
})
