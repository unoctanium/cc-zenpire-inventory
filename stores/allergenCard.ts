import { defineStore, skipHydrate } from 'pinia'
import { ref, computed } from 'vue'

export type AllergenCardAllergen = { id: string; name: string; code: string | null }
export type AllergenCardRecipe   = { id: string; name: string; allergen_ids: string[] }

export const useAllergenCardStore = defineStore('allergenCard', () => {
  const allergensByLocale = skipHydrate(ref<Record<string, AllergenCardAllergen[]>>({}))
  const recipesByLocale   = skipHydrate(ref<Record<string, AllergenCardRecipe[]>>({}))
  const loading           = ref(false)
  const fetchedAt         = skipHydrate(ref<Record<string, number>>({}))

  function forLocale(locale: string) {
    return {
      allergens: computed(() => allergensByLocale.value[locale] ?? []),
      recipes:   computed(() => recipesByLocale.value[locale] ?? []),
    }
  }

  async function load(locale: string) {
    if (!import.meta.client) return
    loading.value = true
    try {
      const res = await $fetch<{ ok: boolean; allergens: AllergenCardAllergen[]; recipes: AllergenCardRecipe[] }>(
        `/api/allergen-card?locale=${locale}`, { credentials: 'include' }
      )
      allergensByLocale.value = { ...allergensByLocale.value, [locale]: res.allergens ?? [] }
      recipesByLocale.value   = { ...recipesByLocale.value,   [locale]: res.recipes   ?? [] }
      fetchedAt.value         = { ...fetchedAt.value,         [locale]: Date.now() }
    } catch { /* offline — keep cached */ }
    finally { loading.value = false }
  }

  return { allergensByLocale, recipesByLocale, loading, fetchedAt, forLocale, load }
})
