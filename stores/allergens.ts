import { defineStore, skipHydrate } from 'pinia'
import { ref, computed } from 'vue'

export type Allergen = { id: string; name: string; code: string | null }

export const useAllergensStore = defineStore('allergens', () => {
  const byLocale  = skipHydrate(ref<Record<string, Allergen[]>>({}))
  const loading   = ref(false)
  const fetchedAt = skipHydrate(ref<Record<string, number>>({}))

  function forLocale(locale: string) {
    return computed(() => byLocale.value[locale] ?? [])
  }

  async function load(locale: string) {
    if (!import.meta.client) return
    loading.value = true
    try {
      const res = await $fetch<{ allergens: Allergen[] }>(`/api/allergens?locale=${locale}`, { credentials: 'include' })
      byLocale.value  = { ...byLocale.value, [locale]: res.allergens ?? [] }
      fetchedAt.value = { ...fetchedAt.value, [locale]: Date.now() }
    } catch { /* offline — keep cached */ }
    finally { loading.value = false }
  }

  return { byLocale, loading, fetchedAt, forLocale, load }
})
