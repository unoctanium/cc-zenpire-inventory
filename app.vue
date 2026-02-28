<script setup lang="ts">
// Splash screen visible from first paint (SSR renders it) until 700ms after
// Vue mounts. The auth plugin completes before onMounted fires, so by the
// time the splash fades the correct page is already rendered beneath it.
const splash = ref(true)

onMounted(() => {
  setTimeout(() => { splash.value = false }, 700)
})
</script>

<template>
  <!-- Splash overlay: always in DOM (no v-if) so SSR always includes it.
       Fades out via CSS transition when splash becomes false. -->
  <div
    class="splash-screen"
    :class="{ 'splash-screen--out': !splash }"
  >
    <div class="splash-logo">
      <img src="/logo.png" alt="Zenpire" class="splash-logo-img" />
    </div>
    <div class="splash-spinner" />
  </div>

  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
/* ── Splash overlay ───────────────────────────────────────────────────── */
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0082c9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  transition: opacity 0.35s ease;
  opacity: 1;
}
.splash-screen--out {
  opacity: 0;
  pointer-events: none;
}

/* ── Logo ring ────────────────────────────────────────────────────────── */
.splash-logo {
  width: 6rem;
  height: 6rem;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.9);
}
.splash-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: invert(1);
  mix-blend-mode: screen;
}

/* ── Spinner ──────────────────────────────────────────────────────────── */
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
</style>
