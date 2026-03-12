# Frontend

*Last updated: 2026-03-12*

---

## Routing

| Pattern | Example |
|---|---|
| `pages/foo/bar.vue` | `/foo/bar` |
| `pages/foo/[id].vue` | `/foo/:id` (mobile detail page) |

Pages auto-import from `components/`, `composables/`, `stores/` — no manual imports needed for these.

---

## Page Structure

| Route | Page | Notes |
|---|---|---|
| `/` | `pages/index.vue` | Dashboard |
| `/production` | `pages/production/index.vue` | Recipe list + detail (split layout) |
| `/production/:id` | `pages/production/[id].vue` | Mobile recipe detail |
| `/ingredients` | `pages/ingredients/index.vue` | Ingredient list + detail |
| `/units` | `pages/units/index.vue` | Unit CRUD table |
| `/allergens` | `pages/allergens/index.vue` | Allergen list + detail |
| `/reports` | `pages/reports/index.vue` | Report navigator |
| `/settings` | `pages/settings.vue` | User profile + password |
| `/admin/db` | `pages/admin/db.vue` | DB tools (seed/purge/import/export) |
| `/admin/stores` | `pages/admin/stores.vue` | Store CRUD |
| `/admin/users` | `pages/admin/users.vue` | User management |
| `/admin/translations` | `pages/admin/translations.vue` | Translation coverage + actions |
| `/superadmin` | `pages/superadmin/index.vue` | Client CRUD (superadmin only) |
| `/login`, `/logout` | `pages/login.vue`, `pages/logout.vue` | Auth |

---

## Layouts

| Layout | Used by | Description |
|---|---|---|
| `default` | All main pages | Sidebar (tablet+) + tab bar (mobile) + avatar drawer |
| `superadmin` | `/superadmin` | Blue full-page, white content area, top nav |
| `auth` | `/login` | Blue full-screen background |

---

## Component Patterns

### AppSplitLayout

Most list pages use `AppSplitLayout`:
- **Tablet/desktop:** left panel (list/search) + right panel (detail), side by side
- **Mobile:** only list; tapping an item navigates to `/:id`

Slots: `#search`, `#list`, `#detail`, `#fab`

```vue
<AppSplitLayout>
  <template #search>…</template>
  <template #list>…</template>
  <template #detail>
    <AppRecipeDetail v-if="selectedRecipe" :recipe="selectedRecipe" … />
  </template>
  <template #fab><AppFab @click="startCreate" /></template>
</AppSplitLayout>
```

### AppBottomSheet

Modal sheet that slides up from the bottom. Used for create/edit forms on mobile.

```vue
<AppBottomSheet :open="showCreateModal" @close="showCreateModal = false">
  <AppIngredientDetail :ingredient="null" … />
</AppBottomSheet>
```

### Detail Components (`components/app/`)

Self-contained view + edit panels. Each handles its own edit sheet, save logic, and translate prompt.

| Component | Entity |
|---|---|
| `AppRecipeDetail.vue` | Recipe (view + edit, components, image) |
| `AppIngredientDetail.vue` | Ingredient (view + edit, allergens, image) |
| `AppAllergenDetail.vue` | Allergen (view + edit) |

All three follow the same pattern:
- View mode: show record; edit button opens `AppBottomSheet`
- Edit sheet: locale pill selector (DE / EN / JA); source pill = full form; non-source pill = translation fields only
- On save: refresh store + update draft; if admin, show translate prompt
- On translate confirm: call `/api/admin/translations/item`, reload all cached locales

### Report Components (`components/reports/`)

Table-based report views. Each uses the shared table layout from `components/admin/`.

---

## Pinia Stores

### `useUnitsStore()`

```typescript
// State
items: Unit[]
loading: boolean

// Methods
load()   // GET /api/units — no locale (units are locale-neutral)
```

### `useIngredientsStore()`

```typescript
// State
byLocale:  Record<string, Ingredient[]>   // e.g. byLocale['de']
fetchedAt: Record<string, number>

// Methods
load(locale: string)            // GET /api/ingredients?locale=<locale>
forLocale(locale: string)       // → ComputedRef<Ingredient[]>
```

### `useRecipesStore()`

