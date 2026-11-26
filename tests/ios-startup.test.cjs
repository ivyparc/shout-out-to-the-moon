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

test('native launch adopts the scene lifecycle required by UIKit', () => {
  const {execFileSync} = require('node:child_process');
  const root = path.join(__dirname, '..');
  const info = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(root, 'ios/ShoutOuttotheMoon/Info.plist')], {encoding:'utf8'}));
  const manifest = info.UIApplicationSceneManifest;
  assert.equal(manifest.UIApplicationSupportsMultipleScenes, false);
  assert.equal(manifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName, '$(PRODUCT_MODULE_NAME).SceneDelegate');
  const swift = fs.readFileSync(path.join(root, 'ios/ShoutOuttotheMoon/AppDelegate.swift'), 'utf8');
  assert.match(swift, /class SceneDelegate: UIResponder, UIWindowSceneDelegate/);
  assert.match(swift, /UIWindow\(windowScene: windowScene\)/);
  assert.doesNotMatch(swift, /UIWindow\(frame: UIScreen.main.bounds\)/);
});
