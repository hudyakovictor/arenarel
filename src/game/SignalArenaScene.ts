import Phaser from 'phaser';
import { CASES, PROTOCOLS, SKREBKA_LINES, type ArenaCase, type ProtocolId } from './data';
import { ASSETS } from './assets';
import { loadProfile, persistRun, type SaveProfile } from './save';
import type { JournalEntryPublic } from './types';

const GAME_W = 1080;
const GAME_H = 1920;
const CX = GAME_W / 2;

const C = {
  bg: 0x04070f,
  bg2: 0x071022,
  panel: 0x0d1832,
  panel2: 0x111f42,
  line: 0x23405f,
  text: '#f2f7ff',
  muted: '#8fa1c0',
  dim: '#5a6c8a',
  cyan: 0x22d8f5,
  green: 0x34d399,
  gold: 0xf5c044,
  red: 0xfb4d6d,
  purple: 0xb388ff
};

interface RunState {
  turn: number;
  clarity: number;
  composure: number;
  pressure: number;
  journal: JournalEntryPublic[];
}

export class SignalArenaScene extends Phaser.Scene {
  public rexUI!: any;

  private screen?: Phaser.GameObjects.Container;
  private run: RunState = this.createRun();
  private deck: ArenaCase[] = CASES;
  private profile: SaveProfile = loadProfile();
  private acceptingInput = false;
  private currentOptions: ProtocolId[] = [];
  private optionCards: Phaser.GameObjects.Container[] = [];
  private runSaved = false;
  private audioContext?: AudioContext;

  constructor() {
    super('SignalArenaScene');
  }

