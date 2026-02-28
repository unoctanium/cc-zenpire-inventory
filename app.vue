<script setup lang="ts">
// Splash screen: rendered on SSR so it's visible immediately in the raw HTML,
// before any JS loads. onMounted fires after Vue has hydrated and the auth
// plugin has resolved auth state — at that point we fade the splash out.
const splash = ref(true)
onMounted(() => { splash.value = false })
</script>

<template>
  <!-- Splash screen (covers everything during initial page load + hydration) -->
  <Transition name="splash">
    <div
      v-if="splash"
      style="position:fixed;inset:0;z-index:9999;background:#0082c9;
             display:flex;flex-direction:column;align-items:center;justify-content:center;
             gap:2rem;"
    >
      <div style="width:6rem;height:6rem;flex-shrink:0;border-radius:50%;
                  overflow:hidden;border:2px solid rgba(255,255,255,0.9);">
        <img
          src="/logo.png"
          alt="Zenpire"
          style="width:100%;height:100%;object-fit:cover;filter:invert(1);mix-blend-mode:screen;"
        />
      </div>
      <div class="splash-spinner" />
    </div>
  </Transition>

  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
.splash-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: splash-spin 0.8s linear infinite;
}

@keyframes splash-spin {
  to { transform: rotate(360deg); }
}

.splash-leave-active {
  transition: opacity 0.3s ease;
}
.splash-leave-to {
  opacity: 0;
}
</style>
