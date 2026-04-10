-- Add 'scan' value to fleet_mission enum for flagship scan ability
ALTER TYPE "fleet_mission" ADD VALUE IF NOT EXISTS 'scan';
