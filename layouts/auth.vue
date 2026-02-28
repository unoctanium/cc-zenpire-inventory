<template>
  <UApp class="bg-[var(--color-app-bar)]">
    <div class="min-h-dvh flex flex-col items-center pt-[12vh] pb-16 bg-[var(--color-app-bar)]">
      <slot />
    </div>
    <UToaster />
  </UApp>
</template>
