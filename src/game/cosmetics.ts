import { P } from '../render/palette';
import type { Cost } from './resources';

/** Customisation: makes the balloon feel like home. Every owned decoration adds COMFORT,
 *  and comfort makes the crew learn faster (+6% XP each, up to +60%). */
export type DecorSlot = 'paint' | 'material' | 'flag' | 'lights' | 'furniture';
export interface Decor { id: string; slot: DecorSlot; name: string; desc: string; cost: Cost; color?: string; color2?: string; }

export const DECOR: Decor[] = [
  // envelope paint jobs (ids match PAINTS in balloonArt)
  { id: 'classic', slot: 'paint', name: 'Old Faithful', desc: 'Orange stripes. Where it all began.', cost: {} },
  { id: 'teal', slot: 'paint', name: 'Teal Diamond', desc: 'Smart diamonds for a smart pilot.', cost: { fabric: 6 } },
  { id: 'sunset', slot: 'paint', name: 'Sunset Checks', desc: 'Loud enough to wake the dead. Literally.', cost: { fabric: 8 } },
  { id: 'storm', slot: 'paint', name: 'Storm Crown', desc: 'Purple & gold. Very regal.', cost: { fabric: 12, parts: 1 } },
  { id: 'sea', slot: 'paint', name: 'Sea Stripe', desc: 'Navy & white, like a seaside deckchair.', cost: { fabric: 10 } },
  { id: 'ivy', slot: 'paint', name: 'Ivy League', desc: 'Olive diamonds, for the discerning survivor.', cost: { fabric: 10 } },
  { id: 'ember', slot: 'paint', name: 'Ember King', desc: 'Black and flame. Zombies hate it.', cost: { fabric: 16, tech: 1 } },
  // basket materials
  { id: 'wicker', slot: 'material', name: 'Wicker', desc: 'Classic woven basket.', cost: {}, color: P.brownLight, color2: P.brown },
  { id: 'timber', slot: 'material', name: 'Painted Timber', desc: 'Planks painted barn red.', cost: { scrap: 10 }, color: '#a8463a', color2: '#7a2e26' },
  { id: 'teak', slot: 'material', name: 'Ship\'s Teak', desc: 'Varnished like a yacht.', cost: { scrap: 14, parts: 1 }, color: '#b8783a', color2: '#7a4a1e' },
  { id: 'brass', slot: 'material', name: 'Brass & Rivets', desc: 'Polished brass. Very steampunk.', cost: { scrap: 20, parts: 3 }, color: P.brass, color2: P.brassDark },
  // flags
  { id: 'noflag', slot: 'flag', name: 'No Flag', desc: '', cost: {} },
  { id: 'jolly', slot: 'flag', name: 'Jolly Jerry', desc: 'A skull wearing goggles.', cost: { fabric: 4 }, color: P.ink, color2: P.parchment },
  { id: 'haven', slot: 'flag', name: 'Haven Colours', desc: 'Teal and gold, home sweet home.', cost: { fabric: 4 }, color: P.teal, color2: P.gold },
  { id: 'hope', slot: 'flag', name: 'Banner of Hope', desc: 'A big red banner: "STILL FLYING".', cost: { fabric: 8, scrap: 4 }, color: P.red, color2: P.parchment },
  // lights
  { id: 'nolights', slot: 'lights', name: 'No Lights', desc: '', cost: {} },
  { id: 'lanterns', slot: 'lights', name: 'Paper Lanterns', desc: 'Warm lanterns strung along the rigging.', cost: { fabric: 6, fuel: 2 } },
  { id: 'bulbs', slot: 'lights', name: 'Carnival Bulbs', desc: 'Twinkling fairground lights.', cost: { scrap: 8, tech: 1 } },
  // furniture (needs a bigger basket)
  { id: 'nofurn', slot: 'furniture', name: 'Bare Deck', desc: '', cost: {} },
  { id: 'plant', slot: 'furniture', name: 'Potted Fern', desc: 'Something green that isn\'t a zombie.', cost: { food: 2 } },
  { id: 'chair', slot: 'furniture', name: 'Comfy Armchair', desc: 'Jerry\'s reading chair. Very worn.', cost: { fabric: 8, scrap: 6 } },
  { id: 'gramophone', slot: 'furniture', name: 'Gramophone', desc: 'Plays one song. Everyone loves it.', cost: { scrap: 12, parts: 2 } },
];
export const decorById = (id: string) => DECOR.find((d) => d.id === id);
export const DECOR_SLOTS: { id: DecorSlot; name: string }[] = [
  { id: 'paint', name: 'Paint' }, { id: 'material', name: 'Basket' }, { id: 'flag', name: 'Flag' }, { id: 'lights', name: 'Lights' }, { id: 'furniture', name: 'Furniture' },
];

/** Rare trophies found on expeditions. They hang off the basket and count as comfort too. */
export interface Trophy { id: string; name: string; desc: string; region: number; }
export const TROPHIES: Trophy[] = [
  { id: 'gnome', name: 'Garden Gnome', desc: 'Survived the apocalypse with a smile.', region: 0 },
  { id: 'teddy', name: 'Lost Teddy', desc: 'One ear. Very brave.', region: 0 },
  { id: 'sheriff', name: 'Sheriff\'s Star', desc: 'Dustbowl Town\'s last lawman.', region: 1 },
  { id: 'horseshoe', name: 'Lucky Horseshoe', desc: 'Nailed to the basket for luck.', region: 1 },
  { id: 'cone', name: 'Traffic Cone', desc: 'Stolen off a brute\'s head.', region: 2 },
  { id: 'hardhat', name: 'Foreman\'s Hard Hat', desc: 'Safety first.', region: 2 },
  { id: 'key', name: 'Key to the City', desc: 'Opens nothing now. Still shiny.', region: 3 },
  { id: 'disco', name: 'Disco Ball', desc: 'From the penthouse club. Still spins.', region: 3 },
  { id: 'medal', name: 'Medal of Valour', desc: 'Left on the last checkpoint.', region: 4 },
  { id: 'dogtags', name: 'Dog Tags', desc: 'We remember them.', region: 4 },
  { id: 'vial', name: 'Glowing Vial', desc: 'Patient Zero\'s lab. Please don\'t drink it.', region: 5 },
  { id: 'crown', name: 'Rotten Crown', desc: 'Worn by the biggest brute in the Dead Zone.', region: 5 },
];
export const trophyById = (id: string) => TROPHIES.find((t) => t.id === id);
