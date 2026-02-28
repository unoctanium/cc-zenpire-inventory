<script setup lang="ts">
/**
 * AdminTableToolbar
 *
 * Layout: [+ Add] [search input] [clear ✕] [column select]  ·····  [Refresh]
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
}>(), {
  canAdd: true,
})

const emit = defineEmits<{
  (e: 'update:filterText',   v: string): void
  (e: 'update:filterColumn', v: string): void
  (e: 'refresh'): void
  (e: 'add'):     void
}>()

const localText = computed({
  get: () => props.filterText,
  set: (v) => emit('update:filterText', v),
})

const localCol = computed({
  get: () => props.filterColumn,
  set: (v) => emit('update:filterColumn', v),
})
</script>

<template>
  <div class="flex items-center gap-2">

    <!-- Left group: Add + search + filter -->
    <UButton v-if="canAdd" icon="i-heroicons-plus" @click="emit('add')">
      {{ $t('common.add') }}
    </UButton>

    <div class="flex items-stretch">
      <input
        v-model="localText"
        class="w-[180px] rounded-l-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
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

    <!-- Spacer pushes Refresh to the right -->
    <div class="flex-1" />

    <!-- Right: Refresh -->
    <UButton icon="i-heroicons-arrow-path" color="neutral" variant="soft" @click="emit('refresh')">
      {{ $t('common.refresh') }}
    </UButton>

  </div>
</template>
