# Zenpire Inventory
## Developer Handbook

*Last updated: 2026-03-12*

> **More detailed docs:**
> - [architecture.md](./architecture.md) — System architecture, auth, RBAC, patterns
> - [data-model.md](./data-model.md) — Full database schema, views, migration history
> - [api.md](./api.md) — All API routes with request/response shapes
> - [frontend.md](./frontend.md) — Stores, composables, components, i18n, PWA
> - [translations.md](./translations.md) — Content translation system (DeepL)

---

# 1. Project Overview

Zenpire Inventory is a restaurant automation and digitalization platform. Core domain: recipe management, ingredient management, allergen tracking, and production support.

It is a **SQL-first, RPC-driven** system. Business logic lives in Postgres, not in application code.

**Stack:**

| Layer | Technology |
|---|---|
| Frontend + SSR | Nuxt 4 (Vue 3) |
| Server layer | Nuxt server routes (BFF) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email/password, session cookie) |
| Schema management | Supabase CLI (versioned migrations) |
| i18n | @nuxtjs/i18n (en / de / ja) |

---

# 2. Multi-Tenancy

The app is multi-tenant. Every client (restaurant group) is isolated at the application layer — not via RLS.

**Key tables:**
- `client` — top-level tenant
- `store` — a location/kitchen under a client
- `app_user` — linked to Supabase auth user; belongs to a client

**Isolation pattern:**
All business tables carry a `client_id` column. Every server route resolves `clientId` from the authenticated user and filters all queries by it.

**Dev tenant:**
- Client UUID: `00000000-0000-0000-0000-000000000001`
- Store UUID: `00000000-0000-0000-0000-000000000002`
- Admin user: `admin@zenpire.eu`

---

# 3. Repository Structure

```
app.vue
nuxt.config.ts
.env                          ← never commit

components/
  admin/                      ← table UI building blocks
  app/                        ← detail panels (RecipeDetail, IngredientDetail, …)
  reports/                    ← report table components + NavList
  AppSplitLayout.vue
  AppBottomSheet.vue
  AppFab.vue

composables/
  useAuth.ts                  ← global auth state + fetchAuth()
  useAppNav.ts                ← ALL_APPS, bar/overflow/drawer nav
  useCurrentStore.ts          ← localStorage-backed active store

layouts/
  default.vue                 ← main shell (sidebar + tabbar + drawer)
  superadmin.vue              ← blue full-page layout for /superadmin
  auth.vue                    ← blue background for login

pages/
  index.vue                   ← Dashboard
  login.vue / logout.vue
  settings.vue                ← User Settings (profile + password)
  production/                 ← Recipe list + detail
  ingredients/
  units/
  allergens/
  reports/                    ← Report navigator + sub-reports
  admin/
    db.vue                    ← DB Seed + Import/Export (DEV_MODE)
    stores.vue                ← Store CRUD
    users.vue                 ← User management (admin only)
  superadmin/
    index.vue                 ← Client CRUD (superadmin only, own layout)

server/
  api/
    auth/
      login.post.ts
      logout.post.ts
      me.get.ts               ← session + permissions + stores
      profile.get.ts / .put.ts
      password.put.ts
    stores/                   ← Store CRUD (store.manage)
    rbac/                     ← Legacy role/user viewer (admin)
    admin/users/              ← User CRUD incl. Supabase auth (admin)
    superadmin/clients/       ← Client CRUD (superadmin)
    manage/
      purge.post.ts           ← Client-scoped purge
      seed_initial.post.ts    ← Units + allergens
      seed_example.post.ts    ← Sample recipes + ingredients
      export.get.ts           ← Full JSON export (with images)
      export-plain.get.ts     ← JSON export (no images)
      import.post.ts          ← JSON import (replaces all data)
    recipes/ ingredients/ units/ allergens/   ← CRUD routes
  utils/
    supabase.ts               ← supabaseAdmin() + supabaseServer()
    resolve-app-user.ts       ← resolveAppUser(event) → { authUser, appUserId, clientId }
    require-user.ts
    require-permission.ts
    require-any-permission.ts
    require-admin-dev.ts

supabase/migrations/          ← all schema changes, versioned
i18n/locales/                 ← en.json / de.json / ja.json
```

