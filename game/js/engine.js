// Ember Duel — game engine: state, rules and turn flow.
// Pure logic, no DOM here: the engine owns the board, hands, mana, combat
// and win/loss, and reports every change as an event the renderer plays.

import { buildDeck, cardById, elementBeats, makeRng, shuffle } from './cards.js';

export const MAX_HAND = 7;
export const MAX_BOARD = 5;
export const START_LIFE = 30;
export const MAX_MANA = 10;

let nextUid = 1;

function makeCreatureInstance(card, owner) {
  return {
    uid: nextUid++,
    cardId: card.id,
    kind: 'creature',
    name: card.name,
    cost: card.cost,
    atk: card.atk,
    hp: card.hp,
    maxHp: card.hp,
    element: card.element,
    guard: !!card.guard,
    swift: !!card.swift,
    drain: !!card.drain,
    text: card.text,
    owner,
    canAttack: false,
    justPlayed: true,
  };
}

function makePlayer(name, isAi, rng) {
  return {
    name,
    isAi,
    life: START_LIFE,
    mana: 0,
    maxMana: 0,
    deck: buildDeck(rng),
    hand: [],
    board: [],
    fatigue: 0,
  };
}

export class Engine {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.events = [];
    this.turn = 0;
    this.phase = 'title'; // title | play | over
    this.winner = null;
    this.stats = { turns: 0, cardsPlayed: 0, damageDealt: 0 };
    this.you = makePlayer('You', false, this.rng);
    this.foe = makePlayer('Ashwarden', true, this.rng);
    this.log = [];
  }

  logLine(text) {
    this.log.unshift(text);
    if (this.log.length > 5) this.log.pop();
  }

  emit(type, data) {
    this.events.push({ type, ...data });
  }

  startGame() {
    this.phase = 'play';
    this.turn = 1;
    for (let i = 0; i < 3; i++) this.drawCard(this.you, true);
    for (let i = 0; i < 3; i++) this.drawCard(this.foe, true);
    this.beginTurn(this.you);
    this.logLine('The duel begins — Ember, Tide, Grove, Stone.');
  }

  drawCard(player, silent) {
    if (player.deck.length === 0) {
      player.fatigue += 1;
      player.life -= player.fatigue;
      this.emit('fatigue', { player: player.name, amount: player.fatigue });
      if (!silent) this.logLine(`${player.name} takes ${player.fatigue} fatigue damage.`);
      this.checkEnd();
      return null;
    }
    const id = player.deck.pop();
    const card = cardById(id);
    if (player.hand.length >= MAX_HAND) {
      if (!silent) this.logLine(`${player.name}'s hand is full — ${card.name} burns away.`);
      return null;
    }
    player.hand.push({ ...card, uid: nextUid++ });
    return card;
  }

  beginTurn(player) {
    player.maxMana = Math.min(MAX_MANA, player.maxMana + 1);
    player.mana = player.maxMana;
    for (const creature of player.board) {
      creature.canAttack = true;
      creature.justPlayed = false;
    }
    if (this.turn > 1 || player === this.foe) this.drawCard(player);
    if (player === this.you) this.stats.turns = this.turn;
    this.emit('turn', { player: player.name, mana: player.mana });
  }

  activePlayer() {
    return this.turn % 2 === 1 ? this.you : this.foe;
  }

  canPlayCard(player, handIndex) {
    if (this.phase !== 'play') return { ok: false, why: 'not playing' };
    if (this.activePlayer() !== player) return { ok: false, why: 'not your turn' };
    const card = player.hand[handIndex];
    if (!card) return { ok: false, why: 'no such card' };
    if (card.cost > player.mana) return { ok: false, why: 'not enough embers' };
    if (card.kind === 'creature' && player.board.length >= MAX_BOARD) {
      return { ok: false, why: 'your side is full' };
    }
    return { ok: true, card };
  }

  playCard(player, handIndex, target) {
    const check = this.canPlayCard(player, handIndex);
    if (!check.ok) return check;
    const card = check.card;
    player.hand.splice(handIndex, 1);
    player.mana -= card.cost;
    this.stats.cardsPlayed += 1;
    if (card.kind === 'creature') {
      const instance = makeCreatureInstance(card, player === this.you ? 'you' : 'foe');
      instance.canAttack = !!card.swift;
      player.board.push(instance);
      this.emit('summon', { uid: instance.uid, owner: instance.owner });
      this.logLine(`${player.name} summons ${card.name}.`);
    } else {
      this.castSpell(player, card, target);
    }
    this.checkEnd();
    return { ok: true, card };
  }

  castSpell(player, card, target) {
    if (card.damage) {
      // A creature target is resolved to the live board object by uid.
      if (target && target.kind === 'creature') {
        const live = [...this.you.board, ...this.foe.board].find((c) => c.uid === target.uid);
        if (live) target = live;
      }
      this.dealDamage(target, card.damage, player);
      this.logLine(`${player.name} casts ${card.name} for ${card.damage} damage.`);
    }
    if (card.heal) {
      player.life = Math.min(START_LIFE, player.life + card.heal);
      this.emit('heal', { player: player.name, amount: card.heal });
      this.logLine(`${player.name} mends for ${card.heal} life.`);
    }
    if (card.draw) {
      this.drawCard(player);
      this.drawCard(player);
      this.logLine(`${player.name} draws ${card.draw} cards.`);
    }
  }

  // Attack resolution: attacker hits target; a creature target hits back.
  // Element advantage adds +2 attack. Drain heals the attacker's hero.
  // Targets arrive by value from the UI and the AI, so a creature target is
  // resolved to the live board object by uid before any damage lands.
  attack(attacker, target) {
    if (this.phase !== 'play') return { ok: false, why: 'not playing' };
    if (!attacker.canAttack) return { ok: false, why: 'already acted' };
    const owner = attacker.owner === 'you' ? this.you : this.foe;
    const foe = attacker.owner === 'you' ? this.foe : this.you;
    if (this.activePlayer() !== owner) return { ok: false, why: 'not your turn' };
    if (target.kind === 'creature') {
      const live = foe.board.find((c) => c.uid === target.uid);
      if (!live) return { ok: false, why: 'target gone' };
      target = live;
    }
    if (target.kind === 'creature' && target.owner !== attacker.owner) {
      const guards = foe.board.filter((c) => c.guard);
      if (guards.length > 0 && !target.guard) {
        return { ok: false, why: 'a Guard blocks the way' };
      }
    }
    let power = attacker.atk;
    if (target.kind === 'creature' && elementBeats(attacker.element, target.element)) {
      power += 2;
    }
    attacker.canAttack = false;
    this.emit('attack', { from: attacker.uid, to: target.kind === 'hero' ? 'hero' : target.uid });
    this.dealDamage(target, power, owner);
    if (target.kind === 'creature') {
      let back = target.atk;
      if (elementBeats(target.element, attacker.element)) back += 2;
      this.dealDamage(attacker, back, foe);
      if (attacker.drain && attacker.hp > 0) this.healHero(owner, power);
    } else if (attacker.drain) {
      this.healHero(owner, power);
    }
    this.sweepBoard();
    this.checkEnd();
    return { ok: true };
  }

  dealDamage(target, amount, source) {
    if (target.kind === 'hero') {
      const hero = target.owner === 'you' ? this.you : this.foe;
      hero.life -= amount;
      this.emit('damage', { target: 'hero', owner: hero.name, amount });
      if (source === this.you) this.stats.damageDealt += amount;
    } else {
      target.hp -= amount;
      this.emit('damage', { target: target.uid, amount });
    }
  }

  healHero(player, amount) {
    player.life = Math.min(START_LIFE, player.life + amount);
    this.emit('heal', { player: player.name, amount });
  }

  sweepBoard() {
    for (const player of [this.you, this.foe]) {
      const fallen = player.board.filter((c) => c.hp <= 0);
      for (const creature of fallen) {
        this.emit('destroy', { uid: creature.uid });
        this.logLine(`${creature.name} falls.`);
      }
      player.board = player.board.filter((c) => c.hp > 0);
    }
  }

  checkEnd() {
    if (this.phase !== 'play') return;
    if (this.you.life <= 0 && this.foe.life <= 0) {
      this.endGame(this.you.life >= this.foe.life ? 'you' : 'foe');
    } else if (this.foe.life <= 0) {
      this.endGame('you');
    } else if (this.you.life <= 0) {
      this.endGame('foe');
    }
  }

  endGame(winner) {
    this.phase = 'over';
    this.winner = winner;
    this.emit('gameover', { winner });
    this.logLine(winner === 'you' ? 'Victory! The table is yours.' : 'Defeat. Ashwarden takes the table.');
  }

  endTurn() {
    if (this.phase !== 'play') return;
    if (this.activePlayer() !== this.you) return;
    this.turn += 1;
    this.beginTurn(this.foe);
    this.emit('turn', { player: this.foe.name, mana: this.foe.mana });
  }

  aiTurnDone() {
    if (this.phase !== 'play') return;
    this.turn += 1;
    this.beginTurn(this.you);
  }

  // Build a fixed mid-game table for screenshots and testing: both sides
  // have creatures, both hands are full, life and mana are part-spent.
  static demoBattle(seed) {
    const engine = new Engine(seed);
    engine.startGame();
    const take = (player, ids) => {
      for (const id of ids) {
        const card = cardById(id);
        const instance = makeCreatureInstance(card, player === engine.you ? 'you' : 'foe');
        instance.canAttack = true;
        instance.justPlayed = false;
        player.board.push(instance);
      }
    };
    take(engine.foe, ['golem', 'archer', 'imp']);
    take(engine.you, ['wolf', 'heron', 'pebble']);
    engine.foe.board[0].hp = 4;
    engine.you.board[1].hp = 3;
    engine.foe.life = 18;
    engine.you.life = 24;
    engine.turn = 5; // your turn: the End Turn button reads live in the shot
    engine.stats = { turns: 8, cardsPlayed: 12, damageDealt: 34 };
    engine.you.mana = 6;
    engine.you.maxMana = 7;
    engine.foe.mana = 3;
    engine.foe.maxMana = 6;
    engine.logLine('Ashwarden plays Ash Golem.');
    engine.logLine('You summon Thorn Wolf.');
    engine.logLine('Storm Heron strikes for 3.');
    return engine;
  }
}
