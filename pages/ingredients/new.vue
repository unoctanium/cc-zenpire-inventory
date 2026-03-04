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
function onCancelled()       { navigateTo('/ingredients') }
</script>

<template>
  <div>
    <AppIngredientDetail
      :ingredient="null"
      :units="units"
      :allergens="allergens"
      :can-manage="canManage"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancelled="onCancelled"
    />
  </div>
</template>
