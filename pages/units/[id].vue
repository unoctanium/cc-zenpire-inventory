<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

type UnitType = 'mass' | 'volume' | 'count'
type UnitRow  = { id: string; code: string; name: string; unit_type: UnitType; factor: number }

const route = useRoute()
const id    = computed(() => route.params.id as string)

const { canManage } = useTablePermissions('unit')

const { data, refresh } = await useFetch<{ ok: boolean; units: UnitRow[] }>('/api/units', { credentials: 'include' })
const unit = computed(() => data.value?.units?.find(u => u.id === id.value) ?? null)

function onSaved() {
  refresh()
}

function onDeleted() {
  navigateTo('/units')
}

function onCancelled() {
  navigateTo('/units')
}
</script>

<template>
  <div>
    <div v-if="unit === null && data" class="p-6 text-sm text-gray-500">{{ $t('common.loading') }}</div>
    <AppUnitDetail
      v-else
      :key="id"
      :unit="unit"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </div>
</template>
