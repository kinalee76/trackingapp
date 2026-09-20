import { useState } from 'react';
import { RouteListScreen } from './RouteListScreen';
import { RouteDetailScreen } from './RouteDetailScreen';

export function RecordsTab({ onBack }: { onBack: () => void }) {
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  if (selectedRouteId !== null) {
    return <RouteDetailScreen routeId={selectedRouteId} onClose={() => setSelectedRouteId(null)} />;
  }
  return <RouteListScreen onSelect={setSelectedRouteId} onBack={onBack} />;
}
