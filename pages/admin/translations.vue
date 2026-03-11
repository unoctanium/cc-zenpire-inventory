<script setup lang="ts">
const { t, locale } = useI18n()
const toast = useToast()

// ── App locale label map ──────────────────────────────────────────────────
const LOCALE_LABELS: Record<string, string> = { de: 'Deutsch', en: 'English', ja: '日本語' }

// ── Client settings ───────────────────────────────────────────────────────
const contentLocale  = ref<string>('de')
const savingLocale   = ref(false)

async function loadSettings() {
  const data = await $fetch('/api/admin/client-settings', { credentials: 'include' })
  contentLocale.value = (data as any).content_locale ?? 'de'
}

async function saveContentLocale() {
  savingLocale.value = true
  try {
    await $fetch('/api/admin/client-settings', {
      method: 'PUT', credentials: 'include',
      body: { content_locale: contentLocale.value },
    })
    toast.add({ title: t('adminTranslations.localeSaved') })
    await loadCoverage()
  } catch (e: any) {
    toast.add({ title: t('common.saveFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'error' })
  } finally {
    savingLocale.value = false
  }
}

// ── Coverage stats ────────────────────────────────────────────────────────
type LocaleCoverage = {
  locale: string
  ingredients: { total: number; translated: number; stale: number }
  recipes:     { total: number; translated: number; stale: number }
  allergens:   { total: number; translated: number; stale: number }
}

const sourceLang = ref<string>('de')
const locales    = ref<LocaleCoverage[]>([])
const loadingCoverage = ref(false)

async function loadCoverage() {
  loadingCoverage.value = true
  try {
    const data = await $fetch('/api/admin/translations/coverage', { credentials: 'include' })
    const d = data as any
    sourceLang.value = d.source_locale
    locales.value    = d.locales
  } catch {
    // ignore
  } finally {
    loadingCoverage.value = false
  }
}

// ── Batch translate ───────────────────────────────────────────────────────
const translating = ref<Record<string, boolean>>({})

async function translateAll(locale: string, staleOnly = false) {
  translating.value[locale] = true
  try {
    const res = await $fetch('/api/admin/translations/batch', {
      method: 'POST', credentials: 'include',
      body: { locale, stale_only: staleOnly },
    }) as any
    toast.add({
      title: t('adminTranslations.batchDone'),
      description: `${t('adminTranslations.translated')}: ${res.translated} · ${t('adminTranslations.skipped')}: ${res.skipped} · ${t('adminTranslations.errors')}: ${res.errors}`,
    })
    await loadCoverage()
  } catch (e: any) {
    toast.add({ title: t('adminTranslations.batchFailed'), description: e?.data?.statusMessage ?? e?.message, color: 'error' })
  } finally {
    translating.value[locale] = false
  }
}

// ── Init — client-only (auth cookies not available during SSR) ────────────
if (import.meta.client) {
  await Promise.all([loadSettings(), loadCoverage()])
}
</script>

<template>
  <AppSplitLayout :show-detail-on-mobile="true">
    <template #detail>
      <div class="p-6 space-y-8">

        <!-- ── Source language ────────────────────────────────────────── -->
        <div class="space-y-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ $t('adminTranslations.sourceLocaleHeading') }}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('adminTranslations.sourceLocaleDesc') }}
          </p>
          <div class="flex items-center gap-3">
            <USelect
              v-model="contentLocale"
              :items="[
                { label: 'Deutsch',  value: 'de' },
                { label: 'English',  value: 'en' },
                { label: '日本語',   value: 'ja' },
              ]"
              value-key="value"
              class="w-48"
            />
            <UButton color="neutral" variant="soft" :loading="savingLocale" @click="saveContentLocale">
              {{ $t('common.save') }}
            </UButton>
          </div>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-800" />

        <!-- ── Translation coverage ───────────────────────────────────── -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ $t('adminTranslations.coverageHeading') }}
            </p>
            <UButton
              color="neutral" variant="ghost" size="xs"
              :loading="loadingCoverage"
              icon="i-heroicons-arrow-path"
              @click="loadCoverage"
            />
          </div>

          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('adminTranslations.sourceIs') }}
            <span class="font-medium text-gray-700 dark:text-gray-200">{{ LOCALE_LABELS[sourceLang] ?? sourceLang }}</span>
          </p>

          <div v-if="locales.length" class="space-y-6">
            <div v-for="loc in locales" :key="loc.locale" class="space-y-3">
              <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ LOCALE_LABELS[loc.locale] ?? loc.locale }}
              </p>

              <!-- Coverage rows -->
              <table class="text-sm w-full">
                <tbody>
                  <tr>
                    <td class="w-32 py-1 text-gray-500 dark:text-gray-400">{{ $t('nav.ingredients') }}</td>
                    <td class="py-1">
                      <span class="text-gray-800 dark:text-gray-200">
                        {{ loc.ingredients.translated }} / {{ loc.ingredients.total }}
                      </span>
                      <span v-if="loc.ingredients.stale > 0" class="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                        {{ loc.ingredients.stale }} {{ $t('adminTranslations.stale') }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="w-32 py-1 text-gray-500 dark:text-gray-400">{{ $t('nav.recipes') }}</td>
                    <td class="py-1">
                      <span class="text-gray-800 dark:text-gray-200">
                        {{ loc.recipes.translated }} / {{ loc.recipes.total }}
                      </span>
                      <span v-if="loc.recipes.stale > 0" class="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                        {{ loc.recipes.stale }} {{ $t('adminTranslations.stale') }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="w-32 py-1 text-gray-500 dark:text-gray-400">{{ $t('nav.allergens') }}</td>
                    <td class="py-1">
                      <span class="text-gray-800 dark:text-gray-200">
                        {{ loc.allergens?.translated ?? 0 }} / {{ loc.allergens?.total ?? 0 }}
                      </span>
                      <span v-if="(loc.allergens?.stale ?? 0) > 0" class="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                        {{ loc.allergens.stale }} {{ $t('adminTranslations.stale') }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Action buttons -->
              <div class="flex gap-2 flex-wrap">
                <UButton
                  color="neutral" variant="soft" size="sm"
                  :loading="translating[loc.locale]"
                  @click="translateAll(loc.locale, false)"
                >
                  {{ $t('adminTranslations.translateMissing') }}
                </UButton>
                <UButton
                  v-if="loc.ingredients.stale > 0 || loc.recipes.stale > 0 || (loc.allergens?.stale ?? 0) > 0"
                  color="warning" variant="soft" size="sm"
                  :loading="translating[loc.locale]"
                  @click="translateAll(loc.locale, true)"
                >
                  {{ $t('adminTranslations.retranslateStale') }}
                </UButton>
              </div>
            </div>
          </div>

          <p v-else-if="!loadingCoverage" class="text-sm text-gray-400">
            {{ $t('adminTranslations.noTargetLocales') }}
          </p>
        </div>

      </div>
    </template>
  </AppSplitLayout>
</template>