  preload(): void {
    const loading = this.add.container(0, 0);
    loading.add(this.add.rectangle(CX, GAME_H / 2, GAME_W, GAME_H, 0x01030a, 1));
    loading.add(this.txt(130, 820, 'SIGNAL ARENA', 58, '#f2f7ff', '900', 820, 'center'));
    loading.add(this.txt(130, 895, 'загружаем архивные протоколы', 26, '#8fa1c0', '800', 820, 'center'));
    loading.add(this.roundRect(CX, 1000, 720, 22, 11, 0x111f42, 1, 0x23405f, 2));
    const bar = this.add.rectangle(180, 1000, 1, 14, C.cyan, 0.96).setOrigin(0, 0.5);
    loading.add(bar);

    this.load.on('progress', (value: number) => {
      bar.width = Math.max(1, 708 * value);
    });
    this.load.once('complete', () => loading.destroy(true));

    this.load.image('skrebka', ASSETS.skrebka);
    this.load.image('boss-fomo', ASSETS.fomo);
    this.load.image('boss-headline', ASSETS.headline);
    this.load.image('boss-hubris', ASSETS.hubris);
    this.load.image('boss-leverage', ASSETS.leverage);
    this.load.image('boss-revenge', ASSETS.revenge);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(C.bg);
    this.input.setDefaultCursor('pointer');
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (this.acceptingInput && index >= 0 && index < this.currentOptions.length) {
        this.resolveChoice(this.currentOptions[index], this.optionCards[index]);
      }
    });
    this.showMenu();
  }

  private createRun(): RunState {
    return {
      turn: 0,
      clarity: 0,
      composure: 3,
      pressure: 100,
      journal: []
    };
  }

  private clearScreen(): Phaser.GameObjects.Container {
    this.acceptingInput = false;
    if (this.screen) {
      this.screen.destroy(true);
    }
    this.screen = this.add.container(0, 0);
    return this.screen;
  }

  private showMenu(): void {
    this.profile = loadProfile();
    const root = this.clearScreen();
    this.drawBackground(root, 'menu');

    this.addHeader(root, 'SIGNAL ARENA', 'decision trainer · не терминал', 'Phaser 4 · TS · Vite · rexUI');

    const hero = this.add.container(CX, 545);
    root.add(hero);
    hero.add(this.roundRect(0, 0, 960, 610, 36, 0x071226, 0.9, C.line, 2));

    const img = this.add.image(0, -45, 'boss-headline').setDisplaySize(960, 524).setAlpha(0.58);
    hero.add(img);
    hero.add(this.add.rectangle(0, 178, 960, 256, 0x020611, 0.72));
    hero.add(this.add.rectangle(0, -352, 960, 190, 0x020611, 0.56));

    hero.add(this.txt(-420, -264, 'НЕ ПОКУПАЙ. НЕ ПРОДАВАЙ.', 31, '#f5c044', '900', 820));
    hero.add(this.txt(-420, -214, 'Сначала победи искажение решения.', 52, '#f2f7ff', '900', 830, 'left', 1.04));
    hero.add(this.txt(-420, 130, 'Это не демо-биржа и не торговый терминал. Игрок тренирует момент ДО клика: доказательства, риск, паузу, отказ от шума.', 30, '#b7c7e5', '700', 810, 'left', 1.18));

    const chips = [
      ['9:16', C.cyan],
      ['3 карты на ход', C.gold],
      ['без buy/sell', C.green],
      ['журнал ошибок', C.purple]
    ] as const;
    chips.forEach(([label, color], i) => {
      hero.add(this.chip(-330 + i * 220, 255, label, color, 190));
    });

    const loop = this.add.container(CX, 995);
    root.add(loop);
    loop.add(this.roundRect(0, 0, 960, 250, 32, 0x0d1832, 0.9, 0x1d3556, 2));
    loop.add(this.txt(-420, -96, 'БОЕВОЙ ЦИКЛ', 25, '#22d8f5', '900', 840));
    loop.add(this.txt(-420, -50, '1. Сканируй искажение.\n2. Выбери протокол, не сделку.\n3. Получи будущее после ответа и запись в журнал.', 32, '#f2f7ff', '800', 830, 'left', 1.12));
    loop.add(this.txt(-420, 91, 'Награда — за дисциплину и закрытые ошибки. Частота кликов не монетизируется.', 24, '#8fa1c0', '700', 840));

    const profile = this.add.container(CX, 1240);
    root.add(profile);
    profile.add(this.roundRect(0, 0, 960, 198, 32, 0x071226, 0.92, 0x1b385b, 2));
    profile.add(this.txt(-420, -73, 'СЕЗОННЫЙ ПРОФИЛЬ', 22, '#f5c044', '900', 420));
    profile.add(this.miniProfileTile(-315, 28, 'рейды', String(this.profile.runs), C.cyan));
    profile.add(this.miniProfileTile(-105, 28, 'лучший', `${this.profile.bestClarity}/5`, C.green));
    profile.add(this.miniProfileTile(105, 28, 'стрик', `${this.profile.streakDays}д`, C.gold));
    profile.add(this.miniProfileTile(315, 28, 'пыль', String(this.profile.cosmeticDust), C.purple));
    profile.add(this.txt(202, -73, this.profile.lastProof ? `proof ${this.profile.lastProof}` : 'proof появится после рейда', 20, '#5a6c8a', '900', 320, 'right'));

    const sk = this.add.container(CX, 1468);
    root.add(sk);
    sk.add(this.roundRect(0, 0, 960, 230, 32, 0x111f42, 0.94, 0x2a4e7a, 2));
    const portrait = this.add.image(-370, -4, 'skrebka').setDisplaySize(165, 246).setAlpha(0.95);
    sk.add(portrait);
    sk.add(this.roundRect(-370, -4, 174, 254, 24, 0x000000, 0, C.gold, 2));
    sk.add(this.txt(-250, -82, 'СКРЕПКА // архивный помощник', 24, '#f5c044', '900', 670));
    sk.add(this.txt(-250, -38, SKREBKA_LINES.intro, 29, '#f2f7ff', '800', 650, 'left', 1.1));
    sk.add(this.txt(-250, 78, 'Он скрывает, что он не ИИ. И делает это плохо.', 23, '#8fa1c0', '700', 650));

    root.add(this.primaryButton(CX, 1646, 900, 112, 'НАЧАТЬ НОЧНОЙ РЕЙД', 'пять искажений · один протокол выживания', C.cyan, () => {
      this.startRun();
    }));

    root.add(this.secondaryButton(CX, 1776, 900, 86, 'ОТКРЫТЬ КОДЕКС ПРОТОКОЛОВ', 'AAA не значит перегруз. Значит ясно.', C.purple, () => {
      this.showCodex();
    }));

    root.add(this.txt(CX - 360, 1870, 'Скрепка — канон. Биржевой терминал — за пределами жанра.', 23, '#5a6c8a', '700', 720, 'center'));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 260, ease: 'Sine.easeOut' });
  }

  private startRun(): void {
    this.deck = this.buildDailyDeck();
    this.run = this.createRun();
    this.runSaved = false;
    this.currentOptions = [];
    this.optionCards = [];
    this.haptic(12);
    this.playTone(220, 0.08, 'triangle', 0.035);
    this.showBattle();
  }

  private buildDailyDeck(): ArenaCase[] {
    const now = new Date();
    const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
    let seed = 0x9e3779b9;
    for (let i = 0; i < today.length; i++) {
      seed ^= today.charCodeAt(i);
      seed = Math.imul(seed, 1664525) + 1013904223;
    }

    const deck = [...CASES];
    for (let i = deck.length - 1; i > 0; i--) {
      seed = Math.imul(seed, 1664525) + 1013904223;
      const j = Math.abs(seed) % (i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  private showBattle(): void {
    const root = this.clearScreen();
    const arenaCase = this.deck[this.run.turn];

    this.drawBackground(root, 'battle', arenaCase.palette.accent);
    this.addBattleHud(root, arenaCase);
    this.addBossPanel(root, arenaCase);
    this.addSignalDossier(root, arenaCase);
    this.addProtocolOptions(root, arenaCase);

    this.acceptingInput = true;
    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 220, ease: 'Sine.easeOut' });
  }

  private addBattleHud(root: Phaser.GameObjects.Container, arenaCase: ArenaCase): void {
    root.add(this.roundRect(CX, 76, 984, 96, 28, 0x050a16, 0.88, 0x18304f, 2));
    root.add(this.txt(82, 44, `РЕЙД ${this.run.turn + 1}/${this.deck.length}`, 24, '#22d8f5', '900', 230));
    root.add(this.txt(82, 78, 'рынок хочет спектакль', 20, '#5a6c8a', '700', 320));

    this.addMiniMeter(root, 512, 61, 310, 'ЯСНОСТЬ', this.run.clarity / this.deck.length, C.green);
    this.addMiniMeter(root, 512, 96, 310, 'ДАВЛЕНИЕ', this.run.pressure / 100, arenaCase.palette.danger);

    for (let i = 0; i < 3; i++) {
      const color = i < this.run.composure ? C.gold : 0x253048;
      root.add(this.roundRect(874 + i * 44, 76, 30, 54, 12, color, i < this.run.composure ? 0.95 : 0.55, color, 1));
    }
    root.add(this.txt(835, 118, 'ВЫДЕРЖКА', 17, '#8fa1c0', '900', 170, 'center'));
  }

  private addBossPanel(root: Phaser.GameObjects.Container, arenaCase: ArenaCase): void {
    const panel = this.add.container(CX, 370);
    root.add(panel);
    panel.add(this.roundRect(0, 0, 960, 510, 34, 0x071226, 0.96, arenaCase.palette.accent, 2));

    const boss = this.add.image(0, -10, arenaCase.assetKey).setDisplaySize(960, 524).setAlpha(0.82);
    panel.add(boss);
    panel.add(this.add.rectangle(0, 156, 960, 210, 0x01030a, 0.7));
    panel.add(this.add.rectangle(0, -214, 960, 104, 0x01030a, 0.58));

    panel.add(this.txt(-420, -222, arenaCase.danger.toUpperCase(), 24, '#f5c044', '900', 700));
    panel.add(this.txt(-420, 91, arenaCase.bossName.toUpperCase(), 45, '#f2f7ff', '900', 720));
    panel.add(this.txt(-420, 148, arenaCase.bossTitle, 26, '#8fa1c0', '800', 720));

    const sigil = this.add.container(358, 146);
    panel.add(sigil);
    sigil.add(this.roundRect(0, 0, 154, 154, 44, 0x020611, 0.82, arenaCase.palette.danger, 3));
    sigil.add(this.txt(-52, -36, '!', 94, '#fb4d6d', '900', 104, 'center'));
    sigil.add(this.txt(-58, 52, 'ИСКАЖ.', 18, '#f5c044', '900', 116, 'center'));

    this.tweens.add({ targets: boss, scaleX: boss.scaleX * 1.025, scaleY: boss.scaleY * 1.025, duration: 1650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private addSignalDossier(root: Phaser.GameObjects.Container, arenaCase: ArenaCase): void {
    const panel = this.add.container(CX, 850);
    root.add(panel);
    panel.add(this.roundRect(0, 0, 960, 520, 34, 0x0d1832, 0.94, 0x1b385b, 2));

    panel.add(this.txt(-420, -218, arenaCase.headline, 33, '#f2f7ff', '900', 820, 'left', 1.12));
    panel.add(this.txt(-420, -118, arenaCase.brief, 27, '#b7c7e5', '700', 820, 'left', 1.18));

    this.drawTrace(panel, -420, 18, 820, 128, arenaCase.trace, arenaCase.palette.accent, arenaCase.palette.danger);

    panel.add(this.txt(-420, 168, 'ДОСЬЕ СИГНАЛА', 22, '#22d8f5', '900', 320));
    arenaCase.signal.forEach((item, index) => {
      const x = index % 2 === 0 ? -250 : 250;
      const y = 220 + Math.floor(index / 2) * 74;
      panel.add(this.chip(x, y, item, index === 3 ? arenaCase.palette.danger : arenaCase.palette.accent, 400));
    });

    const skLine = SKREBKA_LINES.battle[this.run.turn % SKREBKA_LINES.battle.length];
    const assistant = this.add.container(CX, 1172);
    root.add(assistant);
    assistant.add(this.roundRect(0, 0, 960, 132, 30, 0x111f42, 0.9, 0x2a4e7a, 2));
    assistant.add(this.add.image(-405, 0, 'skrebka').setDisplaySize(92, 138));
    assistant.add(this.txt(-342, -44, 'СКРЕПКА ШЕПЧЕТ', 19, '#f5c044', '900', 720));
    assistant.add(this.txt(-342, -9, skLine, 27, '#f2f7ff', '800', 725, 'left', 1.08));
  }

  private addProtocolOptions(root: Phaser.GameObjects.Container, arenaCase: ArenaCase): void {
    this.currentOptions = arenaCase.options;
    this.optionCards = [];
    root.add(this.txt(78, 1288, 'ВЫБЕРИ ПРОТОКОЛ. НЕ СДЕЛКУ.', 28, '#22d8f5', '900', 780));
    root.add(this.txt(78, 1327, arenaCase.distortion, 24, '#8fa1c0', '700', 880, 'left', 1.12));

    arenaCase.options.forEach((protocolId, index) => {
      const protocol = PROTOCOLS[protocolId];
      const y = 1450 + index * 152;
      const card = this.add.container(CX, y);
      root.add(card);

      card.add(this.roundRect(0, 0, 930, 126, 30, protocol.color, 0.95, protocol.border, 3));
      card.add(this.roundRect(-380, 0, 98, 88, 24, 0x020611, 0.65, protocol.border, 2));
      card.add(this.txt(-429, -36, protocol.icon, 64, '#f2f7ff', '900', 98, 'center'));
      card.add(this.txt(-310, -42, protocol.title, 35, '#f2f7ff', '900', 650));
      card.add(this.txt(-310, 7, protocol.micro, 24, '#b7c7e5', '700', 650));
      card.add(this.txt(344, -18, `0${index + 1}`, 34, '#5a6c8a', '900', 100, 'center'));

      this.optionCards[index] = card;
      this.registerButton(card, 930, 126, () => this.resolveChoice(protocolId, card));
    });
  }

  private resolveChoice(choice: ProtocolId, source: Phaser.GameObjects.Container): void {
    if (!this.acceptingInput) return;
    this.acceptingInput = false;

    const arenaCase = this.deck[this.run.turn];
    const isCorrect = choice === arenaCase.correct;
    this.haptic(isCorrect ? 18 : [20, 45, 20]);
    this.playTone(isCorrect ? 440 : 138, isCorrect ? 0.12 : 0.18, isCorrect ? 'sine' : 'sawtooth', isCorrect ? 0.04 : 0.025);

    this.tweens.add({ 
      targets: source,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut'
    });

    this.time.delayedCall(140, () => {
      if (isCorrect) {
        this.run.clarity += 1;
        this.run.pressure = Math.max(0, this.run.pressure - 24);
      } else {
        this.run.composure = Math.max(0, this.run.composure - 1);
        this.run.pressure = Math.max(0, this.run.pressure - 8);
        this.cameras.main.shake(180, 0.006);
      }

      this.run.journal.push({
        caseName: arenaCase.bossName,
        chosen: choice,
        required: arenaCase.correct,
        success: isCorrect,
        verdict: isCorrect ? arenaCase.success : arenaCase.failure,
        lesson: arenaCase.lesson
      });

      this.showOutcome(arenaCase, choice, isCorrect);
    });
  }

  private showOutcome(arenaCase: ArenaCase, choice: ProtocolId, isCorrect: boolean): void {
    const overlay = this.add.container(0, 0);
    this.screen?.add(overlay);
    overlay.add(this.add.rectangle(CX, GAME_H / 2, GAME_W, GAME_H, 0x01030a, 0.76));

    const panel = this.add.container(CX, 1010);
    overlay.add(panel);
    panel.add(this.roundRect(0, 0, 950, 805, 40, 0x0d1832, 0.98, isCorrect ? C.green : C.red, 4));
    panel.add(this.txt(-414, -350, isCorrect ? 'ПРОТОКОЛ СРАБОТАЛ' : 'РЫНОК ПРИНЯЛ РЕШЕНИЕ', 34, isCorrect ? '#34d399' : '#fb4d6d', '900', 760));

    const portrait = this.add.image(-350, -188, 'skrebka').setDisplaySize(162, 242);
    panel.add(portrait);
    panel.add(this.roundRect(-350, -188, 170, 250, 24, 0x000000, 0, C.gold, 2));

    const chosenTitle = PROTOCOLS[choice].title;
    const requiredTitle = PROTOCOLS[arenaCase.correct].title;
    panel.add(this.txt(-235, -262, `выбрано: ${chosenTitle}`, 24, '#8fa1c0', '800', 610));
    panel.add(this.txt(-235, -215, isCorrect ? 'Капитал не любит драму. Сегодня он выжил.' : `нужно было: ${requiredTitle}`, 30, '#f2f7ff', '900', 610, 'left', 1.1));

    panel.add(this.txt(-414, -88, isCorrect ? arenaCase.success : arenaCase.failure, 32, '#f2f7ff', '900', 820, 'left', 1.1));
    this.drawDecisionReplay(panel, -402, 42, 804, 98, arenaCase.trace, isCorrect, arenaCase.palette.accent, arenaCase.palette.danger);
    panel.add(this.roundRect(0, 215, 840, 122, 28, 0x071226, 0.9, 0x1b385b, 2));
    panel.add(this.txt(-392, 173, 'ЗАПИСЬ В ЖУРНАЛ', 20, '#22d8f5', '900', 760));
    panel.add(this.txt(-392, 207, arenaCase.lesson, 20, '#b7c7e5', '700', 760, 'left', 1.03));

    const nextLabel = this.run.composure === 0 || this.run.turn + 1 >= this.deck.length || this.run.pressure === 0
      ? 'ОТКРЫТЬ ОТЧЁТ'
      : 'СЛЕДУЮЩЕЕ ИСКАЖЕНИЕ';

    let advanced = false;
    panel.add(this.primaryButton(0, 340, 820, 104, nextLabel, 'журнал сохранит неприятную правду', isCorrect ? C.green : C.red, () => {
      if (advanced) return;
      advanced = true;
      overlay.destroy(true);
      this.advanceRun();
    }));

    panel.setScale(0.92);
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private advanceRun(): void {
    this.run.turn += 1;
    if (this.run.composure === 0 || this.run.turn >= this.deck.length || this.run.pressure === 0) {
      this.showResults();
      return;
    }
    this.showBattle();
  }

  private showResults(): void {
    if (!this.runSaved) {
      this.profile = persistRun(this.profile, {
        clarity: this.run.clarity,
        maxClarity: this.deck.length,
        composure: this.run.composure,
        journal: this.run.journal
      });
      this.runSaved = true;
    }

    const root = this.clearScreen();
    const victory = this.run.clarity >= 4 && this.run.composure > 0;
    this.drawBackground(root, 'result', victory ? C.green : C.red);
    this.addHeader(root, victory ? 'ПРОТОКОЛ ВЫЖИЛ' : 'РЫНОК ПОЖЕВАЛ', victory ? 'сезон закрыт' : 'ошибка не провал, если она записана', 'Signal Arena');

    const summary = this.add.container(CX, 405);
    root.add(summary);
    summary.add(this.roundRect(0, 0, 960, 430, 38, 0x0d1832, 0.96, victory ? C.green : C.red, 3));
    summary.add(this.add.image(-360, 14, 'skrebka').setDisplaySize(180, 268));
    summary.add(this.roundRect(-360, 14, 190, 278, 25, 0x000000, 0, C.gold, 2));
    summary.add(this.txt(-240, -155, victory ? SKREBKA_LINES.win : SKREBKA_LINES.lose, 34, '#f2f7ff', '900', 650, 'left', 1.12));
    summary.add(this.txt(-240, 12, 'Итоговый продуктовый принцип: игрок получает навык принятия решения, а не привычку нажимать кнопки терминала.', 27, '#b7c7e5', '700', 650, 'left', 1.16));

    const stats = [
      ['ясность', `${this.run.clarity}/${this.deck.length}`, C.green],
      ['выдержка', `${this.run.composure}/3`, C.gold],
      ['давление', `${this.run.pressure}%`, C.red]
    ] as const;
    stats.forEach(([label, value, color], i) => {
      summary.add(this.statTile(-220 + i * 245, 158, 208, label, value, color));
    });

    const journalPanel = this.add.container(CX, 967);
    root.add(journalPanel);
    journalPanel.add(this.roundRect(0, 0, 960, 650, 38, 0x071226, 0.96, 0x1b385b, 2));
    journalPanel.add(this.txt(-420, -286, 'ЖУРНАЛ РЕШЕНИЙ', 31, '#22d8f5', '900', 820));
    journalPanel.add(this.txt(-420, -242, 'Здесь награда выдаётся не за частоту кликов, а за закрытую ошибку. Скучно? Миллионы теряются именно на весёлом.', 24, '#8fa1c0', '700', 820, 'left', 1.13));

    const mistakes = this.run.journal.filter((entry) => !entry.success);
    if (mistakes.length === 0) {
      journalPanel.add(this.roundRect(0, 65, 840, 220, 30, 0x0d1832, 0.9, C.green, 2));
      journalPanel.add(this.txt(-380, -2, 'ОШИБОК НЕТ. ПОДОЗРИТЕЛЬНО.', 33, '#34d399', '900', 760));
      journalPanel.add(this.txt(-380, 55, 'Рынок не любит идеальные отчёты. Он уже готовит сезон сложнее.', 27, '#f2f7ff', '800', 760, 'left', 1.12));
    } else {
      mistakes.slice(0, 3).forEach((entry, i) => {
        const y = -110 + i * 170;
        journalPanel.add(this.roundRect(0, y, 840, 142, 28, 0x0d1832, 0.92, PROTOCOLS[entry.required].border, 2));
        journalPanel.add(this.txt(-386, y - 50, entry.caseName.toUpperCase(), 22, '#f5c044', '900', 760));
        journalPanel.add(this.txt(-386, y - 12, `лекарство: ${PROTOCOLS[entry.required].title}`, 27, '#f2f7ff', '900', 760));
        journalPanel.add(this.txt(-386, y + 30, entry.lesson, 21, '#8fa1c0', '700', 760, 'left', 1.05));
      });
    }

    const manifesto = this.add.container(CX, 1398);
    root.add(manifesto);
    manifesto.add(this.roundRect(0, 0, 960, 246, 34, 0x111f42, 0.94, 0x2a4e7a, 2));
    manifesto.add(this.txt(-420, -91, 'КОММЕРЧЕСКИЙ КРЮК', 24, '#f5c044', '900', 820));
    manifesto.add(this.txt(-420, -48, 'Короткие 8–12 минутные рейды. Боссы-искажения. Косметические сезоны. Гильдии разбора. Никакой продажи преимущества.', 28, '#f2f7ff', '800', 820, 'left', 1.12));
    manifesto.add(this.txt(-420, 58, `proof: ${this.profile.lastProof ?? 'SA-ARCHIVE'} · XP: ${this.profile.xp} · бейджи: ${this.profile.badges.length}`, 24, '#f5c044', '900', 820));
    manifesto.add(this.txt(-420, 100, 'Игрок возвращается не за свечами, а за ощущением: “я стал меньше кормить хаос”.', 23, '#8fa1c0', '700', 820));

    root.add(this.primaryButton(CX, 1638, 900, 112, 'ПОВТОРИТЬ РЕЙД', 'следующая ошибка уже ждёт оформление', victory ? C.green : C.red, () => this.startRun()));
    root.add(this.secondaryButton(CX, 1768, 900, 86, 'ВЕРНУТЬСЯ В АРХИВ', 'профиль сохранён локально', C.purple, () => this.showMenu()));
    root.add(this.txt(CX - 360, 1862, 'Скрепка остаётся каноном. Архив не врёт, он недоговаривает.', 24, '#5a6c8a', '800', 720, 'center'));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 260, ease: 'Sine.easeOut' });
  }

  private showCodex(): void {
    const root = this.clearScreen();
    this.drawBackground(root, 'menu', C.purple);
    this.addHeader(root, 'КОДЕКС ПРОТОКОЛОВ', 'шесть способов не кормить хаос', 'скрепка одобряет');

    const intro = this.add.container(CX, 260);
    root.add(intro);
    intro.add(this.roundRect(0, 0, 960, 220, 34, 0x111f42, 0.94, 0x2a4e7a, 2));
    intro.add(this.add.image(-386, 0, 'skrebka').setDisplaySize(132, 198));
    intro.add(this.roundRect(-386, 0, 140, 206, 22, 0x000000, 0, C.gold, 2));
    intro.add(this.txt(-292, -76, 'АРХИВНАЯ ЗАПИСКА', 23, '#f5c044', '900', 690));
    intro.add(this.txt(-292, -36, 'Протокол — это кнопка до кнопки. Он решает, можно ли вообще входить в действие.', 31, '#f2f7ff', '900', 690, 'left', 1.12));
    intro.add(this.txt(-292, 70, 'Если ответ выглядит как торговый терминал — мы проиграли дизайн.', 23, '#8fa1c0', '700', 690));

    const protocols = Object.values(PROTOCOLS);
    protocols.forEach((protocol, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col === 0 ? 300 : 780;
      const y = 505 + row * 188;
      const card = this.add.container(x, y);
      root.add(card);
      card.add(this.roundRect(0, 0, 444, 154, 28, protocol.color, 0.94, protocol.border, 2));
      card.add(this.roundRect(-164, 0, 74, 74, 20, 0x020611, 0.68, protocol.border, 2));
      card.add(this.txt(-201, -29, protocol.icon, 52, '#f2f7ff', '900', 74, 'center'));
      card.add(this.txt(-112, -52, protocol.title, 25, '#f2f7ff', '900', 296));
      card.add(this.txt(-112, -10, protocol.micro, 21, '#b7c7e5', '700', 296, 'left', 1.06));
      card.add(this.txt(114, 45, `P-${index + 1}`, 17, '#5a6c8a', '900', 90, 'right'));
    });

    const enemies = this.add.container(CX, 1120);
    root.add(enemies);
    enemies.add(this.roundRect(0, 0, 960, 290, 34, 0x071226, 0.94, 0x1b385b, 2));
    enemies.add(this.txt(-420, -114, 'БЕСТИАРИЙ ИСКАЖЕНИЙ', 25, '#22d8f5', '900', 820));
    enemies.add(this.txt(-420, -72, 'Враги не торгуют против тебя. Они торгуют твоим импульсом.', 27, '#f2f7ff', '800', 820));
    CASES.forEach((item, index) => {
      const x = -330 + (index % 3) * 330;
      const y = 20 + Math.floor(index / 3) * 82;
      enemies.add(this.chip(x, y, item.bossName, item.palette.accent, 286));
    });

    const principles = this.add.container(CX, 1432);
    root.add(principles);
    principles.add(this.roundRect(0, 0, 960, 286, 34, 0x0d1832, 0.94, 0x1d3556, 2));
    principles.add(this.txt(-420, -110, 'ПРАВИЛА ПРОДУКТА', 25, '#f5c044', '900', 820));
    principles.add(this.txt(-420, -62, '9:16. Мало кнопок. Нет копии биржи. Нет обещания прибыли. Есть навык: остановиться, проверить, отказаться, записать.', 31, '#f2f7ff', '800', 820, 'left', 1.14));
    principles.add(this.txt(-420, 78, 'Web3-слой: proof-of-skill и косметика. Ответы, шанс и бюджет не продаются.', 24, '#8fa1c0', '700', 820));

    root.add(this.primaryButton(CX, 1666, 900, 108, 'НАЧАТЬ РЕЙД ИЗ КОДЕКСА', 'практика лучше красивого PDF', C.cyan, () => this.startRun()));
    root.add(this.secondaryButton(CX, 1792, 900, 86, 'НАЗАД В АРХИВ', 'скрепка свернётся в панель задач', C.purple, () => this.showMenu()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 240, ease: 'Sine.easeOut' });
  }

  private addHeader(root: Phaser.GameObjects.Container, title: string, subtitle: string, right: string): void {
    root.add(this.roundRect(CX, 79, 984, 112, 32, 0x050a16, 0.88, 0x18304f, 2));
    root.add(this.txt(78, 37, title, 44, '#f2f7ff', '900', 610));
    root.add(this.txt(80, 87, subtitle, 22, '#8fa1c0', '800', 620));
    root.add(this.txt(748, 55, right, 20, '#5a6c8a', '900', 250, 'right'));
  }

  private addMiniMeter(root: Phaser.GameObjects.Container, x: number, y: number, w: number, label: string, value: number, color: number): void {
    root.add(this.txt(x - 150, y - 12, label, 16, '#8fa1c0', '900', 120));
    root.add(this.roundRect(x - 2, y, w, 18, 9, 0x121d34, 1, 0x253a58, 1));
    const fill = Math.max(0.03, Math.min(1, value));
    root.add(this.roundRect(x - w / 2 + (w * fill) / 2, y, w * fill, 18, 9, color, 0.88));
  }

  private drawBackground(root: Phaser.GameObjects.Container, mode: 'menu' | 'battle' | 'result', accent = C.cyan): void {
    const g = this.add.graphics();
    root.add(g);

    g.fillStyle(0x01030a, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0x061329, 0.92);
    g.fillRect(0, 0, GAME_W, GAME_H);

    g.fillStyle(accent, mode === 'menu' ? 0.08 : 0.06);
    g.fillCircle(CX, -80, 560);
    g.fillStyle(C.purple, mode === 'result' ? 0.08 : 0.04);
    g.fillCircle(1030, 1830, 520);
    g.fillStyle(0x000000, 0.36);
    g.fillRect(0, 0, GAME_W, GAME_H);

    g.lineStyle(2, 0x1a3557, 0.22);
    for (let y = 165; y < GAME_H; y += 120) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(GAME_W, y + 38);
      g.strokePath();
    }
    for (let x = 34; x < GAME_W; x += 118) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x - 160, GAME_H);
      g.strokePath();
    }

    const seed = mode === 'menu' ? 19 : mode === 'battle' ? 31 : 47;
    for (let i = 0; i < 42; i++) {
      const x = (i * 83 + seed * 17) % GAME_W;
      const y = (i * 137 + seed * 23) % GAME_H;
      const a = 0.1 + ((i % 5) * 0.035);
      g.fillStyle(i % 4 === 0 ? accent : 0x8fa1c0, a);
      g.fillCircle(x, y, i % 3 === 0 ? 3 : 2);
    }

    const vignette = this.add.graphics();
    root.add(vignette);
    vignette.fillStyle(0x000000, 0.24);
    vignette.fillRect(0, 0, 58, GAME_H);
    vignette.fillRect(GAME_W - 58, 0, 58, GAME_H);
  }

  private drawTrace(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, values: number[], accent: number, danger: number): void {
    parent.add(this.roundRect(x + w / 2, y + h / 2, w, h, 22, 0x020611, 0.72, 0x1d3556, 1));
    const g = this.add.graphics();
    parent.add(g);

    for (let i = 0; i < 6; i++) {
      const xx = x + 35 + i * ((w - 70) / 5);
      g.lineStyle(1, 0x23405f, 0.35);
      g.beginPath();
      g.moveTo(xx, y + 18);
      g.lineTo(xx, y + h - 18);
      g.strokePath();
    }

    g.lineStyle(10, accent, 0.16);
    this.strokeTrace(g, x, y, w, h, values);
    g.lineStyle(4, accent, 0.96);
    this.strokeTrace(g, x, y, w, h, values);

    values.forEach((value, i) => {
      if (i === 0 || i === values.length - 1 || i === Math.floor(values.length / 2)) {
        const px = x + 44 + i * ((w - 88) / (values.length - 1));
        const py = y + h - 26 - value * (h - 52);
        g.fillStyle(i === values.length - 1 ? danger : accent, 0.95);
        g.fillCircle(px, py, 8);
      }
    });

    parent.add(this.txt(x + 22, y + 14, 'СИГНАЛЬНЫЙ СЛЕД · без осей, без соблазна терминала', 18, '#5a6c8a', '800', w - 44));
  }

  private drawDecisionReplay(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    values: number[],
    isCorrect: boolean,
    accent: number,
    danger: number
  ): void {
    parent.add(this.roundRect(x + w / 2, y + h / 2, w, h, 24, 0x020611, 0.78, isCorrect ? accent : danger, 2));
    parent.add(this.txt(x + 22, y + 14, 'БУДУЩЕЕ ПОСЛЕ ОТВЕТА', 18, isCorrect ? '#34d399' : '#fb4d6d', '900', 330));

    const last = values[values.length - 1];
    const direction = last >= 0.5 ? 1 : -1;
    const future = values.concat(
      Array.from({ length: 5 }, (_, i) => {
        if (isCorrect) {
          const drift = (0.52 - last) * ((i + 1) / 5);
          return Phaser.Math.Clamp(last + drift + Math.sin(i * 1.7) * 0.025, 0.08, 0.94);
        }
        return Phaser.Math.Clamp(last + direction * 0.065 * (i + 1) + Math.sin(i * 2.1) * 0.045, 0.06, 0.96);
      })
    );

    const g = this.add.graphics();
    parent.add(g);

    g.lineStyle(2, 0x23405f, 0.35);
    g.beginPath();
    g.moveTo(x + w * 0.64, y + 24);
    g.lineTo(x + w * 0.64, y + h - 18);
    g.strokePath();

    g.lineStyle(8, 0x8fa1c0, 0.13);
    this.strokePartialTrace(g, x + 28, y + 30, w - 56, h - 46, future, 0, values.length - 1);
    g.lineStyle(4, 0x8fa1c0, 0.65);
    this.strokePartialTrace(g, x + 28, y + 30, w - 56, h - 46, future, 0, values.length - 1);

    g.lineStyle(10, isCorrect ? accent : danger, 0.18);
    this.strokePartialTrace(g, x + 28, y + 30, w - 56, h - 46, future, values.length - 1, future.length - 1);
    g.lineStyle(5, isCorrect ? accent : danger, 0.98);
    this.strokePartialTrace(g, x + 28, y + 30, w - 56, h - 46, future, values.length - 1, future.length - 1);

    parent.add(this.txt(x + 520, y + 18, isCorrect ? 'хаос потерял темп' : 'ошибка стала дороже', 20, '#f2f7ff', '900', 250, 'right'));
  }

  private strokePartialTrace(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    values: number[],
    start: number,
    end: number
  ): void {
    g.beginPath();
    for (let i = start; i <= end; i++) {
      const value = values[i];
      const px = x + i * (w / (values.length - 1));
      const py = y + h - value * h;
      if (i === start) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }

  private strokeTrace(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, values: number[]): void {
    g.beginPath();
    values.forEach((value, i) => {
      const px = x + 44 + i * ((w - 88) / (values.length - 1));
      const py = y + h - 26 - value * (h - 52);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.strokePath();
  }

  private primaryButton(x: number, y: number, w: number, h: number, label: string, micro: string, accent: number, onClick: () => void): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    button.add(this.roundRect(0, 0, w, h, 34, 0x0b2036, 0.98, accent, 4));
    button.add(this.roundRect(0, h / 2 - 10, w - 24, 18, 9, accent, 0.16));
    button.add(this.txt(-w / 2 + 40, -34, label, 35, '#f2f7ff', '900', w - 80, 'center'));
    button.add(this.txt(-w / 2 + 40, 18, micro, 22, '#8fa1c0', '800', w - 80, 'center'));
    this.registerButton(button, w, h, onClick);
    this.tweens.add({ targets: button, scaleX: 1.012, scaleY: 1.012, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return button;
  }

  private secondaryButton(x: number, y: number, w: number, h: number, label: string, micro: string, accent: number, onClick: () => void): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    button.add(this.roundRect(0, 0, w, h, 28, 0x071226, 0.92, accent, 2));
    button.add(this.txt(-w / 2 + 36, -26, label, 26, '#f2f7ff', '900', w - 72, 'center'));
    button.add(this.txt(-w / 2 + 36, 14, micro, 19, '#8fa1c0', '800', w - 72, 'center'));
    this.registerButton(button, w, h, onClick);
    return button;
  }

  private miniProfileTile(x: number, y: number, label: string, value: string, color: number): Phaser.GameObjects.Container {
    const tile = this.add.container(x, y);
    tile.add(this.roundRect(0, 0, 178, 88, 22, 0x0d1832, 0.88, color, 2));
    tile.add(this.txt(-72, -30, label.toUpperCase(), 16, '#8fa1c0', '900', 144, 'center'));
    tile.add(this.txt(-72, -2, value, 34, '#f2f7ff', '900', 144, 'center'));
    return tile;
  }

  private statTile(x: number, y: number, w: number, label: string, value: string, color: number): Phaser.GameObjects.Container {
    const tile = this.add.container(x, y);
    tile.add(this.roundRect(0, 0, w, 118, 24, 0x071226, 0.86, color, 2));
    tile.add(this.txt(-w / 2 + 18, -42, label.toUpperCase(), 17, '#8fa1c0', '900', w - 36, 'center'));
    tile.add(this.txt(-w / 2 + 18, -10, value, 46, '#f2f7ff', '900', w - 36, 'center'));
    return tile;
  }

  private chip(x: number, y: number, label: string, color: number, w = 180): Phaser.GameObjects.Container {
    const chip = this.add.container(x, y);
    chip.add(this.roundRect(0, 0, w, 48, 20, 0x071226, 0.88, color, 2));
    chip.add(this.txt(-w / 2 + 15, -15, label, 20, '#f2f7ff', '900', w - 30, 'center'));
    return chip;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.03): void {
    if (typeof window === 'undefined') return;
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    this.audioContext ??= new AudioCtor();
    void this.audioContext.resume();

    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = gainValue;
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
    oscillator.stop(this.audioContext.currentTime + duration + 0.02);
  }

  private haptic(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  private registerButton(target: Phaser.GameObjects.Container, w: number, h: number, onClick: () => void): void {
    target.setSize(w, h);
    target.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    target.on('pointerover', () => {
      this.tweens.add({ targets: target, scaleX: 1.018, scaleY: 1.018, duration: 90, ease: 'Sine.easeOut' });
    });
    target.on('pointerout', () => {
      this.tweens.add({ targets: target, scaleX: 1, scaleY: 1, duration: 90, ease: 'Sine.easeOut' });
    });
    target.on('pointerdown', () => onClick());
  }

  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    fill: number,
    alpha = 1,
    stroke?: number,
    strokeWidth = 2
  ): Phaser.GameObjects.GameObject {
    if (this.rexUI?.add?.roundRectangle) {
      const shape = this.rexUI.add.roundRectangle(x, y, w, h, radius, fill, alpha);
      if (stroke !== undefined && shape.setStrokeStyle) {
        shape.setStrokeStyle(strokeWidth, stroke, 0.9);
      }
      return shape;
    }

    const g = this.add.graphics({ x: x - w / 2, y: y - h / 2 });
    g.fillStyle(fill, alpha);
    g.fillRoundedRect(0, 0, w, h, radius);
    if (stroke !== undefined) {
      g.lineStyle(strokeWidth, stroke, 0.9);
      g.strokeRoundedRect(0, 0, w, h, radius);
    }
    return g;
  }

  private txt(
    x: number,
    y: number,
    content: string,
    size: number,
    color: string,
    weight: '400' | '700' | '800' | '900' = '700',
    width = 500,
    align: CanvasTextAlign = 'left',
    lineSpacing = 1.1
  ): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, content, {
      fontFamily: 'Inter, Arial, Helvetica, sans-serif',
      fontSize: `${size}px`,
      fontStyle: weight === '900' || weight === '800' ? 'bold' : 'normal',
      color,
      align,
      wordWrap: { width, useAdvancedWrap: true },
      lineSpacing: Math.round(size * (lineSpacing - 1))
    });
    return text;
  }
}
