import { useMemo, useState } from 'react';
import { community, type FieldNote, type NoteCategory } from '../community';
import { Disclosure } from '../components/Disclosure';
import { Icon } from '../components/Icon';
import { Meter } from '../components/Meter';
import { SegTabs } from '../components/SegTabs';
import { Sheet } from '../components/Sheet';
import { StrandySays } from '../components/StrandySays';
import { tensions, type Tension } from '../content/ethics';
import { featuredQuest, quests, type Quest } from '../content/quests';
import { downscaleImage, timeAgo } from '../lib/image';
import { useAsync } from '../lib/useAsync';
import { useProgress } from '../state/progress';

type Tab = 'quests' | 'notes' | 'questions';

export const CATEGORIES: { id: NoteCategory; label: string; hue: string }[] = [
  { id: 'pattern', label: 'Pattern', hue: '#5cc8ff' },
  { id: 'fold', label: 'Fold / twist', hue: '#ffb35c' },
  { id: 'adaptation', label: 'Adaptation', hue: '#6fe3a1' },
  { id: 'growth', label: 'Growth', hue: '#c9a7ff' },
  { id: 'material', label: 'Material', hue: '#ff8a5b' },
  { id: 'other', label: 'Other', hue: '#9fb0c3' },
];

export function Fieldwork() {
  const [tab, setTab] = useState<Tab>('quests');
  const [composer, setComposer] = useState<{ quest?: Quest } | null>(null);
  const notes = useAsync(() => community.listFieldNotes());
  const [version, setVersion] = useState(0);

  const saved = () => {
    notes.refresh();
    setVersion((v) => v + 1);
    setComposer(null);
    setTab('notes');
  };

  return (
    <div className="screen fieldwork">
      <header className="chapter-head">
        <p className="kicker">Chapter 3 · Outside the lab</p>
        <h1 className="display">The Fieldwork</h1>
        <p className="lede">Science doesn’t stop at the screen. Notice something, report back, and add to a shared expedition.</p>
      </header>

      <SegTabs
        label="Fieldwork sections"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'quests', label: 'Quests' },
          { id: 'notes', label: 'Field notes' },
          { id: 'questions', label: 'Dilemmas' },
        ]}
      />

      {tab === 'quests' && <Quests key={version} onReport={(q) => setComposer({ quest: q })} />}
      {tab === 'notes' && <Notes notes={notes.data ?? []} onAdd={() => setComposer({})} />}
      {tab === 'questions' && <Questions />}

      <Sheet open={!!composer} onClose={() => setComposer(null)} title={composer?.quest ? 'Report back' : 'New field note'} tall>
        {composer && <FieldNoteForm quest={composer.quest} onSaved={saved} />}
      </Sheet>
    </div>
  );
}

function QuestProgressMeter({ quest }: { quest: Quest }) {
  const { data } = useAsync(() => community.questProgress(quest.id, quest.goal, quest.seedCount), [quest.id]);
  if (!data) return <div className="meter-skeleton" />;
  return <Meter label="Community progress" value={data.count / data.goal} detail={`${data.count.toLocaleString()} / ${data.goal.toLocaleString()}${data.mineCount ? ` · ${data.mineCount} yours` : ''}`} tone="amber" />;
}

