<script setup lang="ts">
const { t }  = useI18n()
const route  = useRoute()

const REPORTS = [
  { key: 'recipes',       labelKey: 'nav.recipes',        icon: 'i-heroicons-book-open',            to: '/reports/recipes'       },
  { key: 'ingredients',   labelKey: 'nav.ingredients',    icon: 'i-heroicons-beaker',               to: '/reports/ingredients'   },
  { key: 'allergens',     labelKey: 'nav.allergens',      icon: 'i-heroicons-exclamation-triangle',  to: '/reports/allergens'     },
  { key: 'allergen-card', labelKey: 'nav.allergenMatrix', icon: 'i-heroicons-table-cells',          to: '/reports/allergen-card' },
  { key: 'units',         labelKey: 'nav.units',          icon: 'i-heroicons-scale',                to: '/reports/units'         },
] as const

// On mobile: show the child page (detail) instead of the nav list when a sub-route is active
const isChildRoute = computed(() => route.path !== '/reports')
</script>

<template>
  <AppSplitLayout :show-detail-on-mobile="isChildRoute">

    <template #list>
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        <button
          v-for="r in REPORTS" :key="r.key"
          class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
          :class="route.path === r.to
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'"
          @click="navigateTo(r.to)"
        >
          <UIcon
            :name="r.icon"
            class="w-5 h-5 flex-none"
            :style="route.path === r.to ? 'color: var(--color-app-bar)' : 'color: #9ca3af'"
          />
          <span
            class="flex-1 text-sm font-medium"
            :class="route.path === r.to ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'"
          >
            {{ t(r.labelKey) }}
          </span>
          <UIcon
            v-if="route.path === r.to"
            name="i-heroicons-chevron-right"
            class="w-4 h-4 flex-none"
            style="color: var(--color-app-bar)"
          />
        </button>
      </div>
    </template>

    <template #detail>
      <NuxtPage />
    </template>

  </AppSplitLayout>
</template>
