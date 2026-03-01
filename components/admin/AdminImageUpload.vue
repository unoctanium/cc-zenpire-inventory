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

const fileInputRef  = ref<HTMLInputElement | null>(null)
const lightboxOpen  = ref(false)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  if (file) {
    emit('upload', file)
    // Reset so the same file can be re-selected after removal
    input.value = ''
  }
}
</script>

<template>
  <div class="flex items-end gap-3">
    <!-- Thumbnail / placeholder -->
    <div
      class="w-20 h-20 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700
             overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center"
      :class="imageUrl ? 'cursor-zoom-in' : ''"
      @click="imageUrl && (lightboxOpen = true)"
    >
      <img v-if="imageUrl" :src="imageUrl" class="w-full h-full object-cover" alt="" />
      <UIcon v-else name="i-heroicons-photo"
        class="w-8 h-8 text-gray-300 dark:text-gray-700" />
    </div>

    <!-- Action buttons (edit mode only) -->
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

  <!-- Lightbox — fixed overlay stays inside the modal's DOM subtree so
       UModal's onClickOutside doesn't fire and close the parent form -->
  <div
    v-if="lightboxOpen && imageUrl"
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
    @click.self="lightboxOpen = false"
  >
    <!-- X button -->
    <button
      class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
      aria-label="Close"
      @click.stop="lightboxOpen = false"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none"
           viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Large image -->
    <img
      :src="imageUrl"
      class="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
      alt=""
      @click.stop
    />
  </div>
</template>
