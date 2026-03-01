<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t } = useI18n()

// ─── types ────────────────────────────────────────────────────────────────────

type AllergenRow = { id: string; name: string }
type RecipeRow   = { id: string; name: string; allergen_ids: string[] }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data, pending, refresh, error } = await useFetch<{
  ok: boolean
  allergens: AllergenRow[]
  recipes: RecipeRow[]
}>('/api/allergen-card', { credentials: 'include' })

const allergens = computed<AllergenRow[]>(() => data.value?.allergens ?? [])
const allRows   = computed<RecipeRow[]>(() => data.value?.recipes ?? [])

// ─── filter ───────────────────────────────────────────────────────────────────

const filterText = ref('')

const visibleRows = computed(() => {
  const q = filterText.value.trim().toLowerCase()
  if (!q) return allRows.value
  return allRows.value.filter(r => r.name.toLowerCase().includes(q))
})

// ─── error ────────────────────────────────────────────────────────────────────

const errorText = computed(() =>
  error.value ? `${t('allergenCard.loadError')}: ${error.value.message}` : null
)
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('allergenCard.noPermission') }}
  </div>

  <AdminTableShell v-else :error-text="errorText">
    <template #toolbar>
      <!-- Search bar (no add button, no column selector — view only) -->
      <div class="flex items-center gap-2 w-full">
        <div class="relative flex-1 max-w-xs">
          <UIcon name="i-heroicons-magnifying-glass"
            class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            v-model="filterText"
            type="text"
            class="w-full rounded border border-gray-300 bg-white pl-8 pr-8 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('common.search') + ' ' + $t('allergenCard.recipe').toLowerCase() + '…'"
          />
          <button v-if="filterText"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            @click="filterText = ''">
            <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
          </button>
        </div>
        <div class="flex-1" />
        <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-arrow-path"
          :aria-label="$t('common.refresh')" @click="refresh()" />
      </div>
    </template>

    <template #table>
      <div v-if="pending" class="px-2 py-4 text-sm text-gray-500">{{ $t('common.loading') }}</div>

      <div v-else-if="allergens.length === 0 || visibleRows.length === 0"
           class="px-2 py-4 text-sm text-gray-500">
        {{ visibleRows.length === 0 ? $t('common.noResults') : $t('allergenCard.noRecipes') }}
      </div>

      <div v-else class="overflow-x-auto">
        <table class="border-separate border-spacing-0 text-sm">
          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <!-- Recipe name column header -->
              <th class="sticky left-0 z-30 px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800
                         border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950 min-w-[180px]">
                {{ $t('allergenCard.recipe') }}
              </th>
              <!-- One column per allergen — header text rotated 90° -->
              <th v-for="allergen in allergens" :key="allergen.id"
                  class="px-1 py-2 font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800
                         text-center w-10">
                <div class="flex items-end justify-center"
                     style="height: 120px;">
                  <span
                    class="text-xs whitespace-nowrap"
                    style="writing-mode: vertical-rl; transform: rotate(180deg); display: block; text-align: left;"
                  >
                    {{ allergen.name }}
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <!-- Recipe name — sticky left -->
              <td class="sticky left-0 z-10 px-3 py-1.5 align-middle
                         border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950 font-medium text-gray-900 dark:text-gray-100">
                {{ row.name }}
              </td>
              <!-- Allergen cells -->
              <td v-for="allergen in allergens" :key="allergen.id"
                  class="px-1 py-1.5 align-middle text-center w-10">
                <span v-if="row.allergen_ids.includes(allergen.id)"
                      class="inline-block font-bold text-gray-900 dark:text-gray-100 text-sm">
                  X
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminTableShell>
</template>
