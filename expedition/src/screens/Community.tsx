import { useMemo, useState } from 'react';
import { community, type Hypothesis, type VoteKind } from '../community';
import { HypothesisForm } from '../components/HypothesisForm';
import { Icon } from '../components/Icon';
import { SegTabs } from '../components/SegTabs';
import { Sheet } from '../components/Sheet';
import { Strandy } from '../components/Strandy';
import { StrandySays } from '../components/StrandySays';
import { labPuzzle } from '../content/communityLab';
import { timeAgo } from '../lib/image';
import { useAsync } from '../lib/useAsync';
import { useProgress } from '../state/progress';
import { activeWorld } from '../worlds';

type Tab = 'wall' | 'lab';

export function Community() {
  const [tab, setTab] = useState<Tab>('wall');
  return (
    <div className="screen community">
      <header className="chapter-head">
        <p className="kicker">Chapter 4 · Community</p>
        <h1 className="display">A distributed expedition</h1>
        <p className="lede">Science is a social process of sharing partial knowledge. Nobody sees the whole picture alone.</p>
      </header>
      <p className="proto-note">
        <Icon name="info" size={16} /> Prototype: entries here are examples plus your own, stored on this device.
      </p>
      <SegTabs
        label="Community sections"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'wall', label: 'Hypothesis wall' },
          { id: 'lab', label: 'Community Lab' },
        ]}
      />
      {tab === 'wall' ? <Wall /> : <Lab />}
    </div>
  );
}

type Sort = 'testable' | 'interesting' | 'new';

