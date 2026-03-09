-- Migration: add_client_and_store_tables
-- Creates the client (tenant) and store tables.

CREATE TABLE public.client (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client ADD CONSTRAINT client_pkey PRIMARY KEY (id);
ALTER TABLE public.client ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client TO anon, authenticated, service_role;

CREATE TABLE public.store (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  client_id  uuid        NOT NULL REFERENCES public.client(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  address    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store ADD CONSTRAINT store_pkey PRIMARY KEY (id);
CREATE INDEX ix_store_client ON public.store USING btree (client_id);
ALTER TABLE public.store ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store TO anon, authenticated, service_role;
