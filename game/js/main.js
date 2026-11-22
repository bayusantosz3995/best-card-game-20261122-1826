// Ember Duel — bootstrap and input.
// Wires clicks and keys to the engine, runs the AI's turn, and drives the
// screenshot setups (?shot=title|battle|win|loss&seed=N) the maker uses to
// photograph the game. The game is fully playable with mouse or keyboard.

import { Engine } from './engine.js';
import { runAiTurn } from './ai.js';
import { blip, renderAll, showEnd, showScreen } from './render.js';

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shot = params.get('shot') || null;

let engine = new Engine(seed);
let busy = false; // true while the AI is taking its turn

// Selection state the renderer reads.
const selectable = {
  selectedUid: null,
  selectedHand: null,
  targeting: false,
  targetUids: new Set(),
};

function refresh() {
  renderAll(engine, selectable);
}

function clearSelection() {
  selectable.selectedUid = null;
  selectable.selectedHand = null;
  selectable.targeting = false;
  selectable.targetUids = new Set();
}

function consumeEvents() {
  for (const event of engine.events.splice(0)) {
    if (event.type === 'attack') {
      const node = document.querySelector(`[data-uid="${event.from}"]`);
      if (node) {
        node.classList.add('lunging');
        setTimeout(() => node.classList.remove('lunging'), 350);
      }
      blip('hit');
    } else if (event.type === 'damage') {
      const node = event.target === 'hero'
        ? document.querySelector(event.owner === 'You' ? '#you-hero' : '#foe-hero')
        : document.querySelector(`[data-uid="${event.target}"]`);
      if (node) {
        node.classList.add('damaged');
        setTimeout(() => node.classList.remove('damaged'), 350);
      }
    } else if (event.type === 'gameover') {
      blip('win');
      setTimeout(() => showEnd(engine), 650);
    }
  }
}

async function maybeRunAi() {
  if (engine.phase !== 'play') return;
  if (engine.activePlayer() !== engine.foe) return;
  busy = true;
  refresh();
  await runAiTurn(engine, () => {
    consumeEvents();
    refresh();
  });
  consumeEvents();
  busy = false;
  refresh();
  if (engine.phase === 'over') showEnd(engine);
}

function onHandCard(index) {
  if (busy || engine.phase !== 'play') return;
  if (engine.activePlayer() !== engine.you) return;
  const card = engine.you.hand[index];
  if (!card) return;
  const check = engine.canPlayCard(engine.you, index);
  if (!check.ok) {
    $('hint').textContent = check.why === 'not enough embers'
      ? `Not enough embers — ${card.name} costs ${card.cost}.`
      : check.why === 'your side is full'
        ? 'Your side of the table is full.'
        : 'You cannot play that now.';
    return;
  }
  if (card.kind === 'spell' && card.damage) {
    // A damaging spell needs a target: enter targeting mode.
    selectable.selectedHand = index;
    selectable.targeting = true;
    selectable.targetUids = new Set(engine.foe.board.map((c) => c.uid));
    $('hint').textContent = 'Choose a target for Ember Burst.';
    refresh();
    return;
  }
  engine.playCard(engine.you, index, null);
  blip('play');
  clearSelection();
  consumeEvents();
  refresh();
  if (engine.phase === 'over') showEnd(engine);
}

function onBoardCard(uid, who) {
  if (busy || engine.phase !== 'play') return;
  if (engine.activePlayer() !== engine.you) return;
  const board = who === 'you' ? engine.you.board : engine.foe.board;
  const creature = board.find((c) => c.uid === uid);
  if (!creature) return;

  // Targeting a spell: pick the enemy creature (or hero, handled below).
  if (selectable.targeting && who === 'foe') {
    const index = selectable.selectedHand;
    engine.playCard(engine.you, index, creature);
    blip('play');
    clearSelection();
    consumeEvents();
    refresh();
    if (engine.phase === 'over') showEnd(engine);
    return;
  }

  if (who !== 'you') return;
  if (!creature.canAttack) {
    $('hint').textContent = creature.justPlayed && !creature.swift
      ? `${creature.name} is still catching its breath — it attacks next turn.`
      : `${creature.name} has already attacked.`;
    return;
  }
  // Select the attacker, then show valid targets (enemy creatures, or the
  // hero when no Guard stands in the way).
  selectable.selectedUid = uid;
  selectable.selectedHand = null;
  selectable.targeting = true;
  const guards = engine.foe.board.filter((c) => c.guard);
  selectable.targetUids = new Set((guards.length > 0 ? guards : engine.foe.board).map((c) => c.uid));
  $('hint').textContent = `Attack with ${creature.name} — pick a target.`;
  refresh();
}

