-- ============================================================================
-- LlamadoApp — Catálogo global de "hospitales" (centros médicos)
-- ============================================================================
-- Propósito:
--   * Las locaciones ya no guardan el centro médico como texto duplicado
--     (centro_medico / direccion_med / url_med). En su lugar referencian un
--     registro del catálogo global "hospitales" mediante locaciones.hospital_id.
--   * Mapeo de columnas (1:1 con los campos viejos de locaciones):
--         hospitales.hospital        <-> locaciones.centro_medico  (nombre)
--         hospitales.direccion_hosp  <-> locaciones.direccion_med  (dirección)
--         hospitales.ubicacion_hosp  <-> locaciones.url_med        (URL Google Maps)
--
-- NOTA: Este script NO elimina las columnas centro_medico / direccion_med /
-- url_med de "locaciones". Esa limpieza se hace manualmente desde el SQL Editor
-- cuando todo esté funcionando (ver archivo README o el final de este archivo).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Asegurar RLS habilitado en hospitales (la tabla ya existe, creada por el usuario)
-- ---------------------------------------------------------------------------
ALTER TABLE public.hospitales ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Políticas de acceso para "hospitales"
--    - SELECT: anon y authenticated (la hoja de llamado público la necesita)
--    - CRUD  : authenticated (panel de administración)
-- Se crean sólo si no existen (bloques defensivos).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hospitales' AND policyname = 'hospitales_select_anon'
  ) THEN
    CREATE POLICY hospitales_select_anon ON public.hospitales
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hospitales' AND policyname = 'hospitales_select_auth'
  ) THEN
    CREATE POLICY hospitales_select_auth ON public.hospitales
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hospitales' AND policyname = 'hospitales_insert_auth'
  ) THEN
    CREATE POLICY hospitales_insert_auth ON public.hospitales
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hospitales' AND policyname = 'hospitales_update_auth'
  ) THEN
    CREATE POLICY hospitales_update_auth ON public.hospitales
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hospitales' AND policyname = 'hospitales_delete_auth'
  ) THEN
    CREATE POLICY hospitales_delete_auth ON public.hospitales
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Agregar columna de relación en locaciones (idempotente)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locaciones' AND column_name = 'hospital_id'
  ) THEN
    ALTER TABLE public.locaciones
      ADD COLUMN hospital_id bigint REFERENCES public.hospitales(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Índice para acelerar el join (idempotente)
CREATE INDEX IF NOT EXISTS locaciones_hospital_id_idx ON public.locaciones(hospital_id);

-- ---------------------------------------------------------------------------
-- 4. Backfill: poblar "hospitales" con los datos únicos ya existentes en las
--    locaciones (centro_medico, direccion_med, url_med) y enlazar hospital_id.
--    Se agrupa por combinación única para no duplicar hospitales.
--    Las locaciones sin datos médicos quedan con hospital_id NULL.
-- ---------------------------------------------------------------------------
-- 4a. Insertar en "hospitales" las combinaciones de locaciones que aún no existen
--     (anti-join contra hospitales para no duplicar registros ya creados).
INSERT INTO public.hospitales (hospital, direccion_hosp, ubicacion_hosp)
SELECT DISTINCT
  NULLIF(btrim(l.centro_medico), '')  AS hospital,
  NULLIF(btrim(l.direccion_med), '')  AS direccion_hosp,
  NULLIF(btrim(l.url_med), '')        AS ubicacion_hosp
FROM public.locaciones l
WHERE l.centro_medico IS NOT NULL
  AND btrim(l.centro_medico) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.hospitales h
    WHERE lower(h.hospital) = lower(btrim(l.centro_medico))
      AND lower(coalesce(h.direccion_hosp, '')) = lower(coalesce(btrim(l.direccion_med), ''))
      AND lower(coalesce(h.ubicacion_hosp, '')) = lower(coalesce(btrim(l.url_med), ''))
  );

-- 4b. Enlazar cada locación con su hospital correspondiente.
UPDATE public.locaciones l
SET hospital_id = h.id
FROM public.hospitales h
WHERE l.hospital_id IS NULL
  AND l.centro_medico IS NOT NULL
  AND btrim(l.centro_medico) <> ''
  AND lower(h.hospital) = lower(btrim(l.centro_medico))
  AND lower(coalesce(h.direccion_hosp, '')) = lower(coalesce(btrim(l.direccion_med), ''))
  AND lower(coalesce(h.ubicacion_hosp, '')) = lower(coalesce(btrim(l.url_med), ''));

COMMIT;

-- ============================================================================
-- LIMPIEZA MANUAL (EJECUTAR SOLO CUANDO TODO ESTÉ FUNCIONANDO)
-- Elimina las columnas de texto viejas que quedaron sin uso:
-- ============================================================================
-- ALTER TABLE public.locaciones
--   DROP COLUMN centro_medico,
--   DROP COLUMN direccion_med,
--   DROP COLUMN url_med;
-- ============================================================================
