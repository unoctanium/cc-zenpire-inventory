# CLAUDE.md — Zenpire Inventory

This file is the persistent context for Claude Code working on the Zenpire codebase.
Read this before every task.

---

## What This App Is

Zenpire Inventory is a restaurant automation and digitalization platform.
Core domain: recipe management, ingredient management, supplier management, stock tracking.

It is a **SQL-first, RPC-driven** system. Business logic lives in Postgres, not in application code.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + SSR | Nuxt 4 (Vue 3) |
| Server layer | Nuxt server routes (BFF) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email/password, session cookie) |
| Schema management | Supabase CLI (versioned migrations) |
| Version control | Git |

---

## Project Structure

```
app.vue
nuxt.config.ts
.env                        ← never commit this
./components                                                                                                                       
./components/admin                                                                                                                 
./composables                                                                                                                      
./doc                                                                                                                              
./i18n                                                                                                                             
./i18n/locales                                                                                                                     
./layouts                                                                                                                          
./pages                                                                                                                            
./pages/admin
./pages/dev
./pages/dev/local
./pages/ingredients
./pages/units
./plugins
./server
./server/api
./server/api/auth
./server/api/dev
./server/api/dev/local
./server/api/ingredients
./server/api/manage
./server/api/stock
./server/api/units
./server/utils
./supabase
./supabase/migrations

### Routing Conventions

- `pages/foo/bar.vue` → `/foo/bar`
- `server/api/foo/bar.post.ts` → `POST /api/foo/bar`
- `server/api/foo/bar.get.ts` → `GET /api/foo/bar`

---

## Architecture Rules — Read These Before Writing Any Code

These are non-negotiable constraints. Follow them in every task.

### 1. SQL-first
Business logic belongs in Postgres — not in Vue components, not in server routes.
Use stored procedures (RPC functions) for all inventory-changing operations.

### 2. All writes go through RPC
Never write directly to inventory tables from the Nuxt layer.
Pattern: Browser → Nuxt server route → Supabase RPC function → Postgres

### 3. Thin BFF
Nuxt server routes are orchestration only. Their only jobs are:
- Authenticate the user
- Resolve app_user
- Enforce RBAC (check v_user_permissions)
- Validate and sanitize input
- Call the appropriate DB RPC
- Return the response

No stock math. No business logic. No direct table mutations.


### 4. Migrations only
All schema changes must be written as Supabase CLI migrations.
Never modify the schema directly in the Supabase dashboard.

```bash
# Create a new migration
npx supabase migration new <descriptive_name>

# Apply migrations
npx supabase db push

# Check migration status
npx supabase migration list
```

### 5. Atomic operations
All inventory-affecting operations must be atomic. Use Postgres transactions inside RPC functions.

### 6. re use components
We have a custom table logic and layout, i.e. in pages/units. use this for future tables as well if presenting data


---

## Core Data Model

### Entities

- **recipe** — a dish or preparation; has steps, media, components
- **ingredient** — can be `purchased` or `produced`; always has a default unit and a standard price (manually maintained)
- **ingredient_stock** — snapshot of on_hand and planned quantity + thresholds
- **supplier** — vendor with contact details
- **supplier_offer** — a purchasable SKU from a supplier; supports bundle modeling
- **supplier_offer_price** — time-versioned pricing for an offer
- **stock_movement** — this is not part of mvp
- entities related to roles, users, and role assignements

### Units
Stock is always stored in base units: `g`, `ml`, `pcs`.
Pack quantities in supplier_offer are always converted to base units.

### Key RPC Functions (existing)
- needs to be added here
---

## Authentication & RBAC

- Auth via Supabase Auth (email/password)
- Supabase auth user maps to `app_user` in the app
- Permissions resolved via `v_user_permissions` view
- All protected server routes must check permissions before acting

---

## Development Environment

The developer works on a **remote Ubuntu vhost** via SSH.
Editor: **Neovim** inside **tmux** via **Blink terminal (iPad)**.
There is no GUI or desktop environment.

### Dev Mode
Controlled by environment variable:
```
DEV_MODE=1
```
When `DEV_MODE` is not set, `/api/dev/seed` and `/api/dev/purge` are blocked.

### Getting to a clean dev state
```bash
npm install
npm run dev
# then in browser: /dev/tools → Purge → Seed
```
Seed is idempotent. Purge clears business data but keeps reference tables.

---

## What Is Already Built (MVP)

- Supabase auth + session handling
- app_user resolution
- RBAC scaffolding (v_user_permissions)
- admin tools: purge and seed endpoints with deterministic data
- Core schema: all tables listed above are migrated and seeded
- login and logout pages
- home page
- layout with menu links
- units page with table to CRUD
- ingredients page with table to CRUD
---

## What Is Not Yet Built (Next Phase)

The following is the immediate next development phase.
All new work should follow the same architecture patterns as existing code.

- user, role and rights management
- recipes CRUD with production steps and media and ingredients
- Supplier CRUD
- Supplier Offer CRUD (including bundle modeling)
- Stock snapshot dashboard (derived from ledger)
- Data model extensions (to be specified per task)

For any new CRUD module, the pattern is:
1. Write/extend migration SQL
2. Write or extend RPC function if the operation is write/inventory-affecting
3. Add Nuxt server route (thin BFF)
4. Add Vue page + components

---

## Coding Conventions

- TypeScript throughout
- Nuxt auto-imports are active — do not manually import `ref`, `computed`, `useRoute`, etc.
- Supabase client is initialized in `server/utils/supabase.ts` — use that, do not create new instances
- Keep server routes thin — if logic grows, move it to a Postgres function
- Name migrations descriptively: `add_recipe_yield_column`, `create_fn_post_production_batch`

---

## What Claude Code Should Never Do

- Write business logic in Vue components
- Write stock calculations in server routes
- Mutate inventory tables directly (bypass RPC)
- Modify the Supabase dashboard directly
- Create migrations without a descriptive name
- Commit `.env` or secrets

---

## When Adding a New Feature — Checklist

1. Does this require a schema change? → Write a migration first
2. Does this change stock state? → It must go through an RPC function
3. Is the server route doing more than orchestration? → Move logic to Postgres
4. Is the seed still valid after this change? → Update if needed
5. Are new permissions needed? → Add to v_user_permissions and document here

---
