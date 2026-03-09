<template>
  <AppSplitLayout>
    <template #list>
      <AdminNavList />
    </template>
    <template #detail>
      <div class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 gap-2 py-20">
        <UIcon name="i-heroicons-cog-6-tooth" class="w-12 h-12" />
        <p class="text-sm">{{ $t('nav.adminSettings') }}</p>
      </div>
    </template>
  </AppSplitLayout>
</template>
