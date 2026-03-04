<script setup lang="ts">
import { useTablePermissions } from '~/composables/useTablePermissions'

const { t }  = useI18n()
const toast  = useToast()

// ─── types ────────────────────────────────────────────────────────────────────

type AllergenRow = { id: string; name: string; comment: string | null; created_at: string; updated_at: string }

// ─── permissions ──────────────────────────────────────────────────────────────

const { canRead, canManage } = useTablePermissions('recipe')

// ─── data fetch ───────────────────────────────────────────────────────────────

const { data, refresh } = await useFetch<{ ok: boolean; allergens: AllergenRow[] }>('/api/allergens', { credentials: 'include' })

const allergens = computed(() => data.value?.allergens ?? [])

// ─── list + search ────────────────────────────────────────────────────────────

const search = ref('')

const filteredAllergens = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = [...allergens.value].sort((a, b) => a.name.localeCompare(b.name))
  if (!q) return list
  return list.filter(a => a.name.toLowerCase().includes(q))
})

// ─── selection + form state ───────────────────────────────────────────────────

const selectedId       = ref<string | null>(null)
const isCreating       = ref(false)
const editMode         = ref(false)
const confirmingDelete = ref(false)

const selectedAllergen = computed(() => allergens.value.find(a => a.id === selectedId.value) ?? null)

const draft = reactive({ name: '', comment: '' })

function selectAllergen(a: AllergenRow) {
  selectedId.value       = a.id
  isCreating.value       = false
  editMode.value         = false
  confirmingDelete.value = false
  draft.name    = a.name
  draft.comment = a.comment ?? ''
}

function startCreate() {
  if (!canManage.value) return
  if (window.innerWidth < 640) { navigateTo('/allergens/new'); return }
  selectedId.value       = null
  isCreating.value       = true
  editMode.value         = true
  confirmingDelete.value = false
  draft.name    = ''
  draft.comment = ''
}

function cancelEdit() {
  if (isCreating.value) { isCreating.value = false; editMode.value = false; return }
  const a = selectedAllergen.value
  if (a) { draft.name = a.name; draft.comment = a.comment ?? '' }
  editMode.value = false
}

