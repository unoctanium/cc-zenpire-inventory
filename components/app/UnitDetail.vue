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

const { t }  = useI18n()
const toast  = useToast()

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
  <div class="p-4 space-y-4 max-w-sm">

    <!-- Header -->
    <div class="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
        {{ isNew ? $t('units.add') : unit!.code + ' — ' + unit!.name }}
      </h2>
      <div v-if="!isNew" class="flex gap-1">
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
