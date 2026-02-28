<script setup lang="ts">
import { useAuth, fetchAuth } from '~/composables/useAuth'

const { t } = useI18n()
const auth    = useAuth()
const pending = ref(false)

async function refresh() {
  pending.value = true
  await fetchAuth()
  pending.value = false
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{{ $t('dashboard.title') }}</h1>
        <p class="text-gray-500">{{ $t('dashboard.subtitle') }}</p>
      </div>
      <UButton icon="i-heroicons-arrow-path" color="neutral" variant="soft" :loading="pending" @click="refresh()">
        {{ $t('common.refresh') }}
      </UButton>
    </div>

    <UCard>
      <template #header>{{ $t('auth.session') }}</template>
      <div v-if="pending" class="text-gray-500">{{ $t('common.loading') }}</div>
      <div v-else class="space-y-2">
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-gray-500">{{ $t('auth.email') }}:</span>
          <span class="font-medium">{{ auth?.email ?? '-' }}</span>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-gray-500">{{ $t('auth.appUser') }}:</span>
          <code class="text-xs">{{ auth?.app_user_id ?? '-' }}</code>
        </div>
        <div class="space-y-2">
          <div class="text-gray-500">{{ $t('auth.permissions') }}:</div>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="p in (auth?.permissions ?? [])"
              :key="p"
              color="neutral"
              variant="soft"
            >
              {{ p }}
            </UBadge>
            <span v-if="!(auth?.permissions?.length)" class="text-gray-400">
              {{ $t('auth.none') }}
            </span>
          </div>
        </div>
      </div>
    </UCard>


  </div>
</template>
