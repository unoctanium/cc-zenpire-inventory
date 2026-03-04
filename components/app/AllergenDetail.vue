<script setup lang="ts">
type AllergenRow = { id: string; name: string; comment: string | null }

const props = defineProps<{
  allergen:  AllergenRow | null
  canManage: boolean
}>()

const emit = defineEmits<{
  (e: 'saved', id: string): void
  (e: 'deleted'): void
  (e: 'cancelled'): void
}>()

const { t }         = useI18n()
const toast         = useToast()
const { printHtml } = usePrint()

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printAllergen() {
  if (!props.allergen) return
  const a = props.allergen
  printHtml(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(a.name)} — Zenpire</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;font-size:14px;color:#111827;background:#fff;padding:24px}
h1{font-size:24px;font-weight:700;margin-bottom:20px}
h2{font-size:15px;font-weight:600;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:24px 0 10px}
.comment{color:#4b5563;line-height:1.6;white-space:pre-wrap}
.footer{margin-top:32px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af}
@media print{@page{margin:1.5cm}}</style></head>
<body>
<h1>${esc(a.name)}</h1>
${a.comment ? `<h2>Comment</h2><p class="comment">${esc(a.comment)}</p>` : ''}
<div class="footer">Zenpire Inventory — printed ${new Date().toLocaleString()}</div>
</body></html>`)
}

const isNew            = computed(() => !props.allergen)
const editMode         = ref(false)
const showEditSheet    = ref(false)
const confirmingDelete = ref(false)
const saving           = ref(false)
const draft            = reactive({ name: '', comment: '' })

watch(() => props.allergen, (a) => {
  confirmingDelete.value = false
  showEditSheet.value    = false
  if (a) {
    editMode.value = false
    draft.name     = a.name
    draft.comment  = a.comment ?? ''
  } else {
    editMode.value = true
    draft.name     = ''
    draft.comment  = ''
  }
}, { immediate: true })

function startEdit() {
  editMode.value      = true
  showEditSheet.value = true
}

function cancelEdit() {
  if (isNew.value) { emit('cancelled'); return }
  const a = props.allergen!
  draft.name     = a.name
  draft.comment  = a.comment ?? ''
  editMode.value         = false
  showEditSheet.value    = false
  confirmingDelete.value = false
}

async function save() {
  if (!draft.name.trim()) {
    toast.add({ title: t('common.missingFields'), description: t('allergens.nameRequired'), color: 'red' })
    return
  }
  saving.value = true
  try {
    const body = { name: draft.name.trim(), comment: draft.comment.trim() || null }
    if (isNew.value) {
      const res = await $fetch<{ ok: boolean; allergen: { id: string } }>('/api/allergens', { method: 'POST', credentials: 'include', body })
      toast.add({ title: t('allergens.created') })
      emit('saved', res.allergen.id)
    } else {
      await $fetch(`/api/allergens/${props.allergen!.id}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('allergens.updated') })
      editMode.value      = false
      showEditSheet.value = false
      emit('saved', props.allergen!.id)
    }
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally { saving.value = false }
}

async function doDelete() {
  if (!props.allergen) return
  try {
    await $fetch(`/api/allergens/${props.allergen.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('allergens.deleted') })
    emit('deleted')
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  }
}
</script>

<template>
  <div class="p-4 space-y-4">

    <!-- Header -->
    <div class="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
        {{ isNew ? $t('allergens.add') : allergen!.name }}
      </h2>
      <div v-if="!isNew" class="flex items-center gap-1">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-printer" @click="printAllergen">{{ $t('common.print') }}</UButton>
        <UButton v-if="canManage" size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" @click="startEdit">{{ $t('common.edit') }}</UButton>
        <UButton v-if="canManage" size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="confirmingDelete = true">{{ $t('common.delete') }}</UButton>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="confirmingDelete" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center justify-between gap-3">
      <p class="text-sm text-red-700 dark:text-red-300">{{ $t('allergens.deleteConfirmExisting', { name: allergen?.name ?? '' }) }}</p>
      <div class="flex gap-2 flex-none">
        <UButton size="xs" color="neutral" variant="soft" @click="confirmingDelete = false">{{ $t('common.cancel') }}</UButton>
        <UButton size="xs" color="error" @click="doDelete">{{ $t('common.delete') }}</UButton>
      </div>
    </div>

    <!-- View mode (existing) -->
    <div v-if="!isNew" class="space-y-3">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('allergens.name') }}</div>
        <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ allergen?.name }}</div>
      </div>
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('allergens.comment') }}</div>
        <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ allergen?.comment || '—' }}</div>
      </div>
    </div>

    <!-- Create mode (new — inline, parent already provides the sheet) -->
    <div v-if="isNew" class="space-y-3">
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

  <!-- Edit sheet (existing allergen) -->
  <AppBottomSheet :open="showEditSheet" @close="cancelEdit">
    <div class="p-4 space-y-4 max-w-sm">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-200 dark:border-gray-800">
        {{ $t('common.edit') }} — {{ allergen?.name }}
      </h3>
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
  </AppBottomSheet>
</template>
