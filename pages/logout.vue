<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
useHead({ title: t('auth.logout') })

const pending = ref(false)

async function logout() {
  pending.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch { /* non-fatal */ }
  finally { pending.value = false }

  // Full page reload so server-side auth state is cleanly reset
  window.location.href = '/login'
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 w-full max-w-md px-4">
    <img src="/logo.png" alt="Zenpire"
      class="w-28 object-contain invert mix-blend-screen" />

    <UCard class="w-full max-w-md">
      <template #header>
        <p class="text-2xl font-semibold text-center">{{ $t('auth.logout') }}</p>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          {{ $t('auth.logoutPrompt') }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" to="/">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton :loading="pending" @click="logout">
            {{ $t('auth.logout') }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
