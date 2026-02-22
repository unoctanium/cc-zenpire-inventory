<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <div class="space-y-3">
    <UCard>
      <template #header>{{ $t('auth.logout') }}</template>
      <p class="text-gray-600">{{ $t('auth.logoutPrompt') }}</p>
      <form method="post" action="/api/auth/logout" class="mt-4">
        <UButton type="submit" color="gray" variant="soft">{{ $t('auth.logout') }}</UButton>
      </form>
    </UCard>
  </div>
</template>
