export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const { data: cached } = useNuxtData('/api/auth/me')

  if (cached.value !== null) {
    // Cache warm — use it
    if (!(cached.value as any)?.ok) return navigateTo('/login')
    return
  }

  // Cache cold (fresh page load) — fetch
  const { data } = await useFetch('/api/auth/me', {
    key: '/api/auth/me',
    server: false,
    credentials: 'include',
    retry: false,
  })

  if (!(data.value as any)?.ok) return navigateTo('/login')
})
