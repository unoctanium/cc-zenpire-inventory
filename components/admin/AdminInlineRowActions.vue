<script setup lang="ts">
type Mode = 'view' | 'edit'

defineProps<{
  mode: 'view' | 'edit'
  canEdit?: boolean
  canDelete?: boolean
}>()

const canEdit = computed(() => props.canEdit !== false)
const canDelete = computed(() => props.canDelete !== false)

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'save'): void
  (e: 'discard'): void
  (e: 'delete'): void
}>()

</script>

<template>
  <div class="flex items-center justify-end gap-2">
    <template v-if="mode === 'view' and canEdit">
      <UButton
        size="xs"
        variant="soft"
        icon="i-heroicons-pencil"
        square
        aria-label="Edit"
        @click="emit('edit')"
      />
    </template>

    <template v-else-if="mode === 'edit' && canEdit">
      <UButton
        size="xs"
        variant="soft"
        icon="i-heroicons-check"
        square
        aria-label="Save"
        @click="emit('save')"
      />
      <UButton
        size="xs"
        variant="soft"
        color="gray"
        icon="i-heroicons-x-mark"
        square
        aria-label="Discard"
        @click="emit('discard')"
      />
    </template>

    <UButton
      v-if="canDelete"
      size="xs"
      color="red"
      variant="soft"
      icon="i-heroicons-trash"
      square
      aria-label="Delete"
      @click="emit('delete')"
    />
  </div>
</template>