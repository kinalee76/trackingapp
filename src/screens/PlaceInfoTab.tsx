import { useEffect, useState } from 'react';
import { PlaceInfoListScreen } from './PlaceInfoListScreen';
import { PlaceInfoDetailScreen } from './PlaceInfoDetailScreen';

interface PlaceInfoTabProps {
  onBack: () => void;
  /** See the matching prop on RecordsTab for why this exists. */
  onRegisterBack?: (handler: (() => boolean) | null) => void;
}

export function PlaceInfoTab({ onBack, onRegisterBack }: PlaceInfoTabProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    onRegisterBack?.(() => {
      if (selectedId !== null) {
        setSelectedId(null);
        return true;
      }
      return false;
    });
    return () => onRegisterBack?.(null);
  }, [selectedId, onRegisterBack]);

  if (selectedId !== null) {
    return <PlaceInfoDetailScreen id={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <PlaceInfoListScreen onSelect={setSelectedId} onBack={onBack} />;
}
