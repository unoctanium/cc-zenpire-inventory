<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

type AllergenRow = { id: string; name: string; comment: string | null; created_at: string; updated_at: string }

const route = useRoute()
const id    = computed(() => route.params.id as string)
const toast = useToast()
const { t } = useI18n()

const { canManage } = useTablePermissions('recipe')

const { data, refresh } = await useFetch<{ ok: boolean; allergens: AllergenRow[] }>('/api/allergens', { credentials: 'include' })
const allergen = computed(() => data.value?.allergens?.find(a => a.id === id.value) ?? null)

const editMode         = ref(false)
const confirmingDelete = ref(false)
const saving           = ref(false)
const draft            = reactive({ name: '', comment: '' })

watch(allergen, (a) => {
  if (a) { draft.name = a.name; draft.comment = a.comment ?? '' }
}, { immediate: true })

function cancelEdit() {
  const a = allergen.value
  if (a) { draft.name = a.name; draft.comment = a.comment ?? '' }
  editMode.value = false
}

async function save() {
  if (!draft.name.trim()) {
    toast.add({ title: t('common.missingFields'), description: t('allergens.nameRequired'), color: 'red' })
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/allergens/${id.value}`, {
      method: 'PUT', credentials: 'include',
      body: { name: draft.name.trim(), comment: draft.comment.trim() || null },
    })
    toast.add({ title: t('allergens.updated') })
    editMode.value = false
    await refresh()
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally { saving.value = false }
}

async function doDelete() {
  try {
    await $fetch(`/api/allergens/${id.value}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('allergens.deleted') })
    navigateTo('/allergens')
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  }
}
</script>

<template>
  <div>
    <div class="sm:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" @click="navigateTo('/allergens')">
        <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
        {{ $t('nav.allergens') }}
      </button>
    </div>

    <div v-if="allergen" class="p-4 space-y-4 max-w-sm">

      <div class="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ editMode ? $t('common.edit') : allergen.name }}
        </h2>
        <div v-if="!editMode" class="flex gap-1">
          <UButton v-if="canManage" size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" @click="editMode = true">{{ $t('common.edit') }}</UButton>
          <UButton v-if="canManage" size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="confirmingDelete = true">{{ $t('common.delete') }}</UButton>
        </div>
      </div>

      <div
        v-if="confirmingDelete"
        class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center justify-between gap-3"
      >
        <p class="text-sm text-red-700 dark:text-red-300">{{ $t('allergens.deleteConfirmExisting', { name: allergen.name }) }}</p>
        <div class="flex gap-2 flex-none">
          <UButton size="xs" color="neutral" variant="soft" @click="confirmingDelete = false">{{ $t('common.cancel') }}</UButton>
          <UButton size="xs" color="error" @click="doDelete">{{ $t('common.delete') }}</UButton>
        </div>
      </div>

      <div v-if="!editMode" class="space-y-3">
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('allergens.name') }}</div>
          <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ allergen.name }}</div>
        </div>
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('allergens.comment') }}</div>
          <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ allergen.comment || '—' }}</div>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('allergens.name') }} *</label>
          <input v-model="draft.name"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('allergens.namePlaceholder')" autocomplete="off" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('allergens.comment') }}</label>
          <textarea v-model="draft.comment" rows="2"
            class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('allergens.commentPlaceholder')" />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <UButton color="neutral" variant="soft" @click="cancelEdit">{{ $t('common.cancel') }}</UButton>
          <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
        </div>
      </div>

    </div>

    <div v-else class="p-6 text-sm text-gray-500">{{ $t('common.loading') }}</div>
  </div>
</template>
