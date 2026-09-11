# Signal Arena Product Spec

## One-line pitch

A mobile-first roguelite decision trainer where crypto-market distortions are bosses and the player wins by applying protocols before any trade-like action exists.

## Why it is commercially different

Most trading education products teach execution inside a terminal-shaped interface. Signal Arena owns the missing step: **decision quality before execution**. The player is not trained to click more often; the player is trained to stop feeding chaos.

## Core loop

```text
Boss distortion → signal dossier → choose protocol → future reveal → journal entry → season profile growth
```

## Session design

- Session length target: 8–12 minutes.
- Current prototype length: 5 encounters.
- Encounter load: 1 boss image, 1 brief, 4 evidence chips, 3 protocol cards.
- Failure is not framed as shame; it becomes journal material.

## UX pillars

### 1. 9:16 native

The canvas is `1080 × 1920`, scaled with Phaser FIT. Desktop preview keeps a phone-like vertical frame.

### 2. Low cognitive load

The player never sees an order book, twenty indicators, or a trading dashboard. Every encounter asks one question: **which protocol protects the system now?**

### 3. Game-first, finance-second

Market concepts are expressed through enemies, rituals, dossiers, pressure, composure, and clarity. The product is entertainment plus skill training, not a reskinned spreadsheet.

## Character canon

### Скрепка

- Analog assistant.
- Looks like a paperclip/old man/market hermit in a Yoda-like robe.
- Claims he came from the past to help the future.
- Hides that he is not AI.
- Tone: dry, archival, satirical, slightly threatening.

### Removed concept

- No owl mentor.
- No Duolingo mascot imitation.
- Duolingo-style streaks are transformed into **closed-error streaks**, not lesson grind.

## Monetization rules

Allowed:

- Cosmetic skins for protocols.
- Seasonal boss frames.
- Guild banners.
- Archive room decorations.
- Optional proof-of-skill minting.

Forbidden:

- Selling correct answers.
- Selling better odds.
- Selling more risk budget.
- Paywalled educational facts needed for fair play.

## Roadmap to production

### Milestone 1 — Current playable vertical slice

- Phaser 4 + TypeScript + Vite + rexUI.
- First-run onboarding with Скрепка.
- Five-battle daily raid selected from a 15-scenario content pool.
- Raid map and scenario districts.
- Six protocols.
- Two-step encounter flow: find the poison, then choose the protocol.
- Signal Laboratory mini-mode.
- Result journal.
- Pending-error review flow.
- Cosmetic archive economy.
- Daily deterministic deck.
- Local progression with protocol mastery, proof ID, badges and cosmetic dust.

### Milestone 2 — Retention systems

- Daily distortion seed.
- More scenario packs.
- Error taxonomy graph.
- Cosmetic unlock screen.
- Season ladder based on completed reviews, not PnL.

### Milestone 3 — Social/Web3

- Guild review rooms.
- Shareable proof cards.
- Optional wallet connection.
- Cosmetic NFTs without gameplay advantage.
- Tournament format scored on decision quality and consistency.

## Quality bar checklist

- [x] 9:16 layout.
- [x] First-run onboarding.
- [x] Phaser 4.
- [x] TypeScript.
- [x] Vite.
- [x] rexUI plugin.
- [x] No owl in playable product.
- [x] Скрепка canon preserved.
- [x] No buy/sell terminal loop.
- [x] Three choices per encounter.
- [x] Journal and future reveal.
- [x] Raid map.
- [x] Signal Laboratory.
- [x] Pending-error closure.
- [x] Local progression and proof ID.
- [x] Settings for sound, haptics and reduced motion.
- [x] PWA manifest and service worker shell.
- [x] Local telemetry buffer for balancing without external tracking.
