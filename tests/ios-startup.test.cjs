const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('launch storyboard constraints refer to existing objects', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../ios/ShoutOuttotheMoon/SplashScreen.storyboard'), 'utf8');
  const ids = new Set([...xml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const constraint of xml.matchAll(/<constraint\b[^>]*>/g)) {
    for (const reference of constraint[0].matchAll(/\b(?:firstItem|secondItem)="([^"]+)"/g)) {
      assert.ok(ids.has(reference[1]), `Launch screen references missing object: ${reference[1]}`);
    }
  }
});
