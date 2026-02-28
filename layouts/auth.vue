<script setup lang="ts">
// Force the blue background on the body element itself so NuxtUI's dark-mode
// bg-background (applied via CSS layers inside UApp) can never bleed through —
// regardless of whether the page is SSR-loaded or client-navigated to.
useHead({
  bodyAttrs: { style: 'background-color: var(--color-app-bar);' },
})
</script>

<template>
  <UApp>
    <div class="min-h-dvh flex flex-col items-center pt-[12vh] pb-16 bg-[var(--color-app-bar)]">
      <slot />
    </div>
    <UToaster />
  </UApp>
</template>
