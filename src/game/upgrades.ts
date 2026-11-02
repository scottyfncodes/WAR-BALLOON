export type ResKey = 'fuel' | 'scrap' | 'fabric' | 'food' | 'water' | 'electronics';
export const RES_KEYS: ResKey[] = ['scrap', 'fabric', 'fuel', 'food', 'water', 'electronics'];
export type Cost = Partial<Record<ResKey, number>>;
export type Category = 'balloon' | 'propulsion' | 'retrieval' | 'defense' | 'firepower';
export const CATEGORIES: { id: Category; name: string; blurb: string }[] = [
  { id: 'balloon', name: 'Balloon', blurb: 'Envelope, lift & handling' },
  { id: 'propulsion', name: 'Propulsion', blurb: 'Burners, props & boost' },
  { id: 'retrieval', name: 'Retrieval', blurb: 'Hook, winch & cargo' },
  { id: 'defense', name: 'Defense', blurb: 'Basket & survival' },
  { id: 'firepower', name: 'Firepower', blurb: 'Bombs, bombs, bombs' },
];

export interface UpgradeDef { id: string; cat: Category; name: string; desc: string[]; costs: Cost[]; requires?: string; }

/** Each entry in desc/costs is one level. */
export const UPGRADES: UpgradeDef[] = [
  // BALLOON
  { id: 'envelope', cat: 'balloon', name: 'Reinforced Envelope', desc: ['+1 max patch (health). Stitched leather straps.', '+1 more patch. Full rope netting.'], costs: [{ fabric: 6, scrap: 8 }, { fabric: 14, scrap: 20 }] },
  { id: 'lift', cat: 'balloon', name: 'Bigger Bag', desc: ['Larger envelope: faster climb, carries heavier cargo.', 'Even bigger! Shrugs off heavy loads.'], costs: [{ fabric: 8, scrap: 6 }, { fabric: 18, scrap: 16 }] },
  { id: 'fins', cat: 'balloon', name: 'Tail Fins', desc: ['Fabric fins: wind gusts push you 50% less, steadier turns.'], costs: [{ fabric: 6, scrap: 10 }] },
  { id: 'heater', cat: 'balloon', name: 'Envelope Heater', desc: ['Warm coils in the bag: no icing at high altitude in the Frozen Reach.'], costs: [{ scrap: 20, electronics: 4, fabric: 8 }] },
  { id: 'buoy', cat: 'balloon', name: 'Emergency Buoyancy', desc: ['Once per sortie, survive a fatal hit: a reserve bladder pops and you bounce skyward.'], costs: [{ fabric: 10, scrap: 12, electronics: 2 }] },
  // PROPULSION
  { id: 'burner', cat: 'propulsion', name: 'Improved Burner', desc: ['Hotter flame: stronger lift, faster ignition.', 'Twin burners! Big lift, 25% less fuel burn.', 'Triple-jet burner. Roars like a lion.'], costs: [{ scrap: 10, fuel: 6 }, { scrap: 22, fuel: 12 }, { scrap: 40, fuel: 20, electronics: 3 }] },
  { id: 'prop', cat: 'propulsion', name: 'Propeller', desc: ['Pedal prop on the basket: faster horizontal flight.', 'Motor prop: much faster cruising.'], costs: [{ scrap: 12 }, { scrap: 26, electronics: 2 }] },
  { id: 'boost', cat: 'propulsion', name: 'Afterburner', desc: ['Unlock BOOST: a burst of speed (uses fuel).', 'Faster recharge, cheaper fuel cost.'], costs: [{ scrap: 14, fuel: 10 }, { scrap: 24, fuel: 16, electronics: 2 }] },
  { id: 'tank', cat: 'propulsion', name: 'Fuel Tank', desc: ['+35% fuel capacity. Strapped-on jerry can.', '+70% fuel capacity total. Proper tank.'], costs: [{ scrap: 8, fuel: 6 }, { scrap: 18, fuel: 14 }] },
  // RETRIEVAL
  { id: 'rope', cat: 'retrieval', name: 'Longer Rope', desc: ['+40% hook reach.', '+80% hook reach total.'], costs: [{ fabric: 4, scrap: 6 }, { fabric: 10, scrap: 14 }] },
  { id: 'winch', cat: 'retrieval', name: 'Faster Winch', desc: ['Hook drops & reels 40% faster.', 'Geared winch: 80% faster, heavy loads too.'], costs: [{ scrap: 10 }, { scrap: 22, electronics: 1 }] },
  { id: 'magnet', cat: 'retrieval', name: 'Magnet Hook', desc: ['Electro-magnet tugs nearby loot onto the hook. Hook hits hurt more.'], costs: [{ scrap: 18, electronics: 3 }] },
  { id: 'net', cat: 'retrieval', name: 'Cargo Net', desc: ['Hook can carry 2 items at once.', 'Carry 3 items at once.'], costs: [{ fabric: 8, scrap: 8 }, { fabric: 16, scrap: 18 }] },
  // DEFENSE
  { id: 'plating', cat: 'defense', name: 'Basket Plating', desc: ['Riveted plates: 25% chance to deflect a hit.', 'Full armor: 45% deflect chance.'], costs: [{ scrap: 16 }, { scrap: 34, electronics: 2 }] },
  { id: 'bucket', cat: 'defense', name: 'Fire Bucket', desc: ['Immune to soot plumes & sparks only sting briefly. Shorter invulnerability gaps.'], costs: [{ scrap: 8, water: 4 }] },
  { id: 'pontoons', cat: 'defense', name: 'Pontoons', desc: ['Floats under the basket: land on water safely, no soaking in the Flood.'], costs: [{ scrap: 16, fabric: 10, water: 2 }] },
  { id: 'patchkit', cat: 'defense', name: 'Patch Kit', desc: ['Slowly self-repair 1 patch every 30s in flight.'], costs: [{ fabric: 12, scrap: 10, food: 2 }] },
  // FIREPOWER
  { id: 'rack', cat: 'firepower', name: 'Bomb Rack', desc: ['+2 bomb capacity.', '+4 bomb capacity total.'], costs: [{ scrap: 8 }, { scrap: 20 }] },
  { id: 'reload', cat: 'firepower', name: 'Quick Release', desc: ['Bombs re-arm 35% faster.', 'Bombs re-arm 65% faster.'], costs: [{ scrap: 10 }, { scrap: 22, electronics: 1 }] },
  { id: 'blast', cat: 'firepower', name: 'Bigger Boom', desc: ['+30% blast radius & a meatier KA-BOOM.', '+60% blast radius.'], costs: [{ scrap: 12, fuel: 4 }, { scrap: 26, fuel: 8 }] },
  { id: 'cluster', cat: 'firepower', name: 'Cluster Bombs', desc: ['Every bomb splits into 3 bomblets just before impact.'], costs: [{ scrap: 30, electronics: 4 }], requires: 'rack' },
];

