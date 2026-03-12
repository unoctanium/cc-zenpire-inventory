# Data Model

*Last updated: 2026-03-12*

---

## Overview

All business tables carry a `client_id` column for multi-tenant isolation. Join and i18n tables are implicitly scoped via their parent FK.

```
client
 ├── store
 ├── app_user ── user_role ── role ── role_permission ── permission
 ├── unit
 ├── allergen ── allergen_i18n
 ├── ingredient ── ingredient_allergen ── allergen
 │           └── ingredient_i18n
 └── recipe ── recipe_component ── ingredient
            │                  └── recipe (sub-recipe)
            └── recipe_i18n
```

---

## Multi-Tenancy Tables

### `client`

Top-level tenant (a restaurant group or brand).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `content_locale` | varchar(5) | Source language for content: `'de'`, `'en'`, `'ja'` |
| `created_at` | timestamptz | |

### `store`

A physical location or kitchen within a client.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → client | |
| `name` | text | |
| `address` | text nullable | |
| `created_at` | timestamptz | |

---

## User & Auth Tables

### `app_user`

One record per authenticated user. Linked to Supabase `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → client | |
| `auth_user_id` | uuid | Supabase Auth UID |
| `email` | text | |
| `first_name` | text nullable | |
| `last_name` | text nullable | |
| `telephone` | text nullable | |
| `avatar_data` | bytea nullable | Inline base64 image |
| `avatar_mime` | text nullable | |
| `display_name` | text nullable | |
| `is_active` | boolean default true | |
| `created_at` | timestamptz | |

Unique: `(client_id, auth_user_id)`

### `role`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text unique | `'admin'`, `'owner'`, `'superadmin'` |
| `name` | text | Human-readable label |

### `permission`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text unique | See RBAC table below |
| `description` | text nullable | |

### `role_permission`

Many-to-many: role → permissions.

| Column | Type |
|---|---|
| `role_id` | uuid FK → role |
| `permission_id` | uuid FK → permission |

PK: `(role_id, permission_id)`

### `user_role`

Many-to-many: app_user → roles.

| Column | Type |
|---|---|
| `user_id` | uuid FK → app_user |
| `role_id` | uuid FK → role |

PK: `(user_id, role_id)`

### `v_user_permissions` (view)

Flattened view: auth_user_id → all permission codes.

| Column | Type |
|---|---|
| `auth_user_id` | uuid |
| `permission_code` | text |

Used by `requirePermission()` in every server route.

---

## Business Tables

All tables below carry `client_id`.

### `unit`

Units of measure. All stock quantities are stored in base units (`g`, `ml`, `pcs`). Other units define a `factor` for conversion.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → client | |
| `code` | text | `'g'`, `'kg'`, `'ml'`, `'l'`, `'pcs'`, … |
| `name` | text | Human-readable |
| `unit_type` | text | `'mass'`, `'volume'`, `'count'` |
| `factor` | numeric | Multiplier to base unit (e.g. kg → 1000) |

Unique: `(client_id, code)`

### `allergen`

EU 14 mandatory allergen definitions (and any custom ones).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → client | |
| `name` | text | |
| `code` | varchar(2) nullable | Short code (e.g. `'A'` = gluten) |
| `gs1_code` | text nullable | GS1 standard code |
| `comment` | text nullable | |
| `created_at`, `updated_at` | timestamptz | |

Unique: `(client_id, lower(name))`

### `ingredient`

A purchasable or produced inventory item.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → client | |
| `article_id` | text nullable | External article/SKU number |
| `name` | text | |
| `kind` | text | `'purchased'` or `'produced'` |
| `default_unit_id` | uuid FK → unit | |
| `standard_unit_cost` | numeric(18,6) nullable | Cost per base unit (EUR) |
| `standard_cost_currency` | text default `'EUR'` | |
| `comment` | text nullable | |
| `yield_pct` | numeric default 100 | Yield percentage (production loss) |
| `purchase_quantity` | numeric nullable | Pack size in purchase unit |
| `purchase_unit_id` | uuid FK → unit nullable | |
| `purchase_price` | numeric nullable | Price per pack |
| `purchase_price_currency` | text default `'EUR'` | |
| `produced_by_recipe_id` | uuid FK → recipe nullable | Set if kind = `'produced'` |
| `name_translation_locked` | boolean default false | Excludes name from auto-translation |
| `image_data` | bytea nullable | Inline image |
| `image_mime` | text nullable | |
| `created_at`, `updated_at` | timestamptz | |

### `ingredient_allergen`

Many-to-many: ingredient → allergens.

| Column | Type |
|---|---|
| `ingredient_id` | uuid FK → ingredient ON DELETE CASCADE |
| `allergen_id` | uuid FK → allergen ON DELETE CASCADE |

PK: `(ingredient_id, allergen_id)`

### `recipe`

A dish, preparation, or batch product.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid FK → client | |
| `recipe_id` | text nullable | External recipe reference code |
| `name` | text | |
| `description` | text nullable | |
| `production_notes` | text nullable | Instructions, steps (free text) |
| `output_quantity` | numeric(18,6) | Batch yield quantity |
| `output_unit_id` | uuid FK → unit | Unit for batch yield |
| `standard_unit_cost` | numeric(18,6) nullable | Manually set or auto-filled from components |
| `is_active` | boolean default true | |
| `is_pre_product` | boolean default false | Marks recipes that are themselves ingredients |
| `name_translation_locked` | boolean default false | |
| `image_data` | bytea nullable | |
| `image_mime` | text nullable | |
| `created_at`, `updated_at` | timestamptz | |

### `recipe_component`

An ingredient or sub-recipe used in a recipe.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `recipe_id` | uuid FK → recipe | Parent recipe |
| `ingredient_id` | uuid FK → ingredient nullable | Set if component is an ingredient |
| `sub_recipe_id` | uuid FK → recipe nullable | Set if component is another recipe |
| `quantity` | numeric(18,6) | Amount in `unit_id` |
| `unit_id` | uuid FK → unit | Unit for quantity |
| `sort_order` | integer default 0 | Display order |

Constraint: exactly one of `ingredient_id` / `sub_recipe_id` must be set.

---

## Translation (i18n) Tables

All translation tables are scoped implicitly via their parent FK. No `client_id` needed.

### `ingredient_i18n`

| Column | Type | Notes |
|---|---|---|
| `ingredient_id` | uuid FK → ingredient ON DELETE CASCADE | |
| `locale` | varchar(5) | `'en'`, `'de'`, `'ja'` |
| `name` | text nullable | |
| `comment` | text nullable | |
| `is_machine` | boolean default true | True = machine-translated |
| `is_stale` | boolean default false | True = source changed after translation |
| `updated_at` | timestamptz | |

PK: `(ingredient_id, locale)`

### `recipe_i18n`

| Column | Type | Notes |
|---|---|---|
| `recipe_id` | uuid FK → recipe ON DELETE CASCADE | |
| `locale` | varchar(5) | |
| `name` | text nullable | |
| `description` | text nullable | |
| `production_notes` | text nullable | |
| `is_machine` | boolean default true | |
| `is_stale` | boolean default false | |
| `updated_at` | timestamptz | |

PK: `(recipe_id, locale)`

### `allergen_i18n`

| Column | Type | Notes |
|---|---|---|
| `allergen_id` | uuid FK → allergen ON DELETE CASCADE | |
| `locale` | varchar(5) | |
| `name` | text nullable | |
| `comment` | text nullable | |
| `is_machine` | boolean default false | |
| `is_stale` | boolean default false | |
| `updated_at` | timestamptz | |

PK: `(allergen_id, locale)`

---

## Views

### `v_user_permissions`

Flattens `app_user → user_role → role → role_permission → permission` into a flat list of permission codes per `auth_user_id`.

### `v_recipe_comp_cost`

Computed cost per recipe from component quantities, unit factors, and ingredient standard costs.

| Column | Type |
|---|---|
| `recipe_id` | uuid |
| `comp_cost` | numeric nullable |

### `v_recipe_effective_allergens`

Recursively resolves all allergens reachable from a recipe (including sub-recipes).

| Column | Type |
|---|---|
| `recipe_id` | uuid |
| `allergen_id` | uuid |

---

## RBAC: Roles & Permissions

| Role code | Permissions |
|---|---|
| `admin` | `admin`, `admin.export`, `recipe.manage`, `recipe.read`, `unit.manage`, `unit.read`, `store.manage` |
| `owner` | Same as admin (current design) |
| `superadmin` | `superadmin` |

| Permission code | Meaning |
|---|---|
| `admin` | Gate for all admin routes |
| `admin.export` | DB export / import |
| `recipe.manage` | Write access to recipes, ingredients, allergens |
| `recipe.read` | Read-only on production data |
| `unit.manage` | Write access to units |
| `unit.read` | Read-only on units |
| `store.manage` | Create / edit / delete stores |
| `superadmin` | Manage all clients |

---

## Migration

The 44 individual migrations from project inception through March 2026 were squashed into a single baseline file on 2026-03-12.

| File | Notes |
|---|---|
| `20260311122422_add_allergen_i18n.sql` | **Baseline** — full schema as of 2026-03-12. All future changes are new migrations on top of this. |

To create a new migration:
```bash
npx supabase migration new <descriptive_name>
npx supabase db push
```
