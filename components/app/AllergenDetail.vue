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

    <!-- New mode: sticky iOS nav bar -->
    <div v-if="isNew" class="sticky top-0 z-10 -mx-4 -mt-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 min-h-[44px]">
      <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
      <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('allergens.add') }}</span>
      <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="save">{{ $t('common.save') }}</button>
    </div>
    <!-- View mode: iOS nav bar -->
    <div v-if="!isNew" class="sticky top-0 z-10 -mx-4 -mt-4 relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end px-2 min-h-[44px]">
      <h2 class="absolute inset-x-0 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 px-28 truncate pointer-events-none">{{ allergen?.name }}</h2>
      <div class="relative z-10 flex items-center">
        <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="printAllergen">
          <UIcon name="i-heroicons-printer" class="w-5 h-5" />
        </button>
        <button v-if="canManage" class="w-9 h-9 flex items-center justify-center text-[#007AFF] dark:text-blue-400 active:opacity-50" @click="startEdit">
          <UIcon name="i-heroicons-pencil-square" class="w-5 h-5" />
        </button>
        <button v-if="canManage" class="w-9 h-9 flex items-center justify-center text-red-500 active:opacity-50" @click="confirmingDelete = true">
          <UIcon name="i-heroicons-trash" class="w-5 h-5" />
        </button>
      </div>
    </div>


    <!-- View mode (existing) -->
    <div v-if="!isNew" class="space-y-5">
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('allergens.name') }}</div>
        <div class="text-[17px] font-medium text-gray-900 dark:text-gray-100">{{ allergen?.name }}</div>
      </div>
      <div>
        <div class="text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-1">{{ $t('allergens.comment') }}</div>
        <div class="text-[17px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ allergen?.comment || '—' }}</div>
      </div>
    </div>

    <!-- Create mode (new — inline, parent already provides the sheet) -->
    <div v-if="isNew" class="space-y-5">
      <div>
        <label class="ios-label">{{ $t('allergens.name') }} *</label>
        <input v-model="draft.name"
          class="ios-input"
          :placeholder="$t('allergens.namePlaceholder')" autocomplete="off" />
      </div>
      <div>
        <label class="ios-label">{{ $t('allergens.comment') }}</label>
        <textarea v-model="draft.comment" rows="2"
          class="ios-input resize-none"
          :placeholder="$t('allergens.commentPlaceholder')" />
      </div>
    </div>

  </div>

  <!-- Edit sheet (existing allergen) -->
  <AppBottomSheet :open="showEditSheet" @close="cancelEdit">
    <!-- Sticky iOS nav bar -->
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 min-h-[44px]">
      <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
      <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('common.edit') }} — {{ allergen?.name }}</span>
      <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="save">{{ $t('common.save') }}</button>
    </div>
    <div class="p-4 space-y-4">
      <div>
        <label class="ios-label">{{ $t('allergens.name') }} *</label>
        <input v-model="draft.name"
          class="ios-input"
          :placeholder="$t('allergens.namePlaceholder')" autocomplete="off" />
      </div>
      <div>
        <label class="ios-label">{{ $t('allergens.comment') }}</label>
        <textarea v-model="draft.comment" rows="2"
          class="ios-input resize-none"
          :placeholder="$t('allergens.commentPlaceholder')" />
      </div>
    </div>
  </AppBottomSheet>

  <!-- iOS delete alert -->
  <Teleport to="body">
    <Transition name="ios-alert">
      <div
        v-if="confirmingDelete"
        class="fixed inset-0 z-[200] flex items-center justify-center"
        style="background: rgba(0,0,0,0.35); backdrop-filter: blur(4px)"
      >
        <div class="ios-alert-card w-[270px] rounded-[13px] bg-white dark:bg-[#1c1c1e] shadow-2xl overflow-hidden">
          <div class="px-4 pt-5 pb-4 text-center">
            <h3 class="text-[17px] font-semibold text-gray-900 dark:text-white leading-snug">
              {{ $t('allergens.deleteConfirmExisting', { name: allergen?.name ?? '' }) }}
            </h3>
          </div>
          <div class="border-t border-gray-300/60 dark:border-gray-600/60 grid grid-cols-2 divide-x divide-gray-300/60 dark:divide-gray-600/60">
            <button
              class="py-[11px] text-[17px] text-[#007AFF] dark:text-blue-400 active:bg-gray-200/60 dark:active:bg-gray-700/60"
              @click="confirmingDelete = false"
            >{{ $t('common.cancel') }}</button>
            <button
              class="py-[11px] text-[17px] font-semibold text-red-500 active:bg-gray-200/60 dark:active:bg-gray-700/60"
              @click="doDelete"
            >{{ $t('common.delete') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
