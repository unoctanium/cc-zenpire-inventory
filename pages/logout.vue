<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
useHead({ title: t('auth.logout'), bodyAttrs: { style: 'background-color:#0082c9' } })

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
  <!-- layout: false — self-contained shell with inline styles (see login.vue for rationale) -->
  <UApp>
    <div
      style="position: fixed; inset: 0; background-color: var(--color-app-bar);
             display: flex; flex-direction: column; align-items: center;
             padding-top: 12vh; padding-bottom: 4rem; overflow-y: auto;"
    >
      <div style="display: flex; flex-direction: column; align-items: center;
                  gap: 2rem; width: 100%; max-width: 24rem; padding: 0 1rem;">

        <div style="width: 6rem; height: 6rem; flex-shrink: 0; border-radius: 50%;
                    overflow: hidden; border: 2px solid rgba(255,255,255,0.9);">
          <img src="/logo.png" alt="Zenpire"
            style="width: 100%; height: 100%; object-fit: cover;
                   filter: invert(1); mix-blend-mode: screen;" />
        </div>

        <UCard class="w-full">
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
    </div>
    <UToaster />
  </UApp>
</template>
