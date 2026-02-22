export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return

  const { data } = useNuxtData('/api/auth/me')

  // data.value is null = not yet loaded, don't redirect
  // data.value exists but ok is false = definitely not authed, redirect
  if (data.value !== null && !(data.value as any)?.ok) {
    return navigateTo('/login')
  }
})
