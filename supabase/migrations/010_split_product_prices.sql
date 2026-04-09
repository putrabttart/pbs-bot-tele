-- ============================================
-- Migration: Split product price into web and bot prices
-- ============================================
-- Adds: harga_web, harga_bot
-- Backfills from legacy harga
-- Drops: legacy harga

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS harga_web DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS harga_bot DECIMAL(12,2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'harga'
  ) THEN
    EXECUTE '
      UPDATE public.products
      SET harga_web = COALESCE(harga_web, harga),
          harga_bot = COALESCE(harga_bot, harga_web, harga)
    ';
  END IF;
END
$$;

-- Final safety net to guarantee non-null values before constraints.
UPDATE public.products
SET
  harga_web = COALESCE(harga_web, harga_bot, 0),
  harga_bot = COALESCE(harga_bot, harga_web, 0)
WHERE harga_web IS NULL OR harga_bot IS NULL;

ALTER TABLE public.products
  ALTER COLUMN harga_web SET DEFAULT 0,
  ALTER COLUMN harga_bot SET DEFAULT 0,
  ALTER COLUMN harga_web SET NOT NULL,
  ALTER COLUMN harga_bot SET NOT NULL;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS harga;

COMMIT;
