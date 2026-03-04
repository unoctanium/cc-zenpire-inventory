<script setup lang="ts">
defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">

    <!-- Backdrop -->
    <Transition name="bs-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/50"
        style="backdrop-filter: blur(2px)"
        @click="$emit('close')"
      />
    </Transition>

    <!-- Sheet -->
    <Transition name="bs-slide">
      <div
        v-if="open"
        class="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white dark:bg-gray-900 shadow-2xl"
        style="border-radius: 20px 20px 0 0; max-height: 92dvh"
      >
        <!-- Drag handle -->
        <div class="flex-none flex justify-center pt-3 pb-2">
          <div class="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto overscroll-contain">
          <slot />
        </div>
      </div>
    </Transition>

  </Teleport>
</template>

<style scoped>
.bs-fade-enter-active  { transition: opacity 0.3s ease; }
.bs-fade-leave-active  { transition: opacity 0.22s ease; }
.bs-fade-enter-from,
.bs-fade-leave-to      { opacity: 0; }

.bs-slide-enter-active { transition: transform 0.38s cubic-bezier(0.32, 0.72, 0, 1); }
.bs-slide-leave-active { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.bs-slide-enter-from,
.bs-slide-leave-to     { transform: translateY(100%); }
</style>
