type AppLink     = { labelKey: string; to: string }
type AppMenuLink = { labelKey: string; to: string; icon: string }

const MAX_BAR_ICONS = 4

// inTopBar: true  → can appear as icon in bar/tabbar (first 4) or in More popup (5th+)
// inTopBar: false → never in bar/tabbar/More — only accessible via avatar drawer
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
  {
    id: 'test1',
    labelKey: 'nav.apps.test1',
    icon: 'i-heroicons-beaker',
    to: '/test1',
    inTopBar: true,
    links:     [] as AppLink[],
    menuLinks: [] as AppMenuLink[],
  },
  {
    id: 'test2',
    labelKey: 'nav.apps.test2',
    icon: 'i-heroicons-puzzle-piece',
    to: '/test2',
    inTopBar: true,
    links:     [] as AppLink[],
    menuLinks: [] as AppMenuLink[],
  },
  // ── Drawer-only apps (never shown in bar, tabbar, or More popup) ──────────
  {
    id: 'admin',
    labelKey: 'nav.apps.admin',
    icon: 'i-heroicons-cog-6-tooth',
    to: '/admin/db',
    inTopBar: false,
    links: [
      { labelKey: 'nav.adminDb',     to: '/admin/db'     },
      { labelKey: 'nav.adminStores', to: '/admin/stores' },
    ] as AppLink[],
    menuLinks: [] as AppMenuLink[],
  },
]

const ROUTE_MAP: Record<string, string> = {
  '/admin':              'admin',
  '/superadmin':         'admin',
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

  // Only inTopBar apps go into bar/tabbar/More
  const inBarApps    = ALL_APPS.filter(a => a.inTopBar)
  const barApps      = inBarApps.slice(0, MAX_BAR_ICONS)
  const overflowApps = inBarApps.slice(MAX_BAR_ICONS)

  const activeApp = computed(
    () => ALL_APPS.find(a => a.id === activeAppId.value)
  )

  watch(
    () => route.path,
    (path) => {
      for (const [prefix, appId] of Object.entries(ROUTE_MAP)) {
        if (prefix === '/') continue
        if (path === prefix || path.startsWith(prefix + '/')) {
          activeAppId.value = appId
          return
        }
      }
      if (path === '/') { activeAppId.value = 'dashboard'; return }
      activeAppId.value = ''
    },
    { immediate: true }
  )

  function setApp(app: (typeof ALL_APPS)[number]) {
    activeAppId.value = app.id
    navigateTo(app.to)
  }

  return { barApps, overflowApps, activeApp, activeAppId, sidebarOpen, setApp }
}
