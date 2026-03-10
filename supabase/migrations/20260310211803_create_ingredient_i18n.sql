-- Create ingredient_i18n table for translated ingredient content
CREATE TABLE public.ingredient_i18n (
  ingredient_id uuid        NOT NULL REFERENCES public.ingredient(id) ON DELETE CASCADE,
  locale        varchar(5)  NOT NULL,
  name          text,
  comment       text,
  is_machine    boolean     NOT NULL DEFAULT true,
  is_stale      boolean     NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ingredient_id, locale)
);

CREATE INDEX ingredient_i18n_ingredient_id_idx ON public.ingredient_i18n (ingredient_id);
