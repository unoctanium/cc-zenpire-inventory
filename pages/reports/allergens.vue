<template>
  <div class="sm:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <button class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" @click="navigateTo('/reports')">
      <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
      {{ $t('nav.apps.reports') }}
    </button>
  </div>
  <ReportsAllergensTable />
</template>
