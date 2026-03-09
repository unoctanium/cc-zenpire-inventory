-- Migration: add_client_id_to_business_tables
-- Adds client_id to all business tables, creates a dev client, backfills existing rows,
-- makes the column NOT NULL, and replaces global unique indexes with per-client ones.

-- 1. Add client_id (nullable first so backfill can run)
ALTER TABLE public.app_user   ADD COLUMN client_id uuid REFERENCES public.client(id);
ALTER TABLE public.unit       ADD COLUMN client_id uuid REFERENCES public.client(id) ON DELETE CASCADE;
ALTER TABLE public.allergen   ADD COLUMN client_id uuid REFERENCES public.client(id) ON DELETE CASCADE;
ALTER TABLE public.ingredient ADD COLUMN client_id uuid REFERENCES public.client(id) ON DELETE CASCADE;
ALTER TABLE public.recipe     ADD COLUMN client_id uuid REFERENCES public.client(id) ON DELETE CASCADE;

-- 2. Insert the dev client and dev store
INSERT INTO public.client (id, name)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Dev Client');

INSERT INTO public.store (id, client_id, name)
VALUES ('00000000-0000-0000-0000-000000000002'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        'Dev Store');

-- 3. Backfill all existing rows to the dev client
UPDATE public.app_user   SET client_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.unit       SET client_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.allergen   SET client_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.ingredient SET client_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.recipe     SET client_id = '00000000-0000-0000-0000-000000000001';

-- 4. Make NOT NULL
ALTER TABLE public.app_user   ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.unit       ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.allergen   ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.ingredient ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.recipe     ALTER COLUMN client_id SET NOT NULL;

-- 5. Replace global unique indexes with per-client composite ones

-- unit.code: was unique globally, now unique per client
ALTER TABLE public.unit DROP CONSTRAINT IF EXISTS unit_code_key;
DROP INDEX IF EXISTS public.unit_code_key;
CREATE UNIQUE INDEX unit_code_client_key ON public.unit(client_id, code);

-- ingredient.name: was unique globally, now unique per client
ALTER TABLE public.ingredient DROP CONSTRAINT IF EXISTS ingredient_name_key;
DROP INDEX IF EXISTS public.ingredient_name_key;
CREATE UNIQUE INDEX ingredient_name_client_key ON public.ingredient(client_id, name);

-- allergen.name: was unique globally (lower), now unique per client
DROP INDEX IF EXISTS public.allergen_name_key;
CREATE UNIQUE INDEX allergen_name_client_key ON public.allergen(client_id, lower(name));

-- 6. Index client_id columns for query performance
CREATE INDEX ix_unit_client       ON public.unit(client_id);
CREATE INDEX ix_allergen_client   ON public.allergen(client_id);
CREATE INDEX ix_ingredient_client ON public.ingredient(client_id);
CREATE INDEX ix_recipe_client     ON public.recipe(client_id);
CREATE INDEX ix_app_user_client   ON public.app_user(client_id);
