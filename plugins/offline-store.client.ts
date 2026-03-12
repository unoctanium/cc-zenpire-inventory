import { fetchAuth } from '~/composables/useAuth'

export default defineNuxtPlugin((nuxtApp) => {
  try {
    const { isOnline } = useOnlineStatus()
    const i18n         = (nuxtApp.$i18n as any)
    const locale       = computed(() => i18n?.locale?.value ?? 'en')

    const unitsStore        = useUnitsStore()
    const allergensStore    = useAllergensStore()
    const ingredientsStore  = useIngredientsStore()
    const recipesStore      = useRecipesStore()
    const allergenCardStore = useAllergenCardStore()

    async function refreshAll(loc: string) {
      try {
        await Promise.all([
          unitsStore.load(),
          allergensStore.load(loc),
          ingredientsStore.load(loc),
          recipesStore.load(loc),
          allergenCardStore.load(loc),
        ])
      } catch (e) {
        console.warn('[offline-store] refreshAll error:', e)
      }
    }

    if (isOnline.value) refreshAll(locale.value)

    watch(isOnline, async (online) => {
      if (!online) return
      // Re-verify auth first — if token expired, fetchAuth sets auth=null
      // and the global middleware redirects to /login cleanly.
      try { await fetchAuth() } catch { /* ignore — fetchAuth already handles errors internally */ }
      refreshAll(locale.value)
    })

    watch(locale, (loc) => {
      if (isOnline.value) {
        allergensStore.load(loc)
        ingredientsStore.load(loc)
        recipesStore.load(loc)
        allergenCardStore.load(loc)
      }
    })
  } catch (e) {
    console.error('[offline-store] plugin init failed:', e)
  }
})
