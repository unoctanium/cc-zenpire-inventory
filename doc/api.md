# API Reference

*Last updated: 2026-03-12*

All routes are prefixed with `/api/`. All protected routes return `401` if not authenticated and `403` if the required permission is missing.

Successful responses always include `ok: true`. Error responses include `statusCode` and `statusMessage`.

---

## Authentication

### `POST /api/auth/login`
No permission required.

**Request:**
```json
{ "email": "string", "password": "string" }
```
**Response:**
```json
{ "ok": true }
```
Sets a session cookie.

---

### `POST /api/auth/logout`
Authenticated.

**Response:**
```json
{ "ok": true }
```

---

### `GET /api/auth/me`
Authenticated.

**Response:**
```json
{
  "ok": true,
  "email": "string",
  "app_user_id": "uuid",
  "client_id": "uuid",
  "client_name": "string",
  "permissions": ["recipe.manage", "unit.read", "..."],
  "roles": ["admin"],
  "is_admin": true,
  "is_superadmin": false,
  "stores": [{ "id": "uuid", "name": "string", "address": "string|null" }]
}
```

---

### `GET /api/auth/profile`
Authenticated.

**Response:**
```json
{
  "ok": true,
  "email": "string",
  "first_name": "string|null",
  "last_name": "string|null",
  "telephone": "string|null",
  "has_avatar": false
}
```

---

### `PUT /api/auth/profile`
Authenticated.

**Request:**
```json
{ "first_name": "string?", "last_name": "string?", "telephone": "string?" }
```
**Response:** `{ "ok": true }`

---

### `PUT /api/auth/password`
Authenticated.

**Request:**
```json
{ "password": "string" }
```
**Response:** `{ "ok": true }`

---

### `GET /api/auth/avatar`
Authenticated. Returns binary image data with appropriate `Content-Type`.

---

### `PUT /api/auth/avatar`
Authenticated. Multipart form: `avatar` (File). **Response:** `{ "ok": true }`

---

### `DELETE /api/auth/avatar`
Authenticated. **Response:** `{ "ok": true }`

---

## Units

Permission: `unit.manage` or `unit.read` (reads); `unit.manage` (writes).

### `GET /api/units`
```json
{
  "ok": true,
  "units": [{ "id": "uuid", "code": "g", "name": "Gramm", "unit_type": "mass", "factor": 1 }]
}
```

### `POST /api/units`
**Request:**
```json
{ "code": "kg", "name": "Kilogramm", "unit_type": "mass", "factor": 1000 }
```
**Response:**
```json
{ "ok": true, "unit": { "id": "uuid", "code": "kg", "name": "Kilogramm", "unit_type": "mass", "factor": 1000 } }
```

### `PUT /api/units/:id`
Same body as POST. **Response:** `{ "ok": true, "unit": {...} }`

### `DELETE /api/units/:id`
**Response:** `{ "ok": true }`

---

## Ingredients

Permission: `recipe.manage` or `recipe.read` (reads); `recipe.manage` (writes).

### `GET /api/ingredients`
**Query:** `locale` (optional) — returns translated content if available.

```json
{
  "ok": true,
  "ingredients": [{
    "id": "uuid",
    "article_id": "ART-001",
    "name": "string",
    "kind": "purchased|produced",
    "default_unit_id": "uuid",
    "default_unit_code": "g",
    "default_unit_type": "mass",
    "standard_unit_cost": 0.005,
    "standard_cost_currency": "EUR",
    "comment": "string|null",
    "yield_pct": 100,
    "purchase_quantity": null,
    "purchase_unit_id": null,
    "purchase_unit_code": null,
    "purchase_price": null,
    "purchase_price_currency": "EUR",
    "is_machine_translation": false
  }]
}
```

### `POST /api/ingredients`
**Request:**
```json
{
  "name": "Mehl",
  "article_id": "ART-001",
  "default_unit_id": "uuid",
  "standard_unit_cost": 0.005,
  "comment": null,
  "allergen_ids": ["uuid"],
  "yield_pct": 100,
  "purchase_quantity": 1000,
  "purchase_unit_id": "uuid",
  "purchase_price": 1.99,
  "name_translation_locked": false
}
```
**Response:** `{ "ok": true, "ingredient": { "id": "uuid", ... } }`

### `GET /api/ingredients/:id`
**Query:** `locale` (optional).
**Response:** Full ingredient record + `allergen_ids[]` + `has_image`.

### `PUT /api/ingredients/:id`
Same body as POST. **Response:** `{ "ok": true, "ingredient": {...} }`

### `DELETE /api/ingredients/:id`
**Response:** `{ "ok": true }`

### `GET /api/ingredients/:id/image`
Returns binary image data.

### `PUT /api/ingredients/:id/image`
Multipart form: `image` (File, max ~10 MB). **Response:** `{ "ok": true }`

### `DELETE /api/ingredients/:id/image`
**Response:** `{ "ok": true }`

### `GET /api/ingredients/:id/i18n/:locale`
**Response:**
```json
{ "ok": true, "name": "string|null", "comment": "string|null", "is_machine": true }
```

