# Zenpire Inventory MVP  
## Developer Handbook

---

# 1. Project Overview

Zenpire Inventory is a SQL-first, RPC-driven inventory and recipe management system built with:

- **Nuxt 4 (Vue 3)** — UI + server (BFF layer)
- **Supabase (Postgres)** — Database + Auth
- **Supabase CLI** — Versioned migrations
- **Git** — Full reproducibility

The architecture is intentionally:

- Database-centric
- Transaction-safe
- Migration-driven
- Deterministic in development

---

# 2. Repository Structure

Canonical Nuxt 4 structure:

app.vue  
nuxt.config.ts  
.env.example  

pages/  
&nbsp;&nbsp;index.vue  
&nbsp;&nbsp;login.vue  
&nbsp;&nbsp;dev/  
&nbsp;&nbsp;&nbsp;&nbsp;tools.vue  
&nbsp;&nbsp;&nbsp;&nbsp;adjust.vue  

layouts/  
&nbsp;&nbsp;default.vue  

server/  
&nbsp;&nbsp;api/  
&nbsp;&nbsp;&nbsp;&nbsp;me.get.ts  
&nbsp;&nbsp;&nbsp;&nbsp;stock/  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;adjust.post.ts  
&nbsp;&nbsp;&nbsp;&nbsp;dev/  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;purge.post.ts  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;seed.post.ts  
&nbsp;&nbsp;utils/  
&nbsp;&nbsp;&nbsp;&nbsp;supabase.ts  
&nbsp;&nbsp;&nbsp;&nbsp;require-admin-dev.ts  

supabase/  
&nbsp;&nbsp;migrations/  

db/  
&nbsp;&nbsp;schema_snapshot_*.sql  

docs/  
&nbsp;&nbsp;developer-handbook.md  

---

## Routing Rules

### UI Routes

Generated automatically from:

pages/**

Examples:

- pages/index.vue → `/`
- pages/login.vue → `/login`
- pages/dev/tools.vue → `/dev/tools`

---

### API Routes

Generated from:

server/api/**

Examples:

- server/api/me.get.ts → `GET /api/me`
- server/api/stock/adjust.post.ts → `POST /api/stock/adjust`
- server/api/dev/seed.post.ts → `POST /api/dev/seed`

---

### Shared Server Utilities

server/utils/**

Contains:

- Supabase client setup
- RBAC helpers
- Dev guards

---

# 3. Data Model Overview

The system models:

- Recipes
- Ingredients
- Suppliers
- Supplier Offers
- Time-based Offer Prices
- Stock Ledger Movements

---

## Core Tables

### recipe
- id
- name
- description

Related tables:
- recipe_step
- recipe_media
- recipe_component

---

### ingredient
- id
- name
- kind (purchased / produced)
- default_unit_id

Relations:
- 1:1 → ingredient_stock
- M:N → supplier_offer (via ingredient_supplier_offer)
- 1:N → stock_movement

---

### ingredient_stock

Tracks:

- on_hand_quantity
- planned_quantity
- threshold deltas (green/yellow)

---

### supplier
- id
- name
- contact_email
- contact_phone
- note

---

### supplier_offer

Represents purchasable package (can be bundle).

Columns:
- supplier_id
- offer_name
- supplier_article_number (SKU)
- pack_quantity
- pack_unit_id
- is_active
- active_from
- active_to
- notes

Bundle modeling:

Example:
- 6×1L vinegar → pack_quantity = 6000 ml
- 6×20 nori sheets → pack_quantity = 120 pcs

Stock is always stored in base units:
- g
- ml
- pcs

---

### supplier_offer_price

Time-versioned pricing:

- supplier_offer_id
- valid_from
- valid_to
- price_per_pack
- currency

---

### stock_movement

Immutable ledger table.

All inventory changes write here:

- purchase
- production
- waste
- adjustment

Stock state is derived from ledger.

---

# 4. SQL-First Domain Model

Business logic lives in Postgres.

We use:

- Foreign keys
- Constraints
- Unique indexes
- Views
- Stored procedures (RPC functions)

Why:

- Transaction safety
- Atomic inventory updates
- Centralized domain logic
- Client independence

---

# 5. RPC-Based Business Logic

Inventory-changing operations are implemented as Postgres functions:

Examples:

- fn_post_adjustment(...)
- fn_post_purchase_receipt(...)
- fn_post_production_batch(...)

Properties:

- Atomic
- Transaction-safe
- Ledger-driven
- Reusable across clients

Nuxt server layer calls RPCs.  
The browser never writes directly to inventory tables.

---

# 6. Nuxt Server Layer (Thin BFF)

Responsibilities:

- Authenticate user
- Resolve app_user
- Enforce RBAC
- Validate input
- Call DB RPC
- Return response

Rules:

- No business logic in Vue components
- No stock math in server routes
- Complex logic belongs in Postgres

---

# 7. Authentication & RBAC

Auth:

- Supabase Auth (email/password)
- Session cookie-based

Mapping:

Supabase auth user → app_user

Permissions resolved via:

v_user_permissions

Server checks permissions before executing protected actions.

Current MVP admin gate:
- stock.adjust.post

---

# 8. Development Utilities (Seed & Purge)

DEV_MODE controlled via:

DEV_MODE=1

If disabled:

- /api/dev/seed blocked
- /api/dev/purge blocked

---

## Purge Endpoint

POST /api/dev/purge

- Calls fn_dev_purge_all()
- Uses TRUNCATE
- Clears business data
- Keeps reference tables

---

## Seed Endpoint

POST /api/dev/seed

Inserts deterministic:

- Suppliers
- Ingredients
- Offers
- Prices
- Stock targets
- Initial stock adjustments

Seed is idempotent.

---

# 9. Supabase CLI & Migrations

All schema changes are versioned.

Create migration:

npx supabase migration new <name>

Apply:

npx supabase db push

Check:

npx supabase migration list

Rule:

Never modify schema directly in Supabase dashboard after migrations are established.

---

# 10. Git Workflow

Repository is private.

.gitignore excludes:
- .env
- node_modules
- .nuxt
- dist

Schema reproducibility:
- supabase/migrations
- seed endpoint

Any developer can:

1. Clone repo
2. Set environment variables
3. Run migrations
4. Run seed
5. Have identical state

---

# 11. Architectural Principles

1. SQL-first domain logic
2. Atomic inventory changes
3. Ledger-based stock
4. Thin server orchestration
5. Deterministic development
6. Versioned migrations
7. Reproducible environments
8. Minimal vendor lock-in

---

# 12. Next Development Phase

Option A — Minimal Admin UI:

- Ingredient CRUD
- Supplier CRUD
- Offer CRUD
- Stock snapshot dashboard

Rules remain:

- Writes → server → RPC
- Reads → server → bounded queries
- No direct DB calls from browser

---

# 13. Developer Quick Start

1. Clone repository
2. Create `.env` from `.env.example`
3. Run:

npm install  
npm run dev  

4. Login
5. Visit `/dev/tools`
6. Click:
   - Purge
   - Seed
7. Verify DB content in Supabase

You are now in deterministic development state.

---

# End of Handbook
