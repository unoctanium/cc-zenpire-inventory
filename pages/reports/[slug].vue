<script setup lang="ts">
const route = useRoute()
const slug  = computed(() => route.params.slug as string)

const RecipesTable     = resolveComponent('ReportsRecipesTable')
const IngredientsTable = resolveComponent('ReportsIngredientsTable')
const AllergensTable   = resolveComponent('ReportsAllergensTable')
const AllergenCard     = resolveComponent('ReportsAllergenCard')
const UnitsTable       = resolveComponent('ReportsUnitsTable')

const DETAIL_COMPONENT: Record<string, ReturnType<typeof resolveComponent>> = {
  'recipes':       RecipesTable,
  'ingredients':   IngredientsTable,
  'allergens':     AllergensTable,
  'allergen-card': AllergenCard,
  'units':         UnitsTable,
}

const detailComponent = computed(() => DETAIL_COMPONENT[slug.value] ?? null)
</script>

<template>
  <AppSplitLayout show-detail-on-mobile>
    <template #list>
      <ReportsNavList />
    </template>
    <template #detail>
      <component :is="detailComponent" v-if="detailComponent" />
      <div v-else class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-20">
        <UIcon name="i-heroicons-chart-bar-square" class="w-12 h-12" />
        <p class="text-sm">{{ $t('reports.selectPrompt') }}</p>
      </div>
    </template>
  </AppSplitLayout>
</template>