### `PUT /api/ingredients/:id/i18n/:locale`
**Request:**
```json
{ "name": "Flour", "comment": "string|null" }
```
**Response:** `{ "ok": true }`

---

## Recipes

Permission: `recipe.manage` or `recipe.read` (reads); `recipe.manage` (writes).

### `GET /api/recipes`
**Query:** `locale` (optional).

```json
{
  "ok": true,
  "recipes": [{
    "id": "uuid",
    "recipe_id": "RCP-001",
    "name": "string",
    "description": "string",
    "output_quantity": 10,
    "output_unit_id": "uuid",
    "output_unit_code": "kg",
    "output_unit_type": "mass",
    "standard_unit_cost": 2.5,
    "comp_cost": 1.8,
    "is_active": true,
    "is_pre_product": false,
    "component_count": 5,
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "is_machine_translation": false
  }]
}
```

### `POST /api/recipes`
**Request:**
```json
{
  "name": "Brot",
  "recipe_id": "RCP-001",
  "description": null,
  "production_notes": null,
  "output_quantity": 1,
  "output_unit_id": "uuid",
  "standard_unit_cost": null,
  "is_active": true,
  "is_pre_product": false,
  "name_translation_locked": false
}
```
**Response:** `{ "ok": true, "recipe": { "id": "uuid", ... } }`

### `GET /api/recipes/:id`
**Query:** `locale` (optional).

```json
{
  "ok": true,
  "recipe": {
    "id": "uuid", "recipe_id": "string|null", "name": "string",
    "description": "string|null", "production_notes": "string|null",
    "output_quantity": 1, "output_unit_id": "uuid", "output_unit_code": "kg",
    "standard_unit_cost": 2.5, "is_active": true, "is_pre_product": false,
    "name_translation_locked": false, "has_image": false,
    "allergen_ids": ["uuid"],
    "is_machine_translation": false,
    "created_at": "ISO8601", "updated_at": "ISO8601"
  },
  "components": [{
    "id": "uuid", "recipe_id": "uuid",
    "ingredient_id": "uuid|null", "sub_recipe_id": "uuid|null",
    "quantity": 500, "unit_id": "uuid", "unit_code": "g",
    "sort_order": 0,
    "type": "ingredient|sub_recipe",
    "name": "string",
    "std_cost": 0.005,
    "yield_pct": 100,
    "base_unit_factor": 1,
    "component_unit_factor": 1
  }]
}
```

### `PUT /api/recipes/:id`
Same body as POST. **Response:** `{ "ok": true, "recipe": {...} }`

### `DELETE /api/recipes/:id`
**Response:** `{ "ok": true }`

### `GET /api/recipes/:id/image`
Returns binary image data.

### `PUT /api/recipes/:id/image`
Multipart form: `image` (File). **Response:** `{ "ok": true }`

### `DELETE /api/recipes/:id/image`
**Response:** `{ "ok": true }`

### `GET /api/recipes/:id/i18n/:locale`
```json
{ "ok": true, "name": "string|null", "description": "string|null", "production_notes": "string|null", "is_machine": true }
```

### `PUT /api/recipes/:id/i18n/:locale`
**Request:**
```json
{ "name": "Bread", "description": null, "production_notes": null }
```
**Response:** `{ "ok": true }`

### `POST /api/recipes/:id/components`
**Request:**
```json
{
  "ingredient_id": "uuid",
  "sub_recipe_id": null,
  "quantity": 500,
  "unit_id": "uuid",
  "sort_order": 0
}
```
**Response:** `{ "ok": true, "component": {...} }`

### `PUT /api/recipes/:id/components/:componentId`
Same body as POST. **Response:** `{ "ok": true, "component": {...} }`

### `DELETE /api/recipes/:id/components/:componentId`
**Response:** `{ "ok": true }`

---

## Allergens

Permission: `recipe.manage` or `recipe.read` (reads); `recipe.manage` (writes).

### `GET /api/allergens`
**Query:** `locale` (optional).

```json
{
  "ok": true,
  "allergens": [{ "id": "uuid", "name": "Gluten", "code": "A", "comment": null, "is_machine_translation": false }]
}
```

### `POST /api/allergens`
**Request:** `{ "name": "Gluten", "code": "A", "comment": null }`
**Response:** `{ "ok": true, "allergen": {...} }`

### `PUT /api/allergens/:id`
Same body. **Response:** `{ "ok": true, "allergen": {...} }`

### `DELETE /api/allergens/:id`
**Response:** `{ "ok": true }`

### `GET /api/allergens/:id/i18n/:locale`
```json
{ "ok": true, "name": "string|null", "comment": "string|null", "is_machine": false }
```

### `PUT /api/allergens/:id/i18n/:locale`
**Request:** `{ "name": "Gluten", "comment": null }`
**Response:** `{ "ok": true }`

---

## Stores

Permission: `store.manage`.

