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

    <!-- New mode: sticky iOS nav bar -->
    <div v-if="isNew" class="sticky top-0 z-10 -mx-4 -mt-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 min-h-[44px]">
      <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
      <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('units.add') }}</span>
      <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="save">{{ $t('common.save') }}</button>
    </div>
    <!-- View mode: iOS nav bar -->
    <div v-if="!isNew" class="sticky top-0 z-10 -mx-4 -mt-4 relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end px-2 min-h-[44px]">
      <h2 class="absolute inset-x-0 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 px-28 truncate pointer-events-none">{{ unit?.code + ' — ' + unit?.name }}</h2>
      <div class="relative z-10 flex items-center">
        <button class="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 active:opacity-50" @click="printUnit">
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
    </div>

  </div>

  <!-- Edit sheet (existing unit) -->
  <AppBottomSheet :open="showEditSheet" @close="cancelEdit">
    <!-- Sticky iOS nav bar -->
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 min-h-[44px]">
      <button class="flex-none text-[15px] text-[#007AFF] dark:text-blue-400 py-2 pr-4 active:opacity-50" @click="cancelEdit">{{ $t('common.cancel') }}</button>
      <span class="flex-1 text-center text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate px-2">{{ $t('common.edit') }} — {{ unit?.code }}</span>
      <button class="flex-none text-[15px] font-semibold text-[#007AFF] dark:text-blue-400 py-2 pl-4 disabled:opacity-40 active:opacity-50" :disabled="saving" @click="save">{{ $t('common.save') }}</button>
    </div>
    <div class="p-4 space-y-4">
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
              {{ $t('units.deleteConfirmExisting', { code: unit?.code, name: unit?.name }) }}
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
