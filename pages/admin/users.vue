<script setup lang="ts">
const { t } = useI18n()
const auth  = useAuth()

const canManage = computed(() => Boolean(auth.value?.permissions?.includes('admin')))

type Role    = { id: string; code: string; name: string }
type UserRow = { id: string; email: string; first_name: string; last_name: string; telephone: string; is_active: boolean; created_at: string; roles: Role[] }

const { data, refresh } = await useFetch<{ ok: boolean; users: UserRow[]; roles: Role[] }>(
  '/api/admin/users', { credentials: 'include' }
)
const users   = computed(() => data.value?.users ?? [])
const allRoles = computed(() => data.value?.roles ?? [])

// ─── selection / form ─────────────────────────────────────────────────────────

const selectedId    = ref<string | null>(null)
const isNew         = ref(false)
const saving        = ref(false)
const deleting      = ref(false)
const confirmDelete = ref(false)
const error         = ref('')

const form = reactive({
  email:      '',
  first_name: '',
  last_name:  '',
  telephone:  '',
  password:   '',
  role_ids:   [] as string[],
})

const selectedUser = computed(() => users.value.find(u => u.id === selectedId.value) ?? null)

function selectUser(user: UserRow) {
  isNew.value         = false
  selectedId.value    = user.id
  form.email          = user.email
  form.first_name     = user.first_name
  form.last_name      = user.last_name
  form.telephone      = user.telephone
  form.password       = ''
  form.role_ids       = user.roles.map(r => r.id)
  error.value         = ''
  confirmDelete.value = false
}

function startNew() {
  isNew.value         = true
  selectedId.value    = null
  form.email          = ''
  form.first_name     = ''
  form.last_name      = ''
  form.telephone      = ''
  form.password       = ''
  form.role_ids       = []
  error.value         = ''
  confirmDelete.value = false
}

async function save() {
  error.value = ''
  if (isNew.value) {
    if (!form.email.trim() || !form.password.trim()) { error.value = t('adminUsers.emailRequired'); return }
    if (form.password.length < 6)                   { error.value = t('adminUsers.passwordTooShort'); return }
  }
  saving.value = true
  const wasNew = isNew.value
  try {
    if (wasNew) {
      const res = await $fetch<{ ok: boolean; user: UserRow }>('/api/admin/users', {
        method: 'POST', credentials: 'include',
        body: {
          email:      form.email.trim(),
          first_name: form.first_name.trim() || null,
          last_name:  form.last_name.trim()  || null,
          telephone:  form.telephone.trim()  || null,
          password:   form.password,
          role_ids:   form.role_ids,
        },
      })
      await refresh()
      isNew.value      = false
      selectedId.value = res.user.id
      selectUser({ ...res.user, roles: allRoles.value.filter(r => form.role_ids.includes(r.id)) })
    } else {
      await $fetch(`/api/admin/users/${selectedId.value}`, {
        method: 'PUT', credentials: 'include',
        body: {
          first_name: form.first_name.trim() || null,
          last_name:  form.last_name.trim()  || null,
          telephone:  form.telephone.trim()  || null,
          password:   form.password.trim()   || null,
          role_ids:   form.role_ids,
        },
      })
      await refresh()
    }
    useToast().add({ title: wasNew ? t('adminUsers.created') : t('adminUsers.updated'), color: 'success' })
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? t('common.saveFailed')
  } finally {
    saving.value = false
  }
}

