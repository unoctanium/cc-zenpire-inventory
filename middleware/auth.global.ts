/**
 * Global auth middleware — runs before any route is rendered.
 *
 * Redirecting here (before layouts mount) is the only way to avoid the 0.1s
 * flash of the default layout that occurred when the redirect lived inside
 * default.vue's watchEffect after the layout was already on screen.
 *
 * Note: auth state is populated by the auth plugin (plugins/auth.ts) which
 * runs before middleware, so auth.value is already resolved here.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuth()

  // Unauthenticated → redirect to /login (skip if already going there)
  if ((!auth.value || !auth.value.ok) && to.path !== '/login') {
    return navigateTo('/login', { replace: true })
  }

  // Already authenticated → redirect away from /login
  if (auth.value?.ok && to.path === '/login') {
    return navigateTo('/', { replace: true })
  }
})
