import { defineStore, skipHydrate } from 'pinia'
import { ref, computed } from 'vue'

export type Ingredient = {
  id: string; name: string; kind: string
  default_unit_id: string; default_unit_type: string
  is_machine_translation?: boolean
}

export const useIngredientsStore = defineStore('ingredients', () => {
  const byLocale  = skipHydrate(ref<Record<string, Ingredient[]>>({}))
  const loading   = ref(false)
  const fetchedAt = skipHydrate(ref<Record<string, number>>({}))

  function forLocale(locale: string) {
    return computed(() => byLocale.value[locale] ?? [])
  }

  async function load(locale: string) {
    if (!import.meta.client) return
    loading.value = true
    try {
      const res = await $fetch<{ ingredients: Ingredient[] }>(`/api/ingredients?locale=${locale}`, { credentials: 'include' })
      byLocale.value  = { ...byLocale.value, [locale]: res.ingredients ?? [] }
      fetchedAt.value = { ...fetchedAt.value, [locale]: Date.now() }
    } catch { /* offline — keep cached */ }
    finally { loading.value = false }
  }

  return { byLocale, loading, fetchedAt, forLocale, load }
})
