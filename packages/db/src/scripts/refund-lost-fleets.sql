-- =============================================================
-- Refund ships & cargo from fleets force-completed by compact-universe.sql
-- =============================================================
-- The compaction script set status='completed' on active fleets
-- without returning ships/cargo to origin planets. This fixes it.
--
-- RUN WITH: psql $DATABASE_URL -f packages/db/src/scripts/refund-lost-fleets.sql
-- =============================================================

BEGIN;

-- Find fleets that were force-completed (completed but never went through return phase)
-- These are the ones the compaction script killed.
-- They have status='completed' but phase != 'return' (never actually returned)
-- OR phase='return' (were on the way back, ships still in transit)

-- ── 1. Refund ships to origin planets ──
-- For each affected fleet event, add ships back to planet_ships

DO $$
DECLARE
  fe RECORD;
  ship_key TEXT;
  ship_count INT;
  current_count INT;
  total_refunded INT := 0;
  total_cargo_minerai NUMERIC := 0;
  total_cargo_silicium NUMERIC := 0;
  total_cargo_hydrogene NUMERIC := 0;
BEGIN
  RAISE NOTICE '──── Refunding lost fleets ────';

  FOR fe IN
    SELECT id, origin_planet_id, ships, minerai_cargo, silicium_cargo, hydrogene_cargo, mission, phase
    FROM fleet_events
    WHERE status = 'completed'
      -- Recently completed (within last hour — adjust if needed)
      AND arrival_time > NOW() - INTERVAL '2 hours'
      -- Still had an active purpose (wasn't a natural completion)
      AND (
        phase IN ('outbound', 'prospecting', 'mining')
        OR (phase = 'return' AND arrival_time > NOW())
      )
  LOOP
    RAISE NOTICE '  Fleet %: mission=%, phase=%, ships=%',
      fe.id, fe.mission, fe.phase, fe.ships;

    -- Refund each ship type
    FOR ship_key, ship_count IN
      SELECT key, (value)::INT
      FROM jsonb_each_text(fe.ships)
      WHERE (value)::INT > 0
    LOOP
      -- Ensure planet_ships row exists
      INSERT INTO planet_ships (planet_id)
      VALUES (fe.origin_planet_id)
      ON CONFLICT (planet_id) DO NOTHING;

      -- Add ships back
      EXECUTE format(
        'UPDATE planet_ships SET %I = %I + $1 WHERE planet_id = $2',
        ship_key, ship_key
      ) USING ship_count, fe.origin_planet_id;

      RAISE NOTICE '    +% % -> planet %', ship_count, ship_key, fe.origin_planet_id;
    END LOOP;

    -- Refund cargo
    IF fe.minerai_cargo::NUMERIC > 0 OR fe.silicium_cargo::NUMERIC > 0 OR fe.hydrogene_cargo::NUMERIC > 0 THEN
      UPDATE planets
      SET minerai = (minerai::NUMERIC + fe.minerai_cargo::NUMERIC)::TEXT,
          silicium = (silicium::NUMERIC + fe.silicium_cargo::NUMERIC)::TEXT,
          hydrogene = (hydrogene::NUMERIC + fe.hydrogene_cargo::NUMERIC)::TEXT
      WHERE id = fe.origin_planet_id;

      total_cargo_minerai := total_cargo_minerai + fe.minerai_cargo::NUMERIC;
      total_cargo_silicium := total_cargo_silicium + fe.silicium_cargo::NUMERIC;
      total_cargo_hydrogene := total_cargo_hydrogene + fe.hydrogene_cargo::NUMERIC;

      RAISE NOTICE '    +cargo: % minerai, % silicium, % hydrogene',
        fe.minerai_cargo, fe.silicium_cargo, fe.hydrogene_cargo;
    END IF;

    total_refunded := total_refunded + 1;
  END LOOP;

  RAISE NOTICE '──── Summary ────';
  RAISE NOTICE '  Fleets refunded: %', total_refunded;
  RAISE NOTICE '  Total cargo returned: % minerai, % silicium, % hydrogene',
    total_cargo_minerai, total_cargo_silicium, total_cargo_hydrogene;

  IF total_refunded = 0 THEN
    RAISE NOTICE '  No fleets found to refund. Check the time window (2h) or phase filters.';
  END IF;
END $$;

COMMIT;
