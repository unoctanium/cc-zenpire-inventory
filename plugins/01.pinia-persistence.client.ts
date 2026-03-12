const PERSISTED_STORES = new Set(['units', 'allergens', 'ingredients', 'recipes', 'allergenCard'])

export default defineNuxtPlugin((nuxtApp) => {
  try {
    const pinia = (nuxtApp as any).$pinia
    if (!pinia) { console.warn('[pinia-persistence] $pinia not available'); return }

    pinia.use(({ store }: { store: any }) => {
      if (!PERSISTED_STORES.has(store.$id)) return
      const key = `zenpire_store_${store.$id}`
      try {
        const raw = localStorage.getItem(key)
        if (raw && raw !== 'undefined') store.$patch(JSON.parse(raw))
      } catch (e) {
        console.warn('[pinia-persistence] restore failed for', store.$id, e)
        try { localStorage.removeItem(key) } catch {}
      }
      store.$subscribe((_: any, state: any) => {
        try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
      }, { detached: true })
    })
  } catch (e) {
    console.error('[pinia-persistence] plugin init failed:', e)
  }
})
