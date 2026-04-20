export interface ResourceBundle {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

export interface CargoLoadResult {
  loaded: ResourceBundle;
  overflow: ResourceBundle;
}

export function computeCargoLoad(stock: ResourceBundle, capacity: number): CargoLoadResult {
  const remaining = Math.max(0, capacity);
  const loadedMinerai = Math.min(stock.minerai, remaining);
  const afterMinerai = remaining - loadedMinerai;
  const loadedSilicium = Math.min(stock.silicium, afterMinerai);
  const afterSilicium = afterMinerai - loadedSilicium;
  const loadedHydrogene = Math.min(stock.hydrogene, afterSilicium);
  return {
    loaded: {
      minerai: loadedMinerai,
      silicium: loadedSilicium,
      hydrogene: loadedHydrogene,
    },
    overflow: {
      minerai: stock.minerai - loadedMinerai,
      silicium: stock.silicium - loadedSilicium,
      hydrogene: stock.hydrogene - loadedHydrogene,
    },
  };
}
