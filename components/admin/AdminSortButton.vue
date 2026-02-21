<script setup lang="ts">
type Dir = 'asc' | 'desc' | null

const props = defineProps<{
  active: boolean
  dir: Dir
  ariaLabel: string
}>()

const emit = defineEmits<{ (e: 'click'): void }>()

const icon = computed(() => {
  if (!props.active || props.dir === null) return 'i-heroicons-chevron-up-down'
  return props.dir === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'
})
</script>

<template>
  <button
    type="button"
    class="rounded p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    :aria-label="ariaLabel"
    @click="emit('click')"
  >
    <UIcon :name="icon" />
  </button>
</template>