


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."fn_dev_purge_all"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  TRUNCATE TABLE
    public.ingredient_allergen,
    public.recipe_component,
    public.recipe,
    public.ingredient,
    public.allergen,
    public.unit
  RESTART IDENTITY;
END;
$$;


ALTER FUNCTION "public"."fn_dev_purge_all"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ensure_ingredient_stock"("p_ingredient_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_unit_id uuid;
begin
  if exists (select 1 from ingredient_stock where ingredient_id = p_ingredient_id) then
    return;
  end if;

  select default_unit_id into v_unit_id from ingredient where id = p_ingredient_id;
  if v_unit_id is null then
    raise exception 'Ingredient % not found', p_ingredient_id;
  end if;

  insert into ingredient_stock(ingredient_id, on_hand_quantity, planned_quantity, unit_id)
  values (p_ingredient_id, 0, 0, v_unit_id);
end;
$$;


ALTER FUNCTION "public"."fn_ensure_ingredient_stock"("p_ingredient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_current_offer_price"("p_offer_id" "uuid", "p_at_date" "date") RETURNS TABLE("currency" "text", "price_per_pack" numeric, "valid_from" "date")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    sop.currency,
    sop.price_per_pack,
    sop.valid_from
  from supplier_offer_price sop
  where sop.supplier_offer_id = p_offer_id
    and sop.valid_from <= p_at_date
    and (sop.valid_to is null or sop.valid_to >= p_at_date)
  order by sop.valid_from desc
  limit 1;
$$;


ALTER FUNCTION "public"."fn_get_current_offer_price"("p_offer_id" "uuid", "p_at_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_post_purchase_receipt"("p_payload" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_receipt_id uuid;
  v_supplier_id uuid;
  v_received_at timestamptz;
  v_invoice_no text;
  v_note text;
  v_created_by uuid;

  v_line jsonb;
  v_ingredient_id uuid;
  v_offer_id uuid;
  v_packs numeric;
  v_price_override numeric;
  v_currency_override text;

  v_pack_qty numeric;
  v_pack_unit uuid;
  v_ing_unit uuid;

  v_price numeric;
  v_currency text;

  v_delta_qty numeric;
  v_unit_cost numeric;

  v_movement_id uuid;
  v_at_date date;
begin
  v_supplier_id := (p_payload->>'supplier_id')::uuid;
  v_received_at := (p_payload->>'received_at')::timestamptz;
  v_invoice_no := p_payload->>'invoice_no';
  v_note := p_payload->>'note';
  v_created_by := (p_payload->>'created_by_user_id')::uuid;

  if v_supplier_id is null or v_created_by is null then
    raise exception 'supplier_id and created_by_user_id required';
  end if;

  if v_received_at is null then
    v_received_at := now();
  end if;

  insert into purchase_receipt(supplier_id, received_at, invoice_no, note, created_by_user_id)
  values (v_supplier_id, v_received_at, v_invoice_no, v_note, v_created_by)
  returning id into v_receipt_id;

  v_at_date := (v_received_at at time zone 'UTC')::date;

  for v_line in select * from jsonb_array_elements(coalesce(p_payload->'lines','[]'::jsonb))
  loop
    v_ingredient_id := (v_line->>'ingredient_id')::uuid;
    v_offer_id := (v_line->>'supplier_offer_id')::uuid;
    v_packs := (v_line->>'packs_received')::numeric;
    v_price_override := nullif(v_line->>'price_per_pack','')::numeric;
    v_currency_override := nullif(v_line->>'currency','');

    if v_ingredient_id is null or v_offer_id is null or v_packs is null or v_packs <= 0 then
      raise exception 'Invalid receipt line: %', v_line;
    end if;

    perform fn_ensure_ingredient_stock(v_ingredient_id);

    -- Offer pack snapshots
    select so.pack_quantity, so.pack_unit_id
      into v_pack_qty, v_pack_unit
    from supplier_offer so
    where so.id = v_offer_id;

    if v_pack_qty is null then
      raise exception 'Supplier offer % not found', v_offer_id;
    end if;

    select unit_id into v_ing_unit from ingredient_stock where ingredient_id = v_ingredient_id;

    -- MVP: require same unit between offer pack_unit and ingredient stock unit
    if v_pack_unit <> v_ing_unit then
      raise exception 'Unit mismatch: offer pack_unit % vs ingredient_stock unit % (MVP requires same unit)',
        v_pack_unit, v_ing_unit;
    end if;

    -- Determine price snapshot
    if v_price_override is not null then
      v_price := v_price_override;
      v_currency := coalesce(v_currency_override,'EUR');
    else
      select p.currency, p.price_per_pack
        into v_currency, v_price
      from fn_get_current_offer_price(v_offer_id, v_at_date) p;

      if v_price is null then
        raise exception 'No valid price for offer % at %', v_offer_id, v_at_date;
      end if;
    end if;

    v_delta_qty := v_packs * v_pack_qty;           -- in ingredient unit
    v_unit_cost := v_price / v_pack_qty;           -- normalized per ingredient unit

    insert into stock_movement(
      ingredient_id, movement_type, quantity, unit_id, occurred_at,
      unit_cost_snapshot, currency, reference_type, reference_id, note, created_by_user_id
    )
    values (
      v_ingredient_id, 'purchase', v_delta_qty, v_ing_unit, v_received_at,
      v_unit_cost, v_currency, 'purchase_receipt', v_receipt_id, v_note, v_created_by
    )
    returning id into v_movement_id;

    insert into purchase_receipt_line(
      purchase_receipt_id, ingredient_id, supplier_offer_id,
      packs_received, pack_quantity_snapshot, pack_unit_snapshot_id,
      price_per_pack_snapshot, currency, stock_movement_id, note
    )
    values (
      v_receipt_id, v_ingredient_id, v_offer_id,
      v_packs, v_pack_qty, v_pack_unit,
      v_price, v_currency, v_movement_id, v_note
    );

    update ingredient_stock
      set on_hand_quantity = on_hand_quantity + v_delta_qty,
          updated_at = now()
    where ingredient_id = v_ingredient_id;
  end loop;

  return v_receipt_id;
end;
$$;


ALTER FUNCTION "public"."fn_post_purchase_receipt"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_post_waste"("p_payload" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_movement_id uuid;
  v_ingredient_id uuid;
  v_qty numeric;
  v_unit_id uuid;
  v_occurred_at timestamptz;
  v_unit_cost numeric;
  v_currency text;
  v_note text;
  v_created_by uuid;
  v_stock_unit uuid;
begin
  v_ingredient_id := (p_payload->>'ingredient_id')::uuid;
  v_qty := (p_payload->>'quantity')::numeric;
  v_unit_id := (p_payload->>'unit_id')::uuid;
  v_occurred_at := (p_payload->>'occurred_at')::timestamptz;
  v_unit_cost := (p_payload->>'unit_cost_snapshot')::numeric;
  v_currency := coalesce(nullif(p_payload->>'currency',''), 'EUR');
  v_note := p_payload->>'note';
  v_created_by := (p_payload->>'created_by_user_id')::uuid;

  if v_ingredient_id is null or v_created_by is null or v_qty is null or v_qty <= 0 then
    raise exception 'ingredient_id, quantity (>0), created_by_user_id required';
  end if;

  if v_unit_cost is null then
    raise exception 'unit_cost_snapshot required for waste';
  end if;

  if v_occurred_at is null then
    v_occurred_at := now();
  end if;

  perform fn_ensure_ingredient_stock(v_ingredient_id);

  select unit_id into v_stock_unit from ingredient_stock where ingredient_id = v_ingredient_id;

  if v_unit_id is null then
    v_unit_id := v_stock_unit;
  end if;

  if v_unit_id <> v_stock_unit then
    raise exception 'Unit mismatch: waste unit % must equal ingredient stock unit % (MVP)', v_unit_id, v_stock_unit;
  end if;

  insert into stock_movement(
    ingredient_id, movement_type, quantity, unit_id, occurred_at,
    unit_cost_snapshot, currency, note, created_by_user_id
  )
  values (
    v_ingredient_id, 'waste', -v_qty, v_unit_id, v_occurred_at,
    v_unit_cost, v_currency, v_note, v_created_by
  )
  returning id into v_movement_id;

  update ingredient_stock
    set on_hand_quantity = on_hand_quantity - v_qty,
        updated_at = now()
  where ingredient_id = v_ingredient_id;

  return v_movement_id;
end;
$$;


ALTER FUNCTION "public"."fn_post_waste"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sync_recipe_cost_to_ingredient"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.ingredient
  SET standard_unit_cost = NEW.standard_unit_cost
  WHERE produced_by_recipe_id = NEW.id
    AND client_id = NEW.client_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_sync_recipe_cost_to_ingredient"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."allergen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "code" character varying(2)
);


ALTER TABLE "public"."allergen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allergen_i18n" (
    "allergen_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "name" "text",
    "comment" "text",
    "is_machine" boolean DEFAULT false NOT NULL,
    "is_stale" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."allergen_i18n" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_user" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "telephone" "text",
    "avatar_data" "text",
    "avatar_mime" "text"
);


ALTER TABLE "public"."app_user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_locale" character varying(5) DEFAULT 'de'::character varying NOT NULL
);


ALTER TABLE "public"."client" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "default_unit_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "produced_by_recipe_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "standard_unit_cost" numeric(18,6),
    "standard_cost_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "standard_cost_updated_at" timestamp with time zone,
    "comment" "text",
    "image_data" "text",
    "image_mime" "text",
    "client_id" "uuid" NOT NULL,
    "article_id" "text",
    "purchase_quantity" numeric(12,4),
    "purchase_unit_id" "uuid",
    "purchase_price" numeric(12,4),
    "purchase_price_currency" character varying(3) DEFAULT 'EUR'::character varying,
    "yield_pct" numeric(6,2) DEFAULT 100.00 NOT NULL,
    "name_translation_locked" boolean DEFAULT false NOT NULL,
    CONSTRAINT "ck_ingredient_kind" CHECK (((("kind" = 'purchased'::"text") AND ("produced_by_recipe_id" IS NULL)) OR (("kind" = 'produced'::"text") AND ("produced_by_recipe_id" IS NOT NULL)))),
    CONSTRAINT "ingredient_kind_check" CHECK (("kind" = ANY (ARRAY['purchased'::"text", 'produced'::"text"]))),
    CONSTRAINT "ingredient_yield_pct_check" CHECK ((("yield_pct" > (0)::numeric) AND ("yield_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."ingredient" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ingredient"."purchase_quantity" IS 'Package quantity in purchase_unit (e.g. 1 for 1 kg)';



COMMENT ON COLUMN "public"."ingredient"."purchase_unit_id" IS 'Unit of the purchase package (e.g. kg)';



COMMENT ON COLUMN "public"."ingredient"."purchase_price" IS 'Price paid for purchase_quantity units (e.g. 0.80 for 1 kg)';



COMMENT ON COLUMN "public"."ingredient"."purchase_price_currency" IS 'ISO 4217 currency code for purchase_price (default EUR)';



COMMENT ON COLUMN "public"."ingredient"."yield_pct" IS 'Usable yield after prep losses, as a percentage (1–100). Default 100 = no loss.';



CREATE TABLE IF NOT EXISTS "public"."ingredient_allergen" (
    "ingredient_id" "uuid" NOT NULL,
    "allergen_id" "uuid" NOT NULL
);


ALTER TABLE "public"."ingredient_allergen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient_i18n" (
    "ingredient_id" "uuid" NOT NULL,
    "locale" character varying(5) NOT NULL,
    "name" "text",
    "comment" "text",
    "is_machine" boolean DEFAULT true NOT NULL,
    "is_stale" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ingredient_i18n" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."permission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "output_quantity" numeric(18,6) DEFAULT 1 NOT NULL,
    "output_unit_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_pre_product" boolean DEFAULT false NOT NULL,
    "standard_unit_cost" numeric(18,6),
    "image_data" "text",
    "image_mime" "text",
    "production_notes" "text",
    "client_id" "uuid" NOT NULL,
    "recipe_id" "text",
    "name_translation_locked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."recipe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_component" (
    "recipe_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "quantity" numeric(18,6) NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sub_recipe_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "recipe_component_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "recipe_component_type_check" CHECK (((("ingredient_id" IS NOT NULL) AND ("sub_recipe_id" IS NULL)) OR (("ingredient_id" IS NULL) AND ("sub_recipe_id" IS NOT NULL))))
);


ALTER TABLE "public"."recipe_component" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_i18n" (
    "recipe_id" "uuid" NOT NULL,
    "locale" character varying(5) NOT NULL,
    "name" "text",
    "description" "text",
    "production_notes" "text",
    "is_machine" boolean DEFAULT true NOT NULL,
    "is_stale" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recipe_i18n" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."role" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permission" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_permission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "unit_type" "text" NOT NULL,
    "factor" numeric(18,6) DEFAULT 1 NOT NULL,
    "client_id" "uuid" NOT NULL,
    CONSTRAINT "unit_unit_type_check" CHECK (("unit_type" = ANY (ARRAY['mass'::"text", 'volume'::"text", 'count'::"text"])))
);


ALTER TABLE "public"."unit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_role" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_recipe_comp_cost" AS
 WITH RECURSIVE "comp_tree"("root_recipe_id", "ingredient_id", "sub_recipe_id", "effective_qty_base", "depth") AS (
         SELECT "rc"."recipe_id" AS "root_recipe_id",
            "rc"."ingredient_id",
            "rc"."sub_recipe_id",
            ("rc"."quantity" * "cu"."factor") AS "effective_qty_base",
            1 AS "depth"
           FROM ("public"."recipe_component" "rc"
             JOIN "public"."unit" "cu" ON (("cu"."id" = "rc"."unit_id")))
        UNION ALL
         SELECT "ct_1"."root_recipe_id",
            "rc"."ingredient_id",
            "rc"."sub_recipe_id",
            ((("ct_1"."effective_qty_base" / NULLIF(("sr"."output_quantity" * "ou"."factor"), (0)::numeric)) * "rc"."quantity") * "cu"."factor") AS "effective_qty_base",
            ("ct_1"."depth" + 1)
           FROM (((("comp_tree" "ct_1"
             JOIN "public"."recipe" "sr" ON (("sr"."id" = "ct_1"."sub_recipe_id")))
             JOIN "public"."unit" "ou" ON (("ou"."id" = "sr"."output_unit_id")))
             JOIN "public"."recipe_component" "rc" ON (("rc"."recipe_id" = "sr"."id")))
             JOIN "public"."unit" "cu" ON (("cu"."id" = "rc"."unit_id")))
          WHERE (("ct_1"."sub_recipe_id" IS NOT NULL) AND ("ct_1"."depth" < 10))
        )
 SELECT "ct"."root_recipe_id" AS "recipe_id",
    "sum"(((("ct"."effective_qty_base" / NULLIF("bu"."factor", (0)::numeric)) * "i"."standard_unit_cost") / NULLIF(("i"."yield_pct" / 100.0), (0)::numeric))) AS "comp_cost"
   FROM (("comp_tree" "ct"
     JOIN "public"."ingredient" "i" ON (("i"."id" = "ct"."ingredient_id")))
     JOIN "public"."unit" "bu" ON (("bu"."id" = "i"."default_unit_id")))
  WHERE (("ct"."ingredient_id" IS NOT NULL) AND ("i"."standard_unit_cost" IS NOT NULL))
  GROUP BY "ct"."root_recipe_id";


ALTER VIEW "public"."v_recipe_comp_cost" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_recipe_effective_allergens" AS
 WITH RECURSIVE "recipe_tree"("root_recipe_id", "ingredient_id", "sub_recipe_id", "depth") AS (
         SELECT "rc"."recipe_id" AS "root_recipe_id",
            "rc"."ingredient_id",
            "rc"."sub_recipe_id",
            1 AS "depth"
           FROM "public"."recipe_component" "rc"
        UNION ALL
         SELECT "ct"."root_recipe_id",
            "rc"."ingredient_id",
            "rc"."sub_recipe_id",
            ("ct"."depth" + 1)
           FROM ("recipe_tree" "ct"
             JOIN "public"."recipe_component" "rc" ON (("rc"."recipe_id" = "ct"."sub_recipe_id")))
          WHERE (("ct"."sub_recipe_id" IS NOT NULL) AND ("ct"."depth" < 10))
        )
 SELECT DISTINCT "rt"."root_recipe_id" AS "recipe_id",
    "ia"."allergen_id"
   FROM ("recipe_tree" "rt"
     JOIN "public"."ingredient_allergen" "ia" ON (("ia"."ingredient_id" = "rt"."ingredient_id")))
  WHERE ("rt"."ingredient_id" IS NOT NULL);


ALTER VIEW "public"."v_recipe_effective_allergens" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_recipe_standard_cost" AS
 SELECT "r"."id" AS "recipe_id",
    "r"."name" AS "recipe_name",
    COALESCE("sum"(("rc"."quantity" * COALESCE("i"."standard_unit_cost", (0)::numeric))), (0)::numeric) AS "standard_cost",
    'EUR'::"text" AS "currency"
   FROM (("public"."recipe" "r"
     LEFT JOIN "public"."recipe_component" "rc" ON (("rc"."recipe_id" = "r"."id")))
     LEFT JOIN "public"."ingredient" "i" ON (("i"."id" = "rc"."ingredient_id")))
  GROUP BY "r"."id", "r"."name";


ALTER VIEW "public"."v_recipe_standard_cost" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_user_permissions" AS
 SELECT DISTINCT "au"."id" AS "app_user_id",
    "au"."auth_user_id",
    "p"."code" AS "permission_code"
   FROM ((("public"."app_user" "au"
     JOIN "public"."user_role" "ur" ON (("ur"."user_id" = "au"."id")))
     JOIN "public"."role_permission" "rp" ON (("rp"."role_id" = "ur"."role_id")))
     JOIN "public"."permission" "p" ON (("p"."id" = "rp"."permission_id")));


ALTER VIEW "public"."v_user_permissions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."allergen_i18n"
    ADD CONSTRAINT "allergen_i18n_pkey" PRIMARY KEY ("allergen_id", "locale");



ALTER TABLE ONLY "public"."allergen"
    ADD CONSTRAINT "allergen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_user"
    ADD CONSTRAINT "app_user_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."app_user"
    ADD CONSTRAINT "app_user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client"
    ADD CONSTRAINT "client_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredient_allergen"
    ADD CONSTRAINT "ingredient_allergen_pkey" PRIMARY KEY ("ingredient_id", "allergen_id");



ALTER TABLE ONLY "public"."ingredient_i18n"
    ADD CONSTRAINT "ingredient_i18n_pkey" PRIMARY KEY ("ingredient_id", "locale");



ALTER TABLE ONLY "public"."ingredient"
    ADD CONSTRAINT "ingredient_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission"
    ADD CONSTRAINT "permission_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."permission"
    ADD CONSTRAINT "permission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_component"
    ADD CONSTRAINT "recipe_component_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_i18n"
    ADD CONSTRAINT "recipe_i18n_pkey" PRIMARY KEY ("recipe_id", "locale");



ALTER TABLE ONLY "public"."recipe"
    ADD CONSTRAINT "recipe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role"
    ADD CONSTRAINT "role_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."role_permission"
    ADD CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."role"
    ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store"
    ADD CONSTRAINT "store_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit"
    ADD CONSTRAINT "unit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id", "role_id");



CREATE UNIQUE INDEX "allergen_code_client_key" ON "public"."allergen" USING "btree" ("client_id", "upper"(("code")::"text")) WHERE ("code" IS NOT NULL);



CREATE UNIQUE INDEX "allergen_name_client_key" ON "public"."allergen" USING "btree" ("client_id", "lower"("name"));



CREATE INDEX "idx_recipe_component_sub_recipe_id" ON "public"."recipe_component" USING "btree" ("sub_recipe_id") WHERE ("sub_recipe_id" IS NOT NULL);



CREATE UNIQUE INDEX "ingredient_article_id_client_key" ON "public"."ingredient" USING "btree" ("client_id", "article_id") WHERE ("article_id" IS NOT NULL);



CREATE INDEX "ingredient_i18n_ingredient_id_idx" ON "public"."ingredient_i18n" USING "btree" ("ingredient_id");



CREATE UNIQUE INDEX "ingredient_name_client_key" ON "public"."ingredient" USING "btree" ("client_id", "name");



CREATE INDEX "ix_allergen_client" ON "public"."allergen" USING "btree" ("client_id");



CREATE INDEX "ix_app_user_client" ON "public"."app_user" USING "btree" ("client_id");



CREATE INDEX "ix_ingredient_client" ON "public"."ingredient" USING "btree" ("client_id");



CREATE INDEX "ix_recipe_client" ON "public"."recipe" USING "btree" ("client_id");



CREATE INDEX "ix_store_client" ON "public"."store" USING "btree" ("client_id");



CREATE INDEX "ix_unit_client" ON "public"."unit" USING "btree" ("client_id");



CREATE INDEX "recipe_i18n_recipe_id_idx" ON "public"."recipe_i18n" USING "btree" ("recipe_id");



CREATE UNIQUE INDEX "recipe_recipe_id_client_key" ON "public"."recipe" USING "btree" ("client_id", "recipe_id") WHERE ("recipe_id" IS NOT NULL);



CREATE UNIQUE INDEX "unit_code_client_key" ON "public"."unit" USING "btree" ("client_id", "code");



CREATE OR REPLACE TRIGGER "trg_recipe_cost_sync" AFTER UPDATE OF "standard_unit_cost" ON "public"."recipe" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_recipe_cost_to_ingredient"();



ALTER TABLE ONLY "public"."allergen"
    ADD CONSTRAINT "allergen_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."allergen_i18n"
    ADD CONSTRAINT "allergen_i18n_allergen_id_fkey" FOREIGN KEY ("allergen_id") REFERENCES "public"."allergen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_user"
    ADD CONSTRAINT "app_user_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id");



ALTER TABLE ONLY "public"."ingredient_allergen"
    ADD CONSTRAINT "ingredient_allergen_allergen_id_fkey" FOREIGN KEY ("allergen_id") REFERENCES "public"."allergen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_allergen"
    ADD CONSTRAINT "ingredient_allergen_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient"
    ADD CONSTRAINT "ingredient_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient"
    ADD CONSTRAINT "ingredient_default_unit_id_fkey" FOREIGN KEY ("default_unit_id") REFERENCES "public"."unit"("id");



ALTER TABLE ONLY "public"."ingredient_i18n"
    ADD CONSTRAINT "ingredient_i18n_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient"
    ADD CONSTRAINT "ingredient_produced_by_recipe_id_fkey" FOREIGN KEY ("produced_by_recipe_id") REFERENCES "public"."recipe"("id");



ALTER TABLE ONLY "public"."ingredient"
    ADD CONSTRAINT "ingredient_purchase_unit_id_fkey" FOREIGN KEY ("purchase_unit_id") REFERENCES "public"."unit"("id");



ALTER TABLE ONLY "public"."recipe"
    ADD CONSTRAINT "recipe_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_component"
    ADD CONSTRAINT "recipe_component_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id");



