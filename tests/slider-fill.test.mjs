import test from 'node:test';
import assert from 'node:assert/strict';
import { sliderFillPercent, syncSliderFill } from '../modules/slider-fill.js';

test('slider fill handles negative ranges, endpoints, invalid limits and defaults', () => {
  assert.equal(sliderFillPercent({ min: '-180', max: '180', value: '0' }), 50);
  for (const [value, expected] of [[-1, 0], [0, 0], [25, 25], [100, 100], [110, 100]]) {
    assert.equal(sliderFillPercent({ min: '', max: '', value }), expected);
  }
  assert.equal(sliderFillPercent({ min: '5', max: '5', value: '5' }), 0);
  assert.equal(sliderFillPercent({ min: 'bad', max: '5', value: '5' }), 0);
});

test('slider fills follow edits, resets, silent assignments and bounds without writing unchanged styles', () => {
  const writes = [];
  const range = { min: '0', max: '10', value: '2', style: { setProperty: (...args) => writes.push(args) } };
  syncSliderFill(range);
  syncSliderFill(range);
  assert.equal(writes.length, 1);
  range.value = '8'; syncSliderFill(range);
  assert.deepEqual(writes.at(-1), ['--slider-fill', '80%']);
  range.value = '2'; syncSliderFill(range);
  assert.deepEqual(writes.at(-1), ['--slider-fill', '20%']);
  range.max = '20'; syncSliderFill(range);
  assert.deepEqual(writes.at(-1), ['--slider-fill', '10%']);
  assert.equal(range.value, '2');
});
