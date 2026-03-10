<script setup lang="ts">
definePageMeta({ layout: 'superadmin' })

const { t } = useI18n()
const auth = useAuth()

const canAccess = computed(() => Boolean(auth.value?.is_superadmin))

type ClientRow = { id: string; name: string; created_at: string }

const { data, refresh } = await useFetch<{ ok: boolean; clients: ClientRow[] }>('/api/superadmin/clients', {
  credentials: 'include',
})
const clients = computed(() => data.value?.clients ?? [])

// ─── selection / form ─────────────────────────────────────────────────────────

const selectedId = ref<string | null>(null)
const isNew      = ref(false)

const form = reactive({ name: '' })
const saving  = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const error   = ref('')

const selectedClient = computed(() => clients.value.find(c => c.id === selectedId.value) ?? null)

function selectClient(client: ClientRow) {
  isNew.value      = false
  selectedId.value = client.id
  form.name        = client.name
  error.value      = ''
  confirmDelete.value = false
}

function startNew() {
  isNew.value      = true
  selectedId.value = null
  form.name        = ''
  error.value      = ''
  confirmDelete.value = false
}

async function save() {
  if (!form.name.trim()) { error.value = t('superadmin.nameRequired'); return }
  saving.value = true
  error.value  = ''
  try {
    const body = { name: form.name.trim() }
    if (isNew.value) {
      const res = await $fetch<{ ok: boolean; client: ClientRow }>('/api/superadmin/clients', { method: 'POST', body, credentials: 'include' })
      await refresh()
      selectedId.value = res.client.id
      isNew.value = false
      selectClient(res.client)
      useToast().add({ title: t('superadmin.created'), color: 'success' })
    } else {
      await $fetch(`/api/superadmin/clients/${selectedId.value}`, { method: 'PUT', body, credentials: 'include' })
      await refresh()
      useToast().add({ title: t('superadmin.updated'), color: 'success' })
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? t('common.saveFailed')
  } finally {
    saving.value = false
  }
}

async function doDelete() {
  if (!selectedId.value) return
  deleting.value = true
  try {
    await $fetch(`/api/superadmin/clients/${selectedId.value}`, { method: 'DELETE', credentials: 'include' })
    await refresh()
    selectedId.value = null
    isNew.value = false
    confirmDelete.value = false
    useToast().add({ title: t('superadmin.deleted'), color: 'success' })
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? t('common.deleteFailed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="!canAccess" class="p-6 text-red-600">403 – {{ $t('superadmin.noPermission') }}</div>

  <AppSplitLayout v-else>

    <!-- ─── List panel ─────────────────────────────────────────────────────── -->
    <template #search>
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{{ $t('superadmin.title') }}</span>
        <UButton size="xs" variant="soft" icon="i-heroicons-plus" @click="startNew">{{ $t('superadmin.add') }}</UButton>
      </div>
    </template>

    <template #list>
      <div class="flex flex-col h-full">
        <div
          v-for="client in clients"
          :key="client.id"
          class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer select-none transition-colors"
          :class="selectedId === client.id && !isNew
            ? 'bg-blue-50 dark:bg-blue-950'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
          @click="selectClient(client)"
        >
          <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-gray-400 flex-none" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ client.name }}</p>
            <p class="text-xs text-gray-400 truncate">{{ client.id }}</p>
          </div>
        </div>
        <div v-if="clients.length === 0" class="px-4 py-6 text-sm text-gray-400 text-center">
          {{ $t('common.noData') }}
        </div>
      </div>
    </template>

    <!-- ─── Detail / form panel ───────────────────────────────────────────── -->
    <template #detail>
      <div v-if="!selectedId && !isNew" class="flex items-center justify-center h-full text-gray-400 text-sm">
        {{ $t('superadmin.selectPrompt') }}
      </div>

      <div v-else class="p-6 space-y-4 max-w-lg">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ isNew ? $t('superadmin.add') : selectedClient?.name }}
        </h2>

        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('superadmin.name') }}</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="$t('superadmin.namePlaceholder')"
          />
        </div>

        <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

        <div class="flex items-center gap-3 pt-2">
          <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
          <UButton
            v-if="!isNew"
            color="error"
            variant="soft"
            :loading="deleting"
            @click="confirmDelete = true"
          >
            {{ $t('common.delete') }}
          </UButton>
        </div>

        <div v-if="confirmDelete" class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-4 space-y-3">
          <p class="text-sm text-red-700 dark:text-red-300">
            {{ $t('superadmin.deleteConfirmExisting', { name: selectedClient?.name }) }}
          </p>
          <div class="flex gap-2">
            <UButton color="error" size="sm" :loading="deleting" @click="doDelete">{{ $t('common.delete') }}</UButton>
            <UButton variant="soft" size="sm" @click="confirmDelete = false">{{ $t('common.cancel') }}</UButton>
          </div>
        </div>
      </div>
    </template>

  </AppSplitLayout>
</template>
