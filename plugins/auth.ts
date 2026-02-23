//import { useAuth, fetchAuth } from '~/composables/useAuth'

export default defineNuxtPlugin(async () => {
  const auth = useAuth()
  if (auth.value === null) {
    await fetchAuth()
  }
})
