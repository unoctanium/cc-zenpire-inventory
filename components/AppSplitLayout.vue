<script setup lang="ts">
const { t }  = useI18n({ useScope: 'global' })
const route  = useRoute()
const { activeApp } = useAppNav()

const props = defineProps<{ showDetailOnMobile?: boolean }>()

const navLinks = computed(() => activeApp.value?.links ?? [])

function isLinkActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}

// Sub-nav overflow (tablet pill strip)
const PILL_LIMIT = 4
const visibleLinks  = computed(() => navLinks.value.length > PILL_LIMIT + 1 ? navLinks.value.slice(0, PILL_LIMIT) : navLinks.value)
const overflowLinks = computed(() => navLinks.value.length > PILL_LIMIT + 1 ? navLinks.value.slice(PILL_LIMIT) : [])

const subNavMoreOpen = ref(false)
const subNavMorePos  = ref({ left: 0, top: 0 })

function openSubNavMore(event: MouseEvent) {
  const btn  = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  const popupW = 180
  subNavMorePos.value = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - popupW - 8)),
    top:  rect.bottom + 6,
  }
  subNavMoreOpen.value = !subNavMoreOpen.value
}
</script>

<template>
  <!-- TABLET ≥sm: left panel (pills + list) | right panel (detail) -->
  <div class="hidden sm:flex print:flex h-full print:h-auto overflow-hidden print:overflow-visible">

    <!-- Left panel -->
    <div class="print:hidden w-64 flex-none flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">

      <!-- Nav pills -->
      <div
        v-if="navLinks.length"
        class="flex-none flex overflow-x-auto gap-1.5 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800"
        style="-webkit-overflow-scrolling: touch; scrollbar-width: none"
      >
        <NuxtLink
          v-for="link in visibleLinks"
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
        <!-- Overflow pill button -->
        <button
          v-if="overflowLinks.length"
          class="flex-none flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          @click.stop="openSubNavMore"
        >
          <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- List slot -->
      <div class="flex-1 overflow-y-auto min-h-0">
        <slot name="list" />
      </div>

    </div>

    <!-- Right panel -->
    <div class="flex-1 overflow-auto print:overflow-visible bg-gray-50 dark:bg-gray-950 print:bg-white">
      <slot name="detail" />
    </div>

  </div>

  <!-- MOBILE <sm: list, or detail when a child route is active -->
  <div class="sm:hidden print:hidden">
    <slot v-if="props.showDetailOnMobile" name="detail" />
    <slot v-else name="list" />
  </div>

  <!-- Sub-nav overflow popup (tablet) -->
  <Teleport to="body">
    <div v-if="subNavMoreOpen" class="fixed inset-0 z-50" @click="subNavMoreOpen = false">
      <div
        class="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2"
        style="min-width: 180px"
        :style="`left: ${subNavMorePos.left}px; top: ${subNavMorePos.top}px`"
        @click.stop
      >
        <NuxtLink
          v-for="link in overflowLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-5 py-3 text-sm transition-colors"
          :class="isLinkActive(link.to)
            ? 'font-semibold'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'"
          :style="isLinkActive(link.to) ? 'color: var(--color-app-bar)' : ''"
          @click="subNavMoreOpen = false"
        >
          {{ t(link.labelKey) }}
        </NuxtLink>
      </div>
    </div>
  </Teleport>
</template>
