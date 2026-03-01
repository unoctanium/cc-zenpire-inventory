<script setup lang="ts">
const { t }   = useI18n()
const toast   = useToast()
const out     = ref('')
const exporting      = ref(false)
const exportingPlain = ref(false)

async function call(path: string) {
  out.value = `Calling ${path}...`
  try {
    const res = await $fetch(path, { method: 'POST' })
    out.value = JSON.stringify(res, null, 2)
  } catch (e: any) {
    out.value = `${e?.statusCode ?? ''} ${e?.statusMessage ?? ''}\n${JSON.stringify(e?.data ?? {}, null, 2)}`
  }
}

async function runExport() {
  exporting.value = true
  try {
    const data = await $fetch('/api/manage/export', { credentials: 'include' })
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `zenpire-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.add({ title: t('devTools.exportSuccess') })
  } catch (e: any) {
    toast.add({
      title:       t('devTools.exportFailed'),
      description: e?.data?.statusMessage ?? e?.message ?? String(e),
      color:       'error',
    })
  } finally {
    exporting.value = false
  }
}

async function runExportPlain() {
  exportingPlain.value = true
  try {
    const data = await $fetch('/api/manage/export-plain', { credentials: 'include' })
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `zenpire-export-plain-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.add({ title: t('devTools.exportSuccess') })
  } catch (e: any) {
    toast.add({
      title:       t('devTools.exportFailed'),
      description: e?.data?.statusMessage ?? e?.message ?? String(e),
      color:       'error',
    })
  } finally {
    exportingPlain.value = false
  }
}
</script>

<template>
  <div class="space-y-4">

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

    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 pt-2">
      {{ $t('devTools.headingIo') }}
    </p>

    <table class="text-sm">
      <tbody>
        <tr>
          <td class="pr-4 py-1 align-middle">
            <UButton color="neutral" variant="soft" class="w-36" disabled>
              {{ $t('devTools.dbImport') }}
            </UButton>
          </td>
          <td class="py-1 align-middle text-gray-600 dark:text-gray-400">
            {{ $t('devTools.dbImportDesc') }}
          </td>
        </tr>
        <tr>
          <td class="pr-4 py-1 align-middle">
            <UButton color="neutral" variant="soft" class="w-36" :loading="exporting" @click="runExport">
              {{ $t('devTools.dbExport') }}
            </UButton>
          </td>
          <td class="py-1 align-middle text-gray-600 dark:text-gray-400">
            {{ $t('devTools.dbExportDesc') }}
          </td>
        </tr>
        <tr>
          <td class="pr-4 py-1 align-middle">
            <UButton color="neutral" variant="soft" class="w-36" :loading="exportingPlain" @click="runExportPlain">
              {{ $t('devTools.dbExportPlain') }}
            </UButton>
          </td>
          <td class="py-1 align-middle text-gray-600 dark:text-gray-400">
            {{ $t('devTools.dbExportPlainDesc') }}
          </td>
        </tr>
      </tbody>
    </table>

    <pre v-if="out" class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ out }}</pre>
  </div>
</template>
