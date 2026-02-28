<script setup lang="ts">
const { t } = useI18n()
const out = ref('')

async function call(path: string) {
  out.value = `Calling ${path}...`
  try {
    const res = await $fetch(path, { method: 'POST' })
    out.value = JSON.stringify(res, null, 2)
  } catch (e: any) {
    out.value = `${e?.statusCode ?? ''} ${e?.statusMessage ?? ''}\n${JSON.stringify(e?.data ?? {}, null, 2)}`
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold">{{ $t('devTools.title') }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('devTools.subtitle') }}</p>
    </div>
    <div class="flex flex-wrap gap-3">
      <UButton color="error" variant="soft" @click="call('/api/manage/purge')">
        {{ $t('devTools.purge') }}
      </UButton>
      <UButton color="neutral" variant="soft" @click="call('/api/manage/seed_initial')">
        {{ $t('devTools.seedInitial') }}
      </UButton>
      <UButton color="neutral" variant="soft" @click="call('/api/manage/seed_example')">
        {{ $t('devTools.seedExample') }}
      </UButton>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ $t('devTools.flow') }}
    </p>
    <pre v-if="out" class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ out }}</pre>
  </div>
</template>
