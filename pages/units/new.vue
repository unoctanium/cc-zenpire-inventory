<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { canManage } = useTablePermissions('unit')
</script>

<template>
  <div>
    <AppUnitDetail
      :unit="null"
      :can-manage="canManage"
      @saved="(id) => navigateTo(`/units/${id}`)"
      @cancelled="navigateTo('/units')"
    />
  </div>
</template>
