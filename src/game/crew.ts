import { P } from '../render/palette';
import { RNG } from '../core/math';
import type { CharLook } from '../render/characters';

export type Role = 'mechanic' | 'gunner' | 'medic' | 'scavenger' | 'lookout' | 'engineer' | 'cook';
export type Rarity = 'common' | 'rare' | 'legendary';
export const ROLES: Role[] = ['mechanic', 'gunner', 'medic', 'scavenger', 'lookout', 'engineer', 'cook'];

export interface RoleInfo { name: string; color: string; icon: string; blurb: string; perLevel: string; }
export const ROLE_INFO: Record<Role, RoleInfo> = {
  mechanic: { name: 'Mechanic', color: P.brass, icon: 'wrench', blurb: 'Patches the envelope mid-flight (up to 80%).', perLevel: 'repairs faster' },
  gunner: { name: 'Gunner', color: P.red, icon: 'gun', blurb: 'Shoots hangers & leapers. Mans the mounted gun.', perLevel: 'shoots faster' },
  medic: { name: 'Medic', color: P.redBright, icon: 'cross', blurb: 'Heals Jerry & crew in the air. Prevents injuries.', perLevel: 'heals faster' },
  scavenger: { name: 'Scavenger', color: P.olive, icon: 'sack', blurb: 'More loot from every pickup. Faster winch.', perLevel: '+loot' },
  lookout: { name: 'Lookout', color: P.teal, icon: 'spyglass', blurb: 'Spots survivors, caches & leapers from afar.', perLevel: 'sees further' },
  engineer: { name: 'Engineer', color: P.orange, icon: 'gear', blurb: 'Tunes the burner: less fuel, more lift.', perLevel: 'more efficient' },
  cook: { name: 'Cook', color: P.goldDark, icon: 'ladle', blurb: 'Feeds the crew: half food cost, +1 HP for all.', perLevel: 'more XP for all' },
};

export interface CrewMember {
  id: string; name: string; role: Role; rarity: Rarity; trait: string; look: CharLook;
  xp: number; level: number; injured: number; trips: number; kills: number; saves: number;
  special?: string; bio: string; from: string;
}

export const XP_LEVELS = [0, 25, 70, 140, 240];
export const MAX_LEVEL = 5;
export function levelFor(xp: number) { let l = 1; for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) l = i + 1; return l; }
/** 1 at level 1, +25% per level after. */
export const roleMul = (c: CrewMember) => 1 + 0.25 * (c.level - 1);

export const SPECIALS: Record<string, { name: string; desc: string }> = {
  boomstick: { name: 'Boomstick', desc: 'Double-barrel: every shot knocks TWO hangers off.' },
  strongman: { name: 'Ex-Circus Strongman', desc: 'Hurls boarders overboard with his bare hands.' },
  wrench: { name: 'Miracle Wrench', desc: 'Repairs twice as fast. Patches the basket too.' },
  revive: { name: 'Smelling Salts', desc: 'Wakes knocked-out crew right back up.' },
  hawkeye: { name: 'Hawkeye', desc: 'Reveals everything on the map. Rare finds +50%.' },
  magpie: { name: 'Magpie', desc: 'Double rare tech from every pickup.' },
  professor: { name: 'Boffin', desc: 'Envelope wizardry: +25% lift on top of everything.' },
  chef: { name: 'Five-Star Chef', desc: 'Crew eat free, and everyone gets +1 HP more.' },
};

