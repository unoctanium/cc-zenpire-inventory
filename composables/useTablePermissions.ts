/**
 * useTablePermissions
 *
 * Reads the current user's permissions from /api/auth/me and exposes
 * reactive canRead / canManage computed refs.
 *
 * Uses useAuth() so no extra fetch is needed — the plugin already populated it.
 *
 * Usage:
 *   const { canRead, canManage } = useTablePermissions('unit')
 *   // checks 'unit.read' and 'unit.manage'
 */

import { useAuth } from '~/composables/useAuth'

export function useTablePermissions(resource: string) {
  const auth = useAuth()

  function has(permission: string): boolean {
    if (auth.value?.is_admin) return true
    return auth.value?.permissions?.includes(permission) ?? false
  }

  const canRead   = computed(() => has(`${resource}.manage`) || has(`${resource}.read`))
  const canManage = computed(() => has(`${resource}.manage`))

  return { canRead, canManage }
}
