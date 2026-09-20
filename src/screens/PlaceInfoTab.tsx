import { useState } from 'react';
import { PlaceInfoListScreen } from './PlaceInfoListScreen';
import { PlaceInfoDetailScreen } from './PlaceInfoDetailScreen';

export function PlaceInfoTab({ onBack }: { onBack: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId !== null) {
    return <PlaceInfoDetailScreen id={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <PlaceInfoListScreen onSelect={setSelectedId} onBack={onBack} />;
}
