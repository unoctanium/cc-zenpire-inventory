<script setup lang="ts">
type UnitRow = {
  id: string
  code: string
  name: string
  unit_type: string
}

const toast = useToast()

// RBAC check
const { data: me } = await useFetch('/api/me', { retry: false })
const canManage = computed(() => ((me.value as any)?.permissions ?? []).includes('unit.manage'))

// Fetch units
const { data: res, pending, error, refresh } =
  await useFetch<{ ok: boolean; units: UnitRow[] }>('/api/admin/units', {
    retry: false,
    server: false,
  })

const units = computed(() => res.value?.units ?? [])

// Modals
const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const isDeleteOpen = ref(false)

const editing = ref<UnitRow | null>(null)
const deleting = ref<UnitRow | null>(null)

const form = reactive({
  code: '',
  name: '',
  unit_type: 'mass',
})

const unitTypeOptions = [
  { label: 'mass', value: 'mass' },
  { label: 'volume', value: 'volume' },
  { label: 'count', value: 'count' },
]

// TanStack ColumnDef style (Nuxt UI v3 UTable)
const columns = [
  { id: 'code', accessorKey: 'code', header: 'Code' },
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'unit_type', accessorKey: 'unit_type', header: 'Type' },
  { id: 'actions', header: '' },
]

function openCreate() {
  form.code = ''
  form.name = ''
  form.unit_type = 'mass'
  isCreateOpen.value = true
}

function openEdit(u: UnitRow) {
  editing.value = u
  form.code = u.code
  form.name = u.name
  form.unit_type = u.unit_type
  isEditOpen.value = true
}

function openDelete(u: UnitRow) {
  deleting.value = u
  isDeleteOpen.value = true
}

async function createUnit() {
  try {
    await $fetch('/api/admin/units', { method: 'POST', body: { ...form } })
    toast.add({ title: 'Unit created' })
    isCreateOpen.value = false
    await refresh()
  } catch (e: any) {
    toast.add({
      title: 'Create failed',
      description: e?.data?.message ?? e?.message ?? String(e),
      color: 'red',
    })
  }
}

async function updateUnit() {
  if (!editing.value) return
  try {
    await $fetch(`/api/admin/units/${editing.value.id}`, { method: 'PUT', body: { ...form } })
    toast.add({ title: 'Unit updated' })
    isEditOpen.value = false
    editing.value = null
    await refresh()
  } catch (e: any) {
    toast.add({
      title: 'Update failed',
      description: e?.data?.message ?? e?.message ?? String(e),
      color: 'red',
    })
  }
}

async function deleteUnit() {
  if (!deleting.value) return
  try {
    await $fetch(`/api/admin/units/${deleting.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Unit deleted' })
    isDeleteOpen.value = false
    deleting.value = null
    await refresh()
  } catch (e: any) {
    toast.add({
      title: 'Delete failed',
      description: e?.data?.message ?? e?.message ?? String(e),
      color: 'red',
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Units</h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400">
          View for logged-in users. Edit requires <code>unit.manage</code>. Delete is DEV_MODE-only (server enforced).
        </p>
      </div>

      <div class="flex gap-2">
        <UButton size="sm" variant="soft" @click="refresh">Refresh</UButton>
        <UButton v-if="canManage" size="sm" icon="i-heroicons-plus" @click="openCreate">New unit</UButton>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="red"
      variant="soft"
      title="Units API error"
      :description="String(error)"
    />

    <UCard>
      <!-- ✅ Nuxt UI (TanStack) uses :data, not :rows -->
      <UTable :columns="columns" :data="units" :loading="pending">
        <template #actions-data="{ row }">
          <div class="flex justify-end gap-2">
            <UButton v-if="canManage" size="xs" variant="soft" @click="openEdit(row)">Edit</UButton>
            <UButton v-if="canManage" size="xs" color="red" variant="soft" @click="openDelete(row)">Delete</UButton>
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Create Modal -->
    <UModal v-model="isCreateOpen">
      <UCard>
        <template #header>Create unit</template>

        <div class="space-y-3">
          <UFormGroup label="Code">
            <UInput v-model="form.code" placeholder="e.g. g" />
          </UFormGroup>

          <UFormGroup label="Name">
            <UInput v-model="form.name" placeholder="e.g. Gram" />
          </UFormGroup>

          <UFormGroup label="Type">
            <USelect v-model="form.unit_type" :options="unitTypeOptions" />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="soft" @click="isCreateOpen = false">Cancel</UButton>
            <UButton @click="createUnit">Create</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Edit Modal -->
    <UModal v-model="isEditOpen">
      <UCard>
        <template #header>Edit unit</template>

        <div class="space-y-3">
          <UFormGroup label="Code">
            <UInput v-model="form.code" />
          </UFormGroup>

          <UFormGroup label="Name">
            <UInput v-model="form.name" />
          </UFormGroup>

          <UFormGroup label="Type">
            <USelect v-model="form.unit_type" :options="unitTypeOptions" />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="soft" @click="isEditOpen = false">Cancel</UButton>
            <UButton @click="updateUnit">Save</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Delete Modal -->
    <UModal v-model="isDeleteOpen">
      <UCard>
        <template #header>Delete unit</template>

        <p>Delete <strong>{{ deleting?.code }}</strong> ({{ deleting?.name }})?</p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="soft" @click="isDeleteOpen = false">Cancel</UButton>
            <UButton color="red" @click="deleteUnit">Delete</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>