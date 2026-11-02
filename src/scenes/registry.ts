import type { Scene } from '../core/engine';
/** Late-bound scene registry (avoids circular imports). */
export const Scenes: { title: Scene; intro: Scene; map: Scene; garage: Scene; play: Scene; results: Scene; ending: Scene } = {} as any;
