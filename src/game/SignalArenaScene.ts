import Phaser from 'phaser';
import { BADGE_COPY, CASES, COSMETICS, DAILY_MISSIONS, PROTOCOLS, RUN_LENGTH, SKREBKA_LINES, type ArenaCase, type ProtocolId } from './data';
import { ASSETS } from './assets';
import { buyCosmetic, completeReview, equipCosmetic, loadProfile, markTutorialSeen, persistLab, persistRun, resetProfile, setSettings, type SaveProfile } from './save';
import { track } from './telemetry';
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
  private acceptingFocus = false;
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
    this.profile = loadProfile();
    if (this.profile.tutorialSeen) {
      this.showMenu();
    } else {
      this.showOnboarding(0);
    }
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
    this.acceptingFocus = false;
    if (this.screen) {
      this.screen.destroy(true);
    }
    this.screen = this.add.container(0, 0);
    return this.screen;
  }

  private showOnboarding(step: 0 | 1 | 2): void {
    track('screen.onboarding', { step });
    const root = this.clearScreen();
    const item = CASES[0];
    this.drawBackground(root, step === 1 ? 'battle' : 'menu', step === 1 ? item.palette.accent : C.cyan);

    if (step === 0) {
      this.addHeader(root, 'АРХИВНЫЙ ПРОЛОГ', 'первые 90 секунд без биржевого культа', 'new player');
      const panel = this.add.container(CX, 620);
      root.add(panel);
      panel.add(this.roundRect(0, 0, 960, 900, 44, 0x0d1832, 0.96, C.cyan, 3));
      panel.add(this.add.image(0, -170, 'skrebka').setDisplaySize(360, 538).setAlpha(0.97));
      panel.add(this.roundRect(0, -170, 380, 558, 42, 0x000000, 0, C.gold, 2));
      panel.add(this.txt(-420, 138, 'СКРЕПКА ПРИБЫЛА', 31, '#f5c044', '900', 820, 'center'));
      panel.add(this.txt(-420, 198, 'Я пришёл из прошлого, чтобы помочь тебе в будущем. Нет, я не ИИ. Я офисная травма с лицензией на здравый смысл.', 38, '#f2f7ff', '900', 820, 'center', 1.12));
      panel.add(this.txt(-420, 388, 'Правило обучения: мы тренируем момент ДО сделки. Поэтому здесь нет кнопки купить, продать или поверить человеку с микрофоном.', 28, '#b7c7e5', '800', 820, 'center', 1.15));

      const rules = this.add.container(CX, 1190);
      root.add(rules);
      rules.add(this.roundRect(0, 0, 960, 300, 34, 0x071226, 0.94, 0x1b385b, 2));
      rules.add(this.txt(-420, -110, 'ТРИ ЗАКОНА АРЕНЫ', 25, '#22d8f5', '900', 820));
      rules.add(this.txt(-420, -64, '1. Экран вертикальный.\n2. Выборов мало, последствий много.\n3. Терминал остаётся за дверью. Здесь воюют протоколы.', 32, '#f2f7ff', '900', 820, 'left', 1.12));

      root.add(this.primaryButton(CX, 1540, 900, 112, 'ПОНЯТНО. ПОКА СТРАННО.', 'Скрепка считает это согласием', C.cyan, () => this.showOnboarding(1)));
      root.add(this.secondaryButton(CX, 1670, 900, 82, 'ПРОПУСТИТЬ ПРОЛОГ', 'архив запомнит твою спешку', C.purple, () => {
        this.profile = markTutorialSeen(this.profile);
        this.showMenu();
      }));
    }

    if (step === 1) {
      this.addHeader(root, 'УЧЕБНЫЙ ИМПУЛЬС', 'выбери протокол, не сделку', 'tutorial');
      const boss = this.add.container(CX, 390);
      root.add(boss);
      boss.add(this.roundRect(0, 0, 960, 510, 38, 0x071226, 0.96, item.palette.accent, 3));
      boss.add(this.add.image(0, -28, item.assetKey).setDisplaySize(960, 524).setAlpha(0.72));
      boss.add(this.add.rectangle(0, 150, 960, 220, 0x01030a, 0.7));
      boss.add(this.txt(-420, -218, 'ФАНТОМ FOMO УЧЕБНЫЙ', 25, '#f5c044', '900', 820));
      boss.add(this.txt(-420, 70, 'Ракета уже улетела. Толпа предлагает купить её хвост.', 42, '#f2f7ff', '900', 820, 'left', 1.04));
      boss.add(this.txt(-420, 170, 'Скрепка запрещает героизм. Найди протокол, который признаёт поздний вход.', 27, '#b7c7e5', '800', 820));

      const dossier = this.add.container(CX, 835);
      root.add(dossier);
      dossier.add(this.roundRect(0, 0, 960, 350, 34, 0x0d1832, 0.94, 0x1b385b, 2));
      dossier.add(this.txt(-420, -130, 'ДОСЬЕ', 24, '#22d8f5', '900', 820));
      item.signal.forEach((s, index) => {
        const x = index % 2 === 0 ? -245 : 245;
        const y = -54 + Math.floor(index / 2) * 86;
        dossier.add(this.chip(x, y, s, index === 2 ? C.gold : item.palette.accent, 410));
      });
      dossier.add(this.txt(-420, 126, 'Подсказка: если плановый вход ушёл, рынок не обязан ждать твою самооценку.', 22, '#8fa1c0', '700', 820));

      item.options.forEach((protocolId, index) => {
        const protocol = PROTOCOLS[protocolId];
        const y = 1130 + index * 148;
        const card = this.add.container(CX, y);
        root.add(card);
        card.add(this.roundRect(0, 0, 930, 118, 30, protocol.color, 0.95, protocol.border, protocolId === item.correct ? 4 : 2));
        card.add(this.txt(-405, -38, protocol.icon, 58, '#f2f7ff', '900', 90, 'center'));
        card.add(this.txt(-300, -38, protocol.title, 34, '#f2f7ff', '900', 650));
        card.add(this.txt(-300, 10, protocol.micro, 23, '#b7c7e5', '700', 650));
        this.registerButton(card, 930, 118, () => {
          if (protocolId === item.correct) this.showOnboarding(2);
          else {
            this.cameras.main.shake(140, 0.004);
            this.haptic([14, 28, 14]);
            this.playTone(110, 0.12, 'sawtooth', 0.018);
          }
        });
      });
      root.add(this.txt(120, 1650, 'Да, правильная карта подсвечена. Это обучение, не экзамен. Рынок и так всё усложнит.', 23, '#8fa1c0', '800', 840, 'center'));
    }

    if (step === 2) {
      this.addHeader(root, 'ПЕРВЫЙ ПРОТОКОЛ ЗАКРЫТ', 'теперь можно выпускать тебя в хаос', '+40 XP');
      const panel = this.add.container(CX, 620);
      root.add(panel);
      panel.add(this.roundRect(0, 0, 960, 820, 44, 0x0d1832, 0.96, C.green, 3));
      panel.add(this.add.image(-350, -190, 'skrebka').setDisplaySize(190, 284));
      panel.add(this.roundRect(-350, -190, 200, 294, 30, 0x000000, 0, C.gold, 2));
      panel.add(this.txt(-220, -300, 'FOMO ЗАПЕРТ', 42, '#34d399', '900', 650));
      panel.add(this.txt(-220, -226, 'Ты не купил надежду на максимуме. Это выглядит скучно. Именно поэтому капитал не умер.', 32, '#f2f7ff', '900', 650, 'left', 1.12));
      this.drawDecisionReplay(panel, -402, 30, 804, 120, item.trace, true, item.palette.accent, item.palette.danger);
      panel.add(this.roundRect(0, 238, 840, 210, 30, 0x071226, 0.92, 0x1b385b, 2));
      panel.add(this.txt(-392, 160, 'ЧТО ОТКРЫЛОСЬ', 23, '#22d8f5', '900', 760));
      panel.add(this.txt(-392, 202, 'Карта рейда, лаборатория, архив ошибок, кодекс и профиль. Теперь игра будет требовать не кликов, а честных решений.', 27, '#b7c7e5', '800', 760, 'left', 1.12));

      root.add(this.primaryButton(CX, 1235, 900, 112, 'В АРХИВ', 'открыть настоящий хаб', C.green, () => {
        this.profile = markTutorialSeen(this.profile);
        this.showMenu();
      }));
      root.add(this.secondaryButton(CX, 1366, 900, 84, 'СРАЗУ НА КАРТУ', 'Скрепка делает вид, что это безопасно', C.cyan, () => {
        this.profile = markTutorialSeen(this.profile);
        this.prepareRaidMap();
      }));
    }

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 260, ease: 'Sine.easeOut' });
  }

  private showMenu(): void {
    track('screen.hub');
    this.profile = loadProfile();
    const root = this.clearScreen();
    this.drawBackground(root, 'menu');

    this.addHeader(root, 'SIGNAL ARENA', 'протоколы против рыночных искажений', 'Phaser 4 · rexUI');

    const hero = this.add.container(CX, 395);
    root.add(hero);
    hero.add(this.roundRect(0, 0, 960, 470, 38, 0x071226, 0.92, C.line, 2));
    const img = this.add.image(0, -24, 'boss-hubris').setDisplaySize(960, 520).setAlpha(0.56);
    hero.add(img);
    hero.add(this.add.rectangle(0, 94, 960, 278, 0x01030a, 0.68));
    hero.add(this.add.rectangle(0, -188, 960, 126, 0x01030a, 0.5));
    hero.add(this.txt(-420, -190, 'НЕ ТЕРМИНАЛ. НЕ ДЕМО-БИРЖА.', 27, '#f5c044', '900', 820));
    hero.add(this.txt(-420, -140, 'Охота на решение до клика.', 50, '#f2f7ff', '900', 830, 'left', 1.03));
    hero.add(this.txt(-420, 38, 'Ты не покупаешь и не продаёшь. Ты вскрываешь искажение, выбираешь протокол и смотришь будущее после ответа.', 29, '#b7c7e5', '800', 805, 'left', 1.15));
    hero.add(this.chip(-320, 173, '9:16', C.cyan, 180));
    hero.add(this.chip(-105, 173, '3 решения', C.gold, 205));
    hero.add(this.chip(140, 173, 'журнал ошибок', C.purple, 250));
    hero.add(this.chip(365, 173, 'Web3 proof', C.green, 210));

    const contract = this.add.container(CX, 710);
    root.add(contract);
    contract.add(this.roundRect(0, 0, 960, 196, 32, 0x111f42, 0.94, 0x2a4e7a, 2));
    contract.add(this.txt(-420, -72, 'СЕГОДНЯШНИЙ КОНТРАКТ', 23, '#22d8f5', '900', 570));
    contract.add(this.txt(214, -72, `пул: ${CASES.length} · рейд: ${RUN_LENGTH}`, 20, '#5a6c8a', '900', 220, 'right'));
    const mission = DAILY_MISSIONS[this.profile.runs % DAILY_MISSIONS.length];
    contract.add(this.txt(-420, -28, mission, 30, '#f2f7ff', '900', 820, 'left', 1.12));
    contract.add(this.txt(-420, 75, 'Награда выдаётся за разбор, дисциплину и отказ от дурной сделки. Частота кликов не считается навыком.', 22, '#8fa1c0', '700', 820));

    const profile = this.add.container(CX, 945);
    root.add(profile);
    profile.add(this.roundRect(0, 0, 960, 190, 32, 0x071226, 0.92, 0x1b385b, 2));
    profile.add(this.txt(-420, -70, 'АРХИВ ПРОФИЛЯ', 22, '#f5c044', '900', 360));
    profile.add(this.miniProfileTile(-315, 26, 'рейды', String(this.profile.runs), C.cyan));
    profile.add(this.miniProfileTile(-105, 26, 'лучший', `${this.profile.bestClarity}/${RUN_LENGTH}`, C.green));
    profile.add(this.miniProfileTile(105, 26, 'стрик', `${this.profile.streakDays}д`, C.gold));
    profile.add(this.miniProfileTile(315, 26, 'ревью', String(this.profile.pendingReviews.length), C.red));
    profile.add(this.txt(190, -70, this.profile.lastProof ? `proof ${this.profile.lastProof}` : 'proof появится после рейда', 20, '#5a6c8a', '900', 340, 'right'));

    const sk = this.add.container(CX, 1178);
    root.add(sk);
    sk.add(this.roundRect(0, 0, 960, 210, 32, 0x0d1832, 0.95, 0x2a4e7a, 2));
    const portrait = this.add.image(-385, -4, 'skrebka').setDisplaySize(150, 224).setAlpha(0.97);
    sk.add(portrait);
    sk.add(this.roundRect(-385, -4, 158, 232, 24, 0x000000, 0, C.gold, 2));
    sk.add(this.txt(-285, -76, 'СКРЕПКА // аналоговый помощник', 23, '#f5c044', '900', 690));
    sk.add(this.txt(-285, -36, SKREBKA_LINES.intro, 28, '#f2f7ff', '800', 690, 'left', 1.1));
    sk.add(this.txt(-285, 72, 'Он не меняет образ. Архивные сущности редко слушают маркетинг.', 22, '#8fa1c0', '700', 690));

    root.add(this.primaryButton(CX, 1405, 900, 118, 'ОТКРЫТЬ КАРТУ РЕЙДА', 'ежедневный маршрут · пять искажений', C.cyan, () => {
      this.prepareRaidMap();
    }));

    root.add(this.secondaryButton(CX, 1537, 900, 92, 'СИГНАЛЬНАЯ ЛАБОРАТОРИЯ', 'короткая тренировка чтения шума без терминала', C.green, () => {
      this.showLab();
    }));

    const nav = this.add.container(CX, 1668);
    root.add(nav);
    nav.add(this.navButton(-305, 0, 286, 'КОДЕКС', 'протоколы', C.purple, () => this.showCodex()));
    nav.add(this.navButton(0, 0, 286, 'ПРОФИЛЬ', 'мастерство', C.gold, () => this.showProfile()));
    nav.add(this.navButton(305, 0, 286, 'НАСТРОЙКИ', 'звук / сброс', C.line, () => this.showSettings()));

    const footer = this.add.container(CX, 1812);
    root.add(footer);
    footer.add(this.roundRect(0, 0, 930, 96, 26, 0x050a16, 0.82, 0x18304f, 1));
    footer.add(this.txt(-420, -30, 'Принцип 99-го уровня: игра продаёт чувство контроля над хаосом, а не иллюзию лёгкой прибыли.', 22, '#8fa1c0', '800', 820, 'center'));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 260, ease: 'Sine.easeOut' });
  }

  private prepareRaidMap(): void {
    this.deck = this.buildDailyDeck();
    this.showRaidMap();
  }

  private startRun(reuseDeck = false): void {
    if (!reuseDeck) {
      this.deck = this.buildDailyDeck();
    }
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
    return deck.slice(0, RUN_LENGTH);
  }

  private showRaidMap(): void {
    track('screen.raid_map', { deck: this.deck.map((item) => item.id).join(',') });
    const root = this.clearScreen();
    const accent = this.deck[0]?.palette.accent ?? C.cyan;
    this.drawBackground(root, 'menu', accent);
    this.addHeader(root, 'КАРТА НОЧНОГО РЕЙДА', 'ежедневная цепочка искажений', `пул ${CASES.length}`);

    const map = this.add.container(CX, 610);
    root.add(map);
    map.add(this.roundRect(0, 0, 960, 910, 40, 0x071226, 0.94, 0x1b385b, 2));
    map.add(this.txt(-420, -392, 'МАРШРУТ СЕГОДНЯ', 28, '#22d8f5', '900', 760));
    map.add(this.txt(-420, -350, 'Пять столкновений. Один экран решения. Ни одной кнопки торговли. Протокол либо защищает систему, либо кормит чудовище.', 25, '#b7c7e5', '800', 790, 'left', 1.13));

    const path = this.add.graphics();
    map.add(path);
    path.lineStyle(8, accent, 0.18);
    path.beginPath();
    this.deck.forEach((_, index) => {
      const p = this.raidNodePosition(index);
      if (index === 0) path.moveTo(p.x, p.y);
      else path.lineTo(p.x, p.y);
    });
    path.strokePath();
    path.lineStyle(3, 0xf5c044, 0.38);
    path.strokePath();

    this.deck.forEach((item, index) => {
      const p = this.raidNodePosition(index);
      const node = this.add.container(p.x, p.y);
      map.add(node);
      node.add(this.roundRect(0, 0, 278, 142, 30, 0x0d1832, 0.96, item.palette.accent, 3));
      const boss = this.add.image(-94, -4, item.assetKey).setDisplaySize(86, 86).setAlpha(0.9);
      node.add(boss);
      node.add(this.roundRect(-94, -4, 94, 94, 24, 0x000000, 0, item.palette.danger, 2));
      node.add(this.txt(-42, -50, `0${index + 1}`, 18, '#5a6c8a', '900', 52, 'center'));
      node.add(this.txt(-38, -27, item.bossName, 21, '#f2f7ff', '900', 180));
      node.add(this.txt(-38, 8, item.district, 16, '#8fa1c0', '700', 180));
      node.add(this.txt(-38, 42, 'опасность ' + '◆'.repeat(item.difficulty), 15, '#f5c044', '900', 180));
      if (!this.profile.settings.reducedMotion) {
        this.tweens.add({ targets: node, y: p.y - 6, duration: 1300 + index * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    });

    const rules = this.add.container(CX, 1175);
    root.add(rules);
    rules.add(this.roundRect(0, 0, 960, 250, 34, 0x0d1832, 0.95, 0x2a4e7a, 2));
    rules.add(this.add.image(-396, 0, 'skrebka').setDisplaySize(130, 194));
    rules.add(this.roundRect(-396, 0, 138, 202, 22, 0x000000, 0, C.gold, 2));
    rules.add(this.txt(-302, -86, 'БРИФИНГ СКРЕПКИ', 24, '#f5c044', '900', 700));
    rules.add(this.txt(-302, -42, 'Карта не предсказывает рынок. Она предсказывает твои слабые места. Разница неприятная, зато полезная.', 29, '#f2f7ff', '900', 700, 'left', 1.1));
    rules.add(this.txt(-302, 78, 'Перед каждым узлом: факты → протокол → будущее → журнал.', 23, '#8fa1c0', '700', 700));

    const rewards = this.add.container(CX, 1400);
    root.add(rewards);
    rewards.add(this.roundRect(0, 0, 960, 166, 30, 0x111f42, 0.92, 0x1b385b, 2));
    rewards.add(this.txt(-420, -56, 'НАГРАДЫ БЕЗ PAY-TO-WIN', 22, '#22d8f5', '900', 760));
    rewards.add(this.txt(-420, -16, 'XP, косметическая пыль, proof-id и записи в архив. Ответы, шанс и бюджет не продаются.', 27, '#f2f7ff', '800', 810, 'left', 1.1));
    rewards.add(this.txt(-420, 62, `ожидаемый отчёт: ${RUN_LENGTH} решений · pending review: ${this.profile.pendingReviews.length}`, 21, '#8fa1c0', '700', 810));

    root.add(this.primaryButton(CX, 1622, 900, 114, 'ВЫЙТИ НА МАРШРУТ', 'рейд начнётся с первого искажения', C.cyan, () => this.startRun(true)));
    root.add(this.secondaryButton(CX, 1752, 900, 86, 'НАЗАД В АРХИВ', 'карта будет пересобрана завтра', C.purple, () => this.showMenu()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 250, ease: 'Sine.easeOut' });
  }

  private raidNodePosition(index: number): { x: number; y: number } {
    const points = [
      { x: -300, y: -218 },
      { x: 120, y: -80 },
      { x: -185, y: 88 },
      { x: 245, y: 238 },
      { x: -20, y: 398 }
    ];
    return points[index] ?? { x: 0, y: 0 };
  }

  private showBattle(phase: 'scan' | 'decision' = 'scan'): void {
    const root = this.clearScreen();
    const arenaCase = this.deck[this.run.turn];
    track('screen.battle', { phase, case: arenaCase.id, turn: this.run.turn + 1 });

    this.drawBackground(root, 'battle', arenaCase.palette.accent);
    this.addBattleHud(root, arenaCase);
    this.addBossPanel(root, arenaCase);
    this.addSignalDossier(root, arenaCase);

    if (phase === 'scan') {
      this.addFocusOptions(root, arenaCase);
      this.acceptingFocus = true;
    } else {
      this.addProtocolOptions(root, arenaCase);
      this.acceptingInput = true;
    }

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

    panel.add(this.txt(-420, -222, arenaCase.danger.toUpperCase(), 24, '#f5c044', '900', 520));
    panel.add(this.txt(120, -222, `${arenaCase.district} · ${'◆'.repeat(arenaCase.difficulty)}`, 22, '#8fa1c0', '900', 360, 'right'));
    panel.add(this.txt(-420, 91, arenaCase.bossName.toUpperCase(), 45, '#f2f7ff', '900', 720));
    panel.add(this.txt(-420, 148, arenaCase.bossTitle, 26, '#8fa1c0', '800', 720));

    const sigil = this.add.container(358, 146);
    panel.add(sigil);
    sigil.add(this.roundRect(0, 0, 154, 154, 44, 0x020611, 0.82, arenaCase.palette.danger, 3));
    sigil.add(this.txt(-52, -36, '!', 94, '#fb4d6d', '900', 104, 'center'));
    sigil.add(this.txt(-58, 52, 'ИСКАЖ.', 18, '#f5c044', '900', 116, 'center'));

    if (!this.profile.settings.reducedMotion) {
      this.tweens.add({ targets: boss, scaleX: boss.scaleX * 1.025, scaleY: boss.scaleY * 1.025, duration: 1650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
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

  private addFocusOptions(root: Phaser.GameObjects.Container, arenaCase: ArenaCase): void {
    root.add(this.txt(78, 1288, 'СКАНИРОВАНИЕ: НАЙДИ ЯД', 28, '#22d8f5', '900', 780));
    root.add(this.txt(78, 1327, 'Прежде чем выбирать протокол, назови главную причину опасности. Это добавляет глубину без превращения игры в терминал.', 23, '#8fa1c0', '700', 880, 'left', 1.12));

    arenaCase.labOptions.forEach((option, index) => {
      const y = 1450 + index * 152;
      const card = this.add.container(CX, y);
      root.add(card);
      card.add(this.roundRect(0, 0, 930, 126, 30, 0x111f42, 0.95, 0x2a4e7a, 2));
      card.add(this.roundRect(-380, 0, 98, 88, 24, 0x020611, 0.65, arenaCase.palette.accent, 2));
      card.add(this.txt(-429, -27, `0${index + 1}`, 42, '#f2f7ff', '900', 98, 'center'));
      card.add(this.txt(-310, -42, option.toUpperCase(), 31, '#f2f7ff', '900', 650));
      card.add(this.txt(-310, 7, 'выглядит как причина. проверь, не просто ли это шум', 22, '#b7c7e5', '700', 650));
      this.registerButton(card, 930, 126, () => this.resolveFocus(arenaCase, index, card));
    });
  }

  private resolveFocus(arenaCase: ArenaCase, index: number, source: Phaser.GameObjects.Container): void {
    if (!this.acceptingFocus) return;
    const success = index === arenaCase.labAnswer;
    track('battle.focus', { case: arenaCase.id, selected: index, success });
    this.acceptingFocus = false;

    if (success) {
      this.run.pressure = Math.max(0, this.run.pressure - 4);
      this.haptic(10);
      this.playTone(360, 0.08, 'triangle', 0.028);
      this.tweens.add({ targets: source, scaleX: 0.97, scaleY: 0.97, duration: 80, yoyo: true, ease: 'Sine.easeOut' });
      this.time.delayedCall(120, () => this.showBattle('decision'));
      return;
    }

    this.haptic([12, 28, 12]);
    this.playTone(120, 0.12, 'sawtooth', 0.018);
    this.cameras.main.shake(120, 0.004);
    this.toast('ЯД НЕ ТОТ. РЫНОК ЛЮБИТ ПОХОЖИЕ ОТВЕТЫ.', C.red);
    this.tweens.add({ targets: source, x: source.x + 12, duration: 55, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    this.time.delayedCall(420, () => {
      this.acceptingFocus = true;
    });
  }

  private addProtocolOptions(root: Phaser.GameObjects.Container, arenaCase: ArenaCase): void {
    this.currentOptions = arenaCase.options;
    this.optionCards = [];
    root.add(this.txt(78, 1288, 'ЯД НАЙДЕН → ВЫБЕРИ ПРОТОКОЛ', 28, '#22d8f5', '900', 780));
    root.add(this.txt(78, 1327, `${arenaCase.labOptions[arenaCase.labAnswer]}: ${arenaCase.distortion}`, 24, '#8fa1c0', '700', 880, 'left', 1.12));

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
    track('battle.protocol', { case: arenaCase.id, chosen: choice, required: arenaCase.correct, success: isCorrect });
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
    track('screen.results', { clarity: this.run.clarity, composure: this.run.composure, pressure: this.run.pressure });
    if (!this.runSaved) {
      this.profile = persistRun(this.profile, {
        clarity: this.run.clarity,
        maxClarity: this.deck.length,
        composure: this.run.composure,
        pressure: this.run.pressure,
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

    if (this.profile.pendingReviews.length > 0) {
      root.add(this.primaryButton(CX, 1628, 900, 108, 'ЗАКРЫТЬ ОШИБКУ В АРХИВЕ', 'стрик растёт только после разбора', C.gold, () => this.showReview()));
      root.add(this.secondaryButton(CX, 1752, 900, 86, 'КАРТА НОВОГО РЕЙДА', 'можно сбежать, но архив запомнит', C.purple, () => this.prepareRaidMap()));
    } else {
      root.add(this.primaryButton(CX, 1628, 900, 108, 'ПОВТОРИТЬ РЕЙД', 'следующая ошибка уже ждёт оформление', victory ? C.green : C.red, () => this.prepareRaidMap()));
      root.add(this.secondaryButton(CX, 1752, 900, 86, 'ВЕРНУТЬСЯ В АРХИВ', 'профиль сохранён локально', C.purple, () => this.showMenu()));
    }
    root.add(this.txt(CX - 360, 1858, 'Скрепка остаётся каноном. Архив не врёт, он недоговаривает.', 23, '#5a6c8a', '800', 720, 'center'));

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
    enemies.add(this.txt(-420, -72, `Враги не торгуют против тебя. Они торгуют твоим импульсом. В пуле сейчас ${CASES.length} сценариев.`, 25, '#f2f7ff', '800', 820, 'left', 1.08));
    CASES.slice(0, 6).forEach((item, index) => {
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

  private showProfile(): void {
    track('screen.profile');
    this.profile = loadProfile();
    const root = this.clearScreen();
    this.drawBackground(root, 'result', C.gold);
    this.addHeader(root, 'АРХИВ ИГРОКА', 'мета-прогресс без продажи преимущества', `XP ${this.profile.xp}`);

    const proof = this.add.container(CX, 330);
    root.add(proof);
    proof.add(this.roundRect(0, 0, 960, 360, 38, 0x0d1832, 0.96, C.gold, 3));
    proof.add(this.add.image(-370, 0, 'skrebka').setDisplaySize(170, 254));
    proof.add(this.roundRect(-370, 0, 180, 264, 28, 0x000000, 0, C.gold, 2));
    proof.add(this.txt(-250, -126, 'PROOF-OF-SKILL CARD', 25, '#f5c044', '900', 650));
    proof.add(this.txt(-250, -80, this.profile.lastProof ?? 'SA-НЕ-ВЫДАН', 48, '#f2f7ff', '900', 650));
    proof.add(this.txt(-250, -12, 'Локальная карточка мастерства. В будущей Web3-версии её можно минтить как косметический статус, но не как преимущество.', 25, '#b7c7e5', '800', 650, 'left', 1.12));
    proof.add(this.txt(-250, 112, `рейды ${this.profile.runs} · лаборатории ${this.profile.labs} · пыль ${this.profile.cosmeticDust} · ревью ${this.profile.pendingReviews.length}`, 23, '#8fa1c0', '900', 650));
    proof.add(this.secondaryButton(320, 115, 220, 68, 'EXPORT', 'png proof', C.cyan, () => this.exportProofCard()));

    const mastery = this.add.container(CX, 780);
    root.add(mastery);
    mastery.add(this.roundRect(0, 0, 960, 505, 36, 0x071226, 0.95, 0x1b385b, 2));
    mastery.add(this.txt(-420, -220, 'МАСТЕРСТВО ПРОТОКОЛОВ', 27, '#22d8f5', '900', 820));
    mastery.add(this.txt(-420, -178, 'Растёт от правильных решений и закрытых ошибок. Рынок не платит за знание. Он штрафует за отсутствие привычки.', 23, '#8fa1c0', '700', 820, 'left', 1.12));
    Object.values(PROTOCOLS).forEach((protocol, index) => {
      const y = -98 + index * 62;
      mastery.add(this.masteryRow(-420, y, 820, protocol.id));
    });

    const badges = this.add.container(CX, 1224);
    root.add(badges);
    badges.add(this.roundRect(0, 0, 960, 285, 34, 0x111f42, 0.94, 0x2a4e7a, 2));
    badges.add(this.txt(-420, -110, 'ЗНАКИ АРХИВА', 25, '#f5c044', '900', 820));
    if (this.profile.badges.length === 0) {
      badges.add(this.txt(-420, -52, 'Пока пусто. Архив ждёт первую бумажную травму.', 29, '#f2f7ff', '900', 820));
    } else {
      this.profile.badges.slice(0, 6).forEach((badge, index) => {
        const x = -292 + (index % 3) * 292;
        const y = -35 + Math.floor(index / 3) * 82;
        badges.add(this.chip(x, y, BADGE_COPY[badge] ?? badge, index % 2 ? C.purple : C.gold, 260));
      });
    }
    badges.add(this.txt(-420, 106, `закрыто ошибок: ${this.profile.closedErrors} · всего ошибок: ${this.profile.totalMistakes} · идеальных рейдов: ${this.profile.perfectRuns}`, 22, '#8fa1c0', '800', 820));

    const actions = this.add.container(CX, 1495);
    root.add(actions);
    actions.add(this.roundRect(0, 0, 960, 180, 30, 0x0d1832, 0.92, 0x1b385b, 2));
    actions.add(this.txt(-420, -62, this.profile.pendingReviews.length > 0 ? 'АРХИВ ТРЕБУЕТ РАЗБОРА' : 'АРХИВ СПОКОЕН. ЭТО ПОДОЗРИТЕЛЬНО.', 23, this.profile.pendingReviews.length > 0 ? '#fb4d6d' : '#34d399', '900', 820));
    actions.add(this.txt(-420, -20, this.profile.pendingReviews.length > 0 ? 'Незакрытые ошибки не дают настоящему стрику стать честным.' : 'Нет незакрытых ошибок. Можно идти за новыми, но не специально.', 27, '#f2f7ff', '800', 820, 'left', 1.1));
    actions.add(this.txt(-420, 68, 'Косметическая экономика: пыль и бейджи показывают дисциплину, но не меняют ответы.', 21, '#8fa1c0', '700', 820));

    if (this.profile.pendingReviews.length > 0) {
      root.add(this.primaryButton(CX, 1644, 900, 102, 'ЗАКРЫТЬ ОШИБКУ', 'бумажная работа спасает капитал', C.gold, () => this.showReview()));
    } else {
      root.add(this.primaryButton(CX, 1644, 900, 102, 'НА КАРТУ РЕЙДА', 'найти новые слабые места', C.cyan, () => this.prepareRaidMap()));
    }
    root.add(this.secondaryButton(315, 1766, 430, 82, 'КОСМЕТИКА', 'без преимущества', C.green, () => this.showCosmetics()));
    root.add(this.secondaryButton(765, 1766, 430, 82, 'НАЗАД', 'закрыть папку', C.purple, () => this.showMenu()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 240, ease: 'Sine.easeOut' });
  }

  private showLab(): void {
    track('screen.lab');
    this.profile = loadProfile();
    const item = CASES[(this.profile.labs * 3 + this.profile.runs) % CASES.length];
    const root = this.clearScreen();
    this.drawBackground(root, 'battle', item.palette.accent);
    this.addHeader(root, 'СИГНАЛЬНАЯ ЛАБОРАТОРИЯ', 'короткая калибровка чтения', `LAB ${this.profile.labs + 1}`);

    const panel = this.add.container(CX, 445);
    root.add(panel);
    panel.add(this.roundRect(0, 0, 960, 570, 38, 0x071226, 0.95, item.palette.accent, 2));
    panel.add(this.add.image(0, -88, item.assetKey).setDisplaySize(960, 452).setAlpha(0.56));
    panel.add(this.add.rectangle(0, 120, 960, 250, 0x01030a, 0.7));
    panel.add(this.txt(-420, -220, item.district.toUpperCase(), 23, '#f5c044', '900', 820));
    panel.add(this.txt(-420, -174, item.labQuestion, 48, '#f2f7ff', '900', 820, 'left', 1.02));
    panel.add(this.txt(-420, 42, item.hiddenTruth, 29, '#b7c7e5', '800', 820, 'left', 1.13));
    this.drawTrace(panel, -420, 212, 820, 120, item.trace, item.palette.accent, item.palette.danger);

    const desk = this.add.container(CX, 950);
    root.add(desk);
    desk.add(this.roundRect(0, 0, 960, 330, 34, 0x0d1832, 0.95, 0x1b385b, 2));
    desk.add(this.txt(-420, -128, 'ВЫБЕРИ ЯД СИГНАЛА', 25, '#22d8f5', '900', 820));
    desk.add(this.txt(-420, -86, 'Это не прогноз и не приказ. Это тренировка распознавания причины, почему решение может быть вредным.', 24, '#8fa1c0', '700', 820, 'left', 1.12));
    item.signal.slice(0, 4).forEach((s, index) => {
      const x = index % 2 === 0 ? -245 : 245;
      const y = 18 + Math.floor(index / 2) * 72;
      desk.add(this.chip(x, y, s, index === 3 ? item.palette.danger : item.palette.accent, 410));
    });

    item.labOptions.forEach((option, index) => {
      const y = 1280 + index * 132;
      const card = this.add.container(CX, y);
      root.add(card);
      card.add(this.roundRect(0, 0, 910, 104, 28, 0x111f42, 0.95, 0x2a4e7a, 2));
      card.add(this.txt(-405, -31, `0${index + 1}`, 30, '#5a6c8a', '900', 80, 'center'));
      card.add(this.txt(-300, -28, option, 31, '#f2f7ff', '900', 650));
      this.registerButton(card, 910, 104, () => this.resolveLab(item, index));
    });

    const sk = this.add.container(CX, 1708);
    root.add(sk);
    sk.add(this.roundRect(0, 0, 960, 132, 28, 0x111f42, 0.9, 0x2a4e7a, 2));
    sk.add(this.add.image(-410, 0, 'skrebka').setDisplaySize(92, 138));
    sk.add(this.txt(-348, -43, 'СКРЕПКА', 19, '#f5c044', '900', 740));
    sk.add(this.txt(-348, -8, 'Лаборатория не учит нажимать быстрее. Она учит стыдиться лишнего шума заранее.', 25, '#f2f7ff', '800', 735, 'left', 1.08));
    root.add(this.secondaryButton(CX, 1840, 900, 70, 'НАЗАД', 'не все эксперименты обязаны взрываться', C.purple, () => this.showMenu()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 230, ease: 'Sine.easeOut' });
  }

  private resolveLab(item: ArenaCase, index: number): void {
    const success = index === item.labAnswer;
    track('lab.answer', { case: item.id, selected: index, success });
    this.profile = persistLab(this.profile, success, item.correct);
    this.haptic(success ? 12 : [16, 30, 16]);
    this.playTone(success ? 520 : 150, success ? 0.1 : 0.16, success ? 'triangle' : 'sawtooth', success ? 0.035 : 0.022);

    const root = this.clearScreen();
    this.drawBackground(root, 'result', success ? C.green : C.red);
    this.addHeader(root, success ? 'ЛАБОРАТОРИЯ ПРИНЯЛА' : 'ЛАБОРАТОРИЯ ЗАПАХЛА ДЫМОМ', item.bossName, `XP ${this.profile.xp}`);

    const panel = this.add.container(CX, 720);
    root.add(panel);
    panel.add(this.roundRect(0, 0, 960, 770, 40, 0x0d1832, 0.96, success ? C.green : C.red, 3));
    panel.add(this.add.image(-360, -210, 'skrebka').setDisplaySize(170, 254));
    panel.add(this.roundRect(-360, -210, 180, 264, 28, 0x000000, 0, C.gold, 2));
    panel.add(this.txt(-240, -300, success ? 'ЯД НАЙДЕН' : 'ЯД СПРЯТАЛСЯ ЛУЧШЕ', 33, success ? '#34d399' : '#fb4d6d', '900', 650));
    panel.add(this.txt(-240, -246, success ? 'Ты отделил причину от шума. Архив слегка гордится, но не покажет виду.' : `Правильный яд: ${item.labOptions[item.labAnswer]}. Рынок любит, когда игрок путает симптом с причиной.`, 28, '#f2f7ff', '900', 650, 'left', 1.12));
    panel.add(this.roundRect(0, 48, 840, 255, 30, 0x071226, 0.92, item.palette.accent, 2));
    panel.add(this.txt(-392, -48, 'РАЗБОР', 24, '#22d8f5', '900', 760));
    panel.add(this.txt(-392, -6, item.lesson, 27, '#b7c7e5', '800', 760, 'left', 1.13));
    panel.add(this.txt(-392, 146, `мастерство: ${PROTOCOLS[item.correct].title} +${success ? 1 : 0} · лабораторий: ${this.profile.labs}`, 22, '#f5c044', '900', 760));

    root.add(this.primaryButton(CX, 1392, 900, 110, 'ЕЩЁ ОДИН ЭКСПЕРИМЕНТ', 'архив выдаст новый яд', C.green, () => this.showLab()));
    root.add(this.secondaryButton(CX, 1522, 900, 86, 'НА КАРТУ РЕЙДА', 'лаборатория закончила дымиться', C.cyan, () => this.prepareRaidMap()));
    root.add(this.secondaryButton(CX, 1642, 900, 86, 'НАЗАД В АРХИВ', 'вернуть пробирки на место', C.purple, () => this.showMenu()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 230, ease: 'Sine.easeOut' });
  }

  private showReview(): void {
    track('screen.review');
    this.profile = loadProfile();
    const review = this.profile.pendingReviews[0];
    const root = this.clearScreen();
    this.drawBackground(root, 'result', review ? PROTOCOLS[review.required].border : C.green);
    this.addHeader(root, 'АРХИВНЫЙ РАЗБОР', review ? 'закрытие ошибки вместо стыда' : 'очередь пуста', `${this.profile.pendingReviews.length} pending`);

    if (!review) {
      const empty = this.add.container(CX, 720);
      root.add(empty);
      empty.add(this.roundRect(0, 0, 960, 520, 40, 0x0d1832, 0.96, C.green, 3));
      empty.add(this.add.image(-360, -20, 'skrebka').setDisplaySize(170, 254));
      empty.add(this.roundRect(-360, -20, 180, 264, 28, 0x000000, 0, C.gold, 2));
      empty.add(this.txt(-240, -150, 'НЕТ НЕЗАКРЫТЫХ ОШИБОК', 38, '#34d399', '900', 650));
      empty.add(this.txt(-240, -86, 'Архив пуст. Это не значит, что ты святой. Это значит, что сегодня бумажная работа закончилась.', 30, '#f2f7ff', '900', 650, 'left', 1.12));
      root.add(this.primaryButton(CX, 1210, 900, 110, 'НА КАРТУ РЕЙДА', 'добыть новые документы', C.cyan, () => this.prepareRaidMap()));
      root.add(this.secondaryButton(CX, 1340, 900, 86, 'НАЗАД', 'закрыть шкаф', C.purple, () => this.showProfile()));
      return;
    }

    const panel = this.add.container(CX, 515);
    root.add(panel);
    panel.add(this.roundRect(0, 0, 960, 610, 40, 0x0d1832, 0.96, PROTOCOLS[review.required].border, 3));
    panel.add(this.add.image(-370, -132, 'skrebka').setDisplaySize(160, 238));
    panel.add(this.roundRect(-370, -132, 170, 248, 28, 0x000000, 0, C.gold, 2));
    panel.add(this.txt(-250, -250, review.caseName.toUpperCase(), 29, '#f5c044', '900', 660));
    panel.add(this.txt(-250, -202, 'Ошибка хочет стать привычкой.', 40, '#f2f7ff', '900', 660, 'left', 1.04));
    panel.add(this.txt(-250, -108, SKREBKA_LINES.review, 27, '#b7c7e5', '800', 660, 'left', 1.12));
    panel.add(this.roundRect(0, 156, 840, 226, 30, 0x071226, 0.92, 0x1b385b, 2));
    panel.add(this.txt(-392, 65, 'ЧТО СЛУЧИЛОСЬ', 22, '#22d8f5', '900', 760));
    panel.add(this.txt(-392, 104, review.verdict, 25, '#f2f7ff', '800', 760, 'left', 1.1));
    panel.add(this.txt(-392, 205, review.lesson, 22, '#8fa1c0', '700', 760, 'left', 1.06));

    const question = this.add.container(CX, 960);
    root.add(question);
    question.add(this.roundRect(0, 0, 960, 150, 30, 0x111f42, 0.94, 0x2a4e7a, 2));
    question.add(this.txt(-420, -48, 'КАКОЙ ПРОТОКОЛ ЗАКРЫВАЕТ ОШИБКУ?', 26, '#22d8f5', '900', 820));
    question.add(this.txt(-420, -5, 'Закрытие — это активное действие. Без него ошибка остаётся открытой вкладкой мозга.', 24, '#8fa1c0', '700', 820));

    const options = this.reviewOptions(review.required);
    options.forEach((protocolId, index) => {
      const protocol = PROTOCOLS[protocolId];
      const y = 1130 + index * 138;
      const card = this.add.container(CX, y);
      root.add(card);
      card.add(this.roundRect(0, 0, 910, 110, 28, protocol.color, 0.95, protocol.border, 2));
      card.add(this.txt(-405, -34, protocol.icon, 52, '#f2f7ff', '900', 82, 'center'));
      card.add(this.txt(-300, -34, protocol.title, 32, '#f2f7ff', '900', 680));
      card.add(this.txt(-300, 12, protocol.micro, 22, '#b7c7e5', '700', 680));
      this.registerButton(card, 910, 110, () => this.resolveReview(review.id, protocolId, review.required));
    });

    root.add(this.secondaryButton(CX, 1708, 900, 86, 'ОТЛОЖИТЬ', 'архив осуждает, но терпит', C.purple, () => this.showProfile()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 230, ease: 'Sine.easeOut' });
  }

  private resolveReview(reviewId: string, chosen: ProtocolId, required: ProtocolId): void {
    const success = chosen === required;
    track('review.answer', { chosen, required, success });
    if (success) {
      this.profile = completeReview(this.profile, reviewId);
    }
    this.haptic(success ? 12 : [16, 40, 16]);
    this.playTone(success ? 560 : 120, success ? 0.1 : 0.17, success ? 'triangle' : 'sawtooth', success ? 0.035 : 0.02);

    const root = this.clearScreen();
    this.drawBackground(root, 'result', success ? C.green : C.red);
    this.addHeader(root, success ? 'ОШИБКА ЗАКРЫТА' : 'ОШИБКА УКЛОНИЛАСЬ', success ? 'стрик честный' : 'нужна ещё одна попытка', `pending ${this.profile.pendingReviews.length}`);

    const panel = this.add.container(CX, 690);
    root.add(panel);
    panel.add(this.roundRect(0, 0, 960, 620, 40, 0x0d1832, 0.96, success ? C.green : C.red, 3));
    panel.add(this.add.image(-360, -90, 'skrebka').setDisplaySize(170, 254));
    panel.add(this.roundRect(-360, -90, 180, 264, 28, 0x000000, 0, C.gold, 2));
    panel.add(this.txt(-240, -222, success ? 'БУМАЖНАЯ ПОБЕДА' : 'НЕ ТОТ ПРОТОКОЛ', 36, success ? '#34d399' : '#fb4d6d', '900', 650));
    panel.add(this.txt(-240, -158, success ? 'Ошибка отправлена в архив. Никакой славы, только взрослая скука. Именно поэтому работает.' : `Нужен: ${PROTOCOLS[required].title}. Архив не злится. Он просто добавляет страницу.`, 30, '#f2f7ff', '900', 650, 'left', 1.12));
    panel.add(this.roundRect(0, 145, 840, 180, 30, 0x071226, 0.92, 0x1b385b, 2));
    panel.add(this.txt(-392, 82, 'ИТОГ', 23, '#22d8f5', '900', 760));
    panel.add(this.txt(-392, 122, success ? `закрыто ошибок: ${this.profile.closedErrors} · стрик: ${this.profile.streakDays}д · +85 XP` : 'Ошибка осталась в очереди. Повтори выбор без театра.', 27, '#b7c7e5', '800', 760, 'left', 1.12));

    root.add(this.primaryButton(CX, 1225, 900, 110, this.profile.pendingReviews.length > 0 ? 'СЛЕДУЮЩАЯ ОШИБКА' : 'В ПРОФИЛЬ', 'архив любит последовательность', success ? C.green : C.gold, () => {
      if (success && this.profile.pendingReviews.length > 0) this.showReview();
      else if (!success) this.showReview();
      else this.showProfile();
    }));
    root.add(this.secondaryButton(CX, 1355, 900, 86, 'НАЗАД В АРХИВ', 'папка закрывается со скрипом', C.purple, () => this.showProfile()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 230, ease: 'Sine.easeOut' });
  }

  private showCosmetics(): void {
    track('screen.cosmetics');
    this.profile = loadProfile();
    const root = this.clearScreen();
    const equipped = this.profile.equippedCosmetic ?? 'archive-default';
    this.drawBackground(root, 'result', C.green);
    this.addHeader(root, 'КОСМЕТИЧЕСКИЙ АРХИВ', 'монетизация без pay-to-win', `пыль ${this.profile.cosmeticDust}`);

    const hero = this.add.container(CX, 310);
    root.add(hero);
    hero.add(this.roundRect(0, 0, 960, 320, 38, 0x0d1832, 0.96, C.green, 3));
    hero.add(this.add.image(-360, 0, 'skrebka').setDisplaySize(150, 224));
    hero.add(this.roundRect(-360, 0, 158, 232, 24, 0x000000, 0, C.gold, 2));
    hero.add(this.txt(-252, -104, 'МАГАЗИН, КОТОРЫЙ НЕ ПРОДАЁТ СИЛУ', 25, '#f5c044', '900', 675));
    hero.add(this.txt(-252, -58, 'Пыль покупает рамки и статус. Ответы, бюджет риска и вероятность успеха не продаются. Демон монетизации расстроен.', 29, '#f2f7ff', '900', 675, 'left', 1.12));
    hero.add(this.txt(-252, 82, `экипировано: ${equipped === 'archive-default' ? 'Архив по умолчанию' : COSMETICS.find((item) => item.id === equipped)?.title ?? equipped}`, 22, '#8fa1c0', '800', 675));

    COSMETICS.forEach((item, index) => {
      const y = 590 + index * 245;
      const owned = this.profile.ownedCosmetics.includes(item.id);
      const isEquipped = equipped === item.id;
      const card = this.add.container(CX, y);
      root.add(card);
      card.add(this.roundRect(0, 0, 960, 210, 34, 0x071226, 0.95, isEquipped ? C.gold : item.color, isEquipped ? 4 : 2));
      card.add(this.roundRect(-350, 0, 132, 132, 30, item.color, 0.26, item.color, 3));
      card.add(this.txt(-410, -44, '✦', 82, '#f2f7ff', '900', 120, 'center'));
      card.add(this.txt(-250, -78, item.title.toUpperCase(), 30, '#f2f7ff', '900', 600));
      card.add(this.txt(-250, -28, item.description, 23, '#b7c7e5', '700', 600, 'left', 1.1));
      card.add(this.txt(-250, 70, owned ? (isEquipped ? 'ЭКИПИРОВАНО' : 'КУПЛЕНО') : `цена: ${item.price} пыли`, 22, owned ? '#34d399' : '#f5c044', '900', 600));
      const actionLabel = owned ? (isEquipped ? 'ВКЛЮЧЕНО' : 'НАДЕТЬ') : 'КУПИТЬ';
      const action = this.secondaryButton(320, 50, 200, 74, actionLabel, owned ? 'статус' : 'косметика', owned ? C.green : C.gold, () => {
        if (owned) {
          this.profile = equipCosmetic(this.profile, item.id);
        } else {
          const before = this.profile.cosmeticDust;
          this.profile = buyCosmetic(this.profile, item.id);
          if (this.profile.cosmeticDust === before) {
            this.toast('НЕДОСТАТОЧНО ПЫЛИ. ПАНИКА БЕСПЛАТНА, РАМКА НЕТ.', C.red);
            return;
          }
        }
        this.showCosmetics();
      });
      card.add(action);
    });

    root.add(this.secondaryButton(315, 1778, 430, 82, 'В ПРОФИЛЬ', 'посмотреть proof', C.gold, () => this.showProfile()));
    root.add(this.secondaryButton(765, 1778, 430, 82, 'НАЗАД', 'закрыть лавку', C.purple, () => this.showMenu()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 230, ease: 'Sine.easeOut' });
  }

  private showSettings(): void {
    track('screen.settings');
    this.profile = loadProfile();
    const root = this.clearScreen();
    this.drawBackground(root, 'menu', C.line);
    this.addHeader(root, 'НАСТРОЙКИ АРХИВА', 'комфорт без упрощения решений', 'local');

    const panel = this.add.container(CX, 520);
    root.add(panel);
    panel.add(this.roundRect(0, 0, 960, 640, 40, 0x0d1832, 0.96, 0x2a4e7a, 2));
    panel.add(this.add.image(-370, -190, 'skrebka').setDisplaySize(160, 238));
    panel.add(this.roundRect(-370, -190, 170, 248, 28, 0x000000, 0, C.gold, 2));
    panel.add(this.txt(-250, -285, 'СКРЕПКА НЕ ПРОТИВ УДОБСТВА', 27, '#f5c044', '900', 660));
    panel.add(this.txt(-250, -238, 'Но если настройка обещает лёгкую прибыль — это не настройка, это демон в чекбоксе.', 29, '#f2f7ff', '900', 660, 'left', 1.12));

    const settings = [
      ['sound', 'ЗВУК', 'короткие синт-сигналы без музыки казино', C.cyan],
      ['haptics', 'ВИБРАЦИЯ', 'тактильный щелчок решения', C.gold],
      ['reducedMotion', 'МЕНЬШЕ АНИМАЦИИ', 'для спокойного архива и уставших глаз', C.green]
    ] as const;

    settings.forEach(([key, title, desc, color], index) => {
      const y = -50 + index * 132;
      const enabled = this.profile.settings[key];
      const row = this.add.container(0, y);
      panel.add(row);
      row.add(this.roundRect(0, 0, 840, 104, 28, 0x071226, 0.92, enabled ? color : 0x2a4e7a, 2));
      row.add(this.txt(-392, -34, title, 28, '#f2f7ff', '900', 600));
      row.add(this.txt(-392, 8, desc, 21, '#8fa1c0', '700', 600));
      row.add(this.roundRect(330, 0, 116, 56, 28, enabled ? color : 0x253048, 0.9, enabled ? color : 0x5a6c8a, 2));
      row.add(this.txt(276, -19, enabled ? 'ON' : 'OFF', 26, '#f2f7ff', '900', 108, 'center'));
      this.registerButton(row, 840, 104, () => {
        this.profile = setSettings(this.profile, { [key]: !enabled });
        this.showSettings();
      });
    });

    const danger = this.add.container(CX, 1035);
    root.add(danger);
    danger.add(this.roundRect(0, 0, 960, 250, 34, 0x111f42, 0.94, C.red, 2));
    danger.add(this.txt(-420, -90, 'ОПАСНАЯ ПАПКА', 25, '#fb4d6d', '900', 820));
    danger.add(this.txt(-420, -44, 'Сброс удалит локальный прогресс: XP, proof, стрик, ревью. Рынок не пострадает. Только бумага.', 28, '#f2f7ff', '900', 820, 'left', 1.12));
    danger.add(this.secondaryButton(0, 75, 820, 78, 'СБРОСИТЬ ПРОФИЛЬ', 'двойная проверка перед уничтожением архива', C.red, () => this.confirmReset()));

    root.add(this.primaryButton(CX, 1430, 900, 110, 'НАЗАД В АРХИВ', 'настройки сохранены локально', C.cyan, () => this.showMenu()));

    this.tweens.add({ targets: root, alpha: { from: 0, to: 1 }, duration: 230, ease: 'Sine.easeOut' });
  }

  private confirmReset(): void {
    const overlay = this.add.container(0, 0);
    this.screen?.add(overlay);
    overlay.add(this.add.rectangle(CX, GAME_H / 2, GAME_W, GAME_H, 0x01030a, 0.82));
    const panel = this.add.container(CX, 950);
    overlay.add(panel);
    panel.add(this.roundRect(0, 0, 900, 410, 38, 0x0d1832, 0.98, C.red, 3));
    panel.add(this.txt(-390, -160, 'СБРОСИТЬ АРХИВ?', 40, '#fb4d6d', '900', 780, 'center'));
    panel.add(this.txt(-390, -82, 'Это удалит локальный профиль. Скрепка будет делать вид, что не плакала.', 30, '#f2f7ff', '900', 780, 'center', 1.12));
    panel.add(this.primaryButton(0, 70, 760, 92, 'ДА, УНИЧТОЖИТЬ БУМАГИ', 'последний шанс выглядит именно так', C.red, () => {
      this.profile = resetProfile();
      overlay.destroy(true);
      this.showSettings();
    }));
    panel.add(this.secondaryButton(0, 178, 760, 72, 'ОТМЕНА', 'разум победил палец', C.purple, () => overlay.destroy(true)));
  }

  private reviewOptions(required: ProtocolId): ProtocolId[] {
    const rest = (Object.keys(PROTOCOLS) as ProtocolId[]).filter((id) => id !== required);
    const seed = required.length + this.profile.closedErrors + this.profile.runs;
    const a = rest[seed % rest.length];
    const b = rest[(seed + 2) % rest.length];
    const options = [required, a, b];
    for (let i = options.length - 1; i > 0; i--) {
      const j = (seed + i * 7) % (i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
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
    if (!this.profile.settings.reducedMotion) {
      this.tweens.add({ targets: button, scaleX: 1.012, scaleY: 1.012, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    return button;
  }

  private navButton(x: number, y: number, w: number, label: string, micro: string, accent: number, onClick: () => void): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    button.add(this.roundRect(0, 0, w, 106, 26, 0x071226, 0.93, accent, 2));
    button.add(this.txt(-w / 2 + 18, -34, label, 24, '#f2f7ff', '900', w - 36, 'center'));
    button.add(this.txt(-w / 2 + 18, 4, micro, 18, '#8fa1c0', '800', w - 36, 'center'));
    this.registerButton(button, w, 106, onClick);
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

  private masteryRow(x: number, y: number, w: number, protocolId: ProtocolId): Phaser.GameObjects.Container {
    const protocol = PROTOCOLS[protocolId];
    const count = this.profile.protocolMastery[protocolId] ?? 0;
    const progress = Math.min(1, count / 8);
    const row = this.add.container(x + w / 2, y);
    row.add(this.roundRect(0, 0, w, 48, 18, 0x0d1832, 0.82, protocol.border, 1));
    row.add(this.txt(-w / 2 + 18, -17, protocol.shortTitle, 19, '#f2f7ff', '900', 170));
    row.add(this.roundRect(115, 0, 470, 14, 7, 0x121d34, 1, 0x253a58, 1));
    row.add(this.roundRect(115 - 235 + (470 * Math.max(progress, 0.03)) / 2, 0, 470 * Math.max(progress, 0.03), 14, 7, protocol.border, 0.9));
    row.add(this.txt(365, -15, `${count}/8`, 18, '#8fa1c0', '900', 70, 'right'));
    return row;
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

  private exportProofCard(): void {
    const renderer = this.game.renderer as unknown as {
      snapshotArea?: (x: number, y: number, width: number, height: number, callback: (image: HTMLImageElement) => void, type?: string) => void;
      snapshot?: (callback: (image: HTMLImageElement) => void, type?: string) => void;
    };
    const callback = (image: HTMLImageElement) => {
      const link = document.createElement('a');
      link.href = image.src;
      link.download = `signal-arena-proof-${this.profile.lastProof ?? 'archive'}.png`;
      link.click();
      this.toast('PROOF-КАРТА ЭКСПОРТИРОВАНА. НЕ ПРОДАВАЙ ЕЁ КАК ПРОРОЧЕСТВО.', C.green);
    };

    if (renderer.snapshotArea) {
      renderer.snapshotArea(60, 150, 960, 360, callback, 'image/png');
    } else if (renderer.snapshot) {
      renderer.snapshot(callback, 'image/png');
    } else {
      this.toast('ЭКСПОРТ НЕ ПОДДЕРЖАН ЭТИМ РЕНДЕРОМ.', C.red);
    }
  }

  private toast(message: string, color: number): void {
    const toast = this.add.container(CX, 188);
    this.screen?.add(toast);
    toast.add(this.roundRect(0, 0, 900, 74, 24, 0x050a16, 0.96, color, 2));
    toast.add(this.txt(-420, -24, message, 22, '#f2f7ff', '900', 840, 'center'));
    toast.setAlpha(0);
    this.tweens.add({ targets: toast, alpha: 1, y: 208, duration: 120, ease: 'Sine.easeOut' });
    this.time.delayedCall(980, () => {
      this.tweens.add({ targets: toast, alpha: 0, y: 168, duration: 180, ease: 'Sine.easeIn', onComplete: () => toast.destroy(true) });
    });
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.03): void {
    if (!this.profile.settings.sound) return;
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
    if (!this.profile.settings.haptics) return;
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
