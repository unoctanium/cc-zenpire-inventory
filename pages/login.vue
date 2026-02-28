<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
useHead({ title: t('auth.login'), bodyAttrs: { style: 'background-color:#0082c9' } })

const email    = ref('')
const password = ref('')
const err      = ref('')
const pending  = ref(false)

async function submit() {
  err.value     = ''
  pending.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
      credentials: 'include',
    })
    // Full page reload so the server gets the new cookie on the next request
    window.location.href = '/'
  } catch (e: any) {
    err.value = e?.data?.statusMessage ?? e?.message ?? 'Login failed'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <!--
    layout: false — this page owns its entire shell.
    Inline styles are used for the outer container so that background color and
    flex layout are guaranteed regardless of Tailwind CSS layer order or
    NuxtUI dark-mode overrides (which beat Tailwind utilities on SSR-first loads).
  -->
  <UApp>
    <div
      style="position: fixed; inset: 0; background-color: var(--color-app-bar);
             display: flex; flex-direction: column; align-items: center;
             padding-top: 12vh; padding-bottom: 4rem; overflow-y: auto;"
    >
      <div style="display: flex; flex-direction: column; align-items: center;
                  gap: 2rem; width: 100%; max-width: 24rem; padding: 0 1rem;">

        <!-- Logo — clipped to circle; border-radius + overflow:hidden ensures
             any future logo image is always circle-clipped. -->
        <div style="width: 6rem; height: 6rem; flex-shrink: 0; border-radius: 50%;
                    overflow: hidden; border: 2px solid rgba(255,255,255,0.9);">
          <img src="/logo.png" alt="Zenpire"
            style="width: 100%; height: 100%; object-fit: cover;
                   filter: invert(1); mix-blend-mode: screen;" />
        </div>

        <UCard class="w-full">
          <template #header>
            <p class="text-2xl font-semibold text-center">{{ $t('auth.login') }}</p>
          </template>

          <div class="space-y-4">
            <UFormField :label="$t('auth.email')" name="email">
              <UInput v-model="email" type="email" required placeholder="name@example.com" />
            </UFormField>

            <UFormField :label="$t('auth.password')" name="password">
              <UInput v-model="password" type="password" required placeholder="••••••••" />
            </UFormField>

            <UButton block :loading="pending" @click="submit">
              {{ $t('auth.signIn') }}
            </UButton>

            <UAlert
              v-if="err"
              color="error"
              variant="soft"
              :title="$t('auth.loginFailed')"
              :description="err"
            />
          </div>
        </UCard>

      </div>
    </div>
    <UToaster />
  </UApp>
</template>
