-- Create recipe_i18n table for translated recipe content
CREATE TABLE public.recipe_i18n (
  recipe_id         uuid        NOT NULL REFERENCES public.recipe(id) ON DELETE CASCADE,
  locale            varchar(5)  NOT NULL,
  name              text,
  description       text,
  production_notes  text,
  is_machine        boolean     NOT NULL DEFAULT true,
  is_stale          boolean     NOT NULL DEFAULT false,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipe_id, locale)
);

CREATE INDEX recipe_i18n_recipe_id_idx ON public.recipe_i18n (recipe_id);
