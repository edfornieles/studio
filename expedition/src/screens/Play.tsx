import { useCallback, useEffect, useRef, useState } from 'react';
import { Disclosure } from '../components/Disclosure';
import { HypothesisForm } from '../components/HypothesisForm';
import { Icon } from '../components/Icon';
import { Meter } from '../components/Meter';
import { Sheet } from '../components/Sheet';
import { Strandy } from '../components/Strandy';
import { StrandySays } from '../components/StrandySays';
import { FoldCanvas, RESIDUE_COLORS } from '../game/FoldCanvas';
import type { GameEvent, Residue, Snapshot } from '../game/types';
import { shareCard } from '../lib/shareCard';
import { useProgress } from '../state/progress';
import { activeWorld } from '../worlds';
import { debriefs, finale } from '../worlds/proteins/copy';

type Phase = 'intro' | 'play' | 'debrief' | 'finale';

const LEGEND: Record<Residue, string> = {
  '+': 'Positive charge',
  '-': 'Negative charge',
  H: 'Sticky (oily): clusters together',
  P: 'Neutral',
};

const EMPTY: Snapshot = { energy: 0, stability: 0, bonds: 0, matched: 0, misfolds: 0, goalMet: false, complete: false };

export function Play({ go }: { go: (tab: 'fieldwork' | 'community') => void }) {
  const levels = activeWorld.levels;
  const { progress, completeLevel, resetGame } = useProgress();
  const firstOpen = levels.findIndex((l) => !progress.levels[l.id]?.completed);
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [phase, setPhase] = useState<Phase>(firstOpen === -1 ? 'finale' : 'intro');
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [resetKey, setResetKey] = useState(0);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [tip, setTip] = useState<{ text: string; mood: 'open' | 'happy' | 'wide' } | null>(null);
  const [simplifiedOpen, setSimplifiedOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const startRef = useRef(performance.now());
  const bestRef = useRef(0);
  const seen = useRef(new Set<string>());
  const idleRef = useRef(0);

  const level = levels[index];
  const debrief = debriefs[level.id];

  const say = useCallback((key: string, text: string, mood: 'open' | 'happy' | 'wide' = 'open', once = true) => {
    if (once && seen.current.has(key)) return;
    seen.current.add(key);
    setTip({ text, mood });
  }, []);

  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 4200);
    return () => clearTimeout(t);
  }, [tip]);

  // nudge the player if nothing has bonded for a while
  useEffect(() => {
    if (phase !== 'play') return;
    const t = setInterval(() => {
      idleRef.current += 1;
      if (idleRef.current === 12) say(`idle-${level.id}`, 'Stuck? Tap the lightbulb and I’ll point at a promising pair.');
    }, 1000);
    return () => clearInterval(t);
  }, [phase, level.id, say]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      if (e.kind === 'bond') {
        idleRef.current = 0;
        say('bond', 'Snap! That’s a bond. Every bond makes the fold more stable.', 'happy');
      } else if (e.kind === 'repel') say('repel', 'Feel that shove? Like charges push each other away.', 'wide');
      else if (e.kind === 'misfold') say('misfold', 'That bond holds, but it isn’t one of the matching shapes. Pull it apart to free the chain.', 'wide');
      else if (e.kind === 'break') say('break', 'Bond broken. Sometimes you have to undo progress to find a better fold.');
      else if (e.kind === 'complete') {
        const seconds = Math.round((performance.now() - startRef.current) / 1000);
        completeLevel(level.id, { completed: true, bestStability: bestRef.current, seconds });
        setCelebrate(true);
        setTimeout(() => {
          setCelebrate(false);
          setPhase('debrief');
        }, 1700);
      }
    },
    [completeLevel, level.id, say],
  );

  const onSnapshot = useCallback((s: Snapshot) => {
    bestRef.current = Math.max(bestRef.current, s.stability);
    setSnap(s);
  }, []);

  const startLevel = (i: number) => {
    setIndex(i);
    setSnap(EMPTY);
    setHint(null);
    setTip(null);
    bestRef.current = 0;
    idleRef.current = 0;
    startRef.current = performance.now();
    setResetKey((k) => k + 1);
    setPhase('play');
  };

  const restart = () => {
    setResetKey((k) => k + 1);
    setHint(null);
    bestRef.current = 0;
    startRef.current = performance.now();
  };

  const next = () => {
    if (index < levels.length - 1) {
      setIndex(index + 1);
      setPhase('intro');
    } else setPhase('finale');
  };

  const types = [...new Set(level.chain)] as Residue[];
  const goalDetail = level.targetContacts ? `${snap.matched}/${level.targetContacts.length} pairs` : `${Math.min(snap.bonds, level.requiredBonds ?? 0)}/${level.requiredBonds} bonds`;

  return (
    <div className="screen play">
      <ol className="level-steps" aria-label="Levels">
        {levels.map((l, i) => (
          <li key={l.id} className={`${i === index && phase !== 'finale' ? 'is-current' : ''} ${progress.levels[l.id]?.completed ? 'is-done' : ''}`}>
            <span>{l.number}</span>
            <em>{l.title}</em>
          </li>
        ))}
      </ol>

      {phase === 'intro' && (
        <div className="level-intro">
          <p className="kicker">
            Level {level.number} of {levels.length}
          </p>
          <h1 className="display">{level.title}</h1>
          <p className="lede">{level.goal}</p>
          <ul className="legend">
            {types.map((t) => (
              <li key={t}>
                <span className={`legend__dot legend__dot--${t === '+' ? 'pos' : t === '-' ? 'neg' : t}`} style={{ background: RESIDUE_COLORS[t] }} aria-hidden>
                  {t === '+' ? '+' : t === '-' ? '−' : ''}
                </span>
                {LEGEND[t]}
              </li>
            ))}
            {level.obstacles && (
              <li>
                <span className="legend__dot legend__dot--obstacle" aria-hidden />
                Crowders: other molecules in the way
              </li>
            )}
            {level.targetContacts && (
              <li>
                <span className="legend__dot legend__dot--target" aria-hidden />
                Matching outline shapes must bond to each other
              </li>
            )}
          </ul>
          <StrandySays pose={level.number === 1 ? 'point' : 'think'} size={64}>
            {level.number === 1 && 'Drag any bead with your finger. The rest of the chain follows.'}
            {level.number === 2 && 'Same forces, less room. Find a way around.'}
            {level.number === 3 && 'This time the shape matters, not just the bond count.'}
          </StrandySays>
          <button className="btn btn--primary btn--lg btn--block" onClick={() => startLevel(index)}>
            Start level {level.number}
          </button>
        </div>
      )}

      {phase === 'play' && (
        <div className="game">
          <div className="game__hud">
            <p className="game__goal">{level.goal}</p>
            <div className="game__meters">
              <Meter label="Stability" value={snap.stability} tone={snap.goalMet ? 'amber' : 'green'} />
              <div className={`goal-chip ${snap.goalMet ? 'is-met' : ''}`} aria-live="polite">
                {goalDetail}
                {snap.misfolds > 0 && <span className="goal-chip__warn"> · {snap.misfolds} wrong</span>}
              </div>
            </div>
          </div>
          <div className="game__arena">
            <FoldCanvas level={level} resetKey={resetKey} hint={hint} onSnapshot={onSnapshot} onEvent={onEvent} />
            {snap.goalMet && !snap.complete && <div className="hold-steady">Hold steady…</div>}
            {celebrate && (
              <div className="celebrate" role="status">
                <Strandy pose="cheer" mood="happy" size={120} />
                <strong>Stable fold!</strong>
              </div>
            )}
            {tip && !celebrate && (
              <div className="game__tip" role="status">
                <StrandySays compact size={44} mood={tip.mood}>
                  {tip.text}
                </StrandySays>
              </div>
            )}
          </div>
          <div className="game__tools">
            <button className="tool" onClick={restart}>
              <Icon name="restart" />
              <span>Restart</span>
            </button>
            <button
              className="tool"
              onClick={() => {
                setHint([...level.hint] as [number, number]);
                setTimeout(() => setHint(null), 4000);
              }}
            >
              <Icon name="hint" />
              <span>Hint</span>
            </button>
            <button className="tool" onClick={() => setSimplifiedOpen(true)}>
              <Icon name="info" />
              <span>Simplified?</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'debrief' && (
        <article className="debrief">
          <div className="debrief__hero">
            <Strandy pose="cheer" mood="happy" size={110} />
            <div>
              <p className="kicker">Level {level.number} complete</p>
              <h1 className="display display--sm">{debrief.headline}</h1>
            </div>
          </div>
          <blockquote className="debrief__quote">{debrief.strandy}</blockquote>
          <dl className="debrief__rows">
            <div className="row row--game">
              <dt>What you did</dt>
              <dd>{debrief.inGame}</dd>
            </div>
            <div className="row row--research">
              <dt>In real research</dt>
              <dd>{debrief.inResearch}</dd>
            </div>
            <div className="row row--claude">
              <dt>How Claude can help</dt>
              <dd>{debrief.claudeHelps}</dd>
            </div>
          </dl>
          <Disclosure summary="Why does this matter?" tone="amber">
            <p>{debrief.whyItMatters}</p>
          </Disclosure>
          <Disclosure summary="What is simplified here?">
            <ul>
              {debrief.simplified.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Disclosure>
          <section className="debrief__hyp">
            <p className="kicker">Your hypothesis</p>
            <HypothesisForm levelId={level.id} prompt={debrief.hypothesis.prompt} options={debrief.hypothesis.options} />
          </section>
          <div className="debrief__actions">
            <button className="btn btn--primary btn--lg btn--block" onClick={next}>
              {index < levels.length - 1 ? `Next: Level ${index + 2}` : 'See your results'} <Icon name="arrow" size={20} />
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => startLevel(index)}>
              Replay this level
            </button>
          </div>
        </article>
      )}

      {phase === 'finale' && (
        <Finale
          onReplay={() => {
            resetGame();
            seen.current.clear();
            setIndex(0);
            setPhase('intro');
          }}
          go={go}
          results={levels.map((l) => ({ title: l.title, r: progress.levels[l.id] }))}
        />
      )}

      <Sheet open={simplifiedOpen} onClose={() => setSimplifiedOpen(false)} title="What is simplified here?">
        <ul className="plain-list">
          {debrief.simplified.map((s) => (
            <li key={s}>{s}</li>
          ))}
          <li>Strandy’s lines are written for this prototype. They are not live answers from Claude.</li>
        </ul>
      </Sheet>
    </div>
  );
}

