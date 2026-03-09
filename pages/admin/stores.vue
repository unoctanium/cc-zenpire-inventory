<script setup lang="ts">
import { fetchAuth } from '~/composables/useAuth'

const { t } = useI18n()
const auth = useAuth()
const { currentStore } = useCurrentStore()

const canManage = computed(() => Boolean(auth.value?.permissions?.includes('store.manage')))

type StoreRow = { id: string; name: string; address: string | null; created_at: string }

const { data, refresh } = await useFetch<{ ok: boolean; stores: StoreRow[] }>('/api/stores', { credentials: 'include' })
const stores = computed(() => data.value?.stores ?? [])

// ─── selection / form ─────────────────────────────────────────────────────────

const selectedId    = ref<string | null>(null)
const isNew         = ref(false)
const form          = reactive({ name: '', address: '' })
const saving        = ref(false)
const deleting      = ref(false)
const confirmDelete = ref(false)
const error         = ref('')

const selectedStore = computed(() => stores.value.find(s => s.id === selectedId.value) ?? null)

function selectStore(store: StoreRow) {
  isNew.value      = false
  selectedId.value = store.id
  form.name        = store.name
  form.address     = store.address ?? ''
  error.value      = ''
  confirmDelete.value = false
}

function startNew() {
  isNew.value      = true
  selectedId.value = null
  form.name        = ''
  form.address     = ''
  error.value      = ''
  confirmDelete.value = false
}

async function save() {
  if (!form.name.trim()) { error.value = t('stores.nameRequired'); return }
  saving.value = true
  error.value  = ''
  const wasNew = isNew.value
  try {
    const body = { name: form.name.trim(), address: form.address.trim() || null }
    if (wasNew) {
      const res = await $fetch<{ ok: boolean; store: StoreRow }>('/api/stores', { method: 'POST', body, credentials: 'include' })
      await refresh()
      // Refresh auth so the new store appears in the header dropdown immediately
      await fetchAuth()
      selectedId.value = res.store.id
      isNew.value = false
      selectStore(res.store)
    } else {
      await $fetch(`/api/stores/${selectedId.value}`, { method: 'PUT', body, credentials: 'include' })
      await refresh()
      await fetchAuth()
    }
    useToast().add({ title: wasNew ? t('stores.created') : t('stores.updated'), color: 'success' })
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? t('common.saveFailed')
  } finally {
    saving.value = false
  }
}

async function doDelete() {
  if (!selectedId.value) return
  const deletingActiveStore = currentStore.value?.id === selectedId.value
  deleting.value = true
  try {
    await $fetch(`/api/stores/${selectedId.value}`, { method: 'DELETE', credentials: 'include' })
    await refresh()
    await fetchAuth()
    selectedId.value = null
    isNew.value = false
    confirmDelete.value = false
    useToast().add({ title: t('stores.deleted'), color: 'success' })
    if (deletingActiveStore) navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? t('common.deleteFailed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="!canManage" class="p-6 text-red-600">403 – {{ $t('stores.noPermission') }}</div>

  <AppSplitLayout v-else>

    <!-- ─── List panel ─────────────────────────────────────────────────────── -->
    <template #search>
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{{ $t('stores.title') }}</span>
        <UButton size="xs" variant="soft" icon="i-heroicons-plus" @click="startNew">{{ $t('stores.add') }}</UButton>
      </div>
    </template>

    <template #list>
      <div class="flex flex-col h-full">
        <div
          v-for="store in stores"
          :key="store.id"
          class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer select-none transition-colors"
          :class="selectedId === store.id && !isNew
            ? 'bg-blue-50 dark:bg-blue-950'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
          @click="selectStore(store)"
        >
          <UIcon name="i-heroicons-building-storefront" class="w-5 h-5 text-gray-400 flex-none" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ store.name }}</p>
            <p v-if="store.address" class="text-xs text-gray-500 truncate">{{ store.address }}</p>
          </div>
        </div>
        <div v-if="stores.length === 0" class="px-4 py-6 text-sm text-gray-400 text-center">
          {{ $t('common.noData') }}
        </div>
      </div>
    </template>

    <!-- ─── Detail / form panel ───────────────────────────────────────────── -->
    <template #detail>
      <div v-if="!selectedId && !isNew" class="flex items-center justify-center h-full text-gray-400 text-sm">
        {{ $t('stores.selectPrompt') }}
      </div>

      <div v-else class="p-6 space-y-4 max-w-lg">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ isNew ? $t('stores.add') : selectedStore?.name }}
        </h2>

        <!-- Name -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('stores.name') }}</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="$t('stores.namePlaceholder')"
          />
        </div>

        <!-- Address -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('stores.address') }}</label>
          <input
            v-model="form.address"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="$t('stores.addressPlaceholder')"
          />
        </div>

        <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2">
          <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
          <UButton
            v-if="!isNew"
            color="error"
            variant="soft"
            @click="confirmDelete = true"
          >
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </div>
    </template>

  </AppSplitLayout>

  <!-- iOS-style action sheet for delete confirm -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="confirmDelete"
        class="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center"
        style="background: rgba(0,0,0,0.4)"
        @click.self="confirmDelete = false"
      >
        <!-- Sheet -->
        <Transition
          enter-active-class="transition-transform duration-250 ease-out"
          enter-from-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
          leave-active-class="transition-transform duration-200 ease-in"
          leave-to-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
        >
          <div
            class="w-full sm:w-80 mx-auto mb-4 sm:mb-0 px-4 sm:px-0"
            @click.stop
          >
            <!-- Action group -->
            <div class="rounded-2xl overflow-hidden" style="background: rgba(250,250,250,0.97)">
              <div class="px-4 py-4 text-center border-b border-gray-200">
                <p class="text-xs text-gray-500">{{ $t('stores.deleteTitle') }}</p>
                <p class="text-sm font-semibold text-gray-900 mt-0.5">{{ selectedStore?.name }}</p>
              </div>
              <button
                class="w-full py-4 text-base font-semibold text-red-500 active:bg-gray-100 transition-colors"
                :disabled="deleting"
                @click="doDelete"
              >
                {{ deleting ? '…' : $t('common.delete') }}
              </button>
            </div>
            <!-- Cancel button (separate, iOS style) -->
            <div class="rounded-2xl overflow-hidden mt-2" style="background: rgba(250,250,250,0.97)">
              <button
                class="w-full py-4 text-base font-bold text-gray-900 active:bg-gray-100 transition-colors"
                @click="confirmDelete = false"
              >
                {{ $t('common.cancel') }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
