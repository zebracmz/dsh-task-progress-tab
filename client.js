/**
 * Session task progress — a dedicated tab in the conversation view.
 *
 * Registers into `conversation.view` with order 40, so it sits right after
 * "Chat" (0), "Trajectory" (10) and "Context" (30).
 *
 * Data comes from the session projection `todos` (maintained by the
 * `todo_write` tool). A progress bar on top shows done / total; completed
 * items are listed in the order they were completed, open items in the order
 * the model planned them. The projection is cleared on turn/start, so the last
 * known list is cached per session to avoid flicker between turns.
 */
window.__ModuleLoader__.load({
  id: 'dsh-task-progress-tab',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const TAB_ID = 'task-progress';
    const TAB_ORDER = 40;

    const STRINGS = {
      zh: {
        tab: '任务进度',
        subtitle: '模型自主拆分并维护的阶段任务 · 已完成按完成顺序排列',
        doneSection: '已完成',
        openSection: '未完成',
        byCompletion: '按完成顺序',
        byPlan: '按计划顺序',
        inProgress: '进行中',
        pending: '待开始',
        countLine: (done, total) => `已完成 ${done} / ${total}`,
        emptyTitle: '当前会话还没有任务清单',
        emptyHint: '模型调用 todo_write 拆分阶段任务后，这里会显示已完成 / 未完成，并按完成顺序排列。',
        allDone: '全部任务已完成。',
        nthCompleted: (n) => `第 ${n} 个完成`,
        progressAria: '任务完成进度',
      },
      en: {
        tab: 'Task Progress',
        subtitle: 'Phases the model planned and maintains · completed items in completion order',
        doneSection: 'Completed',
        openSection: 'Open',
        byCompletion: 'in completion order',
        byPlan: 'in plan order',
        inProgress: 'in progress',
        pending: 'pending',
        countLine: (done, total) => `${done} of ${total} done`,
        emptyTitle: 'No task list in this session yet',
        emptyHint:
          'Once the model splits the work into phases with todo_write, completed and open tasks show up here, completed first and in completion order.',
        allDone: 'All tasks completed.',
        nthCompleted: (n) => `Completed #${n}`,
        progressAria: 'Task completion progress',
      },
    };

    function detectLang() {
      try {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        const lang =
          (nav && nav.language) ||
          (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) ||
          '';
        return String(lang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
      } catch (error) {
        return 'zh';
      }
    }

    const L = STRINGS[detectLang()];

    const CSS = [
      '@keyframes dshTpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }',
      '.dsh-tp-row { transition: background-color 120ms ease; }',
      '.dsh-tp-row:hover { background-color: var(--dsw-alias-interactive-bg-hover); }',
      '.dsh-tp-dot-live { animation: dshTpPulse 1.4s ease-in-out infinite; }',
    ].join('\n');

    /** Per-session completion-order memory and last known list. */
    const memory = new Map();

    function memoryFor(sessionId) {
      let entry = memory.get(sessionId);
      if (entry === undefined) {
        entry = { lastTodos: [], seq: new Map(), nextSeq: 1 };
        memory.set(sessionId, entry);
      }
      return entry;
    }

    function normalize(todos) {
      if (!Array.isArray(todos)) return null;
      return todos.filter(
        (item) => item !== null && typeof item === 'object' && typeof item.content === 'string' && item.content.trim() !== '',
      );
    }

    function progressValue(total, done) {
      if (total <= 0) return 0;
      return Math.round((done / total) * 100);
    }

    function pctText(pct) {
      return `${pct}%`;
    }

    function sectionTitle(text, count, hint) {
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            margin: '24px 0 8px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--dsw-alias-label-secondary)',
          },
        },
        h('span', null, text),
        h('span', { style: { fontWeight: 400, color: 'var(--dsw-alias-label-tertiary)' } }, String(count)),
        hint
          ? h(
              'span',
              { style: { marginLeft: 'auto', fontWeight: 400, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } },
              hint,
            )
          : null,
      );
    }

    function rowBase(content, extra) {
      return Object.assign(
        {
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '9px 10px',
          borderRadius: 8,
          lineHeight: 1.55,
          fontSize: 13.5,
        },
        extra || {},
      );
    }

    function CompletedRow({ todo, order }) {
      return h(
        'div',
        { className: 'dsh-tp-row', style: rowBase() },
        h(
          'span',
          {
            style: {
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              marginTop: 2,
              borderRadius: 9,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--dsw-alias-state-success-primary)',
              border: '1px solid var(--dsw-alias-state-success-primary)',
              backgroundColor: 'var(--dsw-alias-state-success-tertiary)',
            },
          },
          '✓',
        ),
        h(
          'span',
          { style: { flex: '1 1 auto', color: 'var(--dsw-alias-label-secondary)', textDecoration: 'line-through', opacity: 0.75 } },
          todo.content,
        ),
        h(
          'span',
          {
            style: {
              flex: '0 0 auto',
              fontSize: 11,
              color: 'var(--dsw-alias-label-tertiary)',
              fontVariantNumeric: 'tabular-nums',
              paddingTop: 3,
            },
            title: L.nthCompleted(order),
          },
          `#${order}`,
        ),
      );
    }

    function OpenRow({ todo }) {
      const live = todo.status === 'in_progress';
      return h(
        'div',
        { className: 'dsh-tp-row', style: rowBase() },
        h(
          'span',
          {
            className: live ? 'dsh-tp-dot-live' : undefined,
            style: {
              flex: '0 0 auto',
              width: 9,
              height: 9,
              marginTop: 7,
              marginLeft: 4,
              borderRadius: 5,
              backgroundColor: live ? 'var(--dsw-alias-brand-primary)' : 'transparent',
              border: live ? 'none' : '1px solid var(--dsw-alias-label-dimmed)',
              boxShadow: live ? '0 0 0 3px var(--dsw-alias-state-business-primary)' : 'none',
            },
          },
        ),
        h('span', { style: { flex: '1 1 auto', color: 'var(--dsw-alias-label-primary)' } }, todo.content),
        h(
          'span',
          {
            style: {
              flex: '0 0 auto',
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 999,
              color: live ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-tertiary)',
              border: `1px solid ${live ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l)'}`,
            },
          },
          live ? L.inProgress : L.pending,
        ),
      );
    }

    function EmptyState() {
      return h(
        'div',
        {
          style: {
            marginTop: 20,
            padding: '28px 24px',
            borderRadius: 12,
            border: '1px dashed var(--dsw-alias-border-l)',
            textAlign: 'center',
            color: 'var(--dsw-alias-label-tertiary)',
            fontSize: 13,
            lineHeight: 1.8,
          },
        },
        h('div', { style: { fontSize: 15, color: 'var(--dsw-alias-label-secondary)', marginBottom: 4 } }, L.emptyTitle),
        h('div', null, L.emptyHint),
      );
    }

    function TaskProgressView(props) {
      const useProjection = props.useProjection;
      const sessionId =
        typeof props.sessionId === 'string' && props.sessionId !== '' ? props.sessionId : 'default';
      const entry = memoryFor(sessionId);
      const raw = typeof useProjection === 'function' ? useProjection('todos') : null;
      const fresh = normalize(raw);

      if (fresh !== null) {
        entry.lastTodos = fresh;
      }
      const todos = fresh !== null ? fresh : entry.lastTodos;

      const completed = [];
      const open = [];
      for (let i = 0; i < todos.length; i += 1) {
        const todo = todos[i];
        if (todo.status === 'completed') {
          if (entry.seq.get(todo.content) === undefined) {
            entry.seq.set(todo.content, entry.nextSeq);
            entry.nextSeq += 1;
          }
          completed.push({ todo: todo, order: entry.seq.get(todo.content) });
        } else {
          open.push(todo);
        }
      }
      completed.sort((a, b) => a.order - b.order);

      const total = todos.length;
      const done = completed.length;
      const pct = progressValue(total, done);

      return h(
        'div',
        {
          style: {
            height: '100%',
            overflow: 'auto',
            boxSizing: 'border-box',
            padding: '26px 32px 48px',
            color: 'var(--dsw-alias-label-primary)',
          },
        },
        h(
          'div',
          { style: { maxWidth: 760, margin: '0 auto' } },
          h('div', { style: { fontSize: 18, fontWeight: 600, letterSpacing: 0.2 } }, L.tab),
          h('div', { style: { marginTop: 4, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, L.subtitle),

          total === 0
            ? h(EmptyState)
            : h(
                'div',
                { style: { marginTop: 18 } },
                h(
                  'div',
                  {
                    role: 'progressbar',
                    'aria-valuemin': 0,
                    'aria-valuemax': total,
                    'aria-valuenow': done,
                    'aria-label': L.progressAria,
                    style: {
                      height: 8,
                      borderRadius: 999,
                      overflow: 'hidden',
                      backgroundColor: 'var(--dsw-alias-bg-module-platform)',
                      border: '1px solid var(--dsw-alias-border-l)',
                    },
                  },
                  h('div', {
                    style: {
                      height: '100%',
                      width: pct + '%',
                      borderRadius: 999,
                      transition: 'width 450ms ease',
                      backgroundImage:
                        'linear-gradient(90deg, var(--dsw-alias-brand-primary), var(--dsw-alias-state-success-primary))',
                    },
                  }),
                ),
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginTop: 8,
                      fontSize: 12,
                      color: 'var(--dsw-alias-label-tertiary)',
                    },
                  },
                  h('span', null, L.countLine(done, total)),
                  h(
                    'span',
                    { style: { fontVariantNumeric: 'tabular-nums', color: 'var(--dsw-alias-label-secondary)' } },
                    pctText(pct),
                  ),
                ),

                completed.length > 0
                  ? h(
                      'div',
                      null,
                      sectionTitle(L.doneSection, completed.length, L.byCompletion),
                      h(
                        'div',
                        { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                        completed.map((row) =>
                          h(CompletedRow, { key: row.todo.content, todo: row.todo, order: row.order }),
                        ),
                      ),
                    )
                  : null,

                open.length > 0
                  ? h(
                      'div',
                      null,
                      sectionTitle(L.openSection, open.length, L.byPlan),
                      h(
                        'div',
                        { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                        open.map((todo, index) =>
                          h(OpenRow, { key: todo.content + '#' + String(index), todo: todo }),
                        ),
                      ),
                    )
                  : h(
                      'div',
                      {
                        style: {
                          marginTop: 22,
                          padding: '10px 12px',
                          borderRadius: 8,
                          fontSize: 13,
                          color: 'var(--dsw-alias-state-success-primary)',
                          backgroundColor: 'var(--dsw-alias-state-success-tertiary)',
                        },
                      },
                      L.allDone,
                    ),
              ),
        ),
      );
    }

    const inject = ['slots', 'locale'];

    function apply(ctx) {
      try {
        const tag = document.createElement('style');
        tag.dataset.dshPlugin = 'dsh-task-progress-tab';
        tag.textContent = CSS;
        document.head.appendChild(tag);
      } catch (error) {
        /* Style injection is optional; inline styles keep the layout intact. */
      }

      ctx.slots.inject('conversation.view', () =>
        ctx.slots.register(
          {
            name: 'conversation.view',
            id: TAB_ID,
            order: TAB_ORDER,
            label: () => L.tab,
          },
          TaskProgressView,
        ),
      );
    }

    return { apply, inject };
  },
});
