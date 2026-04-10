-- Add 'exploring' value to fleet_phase enum
ALTER TYPE "fleet_phase" ADD VALUE IF NOT EXISTS 'exploring';

-- Migrate any stuck explore missions from 'prospecting' to 'exploring'
UPDATE "fleet_events" SET "phase" = 'exploring' WHERE "mission" = 'explore' AND "phase" = 'prospecting';
