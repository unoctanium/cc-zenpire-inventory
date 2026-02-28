<template>
  <div class="space-y-3">
    <!-- Header — only rendered when title slot is provided -->
    <div v-if="$slots.title">
      <h1 class="text-xl font-semibold">
        <slot name="title" />
      </h1>
      <p v-if="$slots.subtitle" class="text-sm text-gray-500 dark:text-gray-400">
        <slot name="subtitle" />
      </p>
    </div>

    <!-- Toolbar — full width -->
    <slot name="toolbar" />

    <!-- Error -->
    <div
      v-if="errorText"
      class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200"
    >
      {{ errorText }}
    </div>

    <!-- Table container -->
    <div class="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <slot name="table" />
    </div>

    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  errorText?: string | null
}>()
</script>
