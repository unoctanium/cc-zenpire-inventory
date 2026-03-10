<script setup lang="ts">
import { useAuth, fetchAuth } from '~/composables/useAuth'
import { useCurrentStore } from '~/composables/useCurrentStore'

const auth         = useAuth()
const { currentStore } = useCurrentStore()
const pending      = ref(false)

async function refresh() {
  pending.value = true
  await fetchAuth()
  pending.value = false
}
</script>

<template>
  <div class="p-6 space-y-4 max-w-xl">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">{{ $t('dashboard.title') }}</h1>
        <p class="text-sm text-gray-500">{{ $t('dashboard.subtitle') }}</p>
      </div>
      <UButton icon="i-heroicons-arrow-path" color="neutral" variant="soft" size="sm" :loading="pending" @click="refresh()" />
    </div>

    <div v-if="pending" class="text-gray-400 text-sm py-4">{{ $t('common.loading') }}</div>
    <template v-else>

      <!-- Context card: tenant + store -->
      <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 divide-y divide-gray-200 dark:divide-gray-700/60">
        <div class="flex items-center gap-3 px-4 py-3">
          <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-gray-400 flex-none" />
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ $t('dashboard.tenant') }}</div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ auth?.client_name || '—' }}</div>
          </div>
        </div>
        <div class="flex items-center gap-3 px-4 py-3">
          <UIcon name="i-heroicons-map-pin" class="w-4 h-4 text-gray-400 flex-none" />
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ $t('dashboard.store') }}</div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ currentStore?.name || '—' }}</div>
          </div>
        </div>
      </div>

      <!-- Session card -->
      <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 divide-y divide-gray-200 dark:divide-gray-700/60">
        <div class="flex items-start gap-3 px-4 py-3">
          <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400 flex-none mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ $t('auth.email') }}</div>
            <div class="text-sm text-gray-800 dark:text-gray-200 break-all">{{ auth?.email ?? '—' }}</div>
          </div>
        </div>
        <div class="flex items-start gap-3 px-4 py-3">
          <UIcon name="i-heroicons-shield-check" class="w-4 h-4 text-gray-400 flex-none mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{{ $t('dashboard.roles') }}</div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="r in (auth?.roles ?? [])" :key="r"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >{{ r }}</span>
              <span v-if="!auth?.roles?.length" class="text-xs text-gray-400">{{ $t('auth.none') }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-start gap-3 px-4 py-3">
          <UIcon name="i-heroicons-key" class="w-4 h-4 text-gray-400 flex-none mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{{ $t('auth.permissions') }}</div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="p in (auth?.permissions ?? [])" :key="p"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300"
              >{{ p }}</span>
              <span v-if="!auth?.permissions?.length" class="text-xs text-gray-400">{{ $t('auth.none') }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-start gap-3 px-4 py-3">
          <UIcon name="i-heroicons-identification" class="w-4 h-4 text-gray-400 flex-none mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ $t('auth.appUser') }}</div>
            <code class="text-[11px] text-gray-500 dark:text-gray-400 break-all">{{ auth?.app_user_id ?? '—' }}</code>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>
