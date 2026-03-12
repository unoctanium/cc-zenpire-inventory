<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const route = useRoute()
const id    = computed(() => route.params.id as string)

const { canManage } = useTablePermissions('recipe')
const { locale }   = useI18n()

const recipesStore     = useRecipesStore()
const unitsStore       = useUnitsStore()
const ingredientsStore = useIngredientsStore()
const allergensStore   = useAllergensStore()

const units       = computed(() => unitsStore.items)
const ingredients = computed(() => ingredientsStore.forLocale(locale.value).value.filter((i: any) => i.kind === 'purchased'))
const allRecipes  = computed(() => recipesStore.forLocale(locale.value).value)
const allergens   = computed(() => allergensStore.forLocale(locale.value).value)
const recipe      = computed(() => recipesStore.detailByLocale[`${id.value}_${locale.value}`]?.recipe ?? null)

async function loadDetail() {
  await recipesStore.loadDetail(id.value, locale.value)
}

onMounted(loadDetail)
watch([id, locale], loadDetail)

function onSaved() {
  loadDetail()
  recipesStore.load(locale.value)
}

function onDeleted() {
  navigateTo('/production')
}
</script>

<template>
  <div>
    <AppRecipeDetail
      v-if="recipe"
      :recipe="recipe"
      :units="units"
      :ingredients="ingredients"
      :all-recipes="allRecipes"
      :allergens="allergens"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
    />
    <div v-else class="p-6 text-sm text-gray-500">{{ $t('common.loading') }}</div>
  </div>
</template>
