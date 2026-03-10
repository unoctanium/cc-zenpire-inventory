<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()

// ─── Profile ─────────────────────────────────────────────────────────────────

const { data, refresh } = await useFetch<{
  ok: boolean; email: string; first_name: string; last_name: string
  telephone: string; has_avatar: boolean
}>('/api/auth/profile', { credentials: 'include' })

const form = reactive({
  first_name: data.value?.first_name ?? '',
  last_name:  data.value?.last_name  ?? '',
  telephone:  data.value?.telephone  ?? '',
})
const saving = ref(false)

watch(data, (d) => {
  if (!d) return
  form.first_name = d.first_name
  form.last_name  = d.last_name
  form.telephone  = d.telephone
})

async function saveProfile() {
  saving.value = true
  try {
    await $fetch('/api/auth/profile', { method: 'PUT', credentials: 'include', body: form })
    toast.add({ title: t('settings.saved'), color: 'success' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

const hasAvatar      = ref(data.value?.has_avatar ?? false)
const avatarVersion  = ref(0)
const avatarUploading = ref(false)
const avatarFileInput = ref<HTMLInputElement | null>(null)

watch(data, (d) => { if (d) hasAvatar.value = d.has_avatar })

const avatarUrl = computed(() =>
  hasAvatar.value ? `/api/auth/avatar?v=${avatarVersion.value}` : null
)

const displayName = computed(() => {
  const f = form.first_name.trim()
  const l = form.last_name.trim()
  if (f || l) return [f, l].filter(Boolean).join(' ')
  return data.value?.email ?? ''
})

const avatarInitials = computed(() => {
  const f = form.first_name.trim()
  const l = form.last_name.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f)      return f.slice(0, 2).toUpperCase()
  return (data.value?.email ?? '?')[0].toUpperCase()
})

async function onAvatarFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarUploading.value = true
  try {
    const fd = new FormData()
    fd.append('avatar', file)
    await $fetch('/api/auth/avatar', { method: 'PUT', credentials: 'include', body: fd })
    hasAvatar.value = true
    avatarVersion.value++
    toast.add({ title: t('settings.avatarUploaded'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'error' })
  } finally {
    avatarUploading.value = false
    if (avatarFileInput.value) avatarFileInput.value.value = ''
  }
}

async function removeAvatar() {
  try {
    await $fetch('/api/auth/avatar', { method: 'DELETE', credentials: 'include' })
    hasAvatar.value = false
    toast.add({ title: t('settings.avatarRemoved'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'error' })
  }
}

// ─── Password ────────────────────────────────────────────────────────────────

const pwSheet    = ref(false)
const pwNew      = ref('')
const pwConfirm  = ref('')
const pwError    = ref('')
const pwChanging = ref(false)

function openPwSheet() {
  pwNew.value     = ''
  pwConfirm.value = ''
  pwError.value   = ''
  pwSheet.value   = true
}

async function changePassword() {
  pwError.value = ''
  if (pwNew.value.length < 6)          { pwError.value = t('settings.passwordTooShort'); return }
  if (pwNew.value !== pwConfirm.value) { pwError.value = t('settings.passwordMismatch'); return }

  pwChanging.value = true
  try {
    await $fetch('/api/auth/password', { method: 'PUT', credentials: 'include', body: { password: pwNew.value } })
    toast.add({ title: t('settings.passwordChanged'), color: 'success' })
    pwSheet.value = false
  } catch (e: any) {
    pwError.value = e?.data?.statusMessage ?? t('settings.passwordChangeFailed')
  } finally {
    pwChanging.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg space-y-6">

    <!-- ── Avatar + name hero ────────────────────────────────────────────── -->
    <div class="flex flex-col items-center gap-3 pt-2">

      <!-- Circular avatar -->
      <div class="relative group">
        <div
          class="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold select-none ring-4 ring-white dark:ring-gray-900 shadow-md"
        >
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            class="w-full h-full object-cover"
            alt=""
          />
          <span v-else>{{ avatarInitials }}</span>
        </div>

        <!-- Upload overlay (shown on hover / tap) -->
        <button
          class="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          :class="avatarUploading ? 'opacity-100 cursor-wait' : 'cursor-pointer'"
          @click="!avatarUploading && avatarFileInput?.click()"
        >
          <UIcon
            :name="avatarUploading ? 'i-heroicons-arrow-path' : 'i-heroicons-camera'"
            class="w-6 h-6 text-white"
            :class="avatarUploading ? 'animate-spin' : ''"
          />
        </button>

        <input
          ref="avatarFileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          @change="onAvatarFileChange"
        />
      </div>

      <!-- Name + remove button -->
      <div class="text-center">
        <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ displayName }}</div>
        <div class="text-sm text-gray-500">{{ data?.email ?? '' }}</div>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="text-xs text-[#007AFF] dark:text-blue-400 active:opacity-50"
          @click="avatarFileInput?.click()"
        >
          {{ $t('settings.uploadAvatar') }}
        </button>
        <span v-if="hasAvatar" class="text-gray-300 dark:text-gray-600">·</span>
        <button
          v-if="hasAvatar"
          class="text-xs text-red-500 active:opacity-50"
          @click="removeAvatar"
        >
          {{ $t('settings.removeAvatar') }}
        </button>
      </div>
    </div>

    <!-- ── Profile form ─────────────────────────────────────────────────── -->
    <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 divide-y divide-gray-200 dark:divide-gray-700/60 overflow-hidden">

      <!-- Email (read-only) -->
      <div class="px-4 py-3">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{{ $t('auth.email') }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 select-all">{{ data?.email ?? '—' }}</div>
      </div>

      <!-- First name -->
      <div class="px-4 py-2">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{{ $t('settings.firstName') }}</div>
        <input
          v-model="form.first_name"
          type="text"
          class="w-full bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
          autocomplete="given-name"
        />
      </div>

      <!-- Last name -->
      <div class="px-4 py-2">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{{ $t('settings.lastName') }}</div>
        <input
          v-model="form.last_name"
          type="text"
          class="w-full bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
          autocomplete="family-name"
        />
      </div>

      <!-- Telephone -->
      <div class="px-4 py-2">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{{ $t('settings.telephone') }}</div>
        <input
          v-model="form.telephone"
          type="tel"
          class="w-full bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
          autocomplete="tel"
        />
      </div>

    </div>

    <!-- Save -->
    <UButton block :loading="saving" @click="saveProfile">{{ $t('common.save') }}</UButton>

    <!-- ── Security section ──────────────────────────────────────────────── -->
    <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 overflow-hidden">
      <button
        class="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-100 dark:active:bg-gray-700/60 transition-colors"
        @click="openPwSheet"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-gray-400" />
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.changePassword') }}</span>
        </div>
        <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-300 dark:text-gray-600" />
      </button>
    </div>

  </div>

  <!-- ── iOS-style change password bottom sheet ────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="pwSheet"
        class="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center"
        style="background: rgba(0,0,0,0.4)"
        @click.self="pwSheet = false"
      >
        <Transition
          enter-active-class="transition-transform duration-250 ease-out"
          enter-from-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
          leave-active-class="transition-transform duration-200 ease-in"
          leave-to-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
        >
          <div v-if="pwSheet" class="w-full sm:w-96 mx-auto mb-4 sm:mb-0 px-4 sm:px-0" @click.stop>
            <div class="rounded-2xl overflow-hidden" style="background: rgba(250,250,250,0.97)">
              <div class="px-6 pt-5 pb-4 border-b border-gray-200 text-center">
                <p class="text-base font-semibold text-gray-900">{{ $t('settings.changePassword') }}</p>
              </div>
              <div class="px-6 py-4 space-y-3">
                <div class="space-y-1">
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('settings.newPassword') }}</label>
                  <input
                    v-model="pwNew"
                    type="password"
                    autocomplete="new-password"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('settings.confirmPassword') }}</label>
                  <input
                    v-model="pwConfirm"
                    type="password"
                    autocomplete="new-password"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p v-if="pwError" class="text-xs text-red-500">{{ pwError }}</p>
              </div>
              <button
                class="w-full py-4 text-base font-semibold border-t border-gray-200 transition-colors"
                :class="pwChanging ? 'text-blue-300' : 'text-blue-500 active:bg-gray-100'"
                :disabled="pwChanging"
                @click="changePassword"
              >
                {{ pwChanging ? '…' : $t('settings.changePassword') }}
              </button>
            </div>
            <div class="rounded-2xl overflow-hidden mt-2" style="background: rgba(250,250,250,0.97)">
              <button
                class="w-full py-4 text-base font-bold text-gray-900 active:bg-gray-100 transition-colors"
                @click="pwSheet = false"
              >
                {{ $t('common.cancel') }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