```typescript
// State
byLocale:      Record<string, Recipe[]>
detailByLocale: Record<string, RecipeDetail>   // key: `${id}_${locale}`
fetchedAt:     Record<string, number>

// Methods
load(locale: string)                    // GET /api/recipes?locale=<locale>
loadDetail(id: string, locale: string)  // GET /api/recipes/:id?locale=<locale>
forLocale(locale: string)               // → ComputedRef<Recipe[]>
getDetail(id, locale)                   // → ComputedRef<RecipeDetail>
```

### `useAllergensStore()`

```typescript
// State
byLocale:  Record<string, Allergen[]>

// Methods
load(locale: string)    // GET /api/allergens?locale=<locale>
forLocale(locale: string)
```

### Store Reload Pattern

After any save or translation, components reload all currently cached locales:

```typescript
const store = useIngredientsStore()
await Promise.all(Object.keys(store.byLocale).map(loc => store.load(loc)))
```

---

## Composables

### `useAuth()`

Global auth state, populated on app boot and after login.

```typescript
const auth = useAuth()
// auth.value?.email
// auth.value?.is_admin
// auth.value?.permissions  → string[]
// auth.value?.stores        → { id, name, address }[]
```

Fetch / refresh: `await fetchAuth()`

### `useCurrentStore()`

Active store selection, persisted to `localStorage`.

```typescript
const { currentStore, currentStoreId, setStore } = useCurrentStore()
```

### `useAppNav()`

Navigation state for sidebar and tab bar.

```typescript
const { barApps, overflowApps, activeApp, sidebarOpen } = useAppNav()
```

**Apps:**

| id | Route | Shown in top bar |
|---|---|---|
| `dashboard` | `/` | ✓ |
| `production` | `/production` | ✓ |
| `stock` | `/stock` | ✓ |
| `reports` | `/reports` | ✓ |
| `admin` | `/admin/db` | Drawer only |

### `useTablePermissions(resource)`

Derives `canRead` and `canManage` from the auth state.

```typescript
const { canRead, canManage } = useTablePermissions('recipe')
// canManage = has 'recipe.manage' AND isOnline
// canRead   = has 'recipe.manage' OR 'recipe.read'
```

### `useClientSettings()`

Client's source locale for content translation.

```typescript
const { sourceLang, reload } = useClientSettings()
// sourceLang.value → 'de' | 'en' | 'ja'
```

### `useOnlineStatus()`

```typescript
const { isOnline } = useOnlineStatus()
```

Offline check — `canManage` is disabled when offline to prevent mutation attempts.

### `usePrint()`

```typescript
const { printHtml } = usePrint()
printHtml('<html>…</html>')   // Opens new tab, triggers window.print()
```

---

## i18n

### UI translations

Three locales: `en` (default), `de`, `ja`. Files: `i18n/locales/{en,de,ja}.json`.

```typescript
const { t, locale } = useI18n()
t('common.save')         // → "Save" / "Speichern" / "保存"
locale.value = 'de'      // switch language
```

### Content translations

Content (recipe names, ingredient names, etc.) is translated via DeepL.
The currently displayed language is the **UI locale**.
The source language is the **client's `content_locale`**.

When `requestedLocale !== sourceLang`, the API returns translated content from `*_i18n` tables.
When `requestedLocale === sourceLang`, the API returns content from the main table.

### Language pill editing

In edit mode, all detail components (recipe, ingredient, allergen) show a language pill row:

- **Source language pill** → edits the main record (name, description, etc.)
- **Non-source pill** → edits the `*_i18n` row for that locale; component lists (recipes) show translated ingredient names

After saving any pill, an iOS-style dialog asks: *"Shall I translate your changes?"*
- **Yes** → calls `POST /api/admin/translations/item` with `fromLocale` set to the edited pill's locale
- **No** → skips translation

---

## PWA / Offline

- Service worker: `@vite-pwa/nuxt` with Workbox
- Auth calls: `NetworkFirst` (3 s timeout, cache fallback)
- Data reads (`/api/units`, `/api/ingredients`, …): `StaleWhileRevalidate`
- i18n JSON files: `CacheFirst`
- Max 500 cache entries per bucket
- `useOnlineStatus()` disables write actions while offline
- Offline banner: `AppOfflineBanner.vue` (shown via `useOnlineStatus`)

---

## Offline Store (Pinia Persistence)

- `plugins/01.pinia-persistence.client.ts` — sets up `pinia-plugin-persistedstate`
- `plugins/offline-store.client.ts` — populates offline fallback data on app boot
- Stores persist their cached data to `localStorage` for offline access
