<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

type UnitOption     = { id: string; code: string; name: string }
type AllergenOption = { id: string; name: string; comment: string | null }

const { canManage } = useTablePermissions('recipe')

const { data: unitData }     = await useFetch<{ ok: boolean; units: UnitOption[] }>('/api/units', { credentials: 'include' })
const { data: allergenData } = await useFetch<{ ok: boolean; allergens: AllergenOption[] }>('/api/allergens', { credentials: 'include' })

const units    = computed(() => unitData.value?.units ?? [])
const allergens = computed(() => allergenData.value?.allergens ?? [])

function onSaved(id: string) { navigateTo(`/ingredients/${id}`) }
function onDeleted()         { navigateTo('/ingredients') }
</script>

<template>
  <div>
    <div class="sm:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" @click="navigateTo('/ingredients')">
        <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
        {{ $t('nav.ingredients') }}
      </button>
    </div>
    <AppIngredientDetail
      :ingredient="null"
      :units="units"
      :allergens="allergens"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
    />
  </div>
</template>
