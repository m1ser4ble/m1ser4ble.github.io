import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const output = path.resolve('../../assets/animations/ipsec');
test('publishes a self-contained Motion Canvas player, not a video substitute', () => {
  assert.ok(fs.existsSync(path.join(output, 'index.html')), 'The embeddable animation page must exist');
  const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /motion-canvas-player/);
  assert.match(html, /project\.js/);
  assert.doesNotMatch(html, /<video/);
  assert.ok(fs.existsSync(path.join(output, 'project.js')), 'Built Motion Canvas project must exist');
  assert.ok(fs.existsSync(path.join(output, 'player.js')), 'Player must be hosted locally');
});
