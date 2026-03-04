<script setup lang="ts">
const { t }  = useI18n({ useScope: 'global' })
const route  = useRoute()
const { activeApp } = useAppNav()

const navLinks = computed(() => activeApp.value.links ?? [])

const props = defineProps<{ showDetailOnMobile?: boolean }>()

function isLinkActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <!-- TABLET ≥sm: left panel (pills + list) | right panel (detail) -->
  <div class="hidden sm:flex h-full overflow-hidden">

    <!-- Left panel -->
    <div class="w-64 flex-none flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">

      <!-- Nav pills -->
      <div
        v-if="navLinks.length"
        class="flex-none flex flex-wrap gap-1.5 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800"
      >
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex-none px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
          :class="isLinkActive(link.to)
            ? 'text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
          :style="isLinkActive(link.to) ? 'background: var(--color-app-bar)' : ''"
        >
          {{ t(link.labelKey) }}
        </NuxtLink>
      </div>

      <!-- List slot -->
      <div class="flex-1 overflow-y-auto min-h-0">
        <slot name="list" />
      </div>

    </div>

    <!-- Right panel -->
    <div class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
      <slot name="detail" />
    </div>

  </div>

  <!-- MOBILE <sm: list, or detail when a child route is active -->
  <div class="sm:hidden">
    <slot v-if="props.showDetailOnMobile" name="detail" />
    <slot v-else name="list" />
  </div>
</template>
