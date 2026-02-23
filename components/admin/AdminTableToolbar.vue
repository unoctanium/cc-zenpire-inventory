<script setup lang="ts">
/**
 * AdminTableToolbar
 *
 * Reusable toolbar for inline-edit tables:
 *   [filter input] [clear ✕] [column select]   [refresh] [add]
 *
 * Props:
 *   filterText          — v-model for the search string
 *   filterColumn        — v-model for the selected column
 *   filterColumnOptions — array of { label, value } for the column dropdown
 *   canAdd              — whether to show the Add button (default true)
 *   addLabel            — label for the Add button
 *
 * Emits:
 *   refresh             — user clicked the refresh button
 *   add                 — user clicked the add button
 */

interface FilterOption {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  filterText:          string
  filterColumn:        string
  filterColumnOptions: FilterOption[]
  canAdd?:             boolean
  addLabel?:           string
}>(), {
  canAdd:    true,
  addLabel:  undefined,
})

const emit = defineEmits<{
  (e: 'update:filterText',   v: string): void
  (e: 'update:filterColumn', v: string): void
  (e: 'refresh'): void
  (e: 'add'):     void
}>()

const { t } = useI18n()

const localText = computed({
  get:  () => props.filterText,
  set:  (v) => emit('update:filterText', v),
})

const localCol = computed({
  get:  () => props.filterColumn,
  set:  (v) => emit('update:filterColumn', v),
})
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
    <!-- Filter -->
    <div class="flex items-center gap-2">
      <div class="flex items-stretch">
        <input
          v-model="localText"
          class="w-[200px] rounded-l-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                 focus:outline-none focus:ring-2 focus:ring-gray-300
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
          :placeholder="$t('common.search')"
          autocomplete="off"
          inputmode="search"
        />
        <button
          type="button"
          :disabled="!localText"
          :aria-label="$t('common.clearFilter')"
          class="flex items-center justify-center px-2
                 border-t border-b border-r border-gray-300 rounded-r-md
                 bg-gray-100 text-gray-600 hover:bg-gray-200
                 disabled:opacity-40 disabled:cursor-not-allowed
                 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="emit('update:filterText', '')"
        >
          ✕
        </button>
      </div>

      <select
        v-model="localCol"
        class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
               focus:outline-none focus:ring-2 focus:ring-gray-300
               dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-700"
      >
        <option v-for="o in filterColumnOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <UButton icon="i-heroicons-arrow-path" color="gray" variant="soft" @click="emit('refresh')">
        {{ $t('common.refresh') }}
      </UButton>
      <UButton v-if="canAdd" icon="i-heroicons-plus" @click="emit('add')">
        {{ addLabel ?? $t('common.add') }}
      </UButton>
    </div>
  </div>
</template>
