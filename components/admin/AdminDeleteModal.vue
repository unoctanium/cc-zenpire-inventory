<script setup lang="ts">
/**
 * AdminDeleteModal
 *
 * Reusable delete confirmation modal.
 *
 * Props:
 *   open    — v-model, controls visibility
 *   title   — modal title
 *
 * Slots:
 *   default — the confirmation message body
 *
 * Emits:
 *   confirm — user clicked the Delete button
 */

const props  = defineProps<{ open: boolean; title: string }>()
const emit   = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <UModal :open="open" :title="title" @update:open="emit('update:open', $event)">
    <template #body>
      <slot />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="emit('update:open', false)">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton color="error" @click="emit('confirm')">
          {{ $t('common.delete') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
