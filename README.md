# dsh-task-progress-tab

[![npm](https://img.shields.io/npm/v/dsh-task-progress-tab.svg)](https://www.npmjs.com/package/dsh-task-progress-tab)
[![license](https://img.shields.io/npm/l/dsh-task-progress-tab.svg)](./LICENSE)

A **Task Progress** tab for the DeepSeek Harness conversation view. It sits right after the built-in **Context** tab and turns the session's task list into a live progress view: one bar for the whole session, completed items numbered in the order they were finished, open items in the order the model planned them.

<!-- ![Task Progress tab](assets/task-progress.png) -->

## Features

- **Live progress bar** — done / total plus a percentage, updated as the model ticks items off.
- **Completion order** — completed items are numbered `#1`, `#2`, … in the order they actually finished, even if the model reorders its plan or the list is regenerated.
- **Open items** — rendered in plan order, with `in progress` highlighted and `pending` dimmed.
- **Per-session memory** — the todo projection is cleared at the start of every turn; the tab caches each session's last known list so the view doesn't flash empty between turns.
- **Bilingual** — follows the browser/desktop language (Chinese and English are built in).
- **Zero dependencies** — one client bundle, no runtime packages, no build step.

## Install

```sh
dsh plugin add dsh-task-progress-tab
```

From GitHub instead of npm:

```sh
dsh plugin add github:zebracmz/dsh-task-progress-tab
```

Desktop app: open **Plugins**, search for `dsh-task-progress-tab` and install it, then restart the app (or use **App → Restart App and Host**).

## Where it shows up

The conversation tab strip becomes:

```
Chat | Trajectory | Context | Task Progress
```

It registers as a `conversation.view` slot with `order: 40`, so it always lands immediately to the right of the Context tab (which uses `order: 30`).

## How it works

The tab reads the session projection `todos`, which the `todo_write` tool maintains:

```js
useProjection('todos') // [{ content, status: 'pending' | 'in_progress' | 'completed' }]
```

Completion order is remembered per session by assigning a monotonic sequence number the first time an item is seen as completed. Nothing is written back — the plugin is read-only.

## Compatibility

- DeepSeek Harness **0.2.0** or newer (`engines.dsh`), client platform `web`.
- Desktop and browser (web) builds are both supported; the same client bundle is served for either.

## Development

```sh
node smoke-test.mjs
```

The smoke test runs the client bundle against a minimal `React.createElement` stub and checks registration metadata, counts, percentages, completion-order stability across reshuffles, the empty state, the per-session fallback, and both locales.

## License

[MIT](./LICENSE)
