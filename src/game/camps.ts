import type { Cost } from './upgrades';
import type { BiomeId } from './biomes';

export interface Request { text: string; give: Cost; reward: Cost; pop: number; }
export interface Camp { id: BiomeId; story: string[]; requests: Request[]; perk: { id: string; name: string; desc: string }; }

/**
 * Lightweight settlements: a leader with a running storyline (one line per mission
 * completed in the region), three supply requests, and a permanent perk once they're met.
 */
export const CAMPS: Record<BiomeId, Camp> = {
  city: {
    id: 'city',
    story: [
      'Jerry! That balloon of yours is held together with string and optimism. Let\'s fix that. Go clear the old supply drop.',
      'Scrap, Jerry. Scrap is what keeps Haven breathing. The rail yard\'s full of it — and full of flak guns.',
      'Folks are stuck on rooftops past the smokestacks. Every one you bring home is another pair of hands in my workshop.',
      'You flattened Big Bertha! Word\'s spreading. There\'s a caravan out in the Dustlands asking for "the balloon fella".',
    ],
    requests: [
      { text: 'Bolts for the water pump', give: { scrap: 10 }, reward: { fabric: 6 }, pop: 1 },
      { text: 'Canvas for a new roof', give: { fabric: 8, scrap: 6 }, reward: { electronics: 2 }, pop: 1 },
      { text: 'Rations for the winter store', give: { food: 3, water: 3 }, reward: { scrap: 20 }, pop: 2 },
    ],
    perk: { id: 'workshop', name: 'Gert\'s Workshop', desc: '+1 bomb capacity, always.' },
  },
  dust: {
    id: 'dust',
    story: [
      'You\'re the balloon fella? Good. We\'re stranded — no fuel, no shade, no patience. The buried stations still have drums.',
      'There\'s a whole town under that dune. People too. Scavs built a siren on top to keep them scared.',
      'Hear that grinding? That\'s the Dune Dredger. It eats caravans. Please don\'t let it eat ours.',
      'The Dredger\'s scrap now and the caravan moves again. The Ferry folk down by the Flood could use you next.',
    ],
    requests: [
      { text: 'Water for the camels (it\'s a long story)', give: { water: 3 }, reward: { fuel: 12 }, pop: 1 },
      { text: 'Patch the caravan awnings', give: { fabric: 8 }, reward: { scrap: 16 }, pop: 1 },
      { text: 'Spare parts for the lead truck', give: { scrap: 18, electronics: 1 }, reward: { fuel: 20 }, pop: 2 },
    ],
    perk: { id: 'fuelrich', name: 'Caravan Fuel Line', desc: 'Fuel cans refill 50% more.' },
  },
  flood: {
    id: 'flood',
    story: [
      'Ahoy, sky-sailor! The clinic rafts are out of medicine and the rooftops are islands now. Mind the water — it bites.',
      'Some scoundrel mined the ferry lanes. Six of the beggars. And two of my lot are hanging off driftwood.',
      'Old Salty\'s coming. Paddle-steamer, armour plating, an anchor like a falling house. I\'ve seen her sink three ferries.',
      'Salty\'s at the bottom where she belongs! There\'s a gardener up in the Green who keeps sending us seeds — go say hello.',
    ],
    requests: [
      { text: 'Sailcloth for the ferry', give: { fabric: 6 }, reward: { water: 4 }, pop: 1 },
      { text: 'Scrap for a new rudder', give: { scrap: 14 }, reward: { food: 3 }, pop: 1 },
      { text: 'Radios for the lighthouse', give: { electronics: 3 }, reward: { scrap: 24 }, pop: 2 },
    ],
    perk: { id: 'longrope', name: 'Ferryman\'s Line', desc: '+15% hook reach.' },
  },
  green: {
    id: 'green',
    story: [
      'Careful where you hover, dear — the plants up here have opinions. There\'s a seed vault on the botanical tower.',
      'The snappers have eaten my allotments and two of my gardeners are trapped. Bring the bombs, I won\'t look.',
      'That mower the Baron left out here? The vines crowned it king. It\'s been calling moths for weeks. Prune it.',
      'Lovely work. Dr. Frost at the research station up north radioed — something big is cracking the glacier.',
    ],
    requests: [
      { text: 'Water for the seedlings', give: { water: 4 }, reward: { food: 5 }, pop: 1 },
      { text: 'Scrap for greenhouse frames', give: { scrap: 16 }, reward: { fabric: 8 }, pop: 1 },
      { text: 'A pump controller', give: { electronics: 3, scrap: 8 }, reward: { food: 6, fabric: 6 }, pop: 2 },
    ],
    perk: { id: 'herbal', name: 'Herbal Poultice', desc: 'Slowly regrow a patch in flight (faster with a Patch Kit).' },
  },
  frozen: {
    id: 'frozen',
    story: [
      'Oh good, a pilot. My station is full of perfectly good electronics. Don\'t fly too high — ice is heavier than it looks.',
      'The scavengers put up jammers. My radios hear nothing but polka. Also Hollis is missing again.',
      'The Icebreaker is drilling for the Baron\'s fuel cache. If he gets it, he\'ll fire up the Forge. Stop it.',
      'Brilliant. The trail leads south to the Ashlands — the Scrap Baron\'s forge itself. This is the end of the line, Jerry.',
    ],
    requests: [
      { text: 'Soup. Lots of soup.', give: { food: 3 }, reward: { electronics: 3 }, pop: 1 },
      { text: 'Fuel for the generator', give: { fuel: 10 }, reward: { scrap: 18 }, pop: 1 },
      { text: 'Insulation for the lab', give: { fabric: 10, scrap: 10 }, reward: { electronics: 5 }, pop: 2 },
    ],
    perk: { id: 'lab', name: 'Lab-tuned Release', desc: 'Bombs re-arm 15% faster.' },
  },
  ash: {
    id: 'ash',
    story: [
      'I used to work for the Baron. Not proud of it. The lava fields are thick with his junk — take it, use it against him.',
      'The fuel dumps run the whole forge. Blow them and he\'s running on fumes. And free the mechanics — they\'re friends.',
      'The Iron Furnace. Four valves, a flaming ball and the Baron himself at the wheel. You\'ve come all this way, Jerry.',
      'The forge is cold. I never thought I\'d see the sky from here. Thank you, balloon man.',
    ],
    requests: [
      { text: 'Water to cool the forge', give: { water: 4 }, reward: { scrap: 20 }, pop: 1 },
      { text: 'Fabric for heat shields', give: { fabric: 10 }, reward: { electronics: 3 }, pop: 1 },
      { text: 'Rebuild the bellows', give: { scrap: 24, electronics: 2 }, reward: { fuel: 20, scrap: 10 }, pop: 2 },
    ],
    perk: { id: 'forge', name: 'Forge-tempered Shells', desc: '+15% blast radius.' },
  },
};
