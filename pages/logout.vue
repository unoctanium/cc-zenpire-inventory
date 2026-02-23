<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()
useHead({ title: t('auth.logout') })

const pending = ref(false)

async function logout() {
  pending.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch { /* non-fatal */ }
  finally { pending.value = false }
  
  const auth = useAuth()
  auth.value = null             // clear state immediately
  await navigateTo('/login')
}

</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="font-semibold">{{ $t('auth.logout') }}</div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          {{ $t('auth.logoutPrompt') }}
        </p>
        <div class="flex gap-2">
          <UButton :loading="pending" color="gray" variant="soft" @click="logout">
            {{ $t('auth.logout') }}
          </UButton>
          <UButton variant="ghost" to="/">
            {{ $t('common.cancel') }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
