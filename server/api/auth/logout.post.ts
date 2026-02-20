import { deleteCookie } from 'h3'

export default defineEventHandler(async (event) => {
  deleteCookie(event, 'sb-access-token', { path: '/' })
  deleteCookie(event, 'sb-refresh-token', { path: '/' })
  return { ok: true }
})
