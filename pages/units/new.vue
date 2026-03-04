<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

type UnitType = 'mass' | 'volume' | 'count'

const toast = useToast()
const { t } = useI18n()

const { canManage } = useTablePermissions('unit')

const unitTypeOptions: { label: string; value: UnitType }[] = [
  { label: 'mass',   value: 'mass'   },
  { label: 'volume', value: 'volume' },
  { label: 'count',  value: 'count'  },
]

const saving = ref(false)
const draft  = reactive({ code: '', name: '', unit_type: 'mass' as UnitType, factor: 1 })

async function save() {
  if (!draft.code.trim() || !draft.name.trim()) {
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
    const res = await $fetch<{ ok: boolean; unit: { id: string } }>('/api/units', {
      method: 'POST', credentials: 'include',
      body: { code: draft.code.trim(), name: draft.name.trim(), unit_type: draft.unit_type, factor: factorVal },
    })
    toast.add({ title: t('units.created') })
    navigateTo(`/units/${res.unit.id}`)
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  } finally { saving.value = false }
}
</script>

<template>
  <div>
    <div class="p-4 space-y-4 max-w-sm">
      <div class="pb-2 border-b border-gray-200 dark:border-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ $t('units.add') }}</h2>
      </div>

      <div class="space-y-3">
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
          <UButton color="neutral" variant="soft" @click="navigateTo('/units')">{{ $t('common.cancel') }}</UButton>
          <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