function Quests({ onReport }: { onReport: (q: Quest) => void }) {
  const featured = featuredQuest();
  const others = quests.filter((q) => q.id !== featured.id);
  return (
    <div className="stack">
      <article className="quest quest--featured">
        <p className="kicker">This week’s shared quest</p>
        <h2 className="quest__title">{featured.title}</h2>
        <p className="quest__objective">{featured.objective}</p>
        <QuestProgressMeter quest={featured} />
        <div className="quest__action">
          <strong>Try this</strong>
          <p>{featured.action}</p>
        </div>
        <Disclosure summary="Why is this science?" tone="amber">
          <p>{featured.why}</p>
        </Disclosure>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => onReport(featured)}>
          <Icon name="plus" size={20} /> Report back
        </button>
      </article>

      <StrandySays size={56} pose="think">
        No location tracking and no names. Just what you noticed.
      </StrandySays>

      <h2 className="section-title">Other open quests</h2>
      <ul className="quest-list">
        {others.map((q) => (
          <li key={q.id} className="quest">
            <h3 className="quest__title quest__title--sm">{q.title}</h3>
            <p className="quest__objective">{q.objective}</p>
            <QuestProgressMeter quest={q} />
            <Disclosure summary="Why and how">
              <p>{q.why}</p>
              <p>
                <strong>Try this:</strong> {q.action}
              </p>
            </Disclosure>
            <button className="btn btn--ghost btn--block" onClick={() => onReport(q)}>
              Report back
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FieldNoteForm({ quest, onSaved }: { quest?: Quest; onSaved: () => void }) {
  const [category, setCategory] = useState<NoteCategory>(quest?.id === 'patterns' ? 'pattern' : quest?.id === 'folds' ? 'fold' : quest?.id === 'adaptation' ? 'adaptation' : quest?.id === 'materials' ? 'material' : 'other');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { update } = useProgress();

  const onFile = async (f?: File) => {
    if (!f) return;
    setError('');
    try {
      setPhoto(await downscaleImage(f));
    } catch {
      setError('That photo couldn’t be read. Try another.');
    }
  };

  const save = async () => {
    setBusy(true);
    await community.addFieldNote({ category, text, photo, questId: quest?.id });
    update((p) => ({ fieldworkCount: p.fieldworkCount + 1 }));
    setBusy(false);
    onSaved();
  };

  return (
    <div className="note-form">
      {quest && (
        <div className="note-form__quest">
          <p className="kicker">{quest.title}</p>
          <p>{quest.reportPrompt}</p>
        </div>
      )}
      <fieldset>
        <legend className="label">Category</legend>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`chip ${category === c.id ? 'is-on' : ''}`} style={{ ['--hue' as string]: c.hue }} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="label" htmlFor="note-text">
        Your observation
      </label>
      <textarea id="note-text" className="input" rows={4} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you see? What do you think is going on?" />
      <p className="fine">{400 - text.length} characters left. Please don’t include names or exact locations.</p>

      {(quest?.acceptsPhoto ?? true) && (
        <div className="photo-pick">
          {photo ? (
            <div className="photo-pick__preview">
              <img src={photo} alt="Your photo" />
              <button className="btn btn--text" onClick={() => setPhoto(undefined)}>
                Remove photo
              </button>
            </div>
          ) : (
            <label className="btn btn--ghost btn--block photo-pick__btn">
              <Icon name="camera" size={20} /> Add a photo (optional)
              <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <p className="fine">Photos are shrunk and kept on this device only. Photo metadata such as GPS is stripped.</p>
        </div>
      )}
      <button className="btn btn--primary btn--lg btn--block" disabled={!text.trim() || busy} onClick={save}>
        Add to the archive
      </button>
    </div>
  );
}

function Notes({ notes, onAdd }: { notes: FieldNote[]; onAdd: () => void }) {
  const [open, setOpen] = useState<FieldNote | null>(null);
  const [filter, setFilter] = useState<NoteCategory | 'all'>('all');
  const shown = filter === 'all' ? notes : notes.filter((n) => n.category === filter);
  const mine = notes.filter((n) => n.mine).length;

  // place notes in a constellation: one cluster per category, deterministic jitter
  const layout = useMemo(() => {
    const centers: Record<NoteCategory, [number, number]> = {
      pattern: [80, 70], fold: [250, 60], adaptation: [170, 150], growth: [70, 230], material: [270, 220], other: [175, 280],
    };
    const count: Record<string, number> = {};
    return notes.map((n) => {
      const k = (count[n.category] = (count[n.category] ?? 0) + 1);
      const a = k * 2.4;
      const r = 12 + k * 7;
      const [cx, cy] = centers[n.category];
      return { n, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8 };
    });
  }, [notes]);

  return (
    <div className="stack">
      <button className="btn btn--primary btn--lg btn--block" onClick={onAdd}>
        <Icon name="plus" size={20} /> Add a field note
      </button>

      <section className="archive-map" aria-labelledby="h-archive">
        <div className="archive-map__head">
          <h2 id="h-archive" className="section-title">
            The expedition archive
          </h2>
          <span className="fine">{notes.length} notes{mine ? ` · ${mine} yours` : ''}</span>
        </div>
        <svg viewBox="0 0 340 320" className="constellation">
          {CATEGORIES.map((c) => {
            const pts = layout.filter((l) => l.n.category === c.id);
            return pts.slice(1).map((p, i) => <line key={`${c.id}${i}`} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} stroke={c.hue} strokeOpacity={0.25} />);
          })}
          {layout.map(({ n, x, y }) => {
            const hue = CATEGORIES.find((c) => c.id === n.category)!.hue;
            return (
              <g key={n.id} className={`star ${n.mine ? 'is-mine' : ''}`} onClick={() => setOpen(n)} role="button" tabIndex={0} aria-label={`${n.category} note: ${n.text}`} onKeyDown={(e) => e.key === 'Enter' && setOpen(n)}>
                <circle cx={x} cy={y} r={16} fill="transparent" />
                <circle cx={x} cy={y} r={n.mine ? 7 : 4.5} fill={n.mine ? '#ffc46b' : hue} />
                {n.mine && <circle cx={x} cy={y} r={12} fill="none" stroke="#ffc46b" strokeOpacity={0.6} className="star__ring" />}
              </g>
            );
          })}
          {CATEGORIES.map((c) => {
            const pts = layout.filter((l) => l.n.category === c.id);
            if (!pts.length) return null;
            return (
              <text key={c.id} x={pts[0].x} y={pts[0].y - 22} className="constellation__label" fill={c.hue} textAnchor="middle">
                {c.label.toUpperCase()}
              </text>
            );
          })}
        </svg>
        <p className="fine">Each point is one observation. Yours glow amber. A future version could show the whole community.</p>
      </section>

      <div className="chips chips--scroll" role="group" aria-label="Filter notes">
        <button className={`chip ${filter === 'all' ? 'is-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`chip ${filter === c.id ? 'is-on' : ''}`} style={{ ['--hue' as string]: c.hue }} aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>No notes in this category yet. Be the first to spot one.</p>
        </div>
      ) : (
        <ul className="notes">
          {shown.map((n) => (
            <li key={n.id} className={`note ${n.mine ? 'note--mine' : ''}`}>
              <button onClick={() => setOpen(n)}>
                {n.photo && <img src={n.photo} alt="" />}
                <span className="note__cat" style={{ color: CATEGORIES.find((c) => c.id === n.category)!.hue }}>
                  {CATEGORIES.find((c) => c.id === n.category)!.label}
                </span>
                <span className="note__text">{n.text}</span>
                <span className="note__meta">
                  {n.mine ? 'You' : n.author} · {timeAgo(n.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title="Field note">
        {open && (
          <div className="note-detail">
            {open.photo && <img src={open.photo} alt="Observation" />}
            <p className="note-detail__text">{open.text}</p>
            <p className="fine">
              {open.mine ? 'You' : open.author} · {timeAgo(open.createdAt)}
              {open.questId ? ` · quest: ${quests.find((q) => q.id === open.questId)?.title}` : ''}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Questions() {
  return (
    <div className="stack">
      <StrandySays size={56} pose="think">
        These can’t be solved by optimisation. There are several defensible answers. I’ll show you the strongest challenge to yours.
      </StrandySays>
      {tensions.map((t) => (
        <TensionCard key={t.id} t={t} />
      ))}
    </div>
  );
}

function TensionCard({ t }: { t: Tension }) {
  const stance = useAsync(() => community.myStance(t.id), [t.id]);
  const tallies = useAsync(() => community.stanceTallies(t.id, t.seedTallies), [t.id]);
  const chosen = stance.data;
  const total = Object.values(tallies.data ?? t.seedTallies).reduce((a, b) => a + b, 0);

  const choose = async (id: string) => {
    await community.recordStance(t.id, id);
    stance.refresh();
    tallies.refresh();
  };

  return (
    <article className="tension">
      <h3 className="tension__q">{t.question}</h3>
      <p className="tension__ctx">{t.context}</p>
      <div className="tension__options" role="group" aria-label={t.question}>
        {t.positions.map((p) => {
          const n = tallies.data?.[p.id] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <button key={p.id} className={`tension__opt ${chosen === p.id ? 'is-on' : ''}`} aria-pressed={chosen === p.id} onClick={() => choose(p.id)}>
              {chosen && <span className="tension__bar" style={{ width: `${pct}%` }} aria-hidden />}
              <span className="tension__label">{p.label}</span>
              {chosen && <span className="tension__pct">{pct}%</span>}
            </button>
          );
        })}
      </div>
      {chosen && (
        <div className="tension__consider" role="status">
          <strong>Consider:</strong> {t.positions.find((p) => p.id === chosen)?.consider}
          <span className="fine">You can change your mind. That’s allowed in science.</span>
        </div>
      )}
    </article>
  );
}
