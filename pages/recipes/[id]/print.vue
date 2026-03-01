<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const id    = route.params.id as string

type ComponentRow = {
  id: string; name: string; type: 'ingredient' | 'sub_recipe'
  quantity: number; unit_code: string
  std_cost: number | null; base_unit_factor: number | null; component_unit_factor: number | null
}
type StepRow = { step_no: number; instruction_text: string }

const { data, error } = await useFetch<{
  ok: boolean; recipe: any; components: ComponentRow[]; steps: StepRow[]
}>(`/api/recipes/${id}`, { credentials: 'include' })

const recipe     = computed(() => data.value?.recipe)
const components = computed(() => data.value?.components ?? [])
const steps      = computed(() => data.value?.steps ?? [])
const imageUrl   = computed(() => recipe.value?.has_image ? `/api/recipes/${id}/image` : null)

function componentCost(c: ComponentRow): number | null {
  if (c.std_cost == null || c.base_unit_factor == null || c.component_unit_factor == null) return null
  if (c.base_unit_factor === 0) return null
  return c.quantity * (c.component_unit_factor / c.base_unit_factor) * c.std_cost
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `€ ${n.toFixed(4)}`
}

const totalCost = computed(() => {
  const costs = components.value.map(componentCost).filter((c): c is number => c !== null)
  return costs.length ? costs.reduce((a, b) => a + b, 0) : null
})
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900 font-sans">

    <!-- Toolbar — hidden when printing -->
    <div class="print:hidden flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
      <button
        class="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 text-white text-sm font-medium px-4 py-1.5 hover:bg-gray-700 transition-colors"
        @click="$window?.print()"
        onclick="window.print()"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.75 19.5m10.56-5.671L17.25 19.5m0 0a2.25 2.25 0 01-4.5 0m4.5 0a2.25 2.25 0 01-4.5 0m-8.25-6.75h15m-15 0a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 016 4.5h12A2.25 2.25 0 0120.25 6.75v4.5A2.25 2.25 0 0118 13.5H6z" />
        </svg>
        Print / Save as PDF
      </button>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-1.5 hover:bg-gray-100 transition-colors"
        onclick="window.close()"
      >
        Close
      </button>
      <span class="text-xs text-gray-400 ml-2">Tip: in the print dialog choose "Save as PDF" to get a PDF file.</span>
    </div>

    <!-- Error state -->
    <div v-if="error" class="p-8 text-red-600">Failed to load recipe.</div>

    <!-- Print content -->
    <div v-else-if="recipe" class="max-w-3xl mx-auto px-8 py-8">

      <!-- Recipe title -->
      <h1 class="text-3xl font-bold text-gray-900 mb-1">{{ recipe.name }}</h1>
      <p v-if="recipe.description" class="text-gray-600 mt-1 mb-4">{{ recipe.description }}</p>

      <!-- Image + core info row -->
      <div class="flex gap-6 mb-6 mt-4">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          class="w-36 h-36 object-cover rounded-lg border border-gray-200 shrink-0"
          alt=""
        />
        <div class="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 text-sm self-start">
          <div>
            <div class="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">Output</div>
            <div class="font-medium">
              {{ recipe.output_quantity }}
              {{ recipe.output_unit_code }}
            </div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">Std. cost / unit</div>
            <div class="font-medium">
              {{ recipe.standard_unit_cost != null ? `€ ${recipe.standard_unit_cost}` : '—' }}
            </div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">Status</div>
            <div>
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mr-1"
                :class="recipe.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-500'"
              >{{ recipe.is_active ? 'Active' : 'Inactive' }}</span>
              <span v-if="recipe.is_pre_product"
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                Pre-product
              </span>
            </div>
          </div>
          <div v-if="recipe.standard_unit_cost != null && totalCost != null">
            <div class="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">Total comp. cost</div>
            <div class="font-medium">{{ fmt(totalCost) }}</div>
          </div>
        </div>
      </div>

      <!-- Components -->
      <div v-if="components.length > 0" class="mb-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">Components</h2>
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
              <th class="text-left py-1.5 pr-3 font-medium">Name</th>
              <th class="text-left py-1.5 pr-3 font-medium">Type</th>
              <th class="text-right py-1.5 pr-3 font-medium">Qty</th>
              <th class="text-left py-1.5 pr-3 font-medium">Unit</th>
              <th class="text-right py-1.5 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in components" :key="c.id"
                class="border-b border-gray-100 hover:bg-gray-50">
              <td class="py-1.5 pr-3 font-medium text-gray-900">{{ c.name }}</td>
              <td class="py-1.5 pr-3 text-gray-500">
                {{ c.type === 'ingredient' ? 'Ingredient' : 'Sub-recipe' }}
              </td>
              <td class="py-1.5 pr-3 text-right text-gray-700">{{ c.quantity }}</td>
              <td class="py-1.5 pr-3 text-gray-700">{{ c.unit_code }}</td>
              <td class="py-1.5 text-right text-gray-700">{{ fmt(componentCost(c)) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-gray-300">
              <td colspan="4" class="py-1.5 pr-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                Total
              </td>
              <td class="py-1.5 text-right font-semibold text-gray-900">{{ fmt(totalCost) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Steps -->
      <div v-if="steps.length > 0">
        <h2 class="text-lg font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">Steps</h2>
        <ol class="space-y-2">
          <li v-for="s in steps" :key="s.step_no" class="flex gap-3 text-sm">
            <span class="shrink-0 w-6 text-right text-gray-400 font-medium pt-0.5">{{ s.step_no }}.</span>
            <span class="text-gray-800 leading-relaxed">{{ s.instruction_text }}</span>
          </li>
        </ol>
      </div>

      <!-- Footer line -->
      <div class="mt-10 pt-4 border-t border-gray-100 text-xs text-gray-400 print:block">
        Zenpire Inventory — printed {{ new Date().toLocaleString() }}
      </div>

    </div>

  </div>
</template>

<style>
@media print {
  @page { margin: 1.5cm; }
  body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
