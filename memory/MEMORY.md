# Zenpire Inventory — Claude Memory

## Project Overview
Restaurant automation platform. SQL-first, RPC-driven. See CLAUDE.md for full architecture rules.

## Key Files
- `layouts/default.vue` — the main app shell. Left 80px icon bar (tablet), bottom bar (mobile). Auth guard, user drawer, More popup. All authenticated pages use this automatically. **No separate left nav panel on tablet** — each page uses AppSplitLayout for its own navigation.
- `layouts/auth.vue` — centered blue shell for login/logout.
- `composables/useAppNav.ts` — route-based app navigation. Exports: `barApps`, `overflowApps`, `activeApp`, `setApp`, `activeAppId`, `sidebarOpen`.
- `pages/local/index-old.vue` — archived old dashboard.
- `pages/local/prototype.vue` — design reference, `layout: false`.

## App Layout Types (confirmed by user)

**a) Dashboard** — single page `/`, no split, no list.

**b) Reports** — `AppSplitLayout(showDetailOnMobile)`. Left panel = fixed nav list (icons + labels, via `ReportsNavList`). Right panel = read-only full table with search / print / refresh. No FAB, no detail view.

**c) Recipes / Stock** — `AppSplitLayout`. Left panel = pill strip (sub-nav from useAppNav links) + search bar + data list + FAB (bottom-left). Right panel = read-only detail (print / edit / delete buttons) that switches to edit form in-place. Mobile: tapping list item pushes to `/entity/[id]`; FAB pushes to `/entity/new`.

App bar order (user confirmed): Dashboard → Recipes → Stock → Reports

## Shell Architecture (current)

**Tablet (≥ sm):** 80px vertical icon bar | `<slot />` content area (bg-gray-50). **No separate left nav panel in shell.**
**Mobile (< sm):** top bar (avatar + app name) | horizontal pill strip (from navLinks) | content | bottom icon bar

**User drawer:** slide-in from left — initials, email, language switcher, admin link, settings, logout
**More popup:** talk-bubble popover listing `overflowApps` (admin, settings)
**Auth guard:** `<div v-if="!isAuthed" style="position:fixed;inset:0;background:#0082c9" />`

`pages/login.vue` and `pages/logout.vue` use `layout: false` — untouched by the shell.

## Master-Detail Layout (current pattern)

All entity pages (recipes, ingredients, units, allergens) use **AppSplitLayout** component:

**Tablet:** Left panel w-64 (nav pills + search + list) | Right panel flex-1 (detail/edit form inline)
**Mobile:** List only. Tapping an item navigates to `/entity/[id]`.

### Components
- `components/AppSplitLayout.vue` — split layout shell. Slots: `#list`, `#detail`. Auto-renders nav pills from `useAppNav().activeApp.links` on tablet.
- `components/app/RecipeDetail.vue` — self-contained recipe view+edit+delete (no modal). Props: `recipe, units, ingredients, allRecipes, canManage`. Emits: `saved(id)`, `deleted()`. Includes components/steps sub-tables, image, print.
- `components/app/IngredientDetail.vue` — self-contained ingredient view+edit+delete. Props: `ingredient, units, allergens, canManage`. Emits: `saved(id)`, `deleted()`.

### Pages (master-detail)
- `pages/recipes/index.vue` — master-detail with AppSplitLayout + AppRecipeDetail
- `pages/recipes/[id].vue` — mobile push detail page
- `pages/ingredients/index.vue` — master-detail with AppSplitLayout + AppIngredientDetail
- `pages/ingredients/[id].vue` — mobile push detail page
- `pages/units/index.vue` — master-detail with inline form (no separate component)
- `pages/units/[id].vue` — mobile push detail page
- `pages/allergens/index.vue` — master-detail with inline form (no separate component)
- `pages/allergens/[id].vue` — mobile push detail page

### Reports pages (full table + modals, admin access)
- `pages/reports/recipes.vue`, `pages/reports/ingredients.vue`, `pages/reports/units.vue`, `pages/reports/allergens.vue`, `pages/reports/allergen-card.vue`

## Nav Structure (useAppNav.ts)

**Dashboard app:** Overview → `/`, Reports → `/reports/recipes`
**Recipes app:** Production → `/recipes-production`, Recipes → `/recipes`, Ingredients → `/ingredients`, Allergens → `/allergens`, Units → `/units`

ROUTE_MAP includes `/reports` → `dashboard`.

## API Endpoints (key)
- `GET /api/recipes` — list with comp_cost, output_unit_code flattened
- `GET /api/recipes/[id]` — detail with components[], steps[], has_image
- `GET /api/ingredients` — list
- `GET /api/ingredients/[id]` — detail with allergen_ids[], has_image
- `GET /api/units` — list (no individual GET endpoint)
- `GET /api/allergens` — list (no individual GET endpoint)

Note: units and allergens have no individual GET endpoint — mobile [id] pages fetch the full list and filter by id.
