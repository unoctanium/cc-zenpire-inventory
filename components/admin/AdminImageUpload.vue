<script setup lang="ts">
const props = defineProps<{
  imageUrl:   string | null
  uploading?: boolean
  canManage?: boolean
}>()

const emit = defineEmits<{
  (e: 'upload', file: File): void
  (e: 'remove'): void
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  if (file) {
    emit('upload', file)
    // Reset input so the same file can be re-selected after removal
    input.value = ''
  }
}
</script>

<template>
  <div class="flex items-end gap-3">
    <!-- Thumbnail / placeholder -->
    <div class="w-20 h-20 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700
                overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <img v-if="imageUrl" :src="imageUrl" class="w-full h-full object-cover" alt="" />
      <UIcon v-else name="i-heroicons-photo"
        class="w-8 h-8 text-gray-300 dark:text-gray-700" />
    </div>

    <!-- Buttons (canManage only) -->
    <div v-if="canManage" class="flex flex-col gap-1.5">
      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        icon="i-heroicons-arrow-up-tray"
        :loading="uploading"
        @click="fileInputRef?.click()"
      >
        {{ imageUrl ? $t('common.replaceImage') : $t('common.uploadImage') }}
      </UButton>
      <UButton
        v-if="imageUrl"
        size="sm"
        color="error"
        variant="ghost"
        icon="i-heroicons-trash"
        @click="emit('remove')"
      >
        {{ $t('common.removeImage') }}
      </UButton>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>
