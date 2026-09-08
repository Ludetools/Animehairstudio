import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsClearance} from '../modules/settings-clearance.js';
test('settings boxes move below stats only on intersection and fit remaining viewport',()=>{
  const stats={left:700,right:900,top:10,bottom:100},viewport={bottom:600};
  assert.deepEqual(settingsClearance({left:650,right:950,top:40,bottom:400},stats,viewport),{dy:72,maxHeight:476});
  assert.equal(settingsClearance({left:0,right:400,top:20,bottom:400},stats,viewport),null);
  assert.equal(settingsClearance({left:650,right:950,top:112,bottom:400},stats,viewport),null);
});
