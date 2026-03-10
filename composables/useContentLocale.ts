/**
 * useContentLocale
 *
 * Returns the current UI locale as a query param string for content API calls.
 * Usage: $fetch(`/api/ingredients?${contentLocaleParam.value}`, ...)
 */
export function useContentLocale() {
  const { locale } = useI18n()

  // e.g. "locale=ja"
  const contentLocaleParam = computed(() => `locale=${locale.value}`)

  return { contentLocaleParam }
}
