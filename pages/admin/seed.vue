<script setup lang="ts">
const { t } = useI18n()
const out    = ref('')

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
  <AppSplitLayout :show-detail-on-mobile="true">
    <template #detail>
      <div class="p-6 space-y-4">

        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ $t('devTools.headingSeed') }}
        </p>

        <table class="text-sm">
          <tbody>
            <tr>
              <td class="pr-4 py-1 align-middle">
                <UButton color="error" variant="soft" class="w-36" @click="call('/api/manage/purge')">
                  {{ $t('devTools.purge') }}
                </UButton>
              </td>
              <td class="py-1 align-middle text-gray-600 dark:text-gray-400">
                {{ $t('devTools.purgeDesc') }}
              </td>
            </tr>
            <tr>
              <td class="pr-4 py-1 align-middle">
                <UButton color="neutral" variant="soft" class="w-36" @click="call('/api/manage/seed_initial')">
                  {{ $t('devTools.seedInitial') }}
                </UButton>
              </td>
              <td class="py-1 align-middle text-gray-600 dark:text-gray-400">
                {{ $t('devTools.seedInitialDesc') }}
              </td>
            </tr>
            <tr>
              <td class="pr-4 py-1 align-middle">
                <UButton color="neutral" variant="soft" class="w-36" @click="call('/api/manage/seed_example')">
                  {{ $t('devTools.seedExample') }}
                </UButton>
              </td>
              <td class="py-1 align-middle text-gray-600 dark:text-gray-400">
                {{ $t('devTools.seedExampleDesc') }}
              </td>
            </tr>
          </tbody>
        </table>

        <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('devTools.flow') }}</p>
        <p class="text-xs text-gray-400 dark:text-gray-600">{{ $t('devTools.subtitle') }}</p>

        <pre v-if="out" class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ out }}</pre>
      </div>
    </template>
  </AppSplitLayout>
</template>
