import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return
  const auth = useAuth()
  if (!auth.value?.ok) {
    return navigateTo('/login')
  }
})
