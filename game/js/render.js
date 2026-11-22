// Ember Duel — renderer: turns engine state into DOM.
// Cards are DOM elements with big readable values; suits are told apart by
// colour AND shape (each element has its own glyph). Animations are CSS
// classes: summon slides a card in, attack lunges, damage flashes.

import { ELEMENTS } from './cards.js';

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function makeCardElement(card) {
  // Note: no position class on the card itself — the container's .hand /
  // .board-row classes style it, so a card never inherits a container rule.
  const node = el('div', `card ${card.element}`);
  node.dataset.uid = card.uid;
  node.appendChild(el('div', 'cost', String(card.cost)));
  node.appendChild(el('div', 'elem', ELEMENTS[card.element].glyph));
  const art = el('div', 'art');
  art.appendChild(el('span', 'glyph', ELEMENTS[card.element].glyph));
  node.appendChild(art);
  node.appendChild(el('div', 'name', card.name));
  if (card.text) node.appendChild(el('div', 'keyword', card.text));
  if (card.kind === 'creature') {
    node.appendChild(el('div', 'atk', String(card.atk)));
    node.appendChild(el('div', 'hp', String(card.hp)));
  } else {
    node.appendChild(el('div', 'spell-tag', 'SPELL'));
  }
  return node;
}

function renderHero(engine, who, root) {
  const player = who === 'you' ? engine.you : engine.foe;
  root.querySelector('.hero-life').textContent = String(Math.max(0, player.life));
  const mana = root.querySelector('.mana');
  mana.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const gem = el('span', 'gem' + (i < player.mana ? ' lit' : '') + (i < player.maxMana ? '' : ' empty'));
    gem.textContent = '◆';
    mana.appendChild(gem);
  }
  root.querySelector('.hero-mana-text').textContent = `${player.mana}/${player.maxMana}`;
  root.classList.toggle('low-life', player.life <= 10);
}

function renderBoardRow(engine, who, root, selectable) {
  const player = who === 'you' ? engine.you : engine.foe;
  const seen = new Set();
  for (const creature of player.board) {
    seen.add(creature.uid);
    let node = root.querySelector(`[data-uid="${creature.uid}"]`);
    if (!node) {
      node = makeCardElement(creature);
      node.classList.add('summon');
      root.appendChild(node);
      setTimeout(() => node.classList.remove('summon'), 450);
    }
    node.querySelector('.atk').textContent = String(creature.atk);
    node.querySelector('.hp').textContent = String(creature.hp);
    node.classList.toggle('ready', creature.canAttack && who === 'you' && engine.activePlayer() === engine.you);
    node.classList.toggle('tired', !creature.canAttack);
    node.classList.toggle('selected', selectable.selectedUid === creature.uid);
    node.classList.toggle('targetable', selectable.targetUids.has(creature.uid));
  }
  for (const node of [...root.children]) {
    if (!seen.has(Number(node.dataset.uid))) root.removeChild(node);
  }
  root.classList.toggle('has-guard', player.board.some((c) => c.guard));
}

function renderHand(engine, root, selectable) {
  const seen = new Set();
  engine.you.hand.forEach((card, index) => {
    seen.add(card.uid);
    let node = root.querySelector(`[data-uid="${card.uid}"]`);
    if (!node) {
      node = makeCardElement(card);
      root.appendChild(node);
    }
    const check = engine.canPlayCard(engine.you, index);
    node.classList.toggle('playable', check.ok);
    node.classList.toggle('selected', selectable.selectedHand === index);
    node.classList.toggle('unaffordable', card.cost > engine.you.mana);
  });
  for (const node of [...root.children]) {
    if (!seen.has(Number(node.dataset.uid))) root.removeChild(node);
  }
}

function renderFoeHand(engine, root) {
  root.innerHTML = '';
  for (let i = 0; i < engine.foe.hand.length; i++) {
    root.appendChild(el('div', 'card-back'));
  }
}

export function renderAll(engine, selectable) {
  renderHero(engine, 'you', $('you-hero'));
  renderHero(engine, 'foe', $('foe-hero'));
  renderBoardRow(engine, 'foe', $('foe-board'), { selectedUid: null, targetUids: selectable.targetUids });
  renderBoardRow(engine, 'you', $('you-board'), selectable);
  renderHand(engine, $('you-hand'), selectable);
  renderFoeHand(engine, $('foe-hand'));
  const log = $('log');
  log.innerHTML = '';
  for (const line of engine.log) log.appendChild(el('div', 'log-line', line));
  const endTurn = $('end-turn');
  const yourTurn = engine.phase === 'play' && engine.activePlayer() === engine.you;
  endTurn.disabled = !yourTurn;
  endTurn.textContent = yourTurn ? 'End Turn  (Space)' : 'Ashwarden is thinking…';
  $('turn-label').textContent = `Turn ${engine.turn}`;
  document.body.classList.toggle('targeting', selectable.targeting);
}

export function showScreen(name) {
  for (const id of ['title-screen', 'table-screen', 'end-screen']) {
    $(id).classList.toggle('hidden', id !== name);
  }
}

export function showEnd(engine) {
  const won = engine.winner === 'you';
  $('end-title').textContent = won ? 'VICTORY' : 'DEFEAT';
  $('end-title').className = won ? 'win' : 'loss';
  $('end-sub').textContent = won
    ? 'The table is yours. Ashwarden bows to a better duelist.'
    : 'Ashwarden takes the table this time. Shuffle up and go again.';
  $('end-stats').textContent =
    `Turns: ${engine.stats.turns} · Cards played: ${engine.stats.cardsPlayed} · Damage dealt: ${engine.stats.damageDealt}`;
  showScreen('end-screen');
}

// Tiny WebAudio blips: click, play, hit, win. No audio files needed.
let audioCtx = null;
export function blip(kind) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const freq = kind === 'hit' ? 140 : kind === 'play' ? 520 : kind === 'win' ? 880 : 660;
    osc.frequency.value = freq;
    osc.type = kind === 'hit' ? 'sawtooth' : 'sine';
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    // Sound is garnish; a browser without audio still plays fine.
  }
}
