export interface TutorialQuest {
  id: string;
  order: number;
  title: string;
  narrativeText: string;
  condition: {
    type: 'building_level' | 'ship_count' | 'mission_complete';
    targetId: string;
    targetValue: number;
  };
  reward: { minerai: number; silicium: number; hydrogene: number };
}

export const TUTORIAL_QUESTS: TutorialQuest[] = [
  {
    id: 'quest_1',
    order: 1,
    title: 'Premiers pas',
    narrativeText: 'Commandant, bienvenue sur votre nouvelle colonie. Notre priorité est d\'établir une extraction de minerai. Construisez votre première mine pour alimenter nos projets.',
    condition: { type: 'building_level', targetId: 'mineraiMine', targetValue: 1 },
    reward: { minerai: 100, silicium: 0, hydrogene: 0 },
  },
  {
    id: 'quest_2',
    order: 2,
    title: 'Fondations technologiques',
    narrativeText: 'Excellent travail. Le silicium est essentiel pour toute technologie avancée. Lancez l\'extraction de silicium sans tarder.',
    condition: { type: 'building_level', targetId: 'siliciumMine', targetValue: 1 },
    reward: { minerai: 0, silicium: 100, hydrogene: 0 },
  },
  {
    id: 'quest_3',
    order: 3,
    title: 'Alimenter la colonie',
    narrativeText: 'Nos installations ont besoin d\'énergie pour fonctionner. Une centrale solaire assurera l\'alimentation de vos mines.',
    condition: { type: 'building_level', targetId: 'solarPlant', targetValue: 1 },
    reward: { minerai: 100, silicium: 75, hydrogene: 0 },
  },
  {
    id: 'quest_4',
    order: 4,
    title: 'Expansion minière',
    narrativeText: 'Bien. Il est temps d\'accélérer notre production. Montez votre mine de minerai au niveau 3 pour assurer un flux constant.',
    condition: { type: 'building_level', targetId: 'mineraiMine', targetValue: 3 },
    reward: { minerai: 200, silicium: 100, hydrogene: 0 },
  },
  {
    id: 'quest_5',
    order: 5,
    title: 'Équilibre énergétique',
    narrativeText: 'La croissance exige de l\'énergie. Améliorez votre centrale solaire au niveau 3 pour soutenir l\'expansion.',
    condition: { type: 'building_level', targetId: 'solarPlant', targetValue: 3 },
    reward: { minerai: 250, silicium: 150, hydrogene: 50 },
  },
  {
    id: 'quest_6',
    order: 6,
    title: 'L\'automatisation',
    narrativeText: 'Les robots de construction accéléreront tous vos projets futurs. Construisez une usine de robots.',
    condition: { type: 'building_level', targetId: 'robotics', targetValue: 1 },
    reward: { minerai: 350, silicium: 200, hydrogene: 150 },
  },
  {
    id: 'quest_7',
    order: 7,
    title: 'Le chantier spatial',
    narrativeText: 'Commandant, il est temps de conquérir les étoiles. Un chantier spatial nous permettra de construire nos premiers vaisseaux.',
    condition: { type: 'building_level', targetId: 'shipyard', targetValue: 1 },
    reward: { minerai: 500, silicium: 300, hydrogene: 150 },
  },
  {
    id: 'quest_8',
    order: 8,
    title: 'Premier vol',
    narrativeText: 'Le moment est historique. Construisez votre premier Explorateur et ouvrez la voie vers les systèmes voisins.',
    condition: { type: 'ship_count', targetId: 'explorer', targetValue: 1 },
    reward: { minerai: 750, silicium: 500, hydrogene: 250 },
  },
  {
    id: 'quest_9',
    order: 9,
    title: 'Agrandir le chantier',
    narrativeText: 'Pour construire des vaisseaux plus avancés, nous devons agrandir notre chantier spatial au niveau 2.',
    condition: { type: 'building_level', targetId: 'shipyard', targetValue: 2 },
    reward: { minerai: 1200, silicium: 800, hydrogene: 400 },
  },
  {
    id: 'quest_10',
    order: 10,
    title: 'Centre de missions',
    narrativeText: 'Un centre de missions nous permettra de détecter les opportunités dans notre système : gisements de ressources et menaces pirates.',
    condition: { type: 'building_level', targetId: 'missionCenter', targetValue: 1 },
    reward: { minerai: 2000, silicium: 1200, hydrogene: 500 },
  },
  {
    id: 'quest_11',
    order: 11,
    title: 'Premier Prospecteur',
    narrativeText: 'Le Prospecteur est un vaisseau minier spécialisé. Construisez-en un pour exploiter les gisements détectés par votre centre de missions.',
    condition: { type: 'ship_count', targetId: 'prospector', targetValue: 1 },
    reward: { minerai: 1500, silicium: 1000, hydrogene: 500 },
  },
  {
    id: 'quest_12',
    order: 12,
    title: 'Première récolte',
    narrativeText: 'Tout est en place, Commandant. Envoyez votre Prospecteur en mission de minage et récoltez votre première cargaison de ressources. Votre colonie est prête à prospérer.',
    condition: { type: 'mission_complete', targetId: 'mine', targetValue: 1 },
    reward: { minerai: 3500, silicium: 2000, hydrogene: 800 },
  },
];
