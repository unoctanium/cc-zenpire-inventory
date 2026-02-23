<script setup lang="ts">
const { t } = useI18n()
useHead({ title: t('auth.login') })

const email    = ref('')
const password = ref('')
const err      = ref('')
const pending  = ref(false)


const { data: me } = useNuxtData('/api/auth/me')
if ((me.value as any)?.ok) {
  await navigateTo('/')
}

async function submit() {
  err.value     = ''
  pending.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
      credentials: 'include',
    })
    await refreshNuxtData('/api/auth/me')
    await navigateTo('/')
  } catch (e: any) {
    err.value = e?.data?.statusMessage ?? e?.message ?? 'Login failed'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-semibold">{{ $t('auth.login') }}</div>
          <UBadge color="gray" variant="soft" size="xs">MVP</UBadge>
        </div>
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
          color="red"
          variant="soft"
          :title="$t('auth.loginFailed')"
          :description="err"
        />
      </div>
    </UCard>
  </div>
</template>
