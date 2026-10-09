const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function game({ supported = true, native = false } = {}) {
  const timers = new Map();
  let nextTimer = 1;
  const recognizers = [];
  class Recognition {
    starts = 0;
    aborts = 0;
    start() { this.starts++; }
    abort() { this.aborts++; }
  }
  const root = {
    addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, style: { setProperty() {} },
  };
  const context = vm.createContext({
    navigator: { language: 'en' },
    document: { getElementById() { return root; } },
    window: {
      innerWidth: 390, innerHeight: 844, SHOUT_MOON_NATIVE_AUDIO: native,
      SpeechRecognition: supported ? class extends Recognition {
        constructor() { super(); recognizers.push(this); }
      } : undefined,
      addEventListener() {}, setInterval() {},
      setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  });
  const source = readFileSync('src/web/main.js', 'utf8');
  // Load production handlers without starting browser microphone acquisition.
  vm.runInContext(source.slice(0, source.lastIndexOf('\nloadEconomy();')), context);
  return {
    run: (code) => vm.runInContext(code, context), recognizers, timers,
    retry() {
      assert.equal(timers.size, 1);
      const [id, callback] = timers.entries().next().value;
      timers.delete(id); callback();
    },
  };
}

test('ready status requires onstart; repeated starts do not overlap', () => {
  const g = game();
  g.run('startVoiceInput(); startVoiceInput();');
  assert.equal(g.recognizers[0].starts, 1);
  assert.equal(g.run('speech.isListening'), false);
  assert.match(g.run('state.speechStatus'), /Connecting/);
  g.recognizers[0].onstart();
  assert.equal(g.run('speech.isListening'), true);
  assert.match(g.run('state.speechStatus'), /Listening/);
});

test('network errors wait for onend, preserve the error, and stop after three attempts', () => {
  const g = game();
  g.run('startVoiceInput()');
  const r = g.recognizers[0];
  for (let i = 0; i < 3; i++) {
    r.onstart();
    r.onerror({ error: 'network' });
    assert.equal(g.timers.size, 0);
    g.run('startVoiceInput()');
    assert.equal(r.starts, i + 1);
    r.onend();
    if (i < 2) {
      g.retry();
      assert.match(g.run('state.speechStatus'), /Cannot connect/);
    }
  }
  assert.equal(g.timers.size, 0);
  assert.equal(g.run('speech.shouldListen'), false);
  g.run('startVoiceInput({fromUserGesture:true, force:true})');
  assert.equal(r.starts, 4);
  assert.equal(g.run('speech.networkFailures'), 0);
  r.onstart();
  assert.match(g.run('state.speechStatus'), /Listening/);
});

test('recognized Launch starts flight, stops listening, and ignores late results', () => {
  const g = game();
  g.run('startVoiceInput()');
  const r = g.recognizers[0];
  r.onstart();
  r.onresult({resultIndex:0, results:[[{transcript:'Launch'}]]});
  assert.equal(g.run('state.phase'), 'flying');
  assert.equal(r.aborts, 1);
  r.onend();
  assert.equal(g.timers.size, 0);
  r.onresult({resultIndex:0, results:[[{transcript:'unrelated late speech'}]]});
  assert.equal(g.run('state.heardSpeech'), 'launch');
});

test('permission denial does not loop; Voice can retry after permission is granted', () => {
  const g = game(); g.run('startVoiceInput()');
  const r = g.recognizers[0];
  r.onerror({error:'not-allowed'}); r.onend();
  assert.equal(g.timers.size, 0);
  assert.match(g.run('state.speechStatus'), /Allow microphone/);
  g.run('startVoiceInput({fromUserGesture:true})');
  assert.equal(r.starts, 2);
});

test('stopping a pending session aborts it without restarting', () => {
  const g = game(); g.run('startVoiceInput(); stopSpeechRecognition()');
  const r = g.recognizers[0];
  assert.equal(r.aborts, 1); r.onend();
  assert.equal(g.timers.size, 0);
});

test('silence retries after session ends; unsupported and native paths stay separate', () => {
  const g = game(); g.run('startVoiceInput()');
  const r = g.recognizers[0];
  r.onstart(); r.onerror({error:'no-speech'}); r.onend(); g.retry();
  assert.equal(r.starts, 2);
  const unsupported = game({supported:false}); unsupported.run('startVoiceInput()');
  assert.equal(unsupported.timers.size, 0);
  assert.match(unsupported.run('state.speechStatus'), /not available/);
  const native = game({native:true}); native.run('startVoiceInput()');
  assert.equal(native.recognizers.length, 0);
});
