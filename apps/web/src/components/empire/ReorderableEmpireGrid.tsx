import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { SortableEmpireCard } from './SortableEmpireCard';
import { EmpirePlanetCard } from './EmpirePlanetCard';

type EmpirePlanet = Parameters<typeof EmpirePlanetCard>[0]['planet'];

interface ReorderableEmpireGridProps {
  planets: EmpirePlanet[];
  onSave: (order: { planetId: string; sortOrder: number }[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ReorderableEmpireGrid({
  planets,
  onSave,
  onCancel,
  isSaving,
}: ReorderableEmpireGridProps) {
  const [orderedPlanets, setOrderedPlanets] = useState(planets);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedPlanets((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setOrderedPlanets((prev) => arrayMove(prev, index, index - 1));
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setOrderedPlanets((prev) => {
      if (index >= prev.length - 1) return prev;
      return arrayMove(prev, index, index + 1);
    });
  }, []);

  const handleSave = () => {
    const order = orderedPlanets.map((planet, i) => ({
      planetId: planet.id,
      sortOrder: i,
    }));
    onSave(order);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedPlanets.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          {/* Desktop grid */}
          <div className="hidden lg:grid lg:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] lg:gap-4">
            {orderedPlanets.map((planet, i) => (
              <SortableEmpireCard
                key={planet.id}
                planet={planet}
                isFirst={i === 0}
                isReordering
                isFirstInList={i === 0}
                isLastInList={i === orderedPlanets.length - 1}
                onMoveUp={() => handleMoveUp(i)}
                onMoveDown={() => handleMoveDown(i)}
              />
            ))}
          </div>

          {/* Mobile list */}
          <div className="flex flex-col gap-3 lg:hidden">
            {orderedPlanets.map((planet, i) => (
              <SortableEmpireCard
                key={planet.id}
                planet={planet}
                isFirst={i === 0}
                isReordering
                isFirstInList={i === 0}
                isLastInList={i === orderedPlanets.length - 1}
                onMoveUp={() => handleMoveUp(i)}
                onMoveDown={() => handleMoveDown(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg px-4 py-3 lg:bottom-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Enregistrement...' : 'Valider'}
          </button>
        </div>
      </div>
    </>
  );
}
