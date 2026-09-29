import { useEffect, useRef } from 'react';
import { ExploreVisualView } from '../components/ExploreVisuals';
import { Icon } from '../components/Icon';
import { StrandySays } from '../components/StrandySays';
import { useProgress } from '../state/progress';
import { worlds } from '../worlds';
import { exploreSections, honestyTable } from '../worlds/proteins/explore';

export function Explore({ go }: { go: (tab: 'play') => void }) {
  const { progress, update } = useProgress();
  const endRef = useRef<HTMLDivElement>(null);

  // reveal sections as they scroll in, and mark the chapter done at the end
  useEffect(() => {
    const els = document.querySelectorAll('.story__section');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-in')),
      { threshold: 0.2 },
    );
    els.forEach((el) => io.observe(el));
    const endIo = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !progress.exploreDone) update({ exploreDone: true });
    });
    if (endRef.current) endIo.observe(endRef.current);
    return () => {
      io.disconnect();
      endIo.disconnect();
    };
  }, [progress.exploreDone, update]);

  return (
    <div className="screen story">
      <header className="chapter-head">
        <p className="kicker">Chapter 1 · Explore</p>
        <h1 className="display">The hidden world of proteins</h1>
        <p className="lede">Six short stops. Tap and drag everything.</p>
      </header>

      {exploreSections.map((s) => (
        <section key={s.id} className="story__section" aria-labelledby={`h-${s.id}`}>
          <p className="kicker">{s.kicker}</p>
          <h2 id={`h-${s.id}`} className="story__title">
            {s.title}
          </h2>
          <ExploreVisualView kind={s.visual} />
          <p className="story__body">{s.body}</p>
          {s.strandy && (
            <StrandySays compact size={52}>
              {s.strandy}
            </StrandySays>
          )}
        </section>
      ))}

      <section className="story__section honesty" aria-labelledby="h-honesty">
        <p className="kicker">Keeping it honest</p>
        <h2 id="h-honesty" className="story__title">
          Three different things
        </h2>
        <ul className="honesty__list">
          {honestyTable.map((row, i) => (
            <li key={row.label} className={`honesty__row honesty__row--${i}`}>
              <strong>{row.label}</strong>
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <div ref={endRef} className="story__cta">
        <StrandySays pose="point" mood="happy" size={72}>
          Enough watching. Your turn to fold one.
        </StrandySays>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => go('play')}>
          Start the folding game <Icon name="arrow" size={20} />
        </button>
      </div>

      <section className="next-worlds" aria-labelledby="h-next">
        <p className="kicker" id="h-next">
          Further expeditions
        </p>
        <ul>
          {worlds
            .filter((w) => w.status === 'soon')
            .map((w) => (
              <li key={w.id} style={{ ['--hue' as string]: w.hue }}>
                <Icon name="lock" size={18} />
                <div>
                  <strong>{w.title}</strong>
                  <span>{w.tagline}</span>
                </div>
                <em>Coming later</em>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
