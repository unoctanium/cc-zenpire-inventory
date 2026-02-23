export type AuthState = {
  ok: boolean
  email: string
  app_user_id: string
  permissions: string[]
  is_admin: boolean
} | null

export const useAuth = () => useState<AuthState>('auth', () => null)

export async function fetchAuth(fetchFn: typeof $fetch = $fetch) {
  const auth = useAuth()
  try {
    const data = await fetchFn<AuthState>('/api/auth/me')
    auth.value = data
  } catch {
    auth.value = null
  }
  return auth
}
