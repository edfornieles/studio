import { LocalCommunityRepository } from './localRepository';
import type { CommunityRepository } from './types';

/** Swap this for an API-backed repository when a backend exists. */
export const community: CommunityRepository = new LocalCommunityRepository();
export * from './types';
