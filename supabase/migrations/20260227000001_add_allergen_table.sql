-- Migration: add_allergen_table
-- Creates the allergen reference table

CREATE TABLE allergen (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        NOT NULL,
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX allergen_name_key ON allergen (lower(name));
