import type { StoreItem } from './useAuth'

const STORAGE_KEY = 'zenpire_current_store_id'

export function useCurrentStore() {
  const auth = useAuth()

  const currentStoreId = useState<string | null>('currentStoreId', () => {
    if (import.meta.client) {
      return localStorage.getItem(STORAGE_KEY) ?? null
    }
    return null
  })

  const currentStore = computed<StoreItem | null>(() => {
    const stores = auth.value?.stores ?? []
    if (!currentStoreId.value) return stores[0] ?? null
    return stores.find(s => s.id === currentStoreId.value) ?? stores[0] ?? null
  })

  function setStore(store: StoreItem) {
    currentStoreId.value = store.id
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, store.id)
    }
  }

  return { currentStore, currentStoreId, setStore }
}
