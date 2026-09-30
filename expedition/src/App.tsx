import { useCallback, useEffect, useState } from 'react';
import { clearCommunity } from './community/localRepository';
import { Backdrop } from './components/Backdrop';
import { Icon } from './components/Icon';
import { Sheet } from './components/Sheet';
import { useProgress } from './state/progress';
import { Community } from './screens/Community';
import { Explore } from './screens/Explore';
import { Fieldwork } from './screens/Fieldwork';
import { Opening } from './screens/Opening';
import { Play } from './screens/Play';

export type Tab = 'explore' | 'play' | 'fieldwork' | 'community';
const TABS: { id: Tab; label: string; icon: string; depth: number }[] = [
  { id: 'explore', label: 'Explore', icon: 'explore', depth: 0.3 },
  { id: 'play', label: 'Play', icon: 'play', depth: 1 },
  { id: 'fieldwork', label: 'Fieldwork', icon: 'fieldwork', depth: 0 },
  { id: 'community', label: 'Community', icon: 'community', depth: 0.6 },
];

const readHash = (): Tab | 'opening' | null => {
  const h = location.hash.replace('#/', '');
  return h === 'opening' || TABS.some((t) => t.id === h) ? (h as Tab | 'opening') : null;
};

export function App() {
  const { progress, update, percent, resetGame, resetAll } = useProgress();
  const initial = readHash();
  const [showOpening, setShowOpening] = useState(initial === 'opening' || (!progress.seenOpening && initial === null));
  const [tab, setTab] = useState<Tab>(initial && initial !== 'opening' ? initial : 'explore');
  const [menu, setMenu] = useState(false);
  const [screenKey, setScreenKey] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  const go = useCallback((t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#/${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onHash = () => {
      const h = readHash();
      if (h === 'opening') setShowOpening(true);
      else if (h) setTab(h);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const finishOpening = () => {
    update({ seenOpening: true });
    setShowOpening(false);
    go('explore');
  };

  const depth = showOpening ? 0 : TABS.find((t) => t.id === tab)!.depth;

  return (
    <>
      <Backdrop depth={depth} />
      {showOpening ? (
        <Opening onDone={finishOpening} />
      ) : (
        <div className="app">
          <header className="topbar">
            <div className="topbar__brand">
              <span className="topbar__dot" aria-hidden />
              <span>
                <strong>The Folding Problem</strong>
                <em>Claude field expedition · Ep.01</em>
              </span>
            </div>
            <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Expedition menu: replay or reset">
              <Icon name="menu" />
            </button>
            <div className="topbar__progress" role="progressbar" aria-label="Expedition progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent * 100)}>
              <div style={{ width: `${percent * 100}%` }} />
            </div>
          </header>

          <main key={`${tab}-${screenKey}`} className="main enter">
            {tab === 'explore' && <Explore go={go} />}
            {tab === 'play' && <Play go={go} />}
            {tab === 'fieldwork' && <Fieldwork />}
            {tab === 'community' && <Community />}
          </main>

          <nav className="bottomnav" aria-label="Chapters">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <Sheet
            open={menu}
            onClose={() => {
              setMenu(false);
              setConfirmReset(false);
            }}
            title="Expedition"
          >
            <p className="lede">Progress: {Math.round(percent * 100)}%. Everything is saved on this device only.</p>
            <div className="stack">
              <button
                className="btn btn--ghost btn--block"
                onClick={() => {
                  setMenu(false);
                  setShowOpening(true);
                }}
              >
                Replay the opening
              </button>
              <button
                className="btn btn--ghost btn--block"
                onClick={() => {
                  resetGame();
                  setMenu(false);
                  setScreenKey((k) => k + 1);
                  go('play');
                }}
              >
                Replay the folding game
              </button>
              <button
                className="btn btn--danger btn--block"
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  clearCommunity();
                  resetAll();
                  setConfirmReset(false);
                  setMenu(false);
                  setShowOpening(true);
                }}
              >
                {confirmReset ? 'Tap again to erase everything' : 'Reset everything'}
              </button>
              {confirmReset && (
                <p className="fine" role="status">
                  This erases your progress, hypotheses and field notes from this device.
                </p>
              )}
            </div>
          </Sheet>
        </div>
      )}
    </>
  );
}
