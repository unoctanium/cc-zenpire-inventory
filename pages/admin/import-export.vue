<script setup lang="ts">
const { t } = useI18n()
const toast  = useToast()

const exporting      = ref(false)
const exportingPlain = ref(false)

const importFileRef   = ref<HTMLInputElement | null>(null)
const importModalOpen = ref(false)
const importSummary   = ref<Record<string, number>>({})
const importParsed    = ref<any>(null)
const importing       = ref(false)

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

function openImportPicker() {
  importFileRef.value?.click()
}

function onImportFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target?.result as string)

      if (!parsed || typeof parsed !== 'object') throw new Error('Not a JSON object')
      if (parsed.version !== 1)                   throw new Error(`Invalid version: ${parsed.version}`)
      if (parsed.app !== 'zenpire-inventory')      throw new Error(`Invalid app: ${parsed.app}`)
      if (!parsed.tables || typeof parsed.tables !== 'object') throw new Error('Missing tables')

      const expected = ['unit', 'allergen', 'ingredient', 'recipe', 'recipe_component']
      for (const t of expected) {
        if (!Array.isArray(parsed.tables[t])) throw new Error(`Missing table: ${t}`)
      }

      importParsed.value    = parsed
      importSummary.value   = Object.fromEntries(expected.map(k => [k, parsed.tables[k].length]))
      importModalOpen.value = true
    } catch (err: any) {
      toast.add({ title: t('devTools.importFailed'), description: err.message, color: 'error' })
    } finally {
      if (importFileRef.value) importFileRef.value.value = ''
    }
  }
  reader.readAsText(file)
}

async function confirmImport() {
  if (!importParsed.value) return
  importing.value = true
  try {
    await $fetch('/api/manage/import', {
      method:      'POST',
      credentials: 'include',
      body:        importParsed.value,
    })
    toast.add({ title: t('devTools.importSuccess') })
    importModalOpen.value = false
    importParsed.value    = null
  } catch (e: any) {
    toast.add({
      title:       t('devTools.importFailed'),
      description: e?.data?.statusMessage ?? e?.message ?? String(e),
      color:       'error',
    })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <AppSplitLayout :show-detail-on-mobile="true">
    <template #detail>
      <div class="p-6 space-y-4">

        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ $t('devTools.headingIo') }}
        </p>

        <table class="text-sm">
          <tbody>
            <tr>
              <td class="pr-4 py-1 align-middle">
                <UButton color="neutral" variant="soft" class="w-36" @click="openImportPicker">
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

        <!-- Hidden file input -->
        <input
          ref="importFileRef"
          type="file"
          accept=".json"
          class="hidden"
          @change="onImportFileChange"
        >

        <!-- Import confirm modal -->
        <UModal v-model:open="importModalOpen" :title="$t('devTools.importConfirmTitle')">
          <template #body>
            <div class="space-y-3 text-sm">
              <p class="text-gray-700 dark:text-gray-300">{{ $t('devTools.importConfirmDesc') }}</p>
              <p class="font-medium text-gray-800 dark:text-gray-200">{{ $t('devTools.importSummaryLabel') }}</p>
              <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-0.5">
                <li v-for="(count, table) in importSummary" :key="table">
                  {{ table }}: {{ count }}
                </li>
              </ul>
            </div>
          </template>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="importModalOpen = false">
                {{ $t('common.cancel') }}
              </UButton>
              <UButton color="error" variant="solid" :loading="importing" @click="confirmImport">
                {{ $t('devTools.importConfirm') }}
              </UButton>
            </div>
          </template>
        </UModal>

      </div>
    </template>
  </AppSplitLayout>
</template>
