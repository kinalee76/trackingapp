import { useEffect, useState } from 'react';
import { RouteListScreen } from './RouteListScreen';
import { RouteDetailScreen } from './RouteDetailScreen';

interface RecordsTabProps {
  onBack: () => void;
  /**
   * Lets the hardware back button (see App.tsx) mirror this tab's own "<"/
   * "닫기" buttons: while a route's detail is open, back should return to
   * the list (handled here, returns true) rather than leaving the tab.
   * Registered/cleared on every relevant state change since this tab is
   * only ever mounted while active.
   */
  onRegisterBack?: (handler: (() => boolean) | null) => void;
}

export function RecordsTab({ onBack, onRegisterBack }: RecordsTabProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  useEffect(() => {
    onRegisterBack?.(() => {
      if (selectedRouteId !== null) {
        setSelectedRouteId(null);
        return true;
      }
      return false;
    });
    return () => onRegisterBack?.(null);
  }, [selectedRouteId, onRegisterBack]);

  if (selectedRouteId !== null) {
    return <RouteDetailScreen routeId={selectedRouteId} onClose={() => setSelectedRouteId(null)} />;
  }
  return <RouteListScreen onSelect={setSelectedRouteId} onBack={onBack} />;
}