function showError(e: any) {
  toast.add({ title: t('common.saveFailed'), description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
}

const saving = ref(false)

async function save() {
  if (!draft.name.trim()) {
    toast.add({ title: t('common.missingFields'), description: t('allergens.nameRequired'), color: 'red' })
    return
  }
  saving.value = true
  try {
    const body = { name: draft.name.trim(), comment: draft.comment.trim() || null }
    if (isCreating.value) {
      const res = await $fetch<{ ok: boolean; allergen: { id: string } }>('/api/allergens', { method: 'POST', credentials: 'include', body })
      toast.add({ title: t('allergens.created') })
      isCreating.value = false
      await refresh()
      selectedId.value = res.allergen?.id ?? null
      editMode.value   = false
    } else if (selectedId.value) {
      await $fetch(`/api/allergens/${selectedId.value}`, { method: 'PUT', credentials: 'include', body })
      toast.add({ title: t('allergens.updated') })
      editMode.value = false
      await refresh()
    }
  } catch (e: any) { showError(e) } finally { saving.value = false }
}

async function doDelete() {
  if (!selectedId.value) return
  try {
    await $fetch(`/api/allergens/${selectedId.value}`, { method: 'DELETE', credentials: 'include' })
    toast.add({ title: t('allergens.deleted') })
    selectedId.value       = null
    isCreating.value       = false
    confirmingDelete.value = false
    editMode.value         = false
    await refresh()
  } catch (e: any) {
    toast.add({ title: t('common.deleteFailed'), description: e?.data?.message ?? e?.data?.statusMessage ?? e?.message ?? String(e), color: 'red' })
  }
}

function handleMobileTap(id: string) {
  navigateTo(`/allergens/${id}`)
}
</script>

<template>
  <div v-if="!canRead" class="p-6 text-red-600">403 – {{ $t('allergens.noPermission') }}</div>

  <AppSplitLayout v-else>

    <!-- ─── List panel ─────────────────────────────────────────────────────── -->
    <template #list>
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="relative flex-1">
          <UIcon name="i-heroicons-magnifying-glass"
            class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            v-model="search" type="text"
            class="w-full rounded border border-gray-300 bg-white pl-7 pr-7 py-1.5 text-sm text-gray-900
                   focus:outline-none focus:ring-1 focus:ring-gray-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            :placeholder="$t('common.search') + '…'" />
          <button v-if="search" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" @click="search = ''">
            <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        <div v-if="filteredAllergens.length === 0" class="px-3 py-3 text-sm text-gray-400 dark:text-gray-600">{{ $t('common.noData') }}</div>

        <!-- TABLET -->
        <button
          v-for="a in filteredAllergens" :key="a.id"
          class="hidden sm:flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          :class="selectedId === a.id && !isCreating
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-white dark:bg-gray-900'"
          @click="selectAllergen(a)"
        >
          <span class="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ a.name }}</span>
          <span v-if="a.comment" class="text-xs text-gray-400 truncate max-w-[80px]">{{ a.comment }}</span>
        </button>

        <!-- MOBILE -->
        <button
          v-for="a in filteredAllergens" :key="a.id + '-m'"
          class="sm:hidden flex w-full items-center gap-2 px-4 py-3 text-left bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="handleMobileTap(a.id)"
        >
          <span class="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ a.name }}</span>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400 flex-none" />
        </button>
      </div>
    </template>

    <!-- ─── Detail panel ───────────────────────────────────────────────────── -->
    <template #detail>

      <div
        v-if="!selectedId && !isCreating"
        class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-20"
      >
        <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12" />
        <p class="text-sm">{{ $t('allergens.selectPrompt') }}</p>
      </div>

      <div v-else class="p-4 space-y-4 max-w-sm">

        <!-- Header -->
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {{ isCreating ? $t('allergens.add') : (editMode ? $t('common.edit') : selectedAllergen?.name) }}
          </h2>
          <div v-if="!editMode && !isCreating" class="flex gap-1">
            <UButton v-if="canManage" size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" @click="editMode = true">{{ $t('common.edit') }}</UButton>
            <UButton v-if="canManage" size="xs" color="error" variant="ghost" icon="i-heroicons-trash" @click="confirmingDelete = true">{{ $t('common.delete') }}</UButton>
          </div>
        </div>

        <!-- Inline delete confirmation -->
        <div
          v-if="confirmingDelete"
          class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center justify-between gap-3"
        >
          <p class="text-sm text-red-700 dark:text-red-300">
            {{ $t('allergens.deleteConfirmExisting', { name: selectedAllergen?.name ?? '' }) }}
          </p>
          <div class="flex gap-2 flex-none">
            <UButton size="xs" color="neutral" variant="soft" @click="confirmingDelete = false">{{ $t('common.cancel') }}</UButton>
            <UButton size="xs" color="error" @click="doDelete">{{ $t('common.delete') }}</UButton>
          </div>
        </div>

        <!-- View mode -->
        <div v-if="!editMode" class="space-y-3">
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('allergens.name') }}</div>
            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedAllergen?.name }}</div>
          </div>
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">{{ $t('allergens.comment') }}</div>
            <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ selectedAllergen?.comment || '—' }}</div>
          </div>
        </div>

        <!-- Edit / Create mode -->
        <div v-else class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('allergens.name') }} *</label>
            <input v-model="draft.name"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                     focus:outline-none focus:ring-1 focus:ring-gray-400
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              :placeholder="$t('allergens.namePlaceholder')" autocomplete="off" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ $t('allergens.comment') }}</label>
            <textarea v-model="draft.comment" rows="2"
              class="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900
                     focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              :placeholder="$t('allergens.commentPlaceholder')" />
          </div>
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
            <UButton color="neutral" variant="soft" @click="cancelEdit">{{ $t('common.cancel') }}</UButton>
            <UButton :loading="saving" @click="save">{{ $t('common.save') }}</UButton>
          </div>
        </div>

      </div>
    </template>

    <!-- FAB -->
    <template v-if="canManage" #fab>
      <button
        class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white"
        style="background: var(--color-app-bar)"
        @click="startCreate"
      >
        <UIcon name="i-heroicons-pencil-square" class="w-5 h-5" />
      </button>
    </template>

  </AppSplitLayout>
</template>
