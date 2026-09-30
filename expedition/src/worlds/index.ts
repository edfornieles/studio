import type { LevelDef } from '../game/types';
import { proteinLevels } from './proteins/levels';

/**
 * Scientific worlds. Each one can bring its own story sections, games and quests.
 * Only proteins is playable in this prototype; the others are placeholders
 * so the structure (and the promise) is visible.
 */
export interface World {
  id: string;
  title: string;
  tagline: string;
  status: 'open' | 'soon';
  levels: LevelDef[];
  hue: string;
}

export const worlds: World[] = [
  { id: 'proteins', title: 'The Folding Problem', tagline: 'How a chain becomes a machine', status: 'open', levels: proteinLevels, hue: '#6fe3a1' },
  { id: 'mycelium', title: 'Underground Networks', tagline: 'How fungi share information', status: 'soon', levels: [], hue: '#e8c872' },
  { id: 'microbiome', title: 'The Invisible Garden', tagline: 'A trillion microbes in balance', status: 'soon', levels: [], hue: '#7cc6ff' },
  { id: 'reef', title: 'Reef Signals', tagline: 'Symbiosis under heat stress', status: 'soon', levels: [], hue: '#ff9f7a' },
];

export const activeWorld = worlds[0];
