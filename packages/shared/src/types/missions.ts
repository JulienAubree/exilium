export enum MissionType {
  Transport = 'transport',
  Station = 'station',
  Spy = 'spy',
  Attack = 'attack',
  Colonize = 'colonize',
  Recycle = 'recycle',
  Mine = 'mine',
  Pirate = 'pirate',
  Trade = 'trade',
  Scan = 'scan',
  Explore = 'explore',
  // `ColonizeSupply` a ete retire le 2026-08-08, apres le DELETE de la ligne
  // `mission_definitions` (migration 0105). Cet enum liste les missions qu'un
  // joueur peut CHOISIR — ce n'est pas un miroir de l'enum Postgres
  // `fleet_mission`, qui contient aussi `colonization_raid` (declenchee par le
  // systeme) et `anomaly` (morte). La valeur 'colonize_supply' reste dans
  // l'enum Postgres et dans le schema Drizzle : 7 fleet_events historiques la
  // portent, et les ecrans de colonisation les affichent encore correctement.
  ColonizeReinforce = 'colonize_reinforce',
  AbandonReturn = 'abandon_return',
}
