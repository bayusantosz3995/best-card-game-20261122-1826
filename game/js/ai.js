// Ember Duel — the AI opponent.
// Ashwarden plays greedily but readably: it spends its embers on the
// biggest creatures it can afford, then attacks — it clears your creatures
// when the trade favours it (element advantage, or a kill without dying)
// and otherwise goes for your hero. Every decision is logged so a player
// can read the opponent's plan and counter it next turn.

import { elementBeats } from './cards.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Value a creature for the AI: stats plus a bonus for keywords and for
// element advantage over what you have on the table.
function creatureValue(engine, creature) {
  let value = creature.atk * 2 + creature.hp;
  if (creature.guard) value += 3;
  if (creature.swift) value += 2;
  if (creature.drain) value += 2;
  for (const enemy of engine.you.board) {
    if (elementBeats(creature.element, enemy.element)) value += 2;
  }
  return value;
}

export async function runAiTurn(engine, onEvent) {
  const foe = engine.foe;
  const step = async () => {
    await sleep(520);
    if (engine.phase !== 'play') return;
    onEvent();
  };

  // 1. Play cards: biggest value per ember first, while affordable.
  let played = true;
  while (played && engine.phase === 'play') {
    played = false;
    let bestIndex = -1;
    let bestScore = -1;
    foe.hand.forEach((card, index) => {
      if (card.cost > foe.mana) return;
      if (card.kind === 'creature' && foe.board.length >= 5) return;
      let score = card.kind === 'creature' ? creatureValue(engine, card) / card.cost : 4;
      if (card.kind === 'spell' && card.damage && engine.you.life <= card.damage) score = 99;
      if (card.kind === 'spell' && card.damage && engine.you.board.some((c) => c.hp <= card.damage)) score = 7;
      if (card.kind === 'spell' && card.heal && foe.life < 20) score = 8;
      if (card.kind === 'spell' && card.draw) score = 3;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      const card = foe.hand[bestIndex];
      let target = null;
      if (card.kind === 'spell' && card.damage) {
        // Ember Burst: clear the biggest enemy it can kill, soften the
        // toughest Guard, or finish the hero when lethal — never waste it.
        const killable = engine.you.board.filter((c) => c.hp <= card.damage);
        if (killable.length > 0) {
          killable.sort((a, b) => b.atk - a.atk);
          target = killable[0];
        } else if (engine.you.life <= card.damage) {
          target = { kind: 'hero', owner: 'you' };
        } else {
          const guards = engine.you.board.filter((c) => c.guard);
          if (guards.length > 0) {
            guards.sort((a, b) => b.hp - a.hp);
            target = guards[0];
          } else {
            target = { kind: 'hero', owner: 'you' };
          }
        }
      }
      engine.playCard(foe, bestIndex, target);
      played = true;
      await step();
    }
  }

  // 2. Attack with every ready creature, best trade first. A trade that is
  // only slightly unfavourable is still taken — a table where nobody attacks
  // is a table where nobody has fun — and when a Guard blocks the hero, the
  // first attacker sacrifices itself to break the stall.
  const attackers = foe.board.filter((c) => c.canAttack);
  let sacrificed = false;
  for (const attacker of attackers) {
    if (engine.phase !== 'play') break;
    const guards = engine.you.board.filter((c) => c.guard);
    const targets = guards.length > 0 ? guards : engine.you.board;
    let target = null;
    let bestTrade = -Infinity;
    for (const enemy of targets) {
      let power = attacker.atk + (elementBeats(attacker.element, enemy.element) ? 2 : 0);
      let back = enemy.atk + (elementBeats(enemy.element, attacker.element) ? 2 : 0);
      // A kill is worth it; dying for it is not, unless the enemy is big.
      let trade = 0;
      if (power >= enemy.hp) trade += 5 + enemy.atk;
      if (back >= attacker.hp) trade -= 4 + attacker.atk;
      trade += power - back;
      if (trade > bestTrade) {
        bestTrade = trade;
        target = enemy;
      }
    }
    if (target && bestTrade > -4) {
      engine.attack(attacker, target);
    } else if (guards.length === 0) {
      engine.attack(attacker, { kind: 'hero', owner: 'you' });
    } else if (!sacrificed && target) {
      sacrificed = true;
      engine.attack(attacker, target);
    }
    await step();
  }

  engine.aiTurnDone();
  onEvent();
}
