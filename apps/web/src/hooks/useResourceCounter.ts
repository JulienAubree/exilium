import { useState, useEffect, useRef } from 'react';

interface ResourceCounterInput {
  minerai: number;
  silicium: number;
  hydrogene: number;
  resourcesUpdatedAt: string;
  mineraiPerHour: number;
  siliciumPerHour: number;
  hydrogenePerHour: number;
  storageMineraiCapacity: number;
  storageSiliciumCapacity: number;
  storageHydrogeneCapacity: number;
}

interface ResourceCounterOutput {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

export function useResourceCounter(input: ResourceCounterInput | undefined): ResourceCounterOutput {
  const [resources, setResources] = useState<ResourceCounterOutput>({
    minerai: 0,
    silicium: 0,
    hydrogene: 0,
  });

  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (!input) return;

    function tick() {
      const data = inputRef.current;
      if (!data) return;

      const now = Date.now();
      const updatedAt = new Date(data.resourcesUpdatedAt).getTime();
      const elapsedHours = (now - updatedAt) / (3600 * 1000);

      const accrue = (stock: number, perHour: number, capacity: number) =>
        stock >= capacity
          ? Math.floor(stock)
          : Math.min(Math.floor(stock + perHour * elapsedHours), capacity);

      setResources({
        minerai: accrue(data.minerai, data.mineraiPerHour, data.storageMineraiCapacity),
        silicium: accrue(data.silicium, data.siliciumPerHour, data.storageSiliciumCapacity),
        hydrogene: accrue(data.hydrogene, data.hydrogenePerHour, data.storageHydrogeneCapacity),
      });
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [input?.resourcesUpdatedAt, input?.mineraiPerHour, input?.siliciumPerHour, input?.hydrogenePerHour]);

  return resources;
}