ALTER TABLE ONLY "public"."recipe_component"
    ADD CONSTRAINT "recipe_component_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_component"
    ADD CONSTRAINT "recipe_component_sub_recipe_id_fkey" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipe"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_component"
    ADD CONSTRAINT "recipe_component_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id");



ALTER TABLE ONLY "public"."recipe_i18n"
    ADD CONSTRAINT "recipe_i18n_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe"
    ADD CONSTRAINT "recipe_output_unit_id_fkey" FOREIGN KEY ("output_unit_id") REFERENCES "public"."unit"("id");



ALTER TABLE ONLY "public"."role_permission"
    ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permission"
    ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store"
    ADD CONSTRAINT "store_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit"
    ADD CONSTRAINT "unit_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE CASCADE;



ALTER TABLE "public"."app_user" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredient" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_component" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_role" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."fn_dev_purge_all"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_dev_purge_all"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_dev_purge_all"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ensure_ingredient_stock"("p_ingredient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ensure_ingredient_stock"("p_ingredient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ensure_ingredient_stock"("p_ingredient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_current_offer_price"("p_offer_id" "uuid", "p_at_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_current_offer_price"("p_offer_id" "uuid", "p_at_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_current_offer_price"("p_offer_id" "uuid", "p_at_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_post_purchase_receipt"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_post_purchase_receipt"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_post_purchase_receipt"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_post_waste"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_post_waste"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_post_waste"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_sync_recipe_cost_to_ingredient"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sync_recipe_cost_to_ingredient"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sync_recipe_cost_to_ingredient"() TO "service_role";


















GRANT ALL ON TABLE "public"."allergen" TO "anon";
GRANT ALL ON TABLE "public"."allergen" TO "authenticated";
GRANT ALL ON TABLE "public"."allergen" TO "service_role";



GRANT ALL ON TABLE "public"."allergen_i18n" TO "anon";
GRANT ALL ON TABLE "public"."allergen_i18n" TO "authenticated";
GRANT ALL ON TABLE "public"."allergen_i18n" TO "service_role";



GRANT ALL ON TABLE "public"."app_user" TO "anon";
GRANT ALL ON TABLE "public"."app_user" TO "authenticated";
GRANT ALL ON TABLE "public"."app_user" TO "service_role";



GRANT ALL ON TABLE "public"."client" TO "anon";
GRANT ALL ON TABLE "public"."client" TO "authenticated";
GRANT ALL ON TABLE "public"."client" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient" TO "anon";
GRANT ALL ON TABLE "public"."ingredient" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_allergen" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_allergen" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_allergen" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_i18n" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_i18n" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_i18n" TO "service_role";



GRANT ALL ON TABLE "public"."permission" TO "anon";
GRANT ALL ON TABLE "public"."permission" TO "authenticated";
GRANT ALL ON TABLE "public"."permission" TO "service_role";



GRANT ALL ON TABLE "public"."recipe" TO "anon";
GRANT ALL ON TABLE "public"."recipe" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_component" TO "anon";
GRANT ALL ON TABLE "public"."recipe_component" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_component" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_i18n" TO "anon";
GRANT ALL ON TABLE "public"."recipe_i18n" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_i18n" TO "service_role";



GRANT ALL ON TABLE "public"."role" TO "anon";
GRANT ALL ON TABLE "public"."role" TO "authenticated";
GRANT ALL ON TABLE "public"."role" TO "service_role";



GRANT ALL ON TABLE "public"."role_permission" TO "anon";
GRANT ALL ON TABLE "public"."role_permission" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permission" TO "service_role";



GRANT ALL ON TABLE "public"."store" TO "anon";
GRANT ALL ON TABLE "public"."store" TO "authenticated";
GRANT ALL ON TABLE "public"."store" TO "service_role";



GRANT ALL ON TABLE "public"."unit" TO "anon";
GRANT ALL ON TABLE "public"."unit" TO "authenticated";
GRANT ALL ON TABLE "public"."unit" TO "service_role";



GRANT ALL ON TABLE "public"."user_role" TO "anon";
GRANT ALL ON TABLE "public"."user_role" TO "authenticated";
GRANT ALL ON TABLE "public"."user_role" TO "service_role";



GRANT ALL ON TABLE "public"."v_recipe_comp_cost" TO "anon";
GRANT ALL ON TABLE "public"."v_recipe_comp_cost" TO "authenticated";
GRANT ALL ON TABLE "public"."v_recipe_comp_cost" TO "service_role";



GRANT ALL ON TABLE "public"."v_recipe_effective_allergens" TO "anon";
GRANT ALL ON TABLE "public"."v_recipe_effective_allergens" TO "authenticated";
GRANT ALL ON TABLE "public"."v_recipe_effective_allergens" TO "service_role";



GRANT ALL ON TABLE "public"."v_recipe_standard_cost" TO "anon";
GRANT ALL ON TABLE "public"."v_recipe_standard_cost" TO "authenticated";
GRANT ALL ON TABLE "public"."v_recipe_standard_cost" TO "service_role";



GRANT ALL ON TABLE "public"."v_user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."v_user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_user_permissions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

