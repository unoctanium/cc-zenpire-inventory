<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()

// ─── Profile ─────────────────────────────────────────────────────────────────

const { data, refresh } = await useFetch<{
  ok: boolean; email: string; first_name: string; last_name: string; telephone: string
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
    <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{{ $t('settings.title') }}</h1>

    <!-- ── Profile form ─────────────────────────────────────────────────── -->
    <div class="space-y-4">

      <!-- Email (read-only) -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('auth.email') }}</label>
        <div class="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 select-all">
          {{ data?.email ?? '—' }}
        </div>
      </div>

      <!-- First name -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('settings.firstName') }}</label>
        <input
          v-model="form.first_name"
          type="text"
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Last name -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('settings.lastName') }}</label>
        <input
          v-model="form.last_name"
          type="text"
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Telephone -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('settings.telephone') }}</label>
        <input
          v-model="form.telephone"
          type="tel"
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Password row -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('auth.password') }}</label>
        <div class="flex items-center gap-3">
          <div class="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-400">
            ••••••••
          </div>
          <UButton variant="soft" color="neutral" @click="openPwSheet">
            {{ $t('settings.changePassword') }}
          </UButton>
        </div>
      </div>

      <!-- Save -->
      <div class="pt-2">
        <UButton :loading="saving" @click="saveProfile">{{ $t('common.save') }}</UButton>
      </div>
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

            <!-- Main card -->
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

            <!-- Separate cancel button (iOS pattern) -->
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