export const upgradeById = (id: string) => UPGRADES.find((u) => u.id === id)!;

export interface Stats {
  maxHp: number; liftMul: number; cargoTolerance: number; windMul: number; buoy: boolean;
  burnerPower: number; burnerEfficiency: number; burners: number; propSpeed: number; boost: number; fuelCap: number;
  ropeLen: number; winchSpeed: number; magnet: boolean; cargoCap: number;
  deflect: number; bucket: boolean; patchKit: boolean; pontoons: boolean; heater: boolean;
  bombCap: number; reloadTime: number; blastMul: number; cluster: boolean;
  envelopeScale: number;
}

export function computeStats(levels: Record<string, number>): Stats {
  const L = (id: string) => levels[id] ?? 0;
  return {
    maxHp: 3 + L('envelope'),
    liftMul: 1 + 0.18 * L('lift'),
    cargoTolerance: L('lift'),
    windMul: L('fins') ? 0.5 : 1,
    buoy: L('buoy') > 0,
    burnerPower: 1 + 0.2 * L('burner'),
    burnerEfficiency: L('burner') >= 2 ? 0.75 : 1,
    burners: 1 + Math.max(0, L('burner') - 1),
    propSpeed: 1 + 0.22 * L('prop'),
    boost: L('boost'),
    fuelCap: 100 * (1 + 0.35 * L('tank')),
    ropeLen: 150 * (1 + 0.4 * L('rope')),
    winchSpeed: 1 + 0.4 * L('winch'),
    magnet: L('magnet') > 0,
    cargoCap: 1 + L('net'),
    deflect: [0, 0.25, 0.45][L('plating')],
    bucket: L('bucket') > 0,
    patchKit: L('patchkit') > 0,
    pontoons: L('pontoons') > 0,
    heater: L('heater') > 0,
    bombCap: 3 + 2 * L('rack'),
    reloadTime: 2.6 * [1, 0.65, 0.35][L('reload')],
    blastMul: 1 + 0.3 * L('blast'),
    cluster: L('cluster') > 0,
    envelopeScale: 1 + 0.08 * L('lift'),
  };
}
