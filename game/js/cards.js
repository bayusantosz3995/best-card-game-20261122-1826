// Ember Duel — card definitions.
// Every card in the game lives here: creatures and spells, their costs,
// stats, elements and keywords. Nothing is copied from any other game;
// names, art glyphs and numbers are original to Ember Duel.

// The four elements, in a cycle: Ember beats Grove, Grove beats Stone,
// Stone beats Tide, Tide beats Ember. An attacker whose element beats the
// defender's gains +2 attack for that combat.
export const ELEMENTS = {
  ember: { name: 'Ember', color: '#e8491d', dark: '#8f2a0c', glyph: '▲', beats: 'grove' },
  tide: { name: 'Tide', color: '#1d7fd6', dark: '#0d4d86', glyph: '●', beats: 'ember' },
  grove: { name: 'Grove', color: '#3da33d', dark: '#1d5c1d', glyph: '◆', beats: 'stone' },
  stone: { name: 'Stone', color: '#8a8f98', dark: '#4a4e55', glyph: '■', beats: 'tide' },
};

export const ELEMENT_ORDER = ['ember', 'tide', 'grove', 'stone'];

// Creature and spell blueprints. id is stable; art is a drawn glyph + hue,
// so every card is readable by colour AND shape, never by text alone.
export const CARD_POOL = [
  { id: 'pup', kind: 'creature', name: 'Cinder Pup', cost: 1, atk: 2, hp: 1, element: 'ember', text: 'Swift', swift: true },
  { id: 'sprite', kind: 'creature', name: 'Tide Sprite', cost: 1, atk: 1, hp: 2, element: 'tide', text: '' },
  { id: 'sprout', kind: 'creature', name: 'Grove Sprout', cost: 1, atk: 1, hp: 3, element: 'grove', text: '' },
  { id: 'pebble', kind: 'creature', name: 'Pebble Guard', cost: 2, atk: 1, hp: 4, element: 'stone', text: 'Guard', guard: true },
  { id: 'imp', kind: 'creature', name: 'Flame Imp', cost: 2, atk: 3, hp: 2, element: 'ember', text: '' },
  { id: 'archer', kind: 'creature', name: 'Coral Archer', cost: 2, atk: 2, hp: 3, element: 'tide', text: '' },
  { id: 'wolf', kind: 'creature', name: 'Thorn Wolf', cost: 3, atk: 4, hp: 3, element: 'grove', text: '' },
  { id: 'golem', kind: 'creature', name: 'Ash Golem', cost: 3, atk: 2, hp: 6, element: 'stone', text: 'Guard', guard: true },
  { id: 'heron', kind: 'creature', name: 'Storm Heron', cost: 3, atk: 3, hp: 4, element: 'tide', text: 'Swift', swift: true },
  { id: 'drake', kind: 'creature', name: 'Wildfire Drake', cost: 4, atk: 5, hp: 4, element: 'ember', text: '' },
  { id: 'leviathan', kind: 'creature', name: 'Deep Leviathan', cost: 5, atk: 6, hp: 6, element: 'tide', text: '' },
  { id: 'treant', kind: 'creature', name: 'Elder Treant', cost: 5, atk: 4, hp: 8, element: 'grove', text: 'Guard', guard: true },
  { id: 'colossus', kind: 'creature', name: 'Magma Colossus', cost: 6, atk: 7, hp: 7, element: 'stone', text: '' },
  { id: 'phoenix', kind: 'creature', name: 'Sun Phoenix', cost: 6, atk: 6, hp: 5, element: 'ember', text: 'Drain', drain: true },
  { id: 'burst', kind: 'spell', name: 'Ember Burst', cost: 2, element: 'ember', text: 'Deal 3 damage to any target', damage: 3 },
  { id: 'mend', kind: 'spell', name: 'Mend', cost: 2, element: 'grove', text: 'Restore 6 life to your hero', heal: 6 },
  { id: 'surge', kind: 'spell', name: 'Surge', cost: 2, element: 'tide', text: 'Draw 2 cards', draw: 2 },
];

export function cardById(id) {
  return CARD_POOL.find((c) => c.id === id);
}

// A small seeded RNG (mulberry32) so screenshot setups are reproducible:
// the same seed always deals the same hands.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(array, rng) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Build a 34-card deck: two copies of every card in the pool.
export function buildDeck(rng) {
  const ids = [];
  for (const card of CARD_POOL) ids.push(card.id, card.id);
  return shuffle(ids, rng);
}

// Element advantage: does attacker's element beat defender's?
export function elementBeats(attackerElement, defenderElement) {
  return ELEMENTS[attackerElement].beats === defenderElement;
}
