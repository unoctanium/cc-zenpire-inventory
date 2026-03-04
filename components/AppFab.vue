<template>
  <button
    class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white"
    style="background: var(--color-app-bar)"
    @click="$emit('click')"
  >
    <UIcon name="i-heroicons-pencil-square" class="w-5 h-5" />
  </button>
</template>

<script setup lang="ts">
defineEmits<{ click: [] }>()
</script>