### `GET /api/stores`
```json
{ "ok": true, "stores": [{ "id": "uuid", "name": "Main Kitchen", "address": "string|null", "created_at": "ISO8601" }] }
```

### `POST /api/stores`
**Request:** `{ "name": "Main Kitchen", "address": "Berlin" }`
**Response:** `{ "ok": true, "store": {...} }`

### `PUT /api/stores/:id`
Same body. **Response:** `{ "ok": true, "store": {...} }`

### `DELETE /api/stores/:id`
**Response:** `{ "ok": true }`

---

## Admin — Users

Permission: `admin`.

### `GET /api/admin/users`
```json
{
  "ok": true,
  "users": [{
    "id": "uuid", "auth_user_id": "uuid", "email": "string",
    "display_name": "string|null", "is_active": true, "created_at": "ISO8601",
    "roles": [{ "id": "uuid", "code": "admin", "name": "Admin" }]
  }],
  "roles": [{ "id": "uuid", "code": "admin", "name": "Admin" }]
}
```

### `POST /api/admin/users`
**Request:** `{ "email": "user@example.com", "password": "..." }`
**Response:** `{ "ok": true, "user": { "id": "uuid", "email": "...", ... } }`

### `PUT /api/admin/users/:id`
**Request:** `{ "email"?: "...", "display_name"?: "...", "is_active"?: true }`
**Response:** `{ "ok": true }`

### `DELETE /api/admin/users/:id`
**Response:** `{ "ok": true }`

### `POST /api/admin/users/:id/roles`
**Request:** `{ "role_id": "uuid" }`
**Response:** `{ "ok": true }`

### `DELETE /api/admin/users/:id/roles/:roleId`
**Response:** `{ "ok": true }`

---

## Admin — Client Settings

Permission: `admin`.

### `GET /api/admin/client-settings`
```json
{ "ok": true, "content_locale": "de" }
```

### `PUT /api/admin/client-settings`
**Request:** `{ "content_locale": "en" }`
**Response:** `{ "ok": true }`

---

## Translations

Permission: `admin`.

### `GET /api/admin/translations/coverage`
Returns translation completeness for all target locales.

```json
{
  "ok": true,
  "source_locale": "de",
  "locales": [{
    "locale": "en",
    "ingredients": { "total": 22, "translated": 20, "stale": 2 },
    "recipes":     { "total": 5,  "translated": 5,  "stale": 0 },
    "allergens":   { "total": 14, "translated": 14, "stale": 0 }
  }]
}
```

### `POST /api/admin/translations/batch`
Translate all missing (or stale) items for a locale.

**Request:**
```json
{ "locale": "en", "stale_only": false }
```
**Response:**
```json
{ "ok": true, "translated": 20, "skipped": 2, "errors": 0 }
```

### `POST /api/admin/translations/item`
Translate a single item. Optionally translate FROM a non-source locale.

**Request:**
```json
{
  "kind": "ingredient",
  "id": "uuid",
  "locale": "en",
  "fromLocale": "de"
}
```

| Field | Description |
|---|---|
| `kind` | `'ingredient'`, `'recipe'`, or `'allergen'` |
| `id` | Entity UUID |
| `locale` | Target locale (omit to translate to all other locales) |
| `fromLocale` | Source locale override. Omit to use the client's source locale. When set to a non-source locale, reads from the i18n table for that locale and translates to all other locales. When the target is the source locale, writes back to the main table. |

**Response:**
```json
{ "ok": true, "translated": 2, "skipped": 0, "errors": 0 }
```

---

## Manage (Import / Export)

Permission: `admin.export` (export/import); DEV_MODE=1 (seed/purge).

### `GET /api/manage/export`
Downloads full JSON backup including images (base64).

### `GET /api/manage/export-plain`
Downloads JSON backup without images.

### `POST /api/manage/import`
**Request:** JSON body matching the export format.
Replaces all client data (purge + re-import). **Response:** `{ "ok": true, "stats": {...} }`

### `POST /api/manage/purge`
DEV_MODE only. Deletes all business data for the current client.
**Response:** `{ "ok": true }`

### `POST /api/manage/seed_initial`
DEV_MODE only. Inserts units (g, kg, ml, l, pcs, …) and EU 14 allergens.
**Response:** `{ "ok": true }`

### `POST /api/manage/seed_example`
DEV_MODE only. Inserts 22 sample ingredients and 5 sample recipes.
**Response:** `{ "ok": true }`

---

## Superadmin — Clients

Permission: `superadmin`.

### `GET /api/superadmin/clients`
```json
{ "ok": true, "clients": [{ "id": "uuid", "name": "string", "content_locale": "de", "created_at": "ISO8601" }] }
```

### `POST /api/superadmin/clients`
**Request:** `{ "name": "Ramen House", "content_locale": "de" }`
**Response:** `{ "ok": true, "client": {...} }`

### `PUT /api/superadmin/clients/:id`
**Request:** `{ "name"?: "...", "content_locale"?: "en" }`
**Response:** `{ "ok": true }`

### `DELETE /api/superadmin/clients/:id`
**Response:** `{ "ok": true }`
