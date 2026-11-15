import Phaser from 'phaser';

class EmptyScene extends Phaser.Scene {
  constructor() {
    super('empty');
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#cbdbfc',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [EmptyScene],
});
