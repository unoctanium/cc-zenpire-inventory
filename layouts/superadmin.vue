<script setup lang="ts">
const { t } = useI18n()
const auth  = useAuth()

const email    = computed(() => auth.value?.email ?? '')
const initials = computed(() => {
  if (!email.value) return '?'
  const local = email.value.split('@')[0] || email.value
  const parts = local.split(/[.\-_]/).filter(Boolean)
  const a = parts[0]?.[0] ?? local[0]
  const b = parts[1]?.[0] ?? local[1]
  return (a + (b ?? '')).toUpperCase()
})
</script>

<template>
  <UApp>
    <div class="fixed inset-0 flex flex-col" style="background: var(--color-app-bar)">

      <!-- Top bar -->
      <div class="flex items-center gap-3 px-5 py-3 flex-none">
        <NuxtLink to="/" class="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium">
          <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
          {{ t('nav.home') }}
        </NuxtLink>
        <span class="text-white/40 text-sm flex-1 text-center font-semibold tracking-wide">
          {{ t('superadmin.title') }}
        </span>
        <NuxtLink to="/logout" class="text-white/80 hover:text-white transition-colors" :title="t('auth.logout')">
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5" />
        </NuxtLink>
      </div>

      <!-- Content area (white) -->
      <div class="flex-1 overflow-hidden rounded-t-2xl bg-white dark:bg-gray-900">
        <slot />
      </div>

    </div>
    <UToaster />
  </UApp>
</template>
