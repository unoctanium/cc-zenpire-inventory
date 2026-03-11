/**
 * useClientSettings
 *
 * Caches the client's content source locale (content_locale) app-wide.
 * - loadIfNeeded(): fetches once, then reuses cache (for display use)
 * - reload(): always re-fetches (call before opening edit form, so a
 *   recently-changed source language is reflected immediately)
 * Client-only (returns empty string during SSR — guard with onMounted).
 */
export function useClientSettings() {
  const sourceLang = useState<string>('clientSourceLang', () => '')

  async function reload() {
    if (!import.meta.client) return
    try {
      const data = await $fetch('/api/client/content-locale', { credentials: 'include' })
      sourceLang.value = (data as any).content_locale ?? 'de'
    } catch {
      sourceLang.value = 'de'
    }
  }

  async function loadIfNeeded() {
    if (!import.meta.client) return
    if (sourceLang.value) return
    await reload()
  }

  return { sourceLang, loadIfNeeded, reload }
}
