/**
 * useClientSettings
 *
 * Caches the client's content source locale (content_locale) app-wide.
 * Fetches once on first call, subsequent calls reuse the cached value.
 * Client-only (returns empty string during SSR — guard with onMounted).
 */
export function useClientSettings() {
  const sourceLang = useState<string>('clientSourceLang', () => '')

  async function loadIfNeeded() {
    if (!import.meta.client) return
    if (sourceLang.value) return
    try {
      const data = await $fetch('/api/client/content-locale', { credentials: 'include' })
      sourceLang.value = (data as any).content_locale ?? 'de'
    } catch {
      sourceLang.value = 'de'
    }
  }

  return { sourceLang, loadIfNeeded }
}