---

# 4. Routing Conventions

| Pattern | Example |
|---|---|
| `pages/foo/bar.vue` | `/foo/bar` |
| `server/api/foo/bar.get.ts` | `GET /api/foo/bar` |
| `server/api/foo/bar.post.ts` | `POST /api/foo/bar` |
| `server/api/foo/[id].put.ts` | `PUT /api/foo/:id` |

---

# 5. Data Model

## Multi-tenancy tables

| Table | Purpose |
|---|---|
| `client` | Top-level tenant (e.g. "Ramen House Berlin") |
| `store` | Kitchen/location within a client |

## User & auth tables

| Table | Purpose |
|---|---|
| `app_user` | App user record; links to Supabase `auth.users`; has `client_id`, `first_name`, `last_name`, `telephone` |
| `role` | Named role (`admin`, `user`, `superadmin`) |
| `permission` | Named permission code (e.g. `recipe.manage`) |
| `role_permission` | Many-to-many: role → permissions |
| `user_role` | Many-to-many: app_user → roles |
| `v_user_permissions` | View: flattens user → roles → permissions (uses DISTINCT) |

## Business tables (all carry `client_id`)

| Table | Purpose |
|---|---|
| `unit` | Units of measure (g, kg, ml, l, pcs, …) |
| `allergen` | Allergen definitions (EU 14 mandatory) |
| `ingredient` | Purchasable or produced ingredient; has default unit, std cost |
| `ingredient_allergen` | Many-to-many: ingredient → allergens |
| `recipe` | A dish or preparation; has output qty, production notes, batch cost |
| `recipe_component` | Ingredient or sub-recipe within a recipe; has qty + unit |

---

# 6. Authentication & RBAC

**Auth flow:**
Supabase Auth (email/password) → session cookie → `supabaseServer(event).auth.getUser()` on each request.

**User resolution:**
Every protected server route calls `resolveAppUser(event)` which returns `{ authUser, appUserId, clientId }`.

**Permission check:**
```ts
await requirePermission(event, 'recipe.manage')
await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
```

## Roles

| Role | Purpose | Permissions |
|---|---|---|
| `admin` | Full tenant access | `admin`, `admin.export`, `recipe.manage`, `recipe.read`, `unit.manage`, `unit.read`, `store.manage` |
| `user` | Read-only tenant access | `recipe.read`, `unit.read` |
| `superadmin` | Platform admin only (`/superadmin`) | `superadmin` |

## Permissions in use

| Permission | Enforced by | Meaning |
|---|---|---|
| `admin` | Admin pages, user management | Gate for all admin routes |
| `admin.export` | `/api/manage/export`, `import` | DB export / import |
| `recipe.manage` | Recipe, ingredient, allergen CRUD | Full write on production data |
| `recipe.read` | Same routes (read paths) | Read-only on production data |
| `unit.manage` | Unit CRUD | Write access to units |
| `unit.read` | Unit read routes | Read-only on units |
| `store.manage` | `/api/stores` | Create / edit / delete stores |
| `superadmin` | `/api/superadmin/clients` | Manage all clients |

> **Note:** The permission layer is planned for removal in a future refactor. The app will check roles directly instead.

---

# 7. App Navigation

Navigation is managed by `composables/useAppNav.ts`.

**Apps visible in sidebar / tabbar (first 4 = icon slots, 5th+ → More popup):**

| App | Route | `inTopBar` |
|---|---|---|
| Dashboard | `/` | ✓ |
| Production | `/production` | ✓ |
| Stock | `/stock` | ✓ |
| Reports | `/reports` | ✓ |

**Drawer-only (avatar menu):**

| App | Entry route |
|---|---|
| Admin Settings | `/admin/db` (pills: DB / Stores / Users) |
| User Settings | `/settings` |

**Admin Settings pills:**
- **DB** — seed, purge, import/export (DEV_MODE only)
- **Stores** — store CRUD
- **Users** — user management

