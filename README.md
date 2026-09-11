# Signal Arena

Vertical 9:16 Phaser 4 game prototype about **decision training before the trade click**. This is not a trading terminal, not an exchange demo account, and not a buy/sell simulator.

## Stack

- Phaser `4.2.1`
- TypeScript `5.9.3`
- Vite `7.3.6`
- `phaser3-rex-plugins` / rexUI `1.80.20`

## Product direction

Signal Arena trains a player to defeat market distortions through compact protocol choices:

1. Read the boss distortion and signal dossier.
2. Pick one of three protocol cards.
3. Reveal the future after the answer.
4. Save the mistake/discipline note into the journal.

The core mechanic intentionally avoids repeating actions that already exist in exchange demo accounts. There are no terminal controls, no order book, no buy/sell button loop, and no real-money promise.

## Canon character

The mentor is **Скрепка**: an analog archival assistant inspired by an old office paperclip archetype, dressed like a tiny market hermit. He hides that he is not AI and says things like:

> Я пришёл из прошлого, чтобы помочь тебе в будущем. Не называй меня ИИ. Я канцелярский инстинкт.

The owl/Duolingo mentor concept is not used in the playable product.

## Current game features

- 9:16 vertical mobile canvas.
- Minimal HUD: clarity, pressure, composure.
- Five boss encounters:
  - Фантом FOMO
  - Титан Заголовков
  - Гоблин Плеча
  - Призрак Мести
  - Дракон Самоуверенности
- Six protocol cards:
  - Доказательства
  - Карантин шума
  - Анти-FOMO
  - Риск первым
  - Пауза после удара
  - Вне рынка
- Forward-after-answer replay.
- Journal of mistakes and lessons.
- Daily deterministic encounter order.
- Local profile persistence: XP, streak, best clarity, proof ID, cosmetic dust, badges.
- Codex screen for protocols and product rules.
- Keyboard support on desktop: `1`, `2`, `3` choose cards.
- Mobile haptic vibration where supported.

## Run locally

```bash
npm install
npm run dev
```

Type-check and build:

```bash
npm run check
npm run build
```

## Design rules

1. Format is always 9:16.
2. UI stays focused: one decision, three choices, one outcome.
3. The game does not become a trading terminal. It gamifies discipline, evidence, refusal, and error closure — not click frequency.

## Web3 layer concept

The current implementation keeps Web3 as a product layer, not a dependency gate:

- Proof-of-skill style local run ID.
- Cosmetic currency only.
- No pay-to-win answers, data, budget, or probability manipulation.
- Future wallet/NFT features should remain optional and cosmetic/status-based.
