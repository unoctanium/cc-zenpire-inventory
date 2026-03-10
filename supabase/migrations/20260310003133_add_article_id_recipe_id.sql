-- article_id: unique human-readable identifier for ingredients (per client)
-- recipe_id:  unique human-readable identifier for recipes (per client)

ALTER TABLE public.ingredient
  ADD COLUMN IF NOT EXISTS article_id text;

ALTER TABLE public.recipe
  ADD COLUMN IF NOT EXISTS recipe_id text;

CREATE UNIQUE INDEX IF NOT EXISTS ingredient_article_id_client_key
  ON public.ingredient (client_id, article_id)
  WHERE article_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS recipe_recipe_id_client_key
  ON public.recipe (client_id, recipe_id)
  WHERE recipe_id IS NOT NULL;
