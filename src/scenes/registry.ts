import type { Scene } from '../core/engine';
/** Late-bound scene registry (avoids circular imports). */
export const Scenes: { title: Scene; intro: Scene; haven: Scene; workshop: Scene; crew: Scene; play: Scene; report: Scene; ending: Scene } = {} as any;
