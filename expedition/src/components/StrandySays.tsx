import type { ReactNode } from 'react';
import { Strandy, type StrandyMood, type StrandyPose } from './Strandy';

export function StrandySays({ children, pose = 'idle', mood = 'open', size = 64, compact = false }: { children: ReactNode; pose?: StrandyPose; mood?: StrandyMood; size?: number; compact?: boolean }) {
  return (
    <div className={`says ${compact ? 'says--compact' : ''}`}>
      <Strandy pose={pose} mood={mood} size={size} />
      <div className="says__bubble">
        <span className="says__name">Strandy</span>
        <div>{children}</div>
      </div>
    </div>
  );
}
