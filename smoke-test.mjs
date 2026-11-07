/**
 * Offline smoke test: no React dependency, a minimal createElement stub verifies
 * registration metadata and render logic.
 * Run: node smoke-test.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const src = fs.readFileSync(new URL('./client.js', import.meta.url), 'utf8');

let factory;
globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      factory = entry.factory;
      assert.equal(entry.id, 'dsh-task-progress-tab');
    },
  },
};
function setLanguage(language) {
  Object.defineProperty(globalThis, 'navigator', { value: { language }, configurable: true });
}
setLanguage('zh-CN');

vm.runInThisContext(src, { filename: 'client.js' });

function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat(Infinity) };
}
const ReactStub = { createElement };

function loadModule(language) {
  setLanguage(language);
  const mod = factory((name) => {
    if (name === 'react') return ReactStub;
    throw new Error('unexpected require: ' + name);
  });
  return mod;
}

function applyTo(mod) {
  let registration;
  const ctx = {
    slots: {
      inject(key, cb) {
        assert.equal(key, 'conversation.view');
        cb();
      },
      register(options, Component) {
        registration = { options, Component };
        return () => {};
      },
    },
  };
  mod.apply(ctx);
  return registration;
}

const mod = loadModule('zh-CN');
assert.equal(typeof mod.apply, 'function');
assert.deepEqual(mod.inject, ['slots', 'locale']);

const registration = applyTo(mod);
assert.equal(registration.options.name, 'conversation.view');
assert.equal(registration.options.id, 'task-progress');
assert.equal(registration.options.order, 40);
assert.equal(registration.options.label(), '任务进度');

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (typeof node.type === 'function') {
    return textOf(node.type({ ...node.props, children: node.children }));
  }
  return node.children.map(textOf).join(' ');
}

function render(reg, todos, sessionId = 's1') {
  const props = { useProjection: () => todos, sessionId };
  const tree = ReactStub.createElement(reg.Component, props);
  return textOf(tree);
}

const t1 = [
  { content: '分析现有插件机制', status: 'completed' },
  { content: '设计进度标签页', status: 'completed' },
  { content: '实现客户端 bundle', status: 'in_progress' },
  { content: '安装并重启验证', status: 'pending' },
];
let out = render(registration, t1);
assert.ok(out.includes('任务进度'), 'title');
assert.ok(out.includes('已完成 2 / 4'), 'count line');
assert.ok(out.includes('50%'), 'percent');
assert.ok(out.includes('进行中'), 'in_progress chip');
assert.ok(out.includes('待开始'), 'pending chip');

// New tasks completed: sequence numbers keep increasing.
const t2 = t1.map((x) => (x.status === 'completed' ? x : { ...x, status: 'completed' }));
out = render(registration, t2);
assert.ok(out.includes('已完成 4 / 4'));
assert.ok(out.includes('100%'));
assert.ok(out.includes('#1') && out.includes('#4'));

// Shuffled list: the completed section still follows completion order.
const shuffled = Object.keys(t2).reverse().map((i) => t2[i]);
out = render(registration, shuffled);
assert.ok(out.indexOf('分析现有插件机制') < out.indexOf('设计进度标签页'));
assert.ok(out.indexOf('设计进度标签页') < out.indexOf('实现客户端 bundle'));
assert.ok(out.indexOf('实现客户端 bundle') < out.indexOf('安装并重启验证'));

// Empty list.
out = render(registration, [], 's2');
assert.ok(out.includes('还没有任务清单'));

// Null projection falls back to the last known list for that session.
out = render(registration, null, 's1');
assert.ok(out.includes('已完成 4 / 4'), 'fallback to last known list');

// English locale.
const registrationEn = applyTo(loadModule('en-US'));
assert.equal(registrationEn.options.label(), 'Task Progress');
out = render(registrationEn, t1);
assert.ok(out.includes('Task Progress'), 'en title');
assert.ok(out.includes('2 of 4 done'), 'en count line');
assert.ok(out.includes('in progress') && out.includes('pending'), 'en status chips');

console.log('OK: registration + render logic passed (zh + en)');
