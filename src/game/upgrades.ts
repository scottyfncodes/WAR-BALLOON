import type { Cost } from './resources';
export type { ResKey, Cost } from './resources';
export { RES_KEYS } from './resources';

export type Category = 'envelope' | 'burner' | 'basket' | 'defense' | 'weapons' | 'utility';
export const CATEGORIES: { id: Category; name: string; blurb: string }[] = [
  { id: 'envelope', name: 'Envelope', blurb: 'Size, lift & toughness of the bag' },
  { id: 'burner', name: 'Burner', blurb: 'Climb, fuel & emergency boost' },
  { id: 'basket', name: 'Basket', blurb: 'Seats, decks & storage' },
  { id: 'defense', name: 'Defense', blurb: 'Keep the dead OFF the basket' },
  { id: 'weapons', name: 'Weapons', blurb: 'Bombs, fire & guns' },
  { id: 'utility', name: 'Utility', blurb: 'Fuel, hook, ladder & spyglass' },
];

export interface UpgradeDef { id: string; cat: Category; name: string; names?: string[]; desc: string[]; costs: Cost[]; requires?: [string, number]; region?: number; }

/** Every level changes how the balloon LOOKS and what it can DO. desc/costs: one entry per level. */
export const UPGRADES: UpgradeDef[] = [
  // ENVELOPE
  { id: 'envelope', cat: 'envelope', name: 'Envelope', names: ['Sturdy Envelope', 'Big Top', 'Grand Envelope', 'Titan Envelope'],
    desc: ['A proper new bag: +20% lift, +3 envelope HP. Visibly bigger.', 'Circus-sized: +40% lift total, +6 HP. Carries a real crew.', 'Grand: +65% lift, +10 HP. Shrugs off a few hangers.', 'Titan: +95% lift, +15 HP. Lifts a flying fortress.'],
    costs: [{ fabric: 10, scrap: 10 }, { fabric: 22, scrap: 20, parts: 4 }, { fabric: 40, scrap: 35, parts: 10 }, { fabric: 70, scrap: 60, parts: 18, tech: 6 }] },
  { id: 'skin', cat: 'envelope', name: 'Rip-stop Lining', names: ['Leather Straps', 'Steel Netting'],
    desc: ['Leather straps: spit & rubble do 25% less envelope damage.', 'Full steel netting: 45% less envelope damage.'],
    costs: [{ fabric: 12, scrap: 10 }, { fabric: 25, scrap: 25, parts: 8 }], region: 2 },
  // BURNER
  { id: 'burner', cat: 'burner', name: 'Burner', names: ['Hot Burner', 'Twin Burners', 'Triple Jet'],
    desc: ['Hotter flame: climb 25% faster.', 'Twin burners: climb 50% faster. Out-climb grabbing hands.', 'Triple-jet: climb 80% faster. Roars like a lion.'],
    costs: [{ scrap: 12, fuel: 6 }, { scrap: 25, fuel: 12, parts: 5 }, { scrap: 45, fuel: 20, parts: 10, tech: 3 }] },
  { id: 'regulator', cat: 'burner', name: 'Fuel Regulator', desc: ['Burner uses 20% less fuel.', 'Burner uses 40% less fuel.'], costs: [{ scrap: 10, parts: 3 }, { scrap: 22, parts: 8, tech: 1 }] },
  { id: 'boost', cat: 'burner', name: 'Emergency Afterburner', desc: ['Unlock BOOST: a rocket surge straight up that shakes hangers loose.', 'Recharges twice as fast and rips hangers clean off.'], costs: [{ scrap: 18, fuel: 12, parts: 3 }, { scrap: 30, fuel: 18, parts: 8, tech: 2 }] },
  { id: 'prop', cat: 'burner', name: 'Propeller', desc: ['Pedal prop: 25% faster cruising.', 'Motor prop: 50% faster cruising.'], costs: [{ scrap: 14 }, { scrap: 28, parts: 6 }] },
  // BASKET
  { id: 'basket', cat: 'basket', name: 'Basket', names: ['Family Basket', 'Outrigger Platforms', 'Two-Deck Gondola', 'Flying Fortress'],
    desc: ['Wider basket: room for 2 crew. Needed for Smokestack Row.', 'Side platforms with railings: 4 crew. Needed for Downtown.', 'A gondola with crew quarters below: 6 crew. Needed for the Quarantine Zone.', 'A full flying fortress with a cabin: 8 crew. Needed for the Dead Zone.'],
    costs: [{ scrap: 14, fabric: 4 }, { scrap: 30, fabric: 10, parts: 5 }, { scrap: 55, fabric: 18, parts: 12, tech: 2 }, { scrap: 90, fabric: 30, parts: 22, tech: 6 }] },
  { id: 'floor', cat: 'basket', name: 'Reinforced Floor', desc: ['Hold more weight: cargo & hangers slow you 25% less.', 'Steel deck: 45% less, and boarders do less damage.'], costs: [{ scrap: 12, parts: 2 }, { scrap: 26, parts: 7 }] },
  { id: 'storage', cat: 'basket', name: 'Cargo Hold', desc: ['Crates on the side: hook carries 2 things at once.', 'Full cargo net: hook carries 3 things at once.'], costs: [{ scrap: 10, fabric: 6 }, { scrap: 22, fabric: 12, parts: 4 }] },
  // DEFENSE
  { id: 'plating', cat: 'defense', name: 'Basket Plating', desc: ['Riveted plates: zombies take 40% longer to climb aboard.', 'Full armour: 80% longer, brutes do half damage.'], costs: [{ scrap: 18, parts: 2 }, { scrap: 36, parts: 8 }] },
  { id: 'spikes', cat: 'defense', name: 'Anti-Boarding Spikes', desc: ['Spikes round the rim: hangers lose grip on their own and get hurt.'], costs: [{ scrap: 20, parts: 4 }] },
  { id: 'shaker', cat: 'defense', name: 'Shock Absorbers', desc: ['SHAKE harder and recharge faster.', 'SHAKE flings even brutes off.'], costs: [{ scrap: 12, parts: 2 }, { scrap: 26, parts: 6 }] },
  { id: 'tesla', cat: 'defense', name: 'Shock Rail', desc: ['Every SHAKE also electrocutes everything clinging to the basket. BZZT!'], costs: [{ scrap: 25, parts: 6, tech: 4 }], region: 2 },
  // WEAPONS
  { id: 'bombs', cat: 'weapons', name: 'Bomb Rack', desc: ['+2 bombs, faster re-arm.', '+4 bombs, much faster re-arm.'], costs: [{ scrap: 10 }, { scrap: 24, parts: 4 }] },
  { id: 'firebomb', cat: 'weapons', name: 'Firebombs', desc: ['Molotovs: leave a pool of fire that burns whole crowds.', 'More firebombs, longer fires.'], costs: [{ scrap: 14, fuel: 10 }, { scrap: 26, fuel: 18, parts: 4 }] },
  { id: 'mines', cat: 'weapons', name: 'Sticky Mines', desc: ['Drop mines on rooftops; they blow when the dead come close.'], costs: [{ scrap: 22, parts: 6 }], region: 1 },
  { id: 'gun', cat: 'weapons', name: 'Mounted Gun', names: ['Rim Gun', 'Rapid Gun', 'Twin Guns'], desc: ['Auto-gun on the rim: shoots hangers & leapers. A GUNNER makes it deadly.', 'Faster fire, longer range.', 'Twin guns, one each side.'], costs: [{ scrap: 24, parts: 5 }, { scrap: 40, parts: 10, tech: 2 }, { scrap: 60, parts: 16, tech: 5 }], region: 1 },
  { id: 'flamer', cat: 'weapons', name: 'Flamethrower', desc: ['FLAME: roast everything hanging off the basket and below it.', 'Shorter cooldown, bigger fireball.'], costs: [{ scrap: 26, fuel: 16, parts: 6 }, { scrap: 40, fuel: 24, parts: 12, tech: 3 }], region: 2 },
  { id: 'turret', cat: 'weapons', name: 'Auto-Turret', desc: ['A belly turret that guards the underside by itself.'], costs: [{ scrap: 50, parts: 14, tech: 8 }], requires: ['gun', 2], region: 3 },
  // UTILITY
  { id: 'tank', cat: 'utility', name: 'Fuel Tanks', desc: ['+40% fuel.', '+80% fuel.', '+120% fuel. Fly to the far edge and back.'], costs: [{ scrap: 10, fuel: 6 }, { scrap: 22, fuel: 14, parts: 3 }, { scrap: 40, fuel: 24, parts: 8 }] },
  { id: 'ladder', cat: 'utility', name: 'Rescue Ladder', desc: ['Longer ladder: rescue survivors from higher up (safer!) and faster.', 'Winch ladder: rescue from way up high in a flash.'], costs: [{ fabric: 8, scrap: 8 }, { fabric: 16, scrap: 18, parts: 4 }] },
  { id: 'hook', cat: 'utility', name: 'Grapple & Winch', desc: ['+50% hook reach, faster winch.', '+100% reach, magnet tugs loot in.'], costs: [{ scrap: 10, fabric: 4 }, { scrap: 22, parts: 5 }] },
  { id: 'spyglass', cat: 'utility', name: 'Spyglass & Charts', desc: ['See survivors and caches on the map from further away.', 'Reveal every survivor and rare find on the map.'], costs: [{ scrap: 10, parts: 2 }, { scrap: 20, parts: 5, tech: 2 }] },
];
export const upgradeById = (id: string) => UPGRADES.find((u) => u.id === id)!;
export const upgradeName = (u: UpgradeDef, lv: number) => (u.names && lv > 0 ? u.names[Math.min(lv, u.names.length) - 1] : u.name);