interface Legend { name: string; role: Role; rarity: Rarity; special: string; trait: string; bio: string; look: CharLook; }
/** Hand-made rare survivors that turn up now and again in deeper regions. */
export const LEGENDS: Legend[] = [
  { name: 'Sgt. Rosa "Boomstick" Vega', role: 'gunner', rarity: 'legendary', special: 'boomstick', trait: 'Fearless', bio: 'Last of the quarantine garrison. Talks to her shotgun.', look: { skin: '#c8906a', coat: '#5c6a4e', hair: P.ink, hat: 'helmet', glasses: 'shades' } },
  { name: 'Big Lou Marconi', role: 'gunner', rarity: 'rare', special: 'strongman', trait: 'Gentle Giant', bio: 'Bent iron bars for the Marconi Circus. Now bends zombies.', look: { skin: P.skin, coat: '#b8433a', hair: P.ink, hat: 'none', beard: true } },
  { name: 'Wrench Wanda', role: 'mechanic', rarity: 'rare', special: 'wrench', trait: 'Grumpy', bio: 'Rebuilt a tractor from spoons once. Hates small talk.', look: { skin: '#a8724a', coat: P.olive, hair: '#dfe0e0', hat: 'bandana', glasses: 'goggles' } },
  { name: 'Doc Hollis', role: 'medic', rarity: 'rare', special: 'revive', trait: 'Calm', bio: 'Forty years a country vet. "People are just tall dogs."', look: { skin: '#f2d4c0', coat: P.white, hair: '#9a9a9a', hat: 'none', glasses: 'round', beard: true } },
  { name: 'Hawkeye Hank', role: 'lookout', rarity: 'rare', special: 'hawkeye', trait: 'Chatty', bio: 'Birdwatcher. Has named 300 crows and every zombie he sees.', look: { skin: P.skin, coat: '#5a7a4a', hair: '#8a6a50', hat: 'cap', glasses: 'round' } },
  { name: 'Magpie', role: 'scavenger', rarity: 'rare', special: 'magpie', trait: 'Sneaky', bio: 'Found a working radio in a dumpster in a horde. Grins a lot.', look: { skin: '#e8b890', coat: P.purple, hair: P.ink, hat: 'hood' } },
  { name: 'Professor Pip', role: 'engineer', rarity: 'legendary', special: 'professor', trait: 'Absent-minded', bio: 'Invented a better balloon in 1971. Nobody listened. Until now.', look: { skin: P.skin, coat: '#7a6a5a', hair: '#f0f0f0', hat: 'none', glasses: 'goggles' } },
  { name: 'Chef Bastien', role: 'cook', rarity: 'legendary', special: 'chef', trait: 'Dramatic', bio: 'Ran the finest bistro in the Metropolis. Still won\'t serve ketchup.', look: { skin: '#f2d4c0', coat: P.white, hair: P.ink, hat: 'chef' } },
];

const FIRST = ['Marta', 'Dewey', 'Priya', 'Otis', 'June', 'Rafael', 'Bea', 'Hector', 'Lena', 'Tomas', 'Ada', 'Moses', 'Ivy', 'Kenji', 'Rosa', 'Abe', 'Nell', 'Felix', 'Zora', 'Gus', 'Mabel', 'Winston', 'Imani', 'Cecil', 'Dot', 'Yusuf', 'Lottie', 'Bram', 'Suki', 'Earl', 'Fern', 'Arlo', 'Tess', 'Omar', 'Pearl', 'Vito'];
const LAST = ['Pickens', 'Okafor', 'Malone', 'Brisket', 'Nakamura', 'Duffy', 'Vargas', 'Pemberton', 'Kowalski', 'Achebe', 'Finch', 'Lindqvist', 'Moreau', 'Haddad', 'Quill', 'Rooney', 'Sato', 'Bellweather', 'Mbeki', 'Tuttle'];
const TRAITS = ['Brave', 'Nervous', 'Cheerful', 'Grumpy', 'Chatty', 'Stubborn', 'Optimist', 'Dramatic', 'Quiet', 'Lucky', 'Clumsy', 'Hopeful'];
const JOBS: Record<Role, string[]> = {
  mechanic: ['Used to fix ice-cream vans.', 'Can hear a loose bolt from 50 paces.', 'Has duct-taped a whole car together.'],
  gunner: ['Carnival shooting-gallery champion.', 'Ex-park ranger. Never misses.', 'Hunted pigeons for dinner all winter.'],
  medic: ['School nurse. Very strict about hand-washing.', 'Paramedic who hasn\'t slept since the outbreak.', 'Read every medical book in the library.'],
  scavenger: ['Looted the mall seven times and lived.', 'Can smell canned peaches through concrete.', 'Pockets full of "useful junk".'],
  lookout: ['Lighthouse keeper. Eagle eyes.', 'Spent the outbreak on a rooftop with binoculars.', 'Counts zombies to fall asleep.'],
  engineer: ['Built a windmill out of shopping trolleys.', 'Ex-boiler inspector. Loves a good flame.', 'Fixes things by glaring at them.'],
  cook: ['Diner cook. Makes soup from anything.', 'Grandma\'s recipes, memorised.', 'Once fed forty people with one turnip.'],
};
const SKINS = ['#f2c49b', '#e8b890', '#d8a070', '#c8906a', '#a8724a', '#8a5a3a', '#f2d4c0', '#6e4a30'];
const COATS = [P.teal, P.olive, P.purple, P.red, '#2f5f8a', '#a8744a', P.orange, '#5a7a4a', '#7a5a76', P.tealDark, '#8a6a50'];
const HAIRS = [P.ink, P.brownDark, P.gold, '#dfe0e0', P.red, '#8a6a50', '#5a3a2a'];
const HATS: CharLook['hat'][] = ['none', 'none', 'cap', 'beanie', 'bandana', 'scarf', 'bun', 'straw', 'hood', 'sailor'];
const ROLE_HAT: Partial<Record<Role, CharLook['hat']>> = { cook: 'chef', gunner: 'helmet', mechanic: 'bandana', lookout: 'cap' };

