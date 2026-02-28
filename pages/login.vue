<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
useHead({ title: t('auth.login') })

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
  <div class="flex flex-col items-center gap-6 w-full px-4">
    <!-- Logo: invert + screen blend makes the dark plant white on the blue background -->
    <img src="/logo.png" alt="Zenpire"
      class="w-[10vw] min-w-20 max-w-40 object-contain invert mix-blend-screen" />

    <UCard class="w-full max-w-md">
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
</template>