function onHero(who) {
  if (busy || engine.phase !== 'play') return;
  if (engine.activePlayer() !== engine.you) return;
  if (selectable.targeting && who === 'foe') {
    if (selectable.selectedHand !== null) {
      const index = selectable.selectedHand;
      engine.playCard(engine.you, index, { kind: 'hero', owner: 'foe' });
      blip('play');
    } else if (selectable.selectedUid !== null) {
      const attacker = engine.you.board.find((c) => c.uid === selectable.selectedUid);
      const guards = engine.foe.board.filter((c) => c.guard);
      if (guards.length > 0) {
        $('hint').textContent = 'A Guard blocks the way — clear it first.';
        return;
      }
      if (attacker) engine.attack(attacker, { kind: 'hero', owner: 'foe' });
      blip('hit');
    }
    clearSelection();
    consumeEvents();
    refresh();
    if (engine.phase === 'over') showEnd(engine);
    return;
  }
  if (who === 'foe' && selectable.selectedUid !== null) {
    // Fallback: clicking the hero with an attacker selected attacks face.
    const attacker = engine.you.board.find((c) => c.uid === selectable.selectedUid);
    const guards = engine.foe.board.filter((c) => c.guard);
    if (attacker && guards.length === 0) {
      engine.attack(attacker, { kind: 'hero', owner: 'foe' });
      blip('hit');
      clearSelection();
      consumeEvents();
      refresh();
      if (engine.phase === 'over') showEnd(engine);
    }
  }
}

function onEndTurn() {
  if (busy || engine.phase !== 'play') return;
  if (engine.activePlayer() !== engine.you) return;
  clearSelection();
  engine.endTurn();
  consumeEvents();
  refresh();
  maybeRunAi();
}

function bind() {
  $('you-hand').addEventListener('click', (event) => {
    const node = event.target.closest('.card');
    if (!node) return;
    const index = engine.you.hand.findIndex((c) => c.uid === Number(node.dataset.uid));
    if (index >= 0) onHandCard(index);
  });
  $('you-board').addEventListener('click', (event) => {
    const node = event.target.closest('.card');
    if (node) onBoardCard(Number(node.dataset.uid), 'you');
  });
  $('foe-board').addEventListener('click', (event) => {
    const node = event.target.closest('.card');
    if (node) onBoardCard(Number(node.dataset.uid), 'foe');
  });
  $('foe-hero').addEventListener('click', () => onHero('foe'));
  $('you-hero').addEventListener('click', () => onHero('you'));
  $('end-turn').addEventListener('click', onEndTurn);
  $('play-button').addEventListener('click', () => {
    blip('play');
    engine.startGame();
    showScreen('table-screen');
    refresh();
  });
  $('again-button').addEventListener('click', () => {
    engine = new Engine(seed);
    engine.startGame();
    clearSelection();
    showScreen('table-screen');
    refresh();
  });
  $('title-howto').addEventListener('click', () => {
    $('howto').classList.toggle('hidden');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === ' ' && engine.phase === 'play') {
      event.preventDefault();
      onEndTurn();
    } else if (event.key === 'Escape') {
      clearSelection();
      refresh();
    } else if (/^[1-7]$/.test(event.key) && engine.phase === 'play') {
      onHandCard(Number(event.key) - 1);
    }
  });
  document.addEventListener('click', (event) => {
    // Clicking empty table space cancels a selection.
    if (event.target.id === 'table-screen' || event.target.id === 'mid-row') {
      clearSelection();
      refresh();
    }
  });
}

// Screenshot setups: deterministic states for the maker's photographs.
function applyShot() {
  if (!shot) return;
  if (shot === 'title') {
    showScreen('title-screen');
    return;
  }
  if (shot === 'battle') {
    engine = Engine.demoBattle(seed);
    showScreen('table-screen');
    refresh();
    return;
  }
  if (shot === 'win' || shot === 'loss') {
    engine = Engine.demoBattle(seed);
    engine.endGame(shot === 'win' ? 'you' : 'foe');
    showScreen('table-screen');
    refresh();
    showEnd(engine);
  }
}

bind();
applyShot();
if (!shot) showScreen('title-screen');
