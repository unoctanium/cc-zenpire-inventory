<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { contentLocaleParam } = useContentLocale()

type AllergenRow = { id: string; name: string; comment: string | null; created_at: string; updated_at: string }

const route = useRoute()
const id    = computed(() => route.params.id as string)

const { canManage } = useTablePermissions('recipe')

const { data, refresh } = await useFetch<{ ok: boolean; allergens: AllergenRow[] }>(() => `/api/allergens?${contentLocaleParam.value}`, { credentials: 'include' })
const allergen = computed(() => data.value?.allergens?.find(a => a.id === id.value) ?? null)

function onSaved() {
  refresh()
}

function onDeleted() {
  navigateTo('/allergens')
}

function onCancelled() {
  navigateTo('/allergens')
}
</script>

<template>
  <div>
    <div v-if="allergen === null && data" class="p-6 text-sm text-gray-500">{{ $t('common.loading') }}</div>
    <AppAllergenDetail
      v-else
      :key="id"
      :allergen="allergen"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </div>
</template>
