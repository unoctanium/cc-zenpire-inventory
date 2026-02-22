<script setup lang="ts">
const out = ref('')

async function call(path: string) {
  out.value = `Calling ${path}...`
  try {
    const res = await $fetch(path, { method: 'POST' })
    out.value = JSON.stringify(res, null, 2)
  } catch (e: any) {
    out.value = `${e?.statusCode ?? ''} ${e?.statusMessage ?? ''}\n${JSON.stringify(e?.data ?? {}, null, 2)}`
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold">Dev Tools</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">Only available when DEV_MODE=1</p>
    </div>

    <div class="flex flex-wrap gap-3">
      <UButton color="red" variant="soft" @click="call('/api/manage/purge')">
        Purge
      </UButton>

      <UButton color="gray" variant="soft" @click="call('/api/manage/seed_initial')">
        Seed Initial
      </UButton>

      <UButton color="gray" variant="soft" @click="call('/api/manage/seed_example')">
        Seed Example
      </UButton>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400">
      Typical flow: <strong>Purge</strong> → <strong>Seed Initial</strong> → <strong>Seed Example</strong>
    </p>

    <pre
      v-if="out"
      class="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900
             p-4 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
    >{{ out }}</pre>
  </div>
</template>