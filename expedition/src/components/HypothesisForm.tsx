import { useState } from 'react';
import { community } from '../community';
import { useProgress } from '../state/progress';

/** Pick a suggested hypothesis or write your own; it goes to the community wall. */
export function HypothesisForm({ levelId, prompt, options, onPosted }: { levelId: string; prompt: string; options: string[]; onPosted?: () => void }) {
  const [choice, setChoice] = useState<number | 'own' | null>(options.length ? null : 'own');
  const [own, setOwn] = useState('');
  const [posted, setPosted] = useState(false);
  const { update } = useProgress();
  const text = choice === 'own' ? own.trim() : choice !== null ? options[choice] : '';

  const submit = async () => {
    if (!text) return;
    await community.addHypothesis(levelId, text);
    update((p) => ({ hypothesisCount: p.hypothesisCount + 1 }));
    setPosted(true);
    onPosted?.();
  };

  if (posted)
    return (
      <div className="hyp-posted" role="status">
        <strong>Posted to the hypothesis wall.</strong>
        <span>Others can mark it interesting or testable. That’s how ideas get sharper.</span>
      </div>
    );

  return (
    <fieldset className="hyp-form">
      <legend>{prompt}</legend>
      {options.map((o, i) => (
        <label key={i} className={`choice ${choice === i ? 'is-on' : ''}`}>
          <input type="radio" name={`hyp-${levelId}`} checked={choice === i} onChange={() => setChoice(i)} />
          <span>{o}</span>
        </label>
      ))}
      {options.length > 0 && (
        <label className={`choice ${choice === 'own' ? 'is-on' : ''}`}>
          <input type="radio" name={`hyp-${levelId}`} checked={choice === 'own'} onChange={() => setChoice('own')} />
          <span>My own idea…</span>
        </label>
      )}
      {choice === 'own' && (
        <textarea
          className="input"
          rows={3}
          maxLength={280}
          placeholder="If we changed…, I predict… because…"
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          aria-label="Your hypothesis"
          autoFocus={options.length > 0}
        />
      )}
      <button className="btn btn--primary btn--block" disabled={!text} onClick={submit}>
        Share hypothesis
      </button>
      <p className="fine">Anonymous. No account, no name.</p>
    </fieldset>
  );
}