---

# 8. Layouts

| Layout | Used by | Description |
|---|---|---|
| `default` | All main pages | Sidebar (tablet) + tabbar (mobile) + avatar drawer |
| `superadmin` | `/superadmin` | Blue background, top bar (← Home / title / logout), white content area |
| `auth` | Login | Blue full-screen background |

---

# 9. Server Route Pattern (Thin BFF)

Every protected route follows this pattern:

```ts
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')   // 1. RBAC
  const { clientId } = await resolveAppUser(event)  // 2. resolve tenant

  const body = await readBody(event)                // 3. validate input
  // ...

  const admin = supabaseAdmin()                     // 4. call DB
  const { data, error } = await admin
    .from('recipe')
    .select('...')
    .eq('client_id', clientId)
  // ...

  return { ok: true, data }                         // 5. return
})
```

**Rules:**
- No business logic in Vue components
- No direct table mutations from the browser
- Keep server routes thin — complex logic belongs in Postgres

---

# 10. Development Utilities

Controlled by `DEV_MODE=1` in `.env`.

When `DEV_MODE` is not set, seed/purge endpoints return 403.

**Access via:** Admin Settings → DB pill

| Action | Endpoint | Effect |
|---|---|---|
| Purge | `POST /api/manage/purge` | Deletes all business data for the current client |
| Seed Initial | `POST /api/manage/seed_initial` | Inserts units (g/kg/ml/l/pcs) + EU allergens |
| Seed Example | `POST /api/manage/seed_example` | Inserts sample ingredients + recipes |
| DB Export | `GET /api/manage/export` | Downloads full JSON (includes images) |
| DB Export Plain | `GET /api/manage/export-plain` | Downloads JSON without images |
| DB Import | `POST /api/manage/import` | Replaces all client data from JSON file |

**Typical dev reset flow:**
Purge → Seed Initial → Seed Example

---

# 11. Migrations

All schema changes are versioned Supabase migrations. Never modify the schema directly in the Supabase dashboard.

```bash
# Create a new migration
npx supabase migration new <descriptive_name>

# Apply to remote DB
npx supabase db push

# Check status
npx supabase migration list
```

Migration naming examples:
- `add_recipe_yield_column`
- `add_client_and_store_tables`
- `fix_v_user_permissions_distinct`

---

# 12. Developer Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd cc-zenpire-inventory
npm install

# 2. Configure environment
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Apply migrations
npx supabase db push

# 4. Start dev server
npm run dev

# 5. Open browser → login as admin@zenpire.eu
# 6. Go to Admin Settings → DB → Purge → Seed Initial → Seed Example
```

You are now in a deterministic development state.

---

# 13. Architectural Principles

1. **SQL-first** — business logic lives in Postgres
2. **Thin BFF** — server routes orchestrate only (auth → resolve → validate → call DB → return)
3. **Migration-driven** — all schema changes are versioned and reproducible
4. **Multi-tenant by design** — every query is scoped by `client_id`
5. **Application-level isolation** — service role key + `client_id` filters (not RLS)
6. **Deterministic development** — seed is idempotent; any dev can reproduce the exact state
7. **No direct browser writes** — the browser never talks to Supabase directly

---

# 14. Content Translation

The app supports multilingual content (recipe names, ingredient names, allergen names) via DeepL.

- Source language: configured per client (`client.content_locale`)
- Translations stored in `ingredient_i18n`, `recipe_i18n`, `allergen_i18n`
- Admin: **Admin → Translations** page for bulk translate / coverage stats
- Per-item: a translate dialog appears after saving any detail record

Requires `DEEPL_API_KEY` in `.env`. See [translations.md](./translations.md) for full details.

---

# 15. Planned / Future Work

- **Refactor RBAC to role-based checks** — remove the permission table layer; check roles directly in server routes
- **Stock app** — stock snapshot, adjustments, production batches
- **Supplier & purchasing** — supplier CRUD, offer CRUD, purchase receipts
- **Recipe costing** — auto-calculation from component costs