async function doDelete() {
  if (!selectedId.value) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/users/${selectedId.value}`, { method: 'DELETE', credentials: 'include' })
    await refresh()
    selectedId.value    = null
    isNew.value         = false
    confirmDelete.value = false
    useToast().add({ title: t('adminUsers.deleted'), color: 'success' })
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? t('common.deleteFailed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="!canManage" class="p-6 text-red-600">403 – {{ $t('adminUsers.noPermission') }}</div>

  <AppSplitLayout v-else>

    <!-- ─── List panel ──────────────────────────────────────────────────────── -->
    <template #search>
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">{{ $t('adminUsers.title') }}</span>
        <UButton size="xs" variant="soft" icon="i-heroicons-plus" @click="startNew">{{ $t('adminUsers.add') }}</UButton>
      </div>
    </template>

    <template #list>
      <div class="flex flex-col h-full">
        <div
          v-for="user in users"
          :key="user.id"
          class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer select-none transition-colors"
          :class="selectedId === user.id && !isNew
            ? 'bg-blue-50 dark:bg-blue-950'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
          @click="selectUser(user)"
        >
          <UIcon name="i-heroicons-user-circle" class="w-5 h-5 text-gray-400 flex-none" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ user.email }}</p>
            <p v-if="user.first_name || user.last_name" class="text-xs text-gray-500 truncate">
              {{ [user.first_name, user.last_name].filter(Boolean).join(' ') }}
            </p>
            <div class="flex flex-wrap gap-1 mt-0.5">
              <span
                v-for="role in user.roles" :key="role.id"
                class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              >{{ role.name }}</span>
            </div>
          </div>
        </div>
        <div v-if="users.length === 0" class="px-4 py-6 text-sm text-gray-400 text-center">
          {{ $t('common.noData') }}
        </div>
      </div>
    </template>

    <!-- ─── Detail / form panel ────────────────────────────────────────────── -->
    <template #detail>
      <div v-if="!selectedId && !isNew" class="flex items-center justify-center h-full text-gray-400 text-sm">
        {{ $t('adminUsers.selectPrompt') }}
      </div>

      <div v-else class="p-6 space-y-4 max-w-lg">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ isNew ? $t('adminUsers.add') : selectedUser?.email }}
        </h2>

        <!-- Email (new only) -->
        <div v-if="isNew" class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('adminUsers.email') }}</label>
          <input
            v-model="form.email"
            type="email"
            autocomplete="off"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- First name -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('adminUsers.firstName') }}</label>
          <input
            v-model="form.first_name"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Last name -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('adminUsers.lastName') }}</label>
          <input
            v-model="form.last_name"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Telephone -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('adminUsers.telephone') }}</label>
          <input
            v-model="form.telephone"
            type="tel"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Password -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('adminUsers.password') }}</label>
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="isNew ? '' : $t('adminUsers.passwordHint')"
          />
        </div>

        <!-- Roles -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('adminUsers.roles') }}</label>
          <div class="flex flex-wrap gap-x-4 gap-y-2">
            <label
              v-for="role in allRoles"
              :key="role.id"
              class="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                :value="role.id"
                v-model="form.role_ids"
                class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ role.name }}</span>
            </label>
          </div>
        </div>

        <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2">
          <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
          <UButton
            v-if="!isNew"
            color="error"
            variant="soft"
            @click="confirmDelete = true"
          >
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </div>
    </template>

  </AppSplitLayout>

  <!-- iOS-style delete confirmation -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="confirmDelete"
        class="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center"
        style="background: rgba(0,0,0,0.4)"
        @click.self="confirmDelete = false"
      >
        <Transition
          enter-active-class="transition-transform duration-250 ease-out"
          enter-from-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
          leave-active-class="transition-transform duration-200 ease-in"
          leave-to-class="translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0"
        >
          <div class="w-full sm:w-80 mx-auto mb-4 sm:mb-0 px-4 sm:px-0" @click.stop>
            <div class="rounded-2xl overflow-hidden" style="background: rgba(250,250,250,0.97)">
              <div class="px-4 py-4 text-center border-b border-gray-200">
                <p class="text-xs text-gray-500">{{ $t('adminUsers.deleteTitle') }}</p>
                <p class="text-sm font-semibold text-gray-900 mt-0.5">{{ selectedUser?.email }}</p>
              </div>
              <button
                class="w-full py-4 text-base font-semibold text-red-500 active:bg-gray-100 transition-colors"
                :disabled="deleting"
                @click="doDelete"
              >
                {{ deleting ? '…' : $t('common.delete') }}
              </button>
            </div>
            <div class="rounded-2xl overflow-hidden mt-2" style="background: rgba(250,250,250,0.97)">
              <button
                class="w-full py-4 text-base font-bold text-gray-900 active:bg-gray-100 transition-colors"
                @click="confirmDelete = false"
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
