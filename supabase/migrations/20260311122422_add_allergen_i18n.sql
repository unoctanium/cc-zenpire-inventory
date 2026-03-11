-- allergen_i18n: stores translated name and comment per allergen per locale
-- Follows the same pattern as ingredient_i18n and recipe_i18n.

CREATE TABLE allergen_i18n (
  allergen_id uuid NOT NULL REFERENCES allergen(id) ON DELETE CASCADE,
  locale      text NOT NULL,
  name        text,
  comment     text,
  is_machine  bool NOT NULL DEFAULT false,
  is_stale    bool NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (allergen_id, locale)
);
