<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const toast = useToast()
const { t } = useI18n()

const { canManage } = useTablePermissions('recipe')

const saving = ref(false)
const draft  = reactive({ name: '', comment: '' })

async function save() {
  if (!draft.name.trim()) {
    toast.add({ title: t('common.missingFields'), description: t('allergens.nameRequired'), color: 'red' })
    return
  }
  saving.value = true
  try {
    const res = await $fetch<{ ok: boolean; allergen: { id: string } }>('/api/allergens', {
      method: 'POST', credentials: 'include',
      body: { name: draft.name.trim(), comment: draft.comment.trim() || null },
    })
    toast.add({ title: t('allergens.created') })
    navigateTo(`/allergens/${res.allergen.id}`)
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally { saving.value = false }
}
</script>

<template>
  <div>
    <div class="p-4 space-y-4 max-w-sm">
      <div class="pb-2 border-b border-gray-200 dark:border-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ $t('allergens.add') }}</h2>
      </div>

      <div class="space-y-3">
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
          <UButton color="neutral" variant="soft" @click="navigateTo('/allergens')">{{ $t('common.cancel') }}</UButton>
          <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
