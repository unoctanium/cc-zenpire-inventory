# Content Translation System

*Last updated: 2026-03-12*

---

## Overview

Zenpire supports multilingual content for recipes, ingredients, and allergens. Translations are stored per-entity in `*_i18n` tables and are produced via the DeepL API.

### Supported locales

`de` · `en` · `ja`

---

## Concepts

| Term | Meaning |
|---|---|
| **Source locale** | The language used for data entry. Configured per client (`client.content_locale`). Stored in the main table columns (`ingredient.name`, `recipe.name`, etc.). |
| **Display locale** | The user's current UI language (vue-i18n). Drives which translation is fetched when rendering the page. |
| **Translation** | A row in `ingredient_i18n`, `recipe_i18n`, or `allergen_i18n` for a specific locale. |
| **Machine translation (MT)** | `is_machine = true`. Produced by DeepL. Shown with an amber "MT" badge in lists. |
| **Stale** | `is_stale = true`. Set when source content changes after a translation was produced. The translation still exists but may be out of date. |
| **Name lock** | `name_translation_locked = true` on ingredient or recipe. The name field is excluded from all automatic translations. The lock does not apply to description, comment, or production notes. |

---

## How Display Works

When the API receives a `?locale=X` query param:
- If `X === sourceLang` → return content from the main table (no i18n lookup).
- If `X !== sourceLang` → fetch from `*_i18n` for that locale; use it to override the main fields; fall back to main fields if no translation row exists.

```
GET /api/recipes?locale=en
  sourceLang = 'de'
  → reads recipe.name (de) as fallback
  → overrides with recipe_i18n.name where locale='en' if present
```

---

## Database Tables

### `ingredient_i18n`

| Column | Notes |
|---|---|
| `ingredient_id` + `locale` | Composite PK |
| `name` | Translated name (null = not translated; falls back to source) |
| `comment` | Translated comment |
| `is_machine` | True = DeepL output; False = manually edited |
| `is_stale` | Set by a trigger when `ingredient.name` or `ingredient.comment` changes |
| `updated_at` | Timestamp of last write |

### `recipe_i18n`

Same pattern; fields: `name`, `description`, `production_notes`.

### `allergen_i18n`

Same pattern; fields: `name`, `comment`.

---

## Translation API

### `POST /api/admin/translations/item`

Translates a single entity. Requires `admin` permission.

```json
{
  "kind": "ingredient",
  "id": "uuid",
  "locale": "en",
  "fromLocale": "de"
}
```

**`fromLocale` behaviour:**

| `fromLocale` | Source of text | Target locales |
|---|---|---|
| Omitted or = source locale | Main table (`ingredient.name`, etc.) | All non-source locales |
| Non-source locale (e.g. `de` when source = `en`) | `ingredient_i18n` for `de` | All other locales including source locale |

When the target locale is the source locale, the translation is written back to the **main table** (not the i18n table), so it appears correctly when displaying source-language content.

**`locale` field:**
- Omit → translate to all applicable target locales.
- Set → translate to that single locale only.

### `POST /api/admin/translations/batch`

Translates all items of all kinds for a given locale.

```json
{ "locale": "en", "stale_only": false }
```

- `stale_only: true` → only re-translate items with `is_stale = true`.
- Translates ingredients, recipes, and allergens in a single API call per entity type (batched DeepL request for efficiency).

### `GET /api/admin/translations/coverage`

Returns counts for each locale:

```json
{
  "source_locale": "de",
  "locales": [{
    "locale": "en",
    "ingredients": { "total": 22, "translated": 20, "stale": 2 },
    "recipes":     { "total": 5,  "translated": 5,  "stale": 0 },
    "allergens":   { "total": 14, "translated": 14, "stale": 0 }
  }]
}
```

---

## Translation Workflow

### Admin bulk translation

1. Go to **Admin → Translations**.
2. Set the source language (saves to `client.content_locale`).
3. View coverage table — shows translated / stale counts per locale.
4. Click **"Translate all missing"** for a locale → calls `/api/admin/translations/batch`.
5. Click **"Retranslate stale"** to refresh outdated translations.

### Per-item translation (from detail screens)

1. Open recipe, ingredient, or allergen in edit mode.
2. Edit content in any language pill.
3. Press **Save**.
4. An iOS-style dialog appears: *"Shall I translate your changes?"*
5. **Yes** → calls `/api/admin/translations/item` with `fromLocale` set to the current pill language.
6. The store reloads all cached locales immediately — no app restart needed.

### Stale flag

When the source content changes (e.g., `ingredient.name` is updated), the `is_stale` flag is set on all existing `ingredient_i18n` rows for that ingredient. This tells the admin that existing translations need to be refreshed.

---

## DeepL Integration

**File:** `server/utils/deepl.ts`

```typescript
translateTexts(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]>
```

- Detects Free vs. Pro API automatically (`:fx` suffix in API key = Free tier).
- Language codes are uppercased before sending to DeepL (e.g., `'de'` → `'DE'`).
- Batches multiple texts in a single request where possible.
- Configured via `DEEPL_API_KEY` in `.env`.

**Without `DEEPL_API_KEY`:** Translation routes return an error. The admin UI shows an error toast. All other features work normally.

---

## Name Lock

Set `name_translation_locked = true` on an ingredient or recipe to prevent the name from being overwritten by automated translations. This is useful for:
- Brand names that should not be translated.
- Dishes known by their native-language name internationally.

The lock only protects the `name` field. Description, comment, and production notes are always included in translations.

---

## MT Badge

When an item's displayed content comes from a machine translation (`is_machine = true`) the list row shows a small amber **MT** badge. This signals to the user that a human review may be appropriate.

```html
<span v-if="item.is_machine_translation" class="...">MT</span>
```
