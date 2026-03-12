import { defineStore, skipHydrate } from 'pinia'
import { ref, computed } from 'vue'

export type Unit = { id: string; code: string; name: string; unit_type: string; factor: number }

export const useUnitsStore = defineStore('units', () => {
  const items     = skipHydrate(ref<Unit[]>([]))
  const loading   = ref(false)
  const fetchedAt = skipHydrate(ref(0))

  async function load() {
    if (!import.meta.client) return
    loading.value = true
    try {
      const res = await $fetch<{ units: Unit[] }>('/api/units', { credentials: 'include' })
      items.value     = res.units ?? []
      fetchedAt.value = Date.now()
    } catch { /* offline — keep cached */ }
    finally { loading.value = false }
  }

  return { items, loading, fetchedAt, load }
})