function Finale({ onReplay, go, results }: { onReplay: () => void; go: (tab: 'fieldwork' | 'community') => void; results: { title: string; r?: { bestStability: number; seconds: number } }[] }) {
  const [shareState, setShareState] = useState('');
  const total = results.reduce((s, x) => s + (x.r?.seconds ?? 0), 0);
  const share = async () => {
    const res = await shareCard({
      title: 'I folded a protein. Sort of.',
      lines: results.map((x) => `✓ ${x.title}${x.r ? ` · ${Math.round(x.r.bestStability * 100)}% stable` : ''}`),
      footer: 'The Folding Problem · a Claude field expedition',
    });
    setShareState(res === 'shared' ? 'Shared.' : res === 'downloaded' ? 'Card saved. The text is copied too.' : res === 'copied' ? 'Copied as text.' : '');
  };
  return (
    <article className="finale">
      <div className="finale__burst" aria-hidden />
      <Strandy pose="cheer" mood="happy" size={170} />
      <p className="kicker">Episode 01 · complete</p>
      <h1 className="display">{finale.title}</h1>
      <p className="lede">{finale.body}</p>
      <ul className="finale__stats">
        {results.map((x) => (
          <li key={x.title}>
            <Icon name="check" size={18} />
            <span>{x.title}</span>
            <em>{x.r ? `${Math.round(x.r.bestStability * 100)}%` : '—'}</em>
          </li>
        ))}
        <li className="finale__time">
          <span>Total folding time</span>
          <em>{total}s</em>
        </li>
      </ul>
      <button className="btn btn--ghost btn--block" onClick={share}>
        <Icon name="share" size={20} /> Share your result card
      </button>
      {shareState && (
        <p className="fine" role="status">
          {shareState}
        </p>
      )}
      <div className="finale__next">
        <StrandySays pose="point" size={64}>
          The lab is closed, but the expedition isn’t. Real scientific curiosity starts outside.
        </StrandySays>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => go('fieldwork')}>
          Go outside the lab <Icon name="arrow" size={20} />
        </button>
        <button className="btn btn--ghost btn--block" onClick={() => go('community')}>
          See what others hypothesised
        </button>
        <button className="btn btn--text" onClick={onReplay}>
          <Icon name="restart" size={18} /> Replay all levels
        </button>
      </div>
    </article>
  );
}
