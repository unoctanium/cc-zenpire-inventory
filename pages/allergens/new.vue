<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { canManage } = useTablePermissions('recipe')
</script>

<template>
  <div>
    <AppAllergenDetail
      :allergen="null"
      :can-manage="canManage"
      @saved="(id) => navigateTo(`/allergens/${id}`)"
      @cancelled="navigateTo('/allergens')"
    />
  </div>
</template>
