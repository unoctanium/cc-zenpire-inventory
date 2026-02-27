-- Migration: add_ingredient_comment
-- Adds an optional comment field to ingredient

ALTER TABLE ingredient ADD COLUMN IF NOT EXISTS comment text;
