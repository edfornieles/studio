/** Stroke icons (no icon font, no emoji). */
const PATHS: Record<string, string> = {
  explore: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
  play: 'M5 12c2-5 5-5 7 0s5 5 7 0M5 12a2 2 0 1 1-.01 0M19 12a2 2 0 1 1-.01 0M12 12a2 2 0 1 1-.01 0',
  fieldwork: 'M4 20c3-8 9-13 16-15-1 7-5 13-13 14M8 16l5-5',
  community: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5',
  restart: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9v.01',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M5 12h.01M12 12h.01M19 12h.01',
  share: 'M12 15V3m0 0-4 4m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  check: 'M5 12.5 10 17l9-10',
  flask: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
  plus: 'M12 5v14M5 12h14',
  lock: 'M6 11h12v10H6V11Zm2 0V8a4 4 0 1 1 8 0v3',
};

export function Icon({ name, size = 22, label }: { name: keyof typeof PATHS | string; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={PATHS[name]} />
    </svg>
  );
}
