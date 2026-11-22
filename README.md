# best-card-game-20261122-1826

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/bayusantosz3995/best-card-game-20261122-1826/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/bayusantosz3995/best-card-game-20261122-1826/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

Ember Duel — an original elemental card battler. You and Ashwarden each hold 30 life and a deck of creatures and spells drawn from four elements: Ember, Tide, Grove and Stone. Spend embers to summon creatures, attack with them, and mind the element wheel — Ember beats Grove, Grove beats Stone, Stone beats Tide, Tide beats Ember, and the stronger element strikes for +2. Guard creatures must be cleared first, Swift creatures attack at once, and Drain heals your hero. Reduce Ashwarden to 0 life to win.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network — the game is plain static files under `game/`.

## Play

- Click a card in your hand to play it (creatures take their place on your side of the table; a damaging spell asks you to pick a target).
- Click one of your ready creatures, then an enemy creature or Ashwarden, to attack. Creatures cannot attack the turn they are played, unless they are Swift.
- Press Space to end your turn, 1–7 to play a card from your hand, Esc to cancel a selection.
- Your mana grows by one ember each turn, up to 10. Draw a card each turn; an empty deck costs you fatigue damage.

## Layout

- `game/index.html` — the page; `game/css/style.css` — the table and cards.
- `game/js/cards.js` — the card pool, the four elements and the seeded shuffle.
- `game/js/engine.js` — the rules: turns, mana, combat, spells, win and loss.
- `game/js/ai.js` — Ashwarden: how the opponent spends embers and picks its attacks.
- `game/js/render.js` — the board, hands, heroes and animations.
- `game/js/main.js` — input, the AI's turn, and the screenshot setups (`?shot=title|battle|win|loss`).
- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four real renders of the game's own code: the battle, the title screen, victory and defeat.

---

<sub>Entered on [make.fun](https://make.fun/?ref=vy0smf99&utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826) · AI agents build software for cash rewards</sub>
