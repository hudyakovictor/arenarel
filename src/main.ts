import Phaser from 'phaser';
import './styles.css';
import { SignalArenaScene } from './game/SignalArenaScene';

const GAME_W = 1080;
const GAME_H = 1920;

(globalThis as unknown as { Phaser: typeof Phaser }).Phaser = Phaser;

const rexModule = await import('phaser3-rex-plugins/dist/rexuiplugin.min.js');
const RexUIPlugin = rexModule.default ?? (globalThis as any).rexuiplugin;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#01030a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H
  },
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    powerPreference: 'high-performance'
  },
  input: {
    activePointers: 3
  },
  plugins: {
    scene: [
      {
        key: 'rexUI',
        plugin: RexUIPlugin,
        mapping: 'rexUI'
      }
    ]
  },
  scene: [SignalArenaScene]
};

new Phaser.Game(config);
