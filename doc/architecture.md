# Architecture

*Last updated: 2026-03-12*

---

## Overview

Zenpire Inventory is a **multi-tenant, SQL-first, PWA-capable** web application for restaurant recipe and inventory management.

```
Browser (Vue 3 / Nuxt 4)
    │
    │  HTTPS
    ▼
Nuxt Server Routes  ← BFF (auth, RBAC, orchestration only)
    │
    │  Service Role Key (server-only)
    ▼
Supabase (Postgres)
```

The browser **never** talks to Supabase directly. All data access goes through Nuxt server routes.

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend + SSR | Nuxt 4 (Vue 3) | Nuxt 4.3 / Vue 3.5 |
| UI components | @nuxt/ui (Tailwind-based) | 4.4 |
| State management | Pinia | 0.11 |
| i18n | @nuxtjs/i18n | 10.2 |
| PWA / Service Worker | @vite-pwa/nuxt | 1.1 |
| Server layer | Nuxt server routes (H3) | — |
| Database | Supabase (Postgres) | — |
| Auth | Supabase Auth (email/password, session cookie) | — |
| Schema management | Supabase CLI (versioned migrations) | 2.76 |
| Translation | DeepL API | — |
| Offline utilities | @vueuse/core | 14.2 |

---

## Multi-Tenancy

Every client (restaurant group) is fully isolated. Isolation is enforced at the **application layer** — not via Postgres RLS.

### How it works

1. Every business table has a `client_id` column.
2. Every server route calls `resolveAppUser(event)` → `{ clientId }`.
3. Every query filters by `client_id`.

```
auth.users  →  app_user.auth_user_id
                │
                └── app_user.client_id  →  client.id
                                                │
                                                └── all business data
```

Join tables (`recipe_component`, `ingredient_allergen`, i18n tables) carry no `client_id` — they are implicitly scoped via their parent FK.

### Dev tenant

| Entity | UUID |
|---|---|
| Client | `00000000-0000-0000-0000-000000000001` |
| Store | `00000000-0000-0000-0000-000000000002` |
| Admin user | `admin@zenpire.eu` |

---

## Server Route Pattern (Thin BFF)

Every protected route follows exactly this pattern:

```typescript
export default defineEventHandler(async (event) => {
  // 1. Check permission
  await requirePermission(event, 'recipe.manage')

  // 2. Resolve tenant
  const { clientId } = await resolveAppUser(event)

  // 3. Validate input
  const body = await readBody(event)

  // 4. Query DB — always filter by client_id
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe')
    .select('...')
    .eq('client_id', clientId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // 5. Return
  return { ok: true, data }
})
```

**Rules:**
- No business logic in Vue components.
- No direct table mutations from the browser.
- Server routes orchestrate only — complex business logic lives in Postgres.

---

## Authentication

Flow:
1. `POST /api/auth/login` → calls `supabaseServer().auth.signInWithPassword()` → sets session cookie.
2. Subsequent requests: Nuxt reads session cookie via `@supabase/ssr`.
3. `resolveAppUser(event)` reads the authenticated user from the session, looks up `app_user` record, returns `{ authUser, appUserId, clientId }`.
4. Logout: `POST /api/auth/logout` → signs out via Supabase, clears session cookie.

---

## RBAC

```
app_user  ──<  user_role  >──  role  ──<  role_permission  >──  permission
                                                                      │
                                                                 v_user_permissions
                                                                      │
                                                              requirePermission()
```

Permissions are checked server-side via `v_user_permissions` view.
The browser receives the resolved permission list from `GET /api/auth/me`.

---

## Frontend Architecture

### Page layout pattern

Most pages use `AppSplitLayout`:
- **Tablet/desktop:** left panel (list) + right panel (detail)
- **Mobile:** list only; tapping navigates to `/route/:id`

### State management

Data is fetched once and cached in Pinia stores keyed by locale:

```typescript
ingredientsStore.load('de')     // fetches /api/ingredients?locale=de
ingredientsStore.forLocale('de') // computed ref from cache
```

Stores invalidate and reload on:
- Save/delete (explicit `store.load(locale)` call)
- UI language change (`watch(locale, ...)` in pages)
- Post-translation reload (in detail components)

### Offline / PWA

- Service worker via Workbox (`@vite-pwa/nuxt`)
- Auth endpoints: `NetworkFirst` (3 s timeout → fallback to cache)
- Read-only data (`/api/units`, `/api/ingredients`, etc.): `StaleWhileRevalidate`
- i18n locale files: `CacheFirst`
- Max 500 entries per cache
- Online status tracked via `useOnlineStatus()` → `canManage` disabled when offline

---

## i18n

### UI language

Three supported locales: `en`, `de`, `ja`. Controlled by `@nuxtjs/i18n`.
Translation keys are in `i18n/locales/{en,de,ja}.json`.

### Content language

Each client has a **source locale** (`client.content_locale`). This is the language used for data entry. Content in other locales lives in `*_i18n` tables and is machine-translated via DeepL.

See [translations.md](./translations.md) for the full translation system.

---

## Migrations

All schema changes are versioned Supabase CLI migrations. The Supabase dashboard is never modified directly.

```bash
# Create a new migration
npx supabase migration new <descriptive_name>

# Apply to remote DB
npx supabase db push

# Check status
npx supabase migration list
```

Naming convention: `add_recipe_yield_column`, `create_fn_post_production_batch`.

---

## Key Server Utilities

| File | Purpose |
|---|---|
| `server/utils/supabase.ts` | `supabaseAdmin()` (service role) and `supabaseServer(event)` (user session) |
| `server/utils/resolve-app-user.ts` | `resolveAppUser(event)` → `{ authUser, appUserId, clientId }` |
| `server/utils/require-permission.ts` | `requirePermission(event, 'code')` — throws 403 on failure |
| `server/utils/require-any-permission.ts` | `requireAnyPermission(event, ['a', 'b'])` |
| `server/utils/require-user.ts` | `requireUser(event)` — only checks authentication |
| `server/utils/deepl.ts` | `translateTexts(texts, target, source)` — DeepL batch API |

---

## Architectural Principles

1. **SQL-first** — business logic lives in Postgres
2. **Thin BFF** — server routes orchestrate only
3. **Migration-driven** — all schema changes are versioned and reproducible
4. **Multi-tenant by design** — every query scoped by `client_id`
5. **Application-level isolation** — service role key + `client_id` filters (not RLS)
6. **Deterministic development** — seed is idempotent; any dev can reproduce exact state
7. **No direct browser writes** — the browser never calls Supabase directly
