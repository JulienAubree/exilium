import { describe, it, expect } from 'vitest';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig, loadBonuses, loadResearch } from './config.js';
import { initState } from './state.js';
import { mineraiProduction, calculateProductionFactor, solarPlantEnergy, mineraiMineEnergy, resolveBonus } from '@exilium/game-engine';

const engine = () => new SimEngine(loadBuildings(), loadProductionConfig(), loadBonuses(), loadResearch());

describe('SimEngine.production', () => {
  it('mine niv.1 + solaire niv.1 : prod minerai = formule du game-engine', () => {
    const s = initState();
    s.levels.set('mineraiMine', 1);
    s.levels.set('solarPlant', 1);
    // solarPlantEnergy(1) = floor(20 * 1 * 1.1^1) = 22
    // mineraiMineEnergy(1) = floor(10 * 1 * 1.1^1) = 11
    const solarProduced = solarPlantEnergy(1, { baseProduction: 20, exponentBase: 1.1 });
    const mineraiConsumed = mineraiMineEnergy(1, { baseConsumption: 10, exponentBase: 1.1 });
    const factor = calculateProductionFactor(solarProduced, mineraiConsumed);
    expect(engine().production(s).minerai).toBe(mineraiProduction(1, factor, { baseProduction: 30, exponentBase: 1.1 }));
  });
});

describe('Research bonus wiring', () => {
  it('temperateProduction booste la prod minerai via resolveBonus', () => {
    const bonuses = loadBonuses();
    const e = new SimEngine(loadBuildings(), loadProductionConfig(), bonuses);
    const base = (() => { const s = initState(); s.levels.set('mineraiMine', 5); s.levels.set('solarPlant', 5); return e.production(s).minerai; })();
    const boosted = (() => { const s = initState(); s.levels.set('mineraiMine', 5); s.levels.set('solarPlant', 5); s.techLevels.set('temperateProduction', 10); return e.production(s).minerai; })();
    const mult = resolveBonus('production_minerai', null, { temperateProduction: 10 }, bonuses);
    expect(mult).toBeGreaterThan(1);
    expect(boosted).toBe(Math.floor(base * mult));
  });
});

describe('SimEngine.advance + startBuild', () => {
  it('attend d\'avoir les ressources puis construit la mine, qui monte au niveau 1', () => {
    const e = engine();
    const s = initState();
    e.startBuild(s, 'mineraiMine');          // niveau 0 → 1
    expect(s.build?.buildingId).toBe('mineraiMine');
    e.advance(s, e.nextEventIn(s));            // saute à la fin de construction
    expect(s.levels.get('mineraiMine')).toBe(1);
    expect(s.build).toBeNull();
  });
});

describe('SimEngine.startResearch + file parallèle', () => {
  it('startResearch energyTech → après advance, techLevels.get(energyTech)===1 et research null, build indépendant', () => {
    const e = engine();
    const s = initState();
    // energyTech prérequis : researchLab niv.1 → on le monte d'abord
    s.levels.set('researchLab', 1);
    // Donner des ressources suffisantes
    s.resources.silicium = 10000;
    s.resources.minerai = 10000;
    s.resources.hydrogene = 10000;

    // Lancer une recherche
    e.startResearch(s, 'energyTech');
    expect(s.research).not.toBeNull();
    expect(s.research?.researchId).toBe('energyTech');
    expect(s.research?.targetLevel).toBe(1);

    // La file build reste indépendante — on peut lancer un build en parallèle
    e.startBuild(s, 'mineraiMine');
    expect(s.build).not.toBeNull();
    expect(s.research).not.toBeNull(); // research toujours active

    // Avancer jusqu'à la fin de la recherche
    const wait = e.nextEventIn(s);
    expect(wait).toBeGreaterThan(0); // nextEventIn ne retourne pas 0 si une file est active
    e.advance(s, wait);

    // Au moins une file terminée après avance
    // Avancer jusqu'à ce que la recherche soit terminée
    let iterations = 0;
    while (s.research !== null && iterations < 100) {
      const w = e.nextEventIn(s);
      if (w <= 0) break;
      e.advance(s, w);
      iterations++;
    }

    expect(s.techLevels.get('energyTech')).toBe(1);
    expect(s.research).toBeNull();
  });
});
