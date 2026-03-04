<script setup lang="ts">
const { t } = useI18n()

const REPORTS = [
  { key: 'recipes',       labelKey: 'nav.recipes',        icon: 'i-heroicons-book-open',            to: '/reports/recipes'       },
  { key: 'ingredients',   labelKey: 'nav.ingredients',    icon: 'i-heroicons-beaker',               to: '/reports/ingredients'   },
  { key: 'allergens',     labelKey: 'nav.allergens',      icon: 'i-heroicons-exclamation-triangle',  to: '/reports/allergens'     },
  { key: 'allergen-card', labelKey: 'nav.allergenMatrix', icon: 'i-heroicons-table-cells',          to: '/reports/allergen-card' },
  { key: 'units',         labelKey: 'nav.units',          icon: 'i-heroicons-scale',                to: '/reports/units'         },
] as const

type ReportKey = typeof REPORTS[number]['key']

const selected = ref<ReportKey | null>(null)
</script>

<template>
  <AppSplitLayout>

    <!-- ─── List panel ─────────────────────────────────────────────────────── -->
    <template #list>

      <!-- TABLET: click to load report inline in detail panel -->
      <div class="hidden sm:block divide-y divide-gray-100 dark:divide-gray-800">
        <button
          v-for="r in REPORTS" :key="r.key"
          class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
          :class="selected === r.key
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'"
          @click="selected = r.key"
        >
          <UIcon :name="r.icon" class="w-5 h-5 flex-none"
            :style="selected === r.key ? 'color: var(--color-app-bar)' : 'color: #9ca3af'" />
          <span class="flex-1 text-sm font-medium"
            :class="selected === r.key ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'">
            {{ t(r.labelKey) }}
          </span>
          <UIcon v-if="selected === r.key" name="i-heroicons-chevron-right"
            class="w-4 h-4 flex-none" style="color: var(--color-app-bar)" />
        </button>
      </div>

      <!-- MOBILE: navigate to full-screen report page -->
      <div class="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
        <button
          v-for="r in REPORTS" :key="r.key + '-m'"
          class="flex w-full items-center gap-3 px-4 py-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          @click="navigateTo(r.to)"
        >
          <UIcon :name="r.icon" class="w-5 h-5 flex-none text-gray-400" />
          <span class="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ t(r.labelKey) }}</span>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400 flex-none" />
        </button>
      </div>

    </template>

    <!-- ─── Detail panel ───────────────────────────────────────────────────── -->
    <template #detail>

      <!-- Placeholder when nothing selected -->
      <div v-if="!selected"
        class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-20">
        <UIcon name="i-heroicons-chart-bar-square" class="w-12 h-12" />
        <p class="text-sm">{{ t('reports.selectPrompt') }}</p>
      </div>

      <!-- Report components — plain components, no Suspense needed -->
      <ReportsRecipesTable      v-else-if="selected === 'recipes'"       :key="selected" />
      <ReportsIngredientsTable  v-else-if="selected === 'ingredients'"   :key="selected" />
      <ReportsAllergensTable    v-else-if="selected === 'allergens'"     :key="selected" />
      <ReportsAllergenCard      v-else-if="selected === 'allergen-card'" :key="selected" />
      <ReportsUnitsTable        v-else-if="selected === 'units'"         :key="selected" />

    </template>

  </AppSplitLayout>
</template>
