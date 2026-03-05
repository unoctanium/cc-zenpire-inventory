<script setup lang="ts">
const { t } = useI18n()
const { activeApp } = useAppNav()
const route = useRoute()
</script>

<template>
  <div class="divide-y divide-gray-100 dark:divide-gray-800">
    <button
      v-for="link in activeApp?.menuLinks" :key="link.to"
      class="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors"
      :class="route.path === link.to
        ? 'bg-blue-50 dark:bg-blue-900/20'
        : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'"
      @click="navigateTo(link.to)"
    >
      <UIcon v-if="link.icon" :name="link.icon" class="w-5 h-5 flex-none"
        :style="route.path === link.to ? 'color: var(--color-app-bar)' : 'color: #9ca3af'" />
      <span class="flex-1 text-[17px] font-medium"
        :class="route.path === link.to ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'">
        {{ t(link.labelKey) }}
      </span>
      <UIcon v-if="route.path === link.to" name="i-heroicons-chevron-right"
        class="w-5 h-5 flex-none" style="color: var(--color-app-bar)" />
    </button>
  </div>
</template>
