-- Migration: add_ingredient_allergen
-- Junction table: many-to-many between ingredient and allergen

CREATE TABLE ingredient_allergen (
  ingredient_id uuid NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  allergen_id   uuid NOT NULL REFERENCES allergen(id)   ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, allergen_id)
);