let seq = 0;
export function newId() { return 'c' + Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

/** Generate a fresh survivor. Deeper regions roll rarer, better survivors. */
export function makeSurvivor(rng: RNG, danger: number, taken: string[] = [], from = ''): CrewMember {
  const legendChance = 0.04 + danger * 0.035;
  if (danger >= 2 && rng.chance(legendChance)) {
    const left = LEGENDS.filter((l) => !taken.includes(l.name) && (l.rarity === 'rare' || danger >= 4));
    if (left.length) {
      const L = rng.pick(left);
      return { id: newId(), name: L.name, role: L.role, rarity: L.rarity, trait: L.trait, look: L.look, xp: 0, level: 1, injured: 0, trips: 0, kills: 0, saves: 0, special: L.special, bio: L.bio, from };
    }
  }
  const role = rng.pick(ROLES);
  let name = '';
  for (let i = 0; i < 10; i++) { name = rng.pick(FIRST) + ' ' + rng.pick(LAST); if (!taken.includes(name)) break; }
  const hat = rng.chance(0.4) ? (ROLE_HAT[role] ?? rng.pick(HATS)) : rng.pick(HATS);
  const look: CharLook = { skin: rng.pick(SKINS), coat: rng.pick(COATS), hair: rng.pick(HAIRS), hat, glasses: rng.chance(0.25) ? rng.pick(['round', 'shades', 'goggles'] as const) : undefined, beard: rng.chance(0.2), flower: rng.chance(0.15) };
  const start = Math.min(3, 1 + Math.floor(rng.next() * danger * 0.45));
  return { id: newId(), name, role, rarity: 'common', trait: rng.pick(TRAITS), look, xp: XP_LEVELS[start - 1], level: start, injured: 0, trips: 0, kills: 0, saves: 0, bio: rng.pick(JOBS[role]), from };
}

/** What each crew member shouts when rescued / leveled. */
export const RESCUE_LINES = ['Oh thank goodness!', 'Took you long enough!', 'A BALLOON?!', 'I owe you one, mister!', 'Is there room for my cat? No? OK.', 'Get me OUT of here!', 'I can help! I swear!', 'You\'re real!'];
export const GRAB_LINES = ['GET OFF!', 'SHOO!', 'NOT TODAY!', 'BACK DOWN!', 'OFF MY BALLOON!', 'HANG ON!'];
