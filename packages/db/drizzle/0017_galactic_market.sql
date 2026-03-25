-- Market offer status enum
CREATE TYPE "market_offer_status" AS ENUM ('active', 'reserved', 'sold', 'expired', 'cancelled');
CREATE TYPE "market_resource_type" AS ENUM ('minerai', 'silicium', 'hydrogene');

-- Market offers table
CREATE TABLE "market_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "seller_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "planet_id" uuid NOT NULL REFERENCES "planets"("id") ON DELETE CASCADE,
  "resource_type" "market_resource_type" NOT NULL,
  "quantity" numeric(20, 2) NOT NULL,
  "price_minerai" numeric(20, 2) NOT NULL DEFAULT '0',
  "price_silicium" numeric(20, 2) NOT NULL DEFAULT '0',
  "price_hydrogene" numeric(20, 2) NOT NULL DEFAULT '0',
  "status" "market_offer_status" NOT NULL DEFAULT 'active',
  "reserved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reserved_at" timestamp with time zone,
  "fleet_event_id" uuid REFERENCES "fleet_events"("id") ON DELETE SET NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "market_offers_status_idx" ON "market_offers" ("status");
CREATE INDEX "market_offers_seller_idx" ON "market_offers" ("seller_id", "status");
CREATE INDEX "market_offers_resource_idx" ON "market_offers" ("resource_type", "status");

-- Add trade mission to fleet enum
ALTER TYPE "fleet_mission" ADD VALUE 'trade';

-- Add trade_id to fleet_events
ALTER TABLE "fleet_events" ADD COLUMN "trade_id" uuid REFERENCES "market_offers"("id") ON DELETE SET NULL;

-- Building definition: Galactic Market
INSERT INTO "building_definitions" ("id", "name", "description", "category_id", "base_cost_minerai", "base_cost_silicium", "base_cost_hydrogene", "cost_factor", "base_time", "sort_order", "role", "flavor_text")
VALUES ('galacticMarket', 'Marché Galactique', 'Permet les échanges de ressources avec les autres joueurs de l''univers.', 'building_industrie', 5000, 5000, 1000, 1.5, 120, 7, 'market', 'Le marché galactique met en relation acheteurs et vendeurs à travers l''univers. Les transactions sont sécurisées par un système d''entiercement automatique.')
ON CONFLICT ("id") DO NOTHING;

-- Building prerequisite: shipyard level 2
INSERT INTO "building_prerequisites" ("building_id", "required_building_id", "required_level")
SELECT 'galacticMarket', 'shipyard', 2
WHERE NOT EXISTS (SELECT 1 FROM "building_prerequisites" WHERE "building_id" = 'galacticMarket' AND "required_building_id" = 'shipyard');

-- Mission definition: trade
INSERT INTO "mission_definitions" ("id", "label", "hint", "button_label", "color", "sort_order", "dangerous", "required_ship_roles", "exclusive", "recommended_ship_roles", "requires_pve_mission")
VALUES ('trade', 'Commerce', 'Envoyez une flotte chercher des marchandises achetées sur le marché', 'Commercer', '#a78bfa', 9, false, null, false, '["smallCargo", "largeCargo"]', false)
ON CONFLICT ("id") DO NOTHING;

-- Universe config
INSERT INTO "universe_config" ("key", "value", "label")
VALUES
  ('market_commission_percent', '5', 'Commission du marché galactique (%)'),
  ('market_offer_duration_hours', '48', 'Durée de vie des offres du marché (heures)'),
  ('market_reservation_minutes', '60', 'Temps de réservation avant expiration (minutes)')
ON CONFLICT ("key") DO NOTHING;
