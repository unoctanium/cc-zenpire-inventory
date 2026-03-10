-- Add content_locale to client table
-- Defines the source language in which this client's content is authored
ALTER TABLE public.client
  ADD COLUMN content_locale varchar(5) NOT NULL DEFAULT 'de';