export interface Stats {
  tier: number; seats: number; envLevel: number;
  liftMul: number; baseWeight: number; envHp: number; envResist: number; hp: number;
  burnerPower: number; burners: number; fuelUse: number; boost: number; propSpeed: number; fuelCap: number;
  loadTol: number; floor: number; cargoCap: number;
  plating: number; spikes: boolean; shakePower: number; shakeCd: number; tesla: boolean;
  bombCap: number; bombReload: number; fireCap: number; mineCap: number; gun: number; flamer: number; turret: boolean; blastMul: number;
  ropeLen: number; winch: number; magnet: boolean; ladder: number; radar: number;
}

export function computeStats(levels: Record<string, number>): Stats {
  const L = (id: string) => levels[id] ?? 0;
  const tier = L('basket');
  return {
    tier, seats: [1, 2, 4, 6, 8][tier], envLevel: L('envelope'),
    liftMul: [1, 1.2, 1.4, 1.65, 1.95][L('envelope')], baseWeight: [1, 1.08, 1.2, 1.34, 1.5][tier],
    envHp: 8 + [0, 3, 6, 10, 15][L('envelope')], envResist: [0, 0.25, 0.45][L('skin')], hp: 3,
    burnerPower: [1, 1.25, 1.5, 1.8][L('burner')], burners: [1, 1, 2, 3][L('burner')], fuelUse: [1, 0.8, 0.6][L('regulator')],
    boost: L('boost'), propSpeed: [1, 1.25, 1.5][L('prop')], fuelCap: 120 * [1, 1.4, 1.8, 2.25][L('tank')],
    loadTol: [0, 0.25, 0.45][L('floor')], floor: L('floor'), cargoCap: 1 + L('storage'),
    plating: L('plating'), spikes: L('spikes') > 0, shakePower: [100, 150, 230][L('shaker')], shakeCd: [1.4, 1.0, 0.75][L('shaker')], tesla: L('tesla') > 0,
    bombCap: 3 + 2 * L('bombs'), bombReload: [2.4, 1.7, 1.1][L('bombs')], fireCap: [0, 2, 4][L('firebomb')], mineCap: L('mines') ? 3 : 0,
    gun: L('gun'), flamer: L('flamer'), turret: L('turret') > 0, blastMul: 1,
    ropeLen: 150 * [1, 1.5, 2][L('hook')], winch: [1, 1.4, 1.8][L('hook')], magnet: L('hook') >= 2,
    ladder: L('ladder'), radar: L('spyglass'),
  };
}
