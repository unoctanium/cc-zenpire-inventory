import { requireAdminDev } from '~/server/utils/require-admin-dev'

type U = { id: string; code: string }

export default defineEventHandler(async (event) => {
  const { admin, clientId } = await requireAdminDev(event)

  // -----------------------
  // Units — resolve IDs (seed_initial must have run first)
  // -----------------------
  const { data: units, error: uErr } = await admin
    .from('unit')
    .select('id, code')
    .eq('client_id', clientId)
  if (uErr) throw createError({ statusCode: 500, statusMessage: uErr.message })

  const unitId = new Map<string, string>((units as U[]).map((u) => [u.code, u.id]))
  const g   = unitId.get('g')
  const ml  = unitId.get('ml')
  const pcs = unitId.get('pcs')

  if (!g || !ml || !pcs) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required units g/ml/pcs not found — run Seed Initial first',
    })
  }

  // -----------------------
  // Inline SVG images (base64-encoded, image/svg+xml)
  // Simple food-themed placeholders for seed data
  // -----------------------
  const b64 = (svg: string) => Buffer.from(svg).toString('base64')
  const SVG_MIME = 'image/svg+xml'

  const IMG = {
    // Ingredients
    soySauce:     b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#F5E6C8"/><rect x="46" y="18" width="28" height="6" rx="3" fill="#2C1A0E"/><rect x="40" y="24" width="40" height="72" rx="8" fill="#1A0A00"/><rect x="44" y="30" width="32" height="60" rx="6" fill="#3D1A00"/><rect x="48" y="38" width="24" height="8" rx="2" fill="#F5E6C8" opacity="0.7"/><text x="60" y="82" font-family="sans-serif" font-size="9" text-anchor="middle" fill="#F5E6C8" opacity="0.8">SOY</text></svg>`),
    sesameOil:    b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#FEF3DC"/><rect x="48" y="16" width="24" height="6" rx="3" fill="#8B5E1A"/><rect x="38" y="22" width="44" height="74" rx="10" fill="#C8862A"/><rect x="42" y="28" width="36" height="62" rx="8" fill="#E8A84C"/><ellipse cx="60" cy="59" rx="14" ry="22" fill="#D4883C" opacity="0.5"/><text x="60" y="82" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#5C3A10">SESAME</text></svg>`),
    garlic:       b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#F5F0E8"/><ellipse cx="60" cy="68" rx="32" ry="30" fill="#EDE0C4"/><ellipse cx="60" cy="64" rx="28" ry="26" fill="#F5EDD8"/><path d="M40 62 Q50 40 60 38 Q70 40 80 62" fill="#EDE0C4" stroke="#C8B48A" stroke-width="1.5"/><line x1="60" y1="38" x2="60" y2="22" stroke="#8B7355" stroke-width="2.5"/><line x1="55" y1="26" x2="50" y2="18" stroke="#8B7355" stroke-width="1.5"/><line x1="65" y1="24" x2="70" y2="16" stroke="#8B7355" stroke-width="1.5"/></svg>`),
    chickenThigh: b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#FFF0E8"/><path d="M25 80 Q30 50 55 42 Q75 38 90 55 Q105 72 95 88 Q80 100 55 98 Q30 96 25 80Z" fill="#E8846A"/><path d="M30 78 Q35 54 57 47 Q74 43 86 58 Q98 73 89 86 Q76 96 54 94 Q33 92 30 78Z" fill="#F09070"/><line x1="55" y1="42" x2="52" y2="22" stroke="#D4C4B0" stroke-width="8" stroke-linecap="round"/></svg>`),
    shiromiso:    b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#FEF3DC"/><rect x="20" y="55" width="80" height="50" rx="6" fill="#C8A060"/><rect x="22" y="45" width="76" height="14" rx="4" fill="#A07838"/><rect x="24" y="57" width="72" height="46" rx="5" fill="#D4B070"/><path d="M30 70 Q60 65 90 70 Q90 90 60 95 Q30 90 30 70Z" fill="#E8C888" opacity="0.7"/></svg>`),
    ginger:       b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#F5F0E0"/><path d="M30 75 Q35 55 55 50 Q65 48 70 58 Q75 68 65 78 Q55 88 40 85 Q28 82 30 75Z" fill="#C8A850"/><path d="M65 58 Q80 50 88 58 Q95 66 85 72 Q75 78 68 70 Q62 63 65 58Z" fill="#D4B060"/><path d="M55 50 Q60 35 68 30 Q74 34 72 44 Q70 52 62 52 Q55 52 55 50Z" fill="#C0A048"/></svg>`),
    springOnion:  b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#F0F8E8"/><rect x="54" y="10" width="12" height="60" rx="4" fill="#5A8A2A"/><rect x="42" y="14" width="10" height="50" rx="3" fill="#6A9A34" opacity="0.85"/><rect x="68" y="18" width="10" height="46" rx="3" fill="#6A9A34" opacity="0.85"/><ellipse cx="60" cy="84" rx="22" ry="16" fill="#E8DFC0"/><ellipse cx="60" cy="80" rx="18" ry="12" fill="#F5EDD4"/></svg>`),
    // Recipes
    gyoza:        b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#FEF3DC"/><ellipse cx="60" cy="78" rx="48" ry="22" fill="#C8862A"/><path d="M12 78 Q60 36 108 78" fill="#E8A84C" stroke="#7A5015" stroke-width="2.5"/><path d="M22 64 Q32 52 42 66" fill="none" stroke="#7A5015" stroke-width="2"/><path d="M44 57 Q54 45 64 59" fill="none" stroke="#7A5015" stroke-width="2"/><path d="M68 57 Q78 46 88 60" fill="none" stroke="#7A5015" stroke-width="2"/><ellipse cx="60" cy="78" rx="40" ry="14" fill="#D4883C" opacity="0.4"/></svg>`),
    misoSoup:     b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#FEF3DC"/><path d="M15 52 Q15 102 60 105 Q105 102 105 52 Z" fill="#B5451B"/><ellipse cx="60" cy="52" rx="45" ry="12" fill="#8B2500"/><ellipse cx="60" cy="52" rx="38" ry="9" fill="#C8522A"/><rect x="44" y="64" width="13" height="13" fill="#FFFDE7" rx="2"/><rect x="65" y="73" width="12" height="12" fill="#FFFDE7" rx="2"/><path d="M40 32 Q43 22 40 12" fill="none" stroke="#BBB" stroke-width="2.5" stroke-linecap="round"/><path d="M60 30 Q63 20 60 10" fill="none" stroke="#BBB" stroke-width="2.5" stroke-linecap="round"/><path d="M80 32 Q83 22 80 12" fill="none" stroke="#BBB" stroke-width="2.5" stroke-linecap="round"/></svg>`),
    karaage:      b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#FEF3DC"/><ellipse cx="42" cy="56" rx="27" ry="23" fill="#C8862A"/><ellipse cx="42" cy="54" rx="22" ry="19" fill="#E8A84C"/><ellipse cx="78" cy="68" rx="24" ry="20" fill="#C8862A"/><ellipse cx="78" cy="66" rx="19" ry="16" fill="#E8A84C"/><ellipse cx="63" cy="40" rx="18" ry="15" fill="#C8862A"/><ellipse cx="63" cy="38" rx="14" ry="11" fill="#E8A84C"/><circle cx="38" cy="90" r="7" fill="#F5F5DC" opacity="0.85"/><circle cx="58" cy="96" r="6" fill="#F5F5DC" opacity="0.85"/><circle cx="76" cy="90" r="5" fill="#F5F5DC" opacity="0.7"/></svg>`),
  }

  // -----------------------
  // Ingredients
  // All costs derived from real wholesale prices (Germany 2025/2026).
  // standard_unit_cost = purchase_price / purchase_quantity (in base unit)
  // -----------------------
  const ingredientDefs = [
    // ── Shared ──────────────────────────────────────────────────────────────
    // Kikkoman soy sauce 5 L @ €38.00  →  €0.0076 / ml
    { name: 'Soy Sauce',      article_id: 'ART-001',
      default_unit_id: ml, kind: 'purchased',
      purchase_quantity: 5000, purchase_unit_id: ml, purchase_price: 38.00,
      standard_unit_cost: 38.00 / 5000,
      image_data: IMG.soySauce, image_mime: SVG_MIME },
    // Sesame oil 750 ml @ €8.00  →  €0.01067 / ml
    { name: 'Sesame Oil',     article_id: 'ART-002',
      default_unit_id: ml, kind: 'purchased',
      purchase_quantity: 750, purchase_unit_id: ml, purchase_price: 8.00,
      standard_unit_cost: 8.00 / 750,
      image_data: IMG.sesameOil, image_mime: SVG_MIME },
    // Garlic 1 kg @ €3.50  →  €0.0035 / g
    { name: 'Garlic',         article_id: 'ART-003',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 3.50,
      standard_unit_cost: 3.50 / 1000,
      image_data: IMG.garlic, image_mime: SVG_MIME },
    // Fresh ginger 1 kg @ €4.00  →  €0.004 / g
    { name: 'Fresh Ginger',   article_id: 'ART-004',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 4.00,
      standard_unit_cost: 4.00 / 1000,
      image_data: IMG.ginger, image_mime: SVG_MIME },
    // Spring onion 1 kg @ €2.50  →  €0.0025 / g
    { name: 'Spring Onion',   article_id: 'ART-005',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 2.50,
      standard_unit_cost: 2.50 / 1000,
      image_data: IMG.springOnion, image_mime: SVG_MIME },
    // Frying oil 5 L @ €8.00  →  €0.0016 / ml
    { name: 'Frying Oil',     article_id: 'ART-006',
      default_unit_id: ml, kind: 'purchased',
      purchase_quantity: 5000, purchase_unit_id: ml, purchase_price: 8.00,
      standard_unit_cost: 8.00 / 5000 },

    // ── Gyoza ───────────────────────────────────────────────────────────────
    // Ground pork 1 kg @ €5.50  →  €0.0055 / g
    { name: 'Ground Pork',    article_id: 'ART-007',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 5.50,
      standard_unit_cost: 5.50 / 1000 },
    // Frozen gyoza wrappers 300 g pack / 50 pcs @ €2.50  →  €0.05 / pcs
    { name: 'Gyoza Wrappers', article_id: 'ART-008',
      default_unit_id: pcs, kind: 'purchased',
      purchase_quantity: 50, purchase_unit_id: pcs, purchase_price: 2.50,
      standard_unit_cost: 2.50 / 50 },
    // Napa cabbage 1 kg @ €1.20  →  €0.0012 / g
    { name: 'Napa Cabbage',   article_id: 'ART-009',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 1.20,
      standard_unit_cost: 1.20 / 1000 },
    // White cabbage 1 kg @ €0.80  →  €0.0008 / g
    { name: 'White Cabbage',  article_id: 'ART-010',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 0.80,
      standard_unit_cost: 0.80 / 1000 },
    // Rice vinegar 500 ml @ €3.00  →  €0.006 / ml
    { name: 'Rice Vinegar',   article_id: 'ART-011',
      default_unit_id: ml, kind: 'purchased',
      purchase_quantity: 500, purchase_unit_id: ml, purchase_price: 3.00,
      standard_unit_cost: 3.00 / 500 },
    // Chili oil (Layu) 100 ml @ €4.50  →  €0.045 / ml
    { name: 'Chili Oil',      article_id: 'ART-012',
      default_unit_id: ml, kind: 'purchased',
      purchase_quantity: 100, purchase_unit_id: ml, purchase_price: 4.50,
      standard_unit_cost: 4.50 / 100 },

    // ── Miso Soup ───────────────────────────────────────────────────────────
    // Shiro miso paste 1 kg @ €9.50  →  €0.0095 / g
    { name: 'Shiro Miso Paste', article_id: 'ART-013',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 9.50,
      standard_unit_cost: 9.50 / 1000,
      image_data: IMG.shiromiso, image_mime: SVG_MIME },
    // Dashi granules (Hondashi) 200 g @ €6.50  →  €0.0325 / g
    { name: 'Dashi Granules', article_id: 'ART-014',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 200, purchase_unit_id: g, purchase_price: 6.50,
      standard_unit_cost: 6.50 / 200 },
    // Silken tofu 300 g @ €1.80  →  €0.006 / g
    { name: 'Silken Tofu',    article_id: 'ART-015',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 300, purchase_unit_id: g, purchase_price: 1.80,
      standard_unit_cost: 1.80 / 300 },
    // Dried wakame 100 g @ €4.50  →  €0.045 / g
    { name: 'Dried Wakame',   article_id: 'ART-016',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 100, purchase_unit_id: g, purchase_price: 4.50,
      standard_unit_cost: 4.50 / 100 },

    // ── Karaage ─────────────────────────────────────────────────────────────
    // Chicken thigh boneless 1 kg @ €5.80  →  €0.0058 / g
    { name: 'Chicken Thigh',  article_id: 'ART-017',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 5.80,
      standard_unit_cost: 5.80 / 1000,
      image_data: IMG.chickenThigh, image_mime: SVG_MIME },
    // Cooking sake (Ryorishu) 1 L @ €6.00  →  €0.006 / ml
    { name: 'Sake',           article_id: 'ART-018',
      default_unit_id: ml, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: ml, purchase_price: 6.00,
      standard_unit_cost: 6.00 / 1000 },
    // Mirin 1 L @ €5.50  →  €0.0055 / ml
    { name: 'Mirin',          article_id: 'ART-019',
      default_unit_id: ml, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: ml, purchase_price: 5.50,
      standard_unit_cost: 5.50 / 1000 },
    // Potato starch 1 kg @ €2.50  →  €0.0025 / g
    { name: 'Potato Starch',  article_id: 'ART-020',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 2.50,
      standard_unit_cost: 2.50 / 1000 },
    // Kewpie mayonnaise 1 kg @ €7.50  →  €0.0075 / g
    { name: 'Kewpie Mayonnaise', article_id: 'ART-021',
      default_unit_id: g, kind: 'purchased',
      purchase_quantity: 1000, purchase_unit_id: g, purchase_price: 7.50,
      standard_unit_cost: 7.50 / 1000 },
    // Lemon 5 pcs / kg @ €2.50  →  €0.50 / pcs
    { name: 'Lemon',          article_id: 'ART-022',
      default_unit_id: pcs, kind: 'purchased',
      purchase_quantity: 5, purchase_unit_id: pcs, purchase_price: 2.50,
      standard_unit_cost: 2.50 / 5 },
  ]

  const ingredientIds: Record<string, string> = {}

  for (const i of ingredientDefs) {
    const { data: ex } = await admin
      .from('ingredient')
      .select('id')
      .eq('name', i.name)
      .eq('client_id', clientId)
      .maybeSingle()
    if (ex?.id) {
      ingredientIds[i.name] = ex.id
      await admin.from('ingredient').update(i).eq('id', ex.id)
      continue
    }
    const { data: created } = await admin
      .from('ingredient')
      .insert({ client_id: clientId, ...i })
      .select('id')
      .single()
    ingredientIds[i.name] = created!.id
  }

  // -----------------------
  // Helpers
  // -----------------------

  async function upsertRecipe(fields: Record<string, any>): Promise<string> {
    const { data: ex } = await admin
      .from('recipe').select('id')
      .eq('name', fields.name).eq('client_id', clientId)
      .maybeSingle()
    if (ex?.id) {
      await admin.from('recipe').update(fields).eq('id', ex.id)
      return ex.id
    }
    const { data: created } = await admin
      .from('recipe').insert({ client_id: clientId, ...fields })
      .select('id').single()
    return created!.id
  }

  async function addIngComp(
    recipeId: string, ingredientId: string,
    quantity: number, unitId: string, sortOrder: number,
  ) {
    const { data: ex } = await admin.from('recipe_component')
      .select('id').eq('recipe_id', recipeId).eq('ingredient_id', ingredientId)
      .maybeSingle()
    if (!ex) {
      await admin.from('recipe_component').insert({
        recipe_id: recipeId, ingredient_id: ingredientId,
        quantity, unit_id: unitId, sort_order: sortOrder,
      })
    }
  }

  // -----------------------
  // Gyoza — pan-fried dumplings, 6-piece portion
  // Ingredient cost: €0.96
  // -----------------------
  const gyozaCost =
    45   * (5.50  / 1000) +  // ground pork
    6    * (2.50  / 50)   +  // gyoza wrappers
    15   * (1.20  / 1000) +  // napa cabbage
    30   * (0.80  / 1000) +  // white cabbage
    13   * (38.00 / 5000) +  // soy sauce (filling + dip)
    5    * (8.00  / 750)  +  // sesame oil
    3    * (3.50  / 1000) +  // garlic
    3    * (4.00  / 1000) +  // fresh ginger
    10   * (2.50  / 1000) +  // spring onion
    10   * (3.00  / 500)  +  // rice vinegar
    2    * (4.50  / 100)  +  // chili oil
    10   * (8.00  / 5000)    // frying oil

  const gyozaId = await upsertRecipe({
    name:             'Gyoza',
    recipe_id:        'GYO-001',
    description:      'Pan-fried Japanese dumplings with pork and cabbage filling, served with a soy-vinegar dipping sauce.',
    production_notes: 'Mix pork, napa cabbage, white cabbage, garlic, ginger, spring onion, soy sauce and sesame oil. Place 1 tsp filling in each wrapper. Fold and pleat the edges firmly to seal. Heat oil in pan, place gyoza flat-side down. Fry 2 min until golden. Add 50 ml water, cover immediately, steam 3 min. Remove lid, let water evaporate and bases crisp again. Serve with dipping sauce of soy sauce, rice vinegar and chili oil.',
    output_quantity:  6,
    output_unit_id:   pcs,
    standard_unit_cost: gyozaCost / 6,
    is_active:        true,
    is_pre_product:   false,
    image_data:       IMG.gyoza,
    image_mime:       SVG_MIME,
  })

  let s = 1
  await addIngComp(gyozaId, ingredientIds['Ground Pork'],    45,  g,   s++)
  await addIngComp(gyozaId, ingredientIds['Gyoza Wrappers'], 6,   pcs, s++)
  await addIngComp(gyozaId, ingredientIds['Napa Cabbage'],   15,  g,   s++)
  await addIngComp(gyozaId, ingredientIds['White Cabbage'],  30,  g,   s++)
  await addIngComp(gyozaId, ingredientIds['Soy Sauce'],      13,  ml,  s++)
  await addIngComp(gyozaId, ingredientIds['Sesame Oil'],     5,   ml,  s++)
  await addIngComp(gyozaId, ingredientIds['Garlic'],         3,   g,   s++)
  await addIngComp(gyozaId, ingredientIds['Fresh Ginger'],   3,   g,   s++)
  await addIngComp(gyozaId, ingredientIds['Spring Onion'],   10,  g,   s++)
  await addIngComp(gyozaId, ingredientIds['Rice Vinegar'],   10,  ml,  s++)
  await addIngComp(gyozaId, ingredientIds['Chili Oil'],      2,   ml,  s++)
  await addIngComp(gyozaId, ingredientIds['Frying Oil'],     10,  ml,  s++)

  // -----------------------
  // Miso Soup — 1 bowl (~250 ml)
  // Ingredient cost: €0.61
  // -----------------------
  const misoCost =
    18 * (9.50 / 1000) +  // shiro miso paste
    3  * (6.50 / 200)  +  // dashi granules
    40 * (1.80 / 300)  +  // silken tofu
    2  * (4.50 / 100)  +  // dried wakame
    5  * (2.50 / 1000)    // spring onion

  const misoId = await upsertRecipe({
    name:             'Miso Soup',
    recipe_id:        'MISO-001',
    description:      'Traditional Japanese clear soup with white miso, silken tofu, wakame seaweed and spring onion.',
    production_notes: 'Dissolve dashi granules in 220 ml hot water (90 °C). Rehydrate dried wakame in cold water for 5 min, drain. Dissolve miso paste in a small ladle of warm broth, then stir back into the pot — do not boil after adding miso as it destroys flavour and aroma. Add silken tofu cubes and wakame. Serve immediately in a covered bowl, garnished with sliced spring onion.',
    output_quantity:  1,
    output_unit_id:   pcs,
    standard_unit_cost: misoCost,
    is_active:        true,
    is_pre_product:   false,
    image_data:       IMG.misoSoup,
    image_mime:       SVG_MIME,
  })

  s = 1
  await addIngComp(misoId, ingredientIds['Shiro Miso Paste'], 18, g, s++)
  await addIngComp(misoId, ingredientIds['Dashi Granules'],   3,  g, s++)
  await addIngComp(misoId, ingredientIds['Silken Tofu'],      40, g, s++)
  await addIngComp(misoId, ingredientIds['Dried Wakame'],     2,  g, s++)
  await addIngComp(misoId, ingredientIds['Spring Onion'],     5,  g, s++)

  // -----------------------
  // Karaage — Japanese fried chicken, 150 g portion
  // Ingredient cost: €1.72
  // -----------------------
  const karaageCost =
    170  * (5.80  / 1000) +  // chicken thigh
    25   * (38.00 / 5000) +  // soy sauce
    20   * (6.00  / 1000) +  // sake
    10   * (5.50  / 1000) +  // mirin
    4    * (3.50  / 1000) +  // garlic
    5    * (4.00  / 1000) +  // fresh ginger
    20   * (2.50  / 1000) +  // potato starch
    30   * (8.00  / 5000) +  // frying oil
    15   * (7.50  / 1000) +  // kewpie mayonnaise
    0.25 * (2.50  / 5)       // lemon (¼ wedge)

  const karaageId = await upsertRecipe({
    name:             'Karaage',
    recipe_id:        'KAR-001',
    description:      'Crispy Japanese fried chicken marinated in soy sauce, sake and mirin, double-fried for maximum crunch.',
    production_notes: 'Cut chicken thigh into 4–5 cm pieces. Marinate in soy sauce, sake, mirin, grated garlic and grated ginger for 30 min. Coat pieces thoroughly in potato starch. First fry: 170 °C for 5 min. Rest on rack for 2 min — this allows residual heat to finish cooking. Second fry: 190 °C for 1 min until deep golden and very crispy. Drain on paper towel. Serve with kewpie mayonnaise and a lemon wedge.',
    output_quantity:  1,
    output_unit_id:   pcs,
    standard_unit_cost: karaageCost,
    is_active:        true,
    is_pre_product:   false,
    image_data:       IMG.karaage,
    image_mime:       SVG_MIME,
  })

  s = 1
  await addIngComp(karaageId, ingredientIds['Chicken Thigh'],     170,  g,   s++)
  await addIngComp(karaageId, ingredientIds['Soy Sauce'],         25,   ml,  s++)
  await addIngComp(karaageId, ingredientIds['Sake'],              20,   ml,  s++)
  await addIngComp(karaageId, ingredientIds['Mirin'],             10,   ml,  s++)
  await addIngComp(karaageId, ingredientIds['Garlic'],            4,    g,   s++)
  await addIngComp(karaageId, ingredientIds['Fresh Ginger'],      5,    g,   s++)
  await addIngComp(karaageId, ingredientIds['Potato Starch'],     20,   g,   s++)
  await addIngComp(karaageId, ingredientIds['Frying Oil'],        30,   ml,  s++)
  await addIngComp(karaageId, ingredientIds['Kewpie Mayonnaise'], 15,   g,   s++)
  await addIngComp(karaageId, ingredientIds['Lemon'],             0.25, pcs, s++)

  // -----------------------
  // Allergen assignments
  // EU Regulation 1169/2011 Annex II — GS1 AllergenTypeCode (T4078)
  // -----------------------
  const { data: allergenRows } = await admin
    .from('allergen').select('id, code').eq('client_id', clientId)
  const allergenByCode = new Map<string, string>(
    (allergenRows ?? []).map((a: any) => [a.code, a.id]),
  )

  async function assignAllergen(ingredientName: string, allergenCode: string) {
    const ingredientId = ingredientIds[ingredientName]
    const allergenId   = allergenByCode.get(allergenCode)
    if (!ingredientId || !allergenId) return
    const { data: ex } = await admin.from('ingredient_allergen')
      .select('ingredient_id')
      .eq('ingredient_id', ingredientId).eq('allergen_id', allergenId)
      .maybeSingle()
    if (!ex) {
      await admin.from('ingredient_allergen').insert({ ingredient_id: ingredientId, allergen_id: allergenId })
    }
  }

  // Gyoza Wrappers: wheat flour → Gluten
  await assignAllergen('Gyoza Wrappers', 'AW')
  // Soy Sauce: wheat + soy → Gluten + Soybeans
  await assignAllergen('Soy Sauce', 'AW')
  await assignAllergen('Soy Sauce', 'AY')
  // Shiro Miso Paste: fermented soy → Soybeans
  await assignAllergen('Shiro Miso Paste', 'AY')
  // Silken Tofu: soy protein → Soybeans
  await assignAllergen('Silken Tofu', 'AY')
  // Sesame Oil → Sesame Seeds
  await assignAllergen('Sesame Oil', 'AS')
  // Kewpie Mayonnaise: egg-based → Eggs
  await assignAllergen('Kewpie Mayonnaise', 'AE')
  // Dashi Granules: dried bonito (fish) → Fish
  await assignAllergen('Dashi Granules', 'AF')

  // Set source language to English — example content is authored in English
  await admin.from('client').update({ content_locale: 'en' }).eq('id', clientId)

  return { ok: true }
})
