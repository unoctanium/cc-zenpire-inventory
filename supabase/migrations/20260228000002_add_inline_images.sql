-- Drop recipe_media (replaced by inline image column on recipe)
DROP TABLE IF EXISTS recipe_media;

-- TEXT columns: store base64-encoded bytes (avoids PostgREST BYTEA hex-encoding issues)
ALTER TABLE ingredient ADD COLUMN image_data TEXT NULL;
ALTER TABLE ingredient ADD COLUMN image_mime TEXT NULL;
ALTER TABLE recipe     ADD COLUMN image_data TEXT NULL;
ALTER TABLE recipe     ADD COLUMN image_mime TEXT NULL;
