type AppLink     = { labelKey: string; to: string }
type AppMenuLink = { labelKey: string; to: string; icon: string }

const ALL_APPS = [
  {
    id: 'dashboard',
    labelKey: 'nav.apps.dashboard',
    icon: 'i-heroicons-squares-2x2',
    to: '/',
    inTopBar: true,
    links:     [] as AppLink[],
    menuLinks: [] as AppMenuLink[],
  },
  {
    id: 'production',
    labelKey: 'nav.apps.production',
    icon: 'i-heroicons-book-open',
    to: '/production',
    inTopBar: true,
    links: [
      { labelKey: 'nav.recipes',     to: '/production'  },
      { labelKey: 'nav.ingredients', to: '/ingredients' },
      { labelKey: 'nav.allergens',   to: '/allergens'   },
      { labelKey: 'nav.units',       to: '/units'       },
    ] as AppLink[],
    menuLinks: [] as AppMenuLink[],
  },
  {
    id: 'stock',
    labelKey: 'nav.apps.stock',
    icon: 'i-heroicons-cube',
    to: '/stock',
    inTopBar: true,
    links: [
      { labelKey: 'nav.apps.stock', to: '/stock' },
    ] as AppLink[],
    menuLinks: [] as AppMenuLink[],
  },
  {
    id: 'reports',
    labelKey: 'nav.apps.reports',
    icon: 'i-heroicons-chart-bar-square',
    to: '/reports',
    inTopBar: true,
    links:     [] as AppLink[],
    menuLinks: [
      { labelKey: 'nav.recipes',        to: '/reports/recipes',       icon: 'i-heroicons-book-open'            },
      { labelKey: 'nav.ingredients',    to: '/reports/ingredients',   icon: 'i-heroicons-beaker'               },
      { labelKey: 'nav.allergens',      to: '/reports/allergens',     icon: 'i-heroicons-exclamation-triangle' },
      { labelKey: 'nav.allergenMatrix', to: '/reports/allergen-card', icon: 'i-heroicons-table-cells'          },
      { labelKey: 'nav.units',          to: '/reports/units',         icon: 'i-heroicons-scale'                },
    ] as AppMenuLink[],
  },
]

const ROUTE_MAP: Record<string, string> = {
  '/reports':            'reports',
  '/production':         'production',
  '/ingredients':        'production',
  '/allergens':          'production',
  '/allergen-card':      'production',
  '/units':              'production',
  '/stock':              'stock',
  '/':                   'dashboard',
}

export function useAppNav() {
  const route = useRoute()

  const activeAppId = useState<string>('activeAppId', () => 'dashboard')
  const sidebarOpen = useState<boolean>('sidebarOpen', () => true)

  const barApps = ALL_APPS.filter(a => a.inTopBar)

  const activeApp = computed(
    () => ALL_APPS.find(a => a.id === activeAppId.value)
  )

  watch(
    () => route.path,
    (path) => {
      for (const [prefix, appId] of Object.entries(ROUTE_MAP)) {
        // Skip the root prefix last — it would match everything via startsWith
        if (prefix === '/') continue
        if (path === prefix || path.startsWith(prefix + '/')) {
          activeAppId.value = appId
          return
        }
      }
      // Root only matches exactly
      if (path === '/') { activeAppId.value = 'dashboard'; return }
      // No match — deselect all bar apps (e.g. /admin, /settings)
      activeAppId.value = ''
    },
    { immediate: true }
  )

  function setApp(app: (typeof ALL_APPS)[number]) {
    activeAppId.value = app.id
    navigateTo(app.to)
  }

  const overflowApps = ALL_APPS.filter(a => !a.inTopBar)

  return { barApps, overflowApps, activeApp, activeAppId, sidebarOpen, setApp }
}
