<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

type UnitType = 'mass' | 'volume' | 'count'
type UnitRow  = { id: string; code: string; name: string; unit_type: UnitType; factor: number }

const props = defineProps<{
  unit:       UnitRow | null
  canManage:  boolean
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

function printUnit() {
  if (!props.unit) return
  const u = props.unit
  printHtml(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(u.code)} — Zenpire</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;font-size:14px;color:#111827;background:#fff;padding:24px}
h1{font-size:24px;font-weight:700;margin-bottom:20px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}
.meta label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:600;display:block;margin-bottom:2px}
.footer{margin-top:32px;padding-top:10px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af}
@media print{@page{margin:1.5cm}}</style></head>
<body>
<h1>${esc(u.code)} — ${esc(u.name)}</h1>
<div class="meta">
  <div><label>Code</label><span>${esc(u.code)}</span></div>
  <div><label>Name</label><span>${esc(u.name)}</span></div>
  <div><label>Type</label><span>${esc(u.unit_type)}</span></div>
  <div><label>Factor</label><span>${u.factor}</span></div>
</div>
<div class="footer">Zenpire Inventory — printed ${new Date().toLocaleString()}</div>
</body></html>`)
}

const unitTypeOptions: { label: string; value: UnitType }[] = [
  { label: 'mass',   value: 'mass'   },
  { label: 'volume', value: 'volume' },
  { label: 'count',  value: 'count'  },
]

const isNew            = computed(() => !props.unit)
const editMode         = ref(false)
const showEditSheet    = ref(false)
const confirmingDelete = ref(false)
const saving           = ref(false)
const draft            = reactive({ code: '', name: '', unit_type: 'mass' as UnitType, factor: 1 })

watch(() => props.unit, (u) => {
  confirmingDelete.value = false
  showEditSheet.value    = false
  if (u) {
    editMode.value  = false
    draft.code      = u.code
    draft.name      = u.name
    draft.unit_type = u.unit_type
    draft.factor    = u.factor
  } else {
    editMode.value  = true
    draft.code      = ''
    draft.name      = ''
    draft.unit_type = 'mass'
    draft.factor    = 1
  }
}, { immediate: true })

function startEdit() {
  editMode.value      = true
  showEditSheet.value = true
}

function cancelEdit() {
  if (isNew.value) { emit('cancelled'); return }
  const u = props.unit!
  draft.code      = u.code
  draft.name      = u.name
  draft.unit_type = u.unit_type
  draft.factor    = u.factor
  editMode.value         = false
  showEditSheet.value    = false
  confirmingDelete.value = false
}

async function save() {
  if (!draft.code.trim() || !draft.name.trim() || !draft.unit_type) {
    toast.add({ title: t('common.missingFields'), description: t('units.codeAndNameRequired'), color: 'red' })
    return
  }
  const factorVal = Number(draft.factor)
  if (!(factorVal > 0)) {
    toast.add({ title: t('common.missingFields'), description: t('units.factorRequired'), color: 'red' })
    return
  }
  saving.value = true
  try {
    const body = { code: draft.code.trim(), name: draft.name.trim(), unit_type: draft.unit_type, factor: factorVal }
    if (isNew.value) {
      const res = await $fetch<{ ok: boolean; unit: { id: string } }>('/api/units', { method: 'POST', credentials: 'include', body })
      toast.add({ title: t('units.created') })
      emit('saved', res.unit.id)
    } else {
      await $fetch(`/api/units/${props.unit!.id}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('units.updated') })
      editMode.value      = false
      showEditSheet.value = false
      emit('saved', props.unit!.id)
    }
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally { saving.value = false }
}

async function doDelete() {
  if (!props.unit) return
  try {
    await $fetch(`/api/units/${props.unit.id}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('units.deleted') })
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
        {{ isNew ? $t('units.add') : unit!.code + ' — ' + unit!.name }}
      </h2>
      <div v-if="!isNew" class="flex items-center gap-1">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-printer" @click="printUnit">{{ $t('common.print') }}</UButton>
        <UButton v-if="canManage" size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" @click="startEdit">{{ $t('common.edit') }}</UButton>
        <UButton v-if="canManage" size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="confirmingDelete = true">{{ $t('common.delete') }}</UButton>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="confirmingDelete" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center justify-between gap-3">
      <p class="text-sm text-red-700 dark:text-red-300">{{ $t('units.deleteConfirmExisting', { code: unit?.code, name: unit?.name }) }}</p>
      <div class="flex gap-2 flex-none">
        <UButton size="xs" color="neutral" variant="soft" @click="confirmingDelete = false">{{ $t('common.cancel') }}</UButton>
        <UButton size="xs" color="error" @click="doDelete">{{ $t('common.delete') }}</UButton>
      </div>
    </div>

    <!-- View mode (existing) -->
    <div v-if="!isNew" class="space-y-3">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('units.code') }}</div>
        <div class="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{{ unit?.code }}</div>
      </div>
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('units.name') }}</div>
        <div class="text-sm text-gray-900 dark:text-gray-100">{{ unit?.name }}</div>
      </div>
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('units.type') }}</div>
        <div class="text-sm text-gray-900 dark:text-gray-100">{{ unit?.unit_type }}</div>
      </div>
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('units.factor') }}</div>
        <div class="text-sm text-gray-900 dark:text-gray-100">{{ unit?.factor }}</div>
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-600">{{ $t('units.usedByOthers') }}</p>
    </div>

    <!-- Create mode (new — inline, parent already provides the sheet) -->
    <div v-if="isNew" class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.code') }} *</label>
        <input v-model="draft.code"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder="e.g. g" autocomplete="off" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.name') }} *</label>
        <input v-model="draft.name"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder="e.g. Gram" autocomplete="off" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.type') }} *</label>
        <select v-model="draft.unit_type"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <option v-for="o in unitTypeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.factor') }} *</label>
        <input v-model.number="draft.factor" type="number" min="0.000001" step="any"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder="1" />
      </div>
      <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
        <UButton color="neutral" variant="soft" @click="cancelEdit">{{ $t('common.cancel') }}</UButton>
        <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
      </div>
    </div>

  </div>

  <!-- Edit sheet (existing unit) -->
  <AppBottomSheet :open="showEditSheet" @close="cancelEdit">
    <div class="p-4 space-y-4 max-w-sm">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-200 dark:border-gray-800">
        {{ $t('common.edit') }} — {{ unit?.code }}
      </h3>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.code') }} *</label>
        <input v-model="draft.code"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder="e.g. g" autocomplete="off" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.name') }} *</label>
        <input v-model="draft.name"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder="e.g. Gram" autocomplete="off" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.type') }} *</label>
        <select v-model="draft.unit_type"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <option v-for="o in unitTypeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('units.factor') }} *</label>
        <input v-model.number="draft.factor" type="number" min="0.000001" step="any"
          class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-1 focus:ring-gray-400
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder="1" />
      </div>
      <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
        <UButton color="neutral" variant="soft" @click="cancelEdit">{{ $t('common.cancel') }}</UButton>
        <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
      </div>
    </div>
  </AppBottomSheet>
</template>