function Wall() {
  const hyps = useAsync(() => community.listHypotheses());
  const votes = useAsync(() => community.myVotes());
  const [level, setLevel] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('testable');
  const [composing, setComposing] = useState(false);
  const [composeLevel, setComposeLevel] = useState(activeWorld.levels[0].id);

  const shown = useMemo(() => {
    const list = (hyps.data ?? []).filter((h) => level === 'all' || h.levelId === level);
    return [...list].sort((a, b) => (sort === 'new' ? b.createdAt - a.createdAt : b.votes[sort] - a.votes[sort]));
  }, [hyps.data, level, sort]);

  const vote = async (h: Hypothesis, kind: VoteKind) => {
    await community.vote(h.id, kind);
    hyps.refresh();
    votes.refresh();
  };

  return (
    <div className="stack">
      <div className="wall-controls">
        <div className="chips chips--scroll" role="group" aria-label="Filter by level">
          <button className={`chip ${level === 'all' ? 'is-on' : ''}`} aria-pressed={level === 'all'} onClick={() => setLevel('all')}>
            All levels
          </button>
          {activeWorld.levels.map((l) => (
            <button key={l.id} className={`chip ${level === l.id ? 'is-on' : ''}`} aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
              L{l.number} · {l.title}
            </button>
          ))}
        </div>
        <label className="sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="testable">Most testable</option>
            <option value="interesting">Most interesting</option>
            <option value="new">Newest</option>
          </select>
        </label>
      </div>

      <button className="btn btn--primary btn--block" onClick={() => setComposing(true)}>
        <Icon name="plus" size={20} /> Post a hypothesis
      </button>

      {shown.length === 0 ? (
        <div className="empty">
          <Strandy pose="think" size={80} />
          <p>No hypotheses here yet. The first question is often the most useful.</p>
        </div>
      ) : (
        <ul className="hyps">
          {shown.map((h) => {
            const mine = votes.data?.[h.id] ?? [];
            const lvl = activeWorld.levels.find((l) => l.id === h.levelId);
            return (
              <li key={h.id} className={`hyp ${h.mine ? 'hyp--mine' : ''}`}>
                <div className="hyp__meta">
                  <span className="hyp__tag">L{lvl?.number} · {lvl?.title}</span>
                  <span>
                    {h.mine ? 'You' : h.author} · {timeAgo(h.createdAt)}
                  </span>
                </div>
                <p className="hyp__text">{h.text}</p>
                <div className="hyp__votes">
                  <button className={`vote ${mine.includes('interesting') ? 'is-on' : ''}`} aria-pressed={mine.includes('interesting')} onClick={() => vote(h, 'interesting')}>
                    Interesting <strong>{h.votes.interesting}</strong>
                  </button>
                  <button className={`vote vote--test ${mine.includes('testable') ? 'is-on' : ''}`} aria-pressed={mine.includes('testable')} onClick={() => vote(h, 'testable')}>
                    <Icon name="flask" size={16} /> Testable <strong>{h.votes.testable}</strong>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="fine">No follower counts and no leaderboards. The votes reward ideas that are curious or checkable, not people.</p>

      <Sheet open={composing} onClose={() => setComposing(false)} title="New hypothesis" tall>
        <label className="label" htmlFor="compose-level">
          About which level?
        </label>
        <select id="compose-level" className="input" value={composeLevel} onChange={(e) => setComposeLevel(e.target.value)}>
          {activeWorld.levels.map((l) => (
            <option key={l.id} value={l.id}>
              Level {l.number}: {l.title}
            </option>
          ))}
        </select>
        <HypothesisForm
          key={composeLevel}
          levelId={composeLevel}
          prompt="What would happen if we changed part of the chain?"
          options={[]}
          onPosted={() => {
            hyps.refresh();
            setTimeout(() => setComposing(false), 900);
          }}
        />
      </Sheet>
    </div>
  );
}

function Lab() {
  const { progress, update } = useProgress();
  const [revealed, setRevealed] = useState<string[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(60);
  const [submitted, setSubmitted] = useState(false);
  const allIn = revealed.length === labPuzzle.clues.length;
  const chosen = labPuzzle.variants.find((v) => v.id === pick);

  const submit = () => {
    setSubmitted(true);
    if (chosen?.correct) update({ labSolved: true });
  };

  return (
    <div className="stack lab">
      <article className="lab__brief">
        <p className="kicker">Case file · {labPuzzle.protein}</p>
        <p>{labPuzzle.brief}</p>
      </article>

      <ol className="clues">
        {labPuzzle.clues.map((c, i) => {
          const open = revealed.includes(c.id);
          return (
            <li key={c.id} className={`clue ${open ? 'is-open' : ''}`}>
              <div className="clue__who">
                <span className="clue__avatar" aria-hidden>
                  {String.fromCharCode(65 + i)}
                </span>
                <div>
                  <strong>{c.role}</strong>
                  <span>
                    {c.who} · {c.when}
                  </span>
                </div>
              </div>
              {open ? (
                <div className="clue__body">
                  <p className="clue__finding">{c.finding}</p>
                  <p>{c.detail}</p>
                </div>
              ) : (
                <button className="btn btn--ghost btn--block" onClick={() => setRevealed((r) => [...r, c.id])}>
                  Open their finding
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {!allIn && <p className="fine center">Open all three findings. No one of them is enough alone.</p>}

      {allIn && (
        <section className="lab__decide" aria-labelledby="h-decide">
          <h2 id="h-decide" className="section-title">
            Your call: which variant?
          </h2>
          <div className="variants" role="radiogroup" aria-label="Variants">
            {labPuzzle.variants.map((v) => (
              <button key={v.id} role="radio" aria-checked={pick === v.id} disabled={submitted} className={`variant ${pick === v.id ? 'is-on' : ''} ${submitted && v.correct && chosen?.correct ? 'is-right' : ''}`} onClick={() => setPick(v.id)}>
                <strong>{v.name}</strong>
                <span>{v.change}</span>
              </button>
            ))}
          </div>
          <label className="confidence">
            <span>
              How sure are you? <strong>{confidence}%</strong>
            </span>
            <input type="range" min={10} max={100} step={5} value={confidence} disabled={submitted} onChange={(e) => setConfidence(Number(e.target.value))} />
          </label>
          {!submitted ? (
            <button className="btn btn--primary btn--lg btn--block" disabled={!pick} onClick={submit}>
              Submit to the lab
            </button>
          ) : (
            chosen && (
              <div className={`verdict ${chosen.correct ? 'verdict--right' : ''}`} role="status">
                <StrandySays pose={chosen.correct ? 'cheer' : 'think'} mood={chosen.correct ? 'happy' : 'open'} size={60}>
                  {chosen.correct ? 'All three clues agree. Nice synthesis.' : 'Not quite. One clue rules this out.'}
                </StrandySays>
                <p>{chosen.feedback}</p>
                <p className="fine">
                  {chosen.correct && confidence >= 90
                    ? 'You were very confident. Good scientists stay open to a failed lab test, even here.'
                    : chosen.correct
                      ? `You were ${confidence}% sure. Reporting honest uncertainty is part of good science.`
                      : confidence >= 80
                        ? 'High confidence with a missing clue is a common trap. Worth noticing.'
                        : 'Your uncertainty was reasonable. Now you know which clue mattered.'}
                </p>
                <p className="lab__real">{labPuzzle.realWorld}</p>
                <button
                  className="btn btn--ghost btn--block"
                  onClick={() => {
                    setSubmitted(false);
                    setPick(null);
                  }}
                >
                  Try again
                </button>
              </div>
            )
          )}
          {progress.labSolved && !submitted && <p className="fine center">You’ve solved this case before.</p>}
        </section>
      )}
    </div>
  );
}
