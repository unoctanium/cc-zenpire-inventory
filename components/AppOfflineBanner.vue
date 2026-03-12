<script setup lang="ts">
const { isOnline } = useOnlineStatus()
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="!isOnline"
      class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white"
      style="background: #f59e0b"
      role="status"
      aria-live="polite"
    >
      <UIcon name="i-heroicons-wifi" class="w-4 h-4" />
      {{ $t('offline.banner') }}
    </div>
  </Transition>
</template>
