<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t } = useI18n()
const { doPrint } = usePrint()

type AllergenRow = { id: string; name: string; code: string | null }
type RecipeRow   = { id: string; name: string; allergen_ids: string[] }

const { canRead } = useTablePermissions('recipe')

const { data, pending, refresh, error } = useFetch<{
  ok: boolean
  allergens: AllergenRow[]
  recipes: RecipeRow[]
}>('/api/allergen-card', { credentials: 'include' })

const allergens = computed<AllergenRow[]>(() => data.value?.allergens ?? [])
const allRows   = computed<RecipeRow[]>(() => data.value?.recipes ?? [])

const filterText = ref('')

const visibleRows = computed(() => {
  const q = filterText.value.trim().toLowerCase()
  if (!q) return allRows.value
  return allRows.value.filter(r => r.name.toLowerCase().includes(q))
})

const errorText = computed(() =>
  error.value ? `${t('allergenCard.loadError')}: ${error.value.message}` : null
)
</script>

<template>
  <div>
  <!-- iOS nav bar -->
  <div class="sticky top-0 z-30 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 relative flex items-center justify-end px-2 min-h-[44px]">
    <span class="absolute inset-x-0 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 px-20 truncate pointer-events-none">{{ $t('nav.allergenMatrix') }}</span>
    <div class="relative z-10 flex items-center">
      <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="refresh()">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
      </button>
      <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="doPrint()">
        <UIcon name="i-heroicons-printer" class="w-5 h-5" />
      </button>
    </div>
  </div>

  <div v-if="!canRead" class="p-6 text-red-600">
    403 – {{ $t('allergenCard.noPermission') }}
  </div>

  <div v-else class="p-4">
  <AdminTableShell :error-text="errorText">
    <template #toolbar>
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
      </div>
    </template>

    <template #table>
      <div v-if="pending" class="px-2 py-4 text-sm text-gray-500">{{ $t('common.loading') }}</div>

      <div v-else-if="allergens.length === 0 || visibleRows.length === 0" class="px-2 py-4 text-sm text-gray-500">
        {{ visibleRows.length === 0 ? $t('common.noResults') : $t('allergenCard.noRecipes') }}
      </div>

      <div v-else class="overflow-x-auto">
        <table class="border-separate border-spacing-0 text-sm">
          <thead class="sticky top-0 z-20 bg-white dark:bg-gray-950">
            <tr>
              <th class="sticky left-0 z-30 px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800
                         border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950 min-w-[180px]">
                {{ $t('allergenCard.recipe') }}
              </th>
              <th v-for="allergen in allergens" :key="allergen.id"
                  class="px-1 py-2 font-medium text-gray-700 dark:text-gray-200
                         border-b border-gray-200 dark:border-gray-800
                         text-center w-10">
                <div class="flex items-end justify-center" style="height: 120px;">
                  <span class="text-xs whitespace-nowrap"
                    style="writing-mode: vertical-rl; transform: rotate(180deg); display: block; text-align: left;">
                    {{ allergen.name }}{{ allergen.code ? ` (${allergen.code})` : '' }}
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="row in visibleRows" :key="row.id"
                class="border-b border-gray-100 dark:border-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <td class="sticky left-0 z-10 px-3 py-1.5 align-middle
                         border-r border-gray-200 dark:border-gray-800
                         bg-white dark:bg-gray-950 font-medium text-gray-900 dark:text-gray-100">
                {{ row.name }}
              </td>
              <td v-for="allergen in allergens" :key="allergen.id"
                  class="px-1 py-1.5 align-middle text-center w-10">
                <span v-if="row.allergen_ids.includes(allergen.id)"
                      class="inline-block font-bold text-gray-900 dark:text-gray-100 text-sm">X</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminTableShell>
  </div>
  </div>
</template>
