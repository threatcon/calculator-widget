// script.js — Rewritten iPhone-style calculator logic (drop-in replacement)
// Populates buttons, provides robust preview (no "Error" on incomplete), keyboard support.

(() => {
  // UI refs
  const exprEl = document.getElementById('expr');
  const resultEl = document.getElementById('result');
  const grid = document.getElementById('buttonGrid');

  // layout (iPhone order, iPhone-like labels)
  const layout = [
    { label: 'AC', type: 'func', action: 'clear' },
    { label: '+/−', type: 'func', action: 'neg' },
    { label: '%', type: 'func', action: 'percent' },
    { label: '÷', type: 'op', action: '/' },

    { label: '7', type: 'digit', action: '7' },
    { label: '8', type: 'digit', action: '8' },
    { label: '9', type: 'digit', action: '9' },
    { label: '×', type: 'op', action: '*' },

    { label: '4', type: 'digit', action: '4' },
    { label: '5', type: 'digit', action: '5' },
    { label: '6', type: 'digit', action: '6' },
    { label: '−', type: 'op', action: '-' },

    { label: '1', type: 'digit', action: '1' },
    { label: '2', type: 'digit', action: '2' },
    { label: '3', type: 'digit', action: '3' },
    { label: '+', type: 'op', action: '+' },

    { label: '0', type: 'digit', action: '0', wide: true },
    { label: '.', type: 'digit', action: '.' },
    { label: '=', type: 'func', action: 'enter' }
  ];

  // state
  let expr = '';
  let lastResult = null;
  let justEvaluated = false;

  // safe evaluator (used for preview and final enter)
  // - normalizes × ÷ −
  // - converts percentages like 50% -> (50/100)
  // - rejects dangerous characters
  function safeEval(raw) {
    if (!raw || !raw.trim()) return 0;
    const normalized = raw.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-');
    const withPercent = normalized.replace(/(\d+(\.\d+)?)%/g, '($1/100)');
    if (!/^[0-9+\-*/().\s%]+$/.test(withPercent)) throw new Error('Invalid characters');
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${withPercent});`);
    const v = fn();
    if (typeof v !== 'number' || !isFinite(v)) throw new Error('Invalid result');
    return v;
  }

  // format display number: trim floating noise, keep up to 12 significant decimals/precision handling
  function formatDisplayNumber(n) {
    if (n === null || n === undefined) return '0';
    if (typeof n === 'number' && Number.isInteger(n)) return String(n);
    const rounded = Math.round((Number(n) + Number.EPSILON) * 1e12) / 1e12;
    // remove trailing zeros in fraction
    return String(rounded).replace(/\.?0+$/,'');
  }

  // updateDisplay: preview but avoid showing "Error" on incomplete expressions.
  function updateDisplay() {
    exprEl.textContent = expr || '\xa0';

    if (!expr) {
      resultEl.textContent = '0';
      return;
    }

    // if expression ends with operator, decimal point, or opening paren — show lastResult or 0
    if (/[\+\-\*\/\s]$/.test(expr) || /\.$/.test(expr) || /[(]$/.test(expr)) {
      resultEl.textContent = lastResult != null ? formatDisplayNumber(lastResult) : '0';
      return;
    }

    try {
      const preview = safeEval(expr);
      resultEl.textContent = formatDisplayNumber(preview);
    } catch {
      resultEl.textContent = lastResult != null ? formatDisplayNumber(lastResult) : '0';
    }
  }

  // handle typing digits/operators/decimal into expr
  function inputChar(ch) {
    // If we just evaluated and user types a digit or '.', start fresh
    if (justEvaluated && /[0-9.]/.test(ch)) {
      expr = '';
      justEvaluated = false;
    }

    // prevent multiple decimals in the same number token
    if (ch === '.') {
      const m = expr.match(/(\d*\.\d*|\d+)$/);
      if (m && m[0].includes('.')) return;
      if (!m) {
        // if previous char is digit or ')', append '0.'; otherwise start '0.'
        expr += (/\d|\)/.test(expr.slice(-1)) ? '0.' : '0.');
        updateDisplay();
        return;
      }
    }

    // don't allow leading + * /
    if (/^[+\*\/]$/.test(ch) && expr === '') return;

    // allow leading minus for negative numbers
    if (ch === '-' && expr === '') {
      expr = '-';
      updateDisplay();
      return;
    }

    // replace consecutive operators (except allow - for negative)
    if (/^[+\-*/]$/.test(ch) && /[+\-*/]$/.test(expr)) {
      // if previous is '-' and new is operator (not minus), replace the operator sequence
      // default behavior: replace last operator with new one (so + then * becomes *)
      expr = expr.replace(/[+\-*/\s]+$/, '');
      expr += ch;
      justEvaluated = false;
      updateDisplay();
      return;
    }

    expr += ch;
    justEvaluated = false;
    updateDisplay();
  }

  function applyAction(action) {
    if (action === 'clear') {
      expr = '';
      lastResult = null;
      justEvaluated = false;
      updateDisplay();
      return;
    }

    if (action === 'neg') {
      expr = toggleSign(expr);
      updateDisplay();
      return;
    }

    if (action === 'percent') {
      // append % to last numeric token if present
      if (/\d$/.test(expr)) {
        expr += '%';
        updateDisplay();
      }
      return;
    }

    if (action === 'enter') {
      if (!expr) {
        resultEl.textContent = '0';
        return;
      }
      try {
        const res = safeEval(expr);
        resultEl.textContent = formatDisplayNumber(res);
        lastResult = res;
        expr = String(formatDisplayNumber(res));
        justEvaluated = true;
      } catch {
        resultEl.textContent = 'Error';
        justEvaluated = false;
      }
      return;
    }

    // default: treat as raw char (digit or operator)
    inputChar(action);
  }

  // toggle sign for last number token
  function toggleSign(s) {
    if (!s) return s;
    // match last numeric token (may be wrapped in parentheses from previous logic)
    const m = s.match(/^(.*?)(-?\d+(\.\d+)?|\(-?\d+(\.\d+)?\))$/);
    if (!m) {
      // if nothing matched, toggle global leading minus
      return s.startsWith('-') ? s.slice(1) : '-' + s;
    }
    const prefix = m[1] || '';
    let num = m[2];
    if (num.startsWith('(') && num.endsWith(')')) num = num.slice(1, -1);
    if (num.startsWith('-')) num = num.slice(1);
    else num = '-' + num;
    // wrap negative numbers in parentheses to keep parsing clear (optional)
    if (num.startsWith('-')) num = '(' + num + ')';
    return prefix + num;
  }

  // build buttons
  function buildButtons() {
    grid.innerHTML = '';
    layout.forEach(it => {
      const btn = document.createElement('button');
      btn.className = 'key';
      if (it.type === 'digit') btn.classList.add('digit');
      if (it.type === 'func') btn.classList.add('func');
      if (it.type === 'op') btn.classList.add('op');
      if (it.wide) btn.classList.add('wide');

      btn.textContent = it.label;
      btn.dataset.action = it.action;
      btn.dataset.type = it.type;
      btn.setAttribute('aria-label', it.label);
      btn.setAttribute('type', 'button');

      let pressTimer = null;

      btn.addEventListener('pointerdown', (e) => {
        btn.classList.add('pressed');
        // long-press for clear: keep behavior but safe guard
        if (it.action === 'clear') {
          pressTimer = setTimeout(() => {
            expr = '';
            lastResult = null;
            updateDisplay();
          }, 550);
        }
        e.preventDefault();
      });

      btn.addEventListener('pointerup', () => {
        btn.classList.remove('pressed');
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        const action = btn.dataset.action;
        if (action === 'clear') {
          expr = '';
          lastResult = null;
          justEvaluated = false;
          updateDisplay();
        } else {
          applyAction(action);
        }
      });

      btn.addEventListener('pointercancel', () => {
        btn.classList.remove('pressed');
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      });

      // also allow keyboard "Enter/Space" activation when button is focused
      btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          btn.classList.add('pressed');
        }
      });
      btn.addEventListener('keyup', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          btn.classList.remove('pressed');
          btn.click();
        }
      });

      // attach data-action attribute for flashKeyForKey
      btn.setAttribute('data-action', it.action);

      grid.appendChild(btn);
    });
  }

  // keyboard support
  function onKeyDown(e) {
    const k = e.key;
    if ((/^[0-9]$/).test(k)) { applyAction(k); flashKeyForKey(k); e.preventDefault(); return; }
    if (k === '.') { applyAction('.'); flashKeyForKey('.'); e.preventDefault(); return; }
    if (k === 'Enter' || k === '=') { applyAction('enter'); flashKeyForKey('='); e.preventDefault(); return; }
    if (k === 'Backspace') {
      if (justEvaluated) {
        expr = '';
        lastResult = null;
        justEvaluated = false;
        updateDisplay();
        e.preventDefault();
        return;
      }
      expr = expr.slice(0, -1);
      updateDisplay();
      e.preventDefault();
      return;
    }
    if (k === 'Escape') { applyAction('clear'); e.preventDefault(); return; }
    if (k === '+' || k === '-' || k === '*' || k === '/') {
      applyAction(k);
      flashKeyForKey(k);
      e.preventDefault();
      return;
    }
    if (k === '%') { applyAction('percent'); flashKeyForKey('%'); e.preventDefault(); return; }
    if (k === '(' || k === ')') { applyAction(k); e.preventDefault(); return; }
  }

  // flash key for keyboard input
  function flashKeyForKey(k) {
    let selector = null;
    if (k >= '0' && k <= '9') selector = `.key.digit[data-action="${k}"]`;
    else if (k === '.') selector = `.key.digit[data-action="."]`;
    else if (k === '+') selector = `.key.op[data-action="+"]`;
    else if (k === '-') selector = `.key.op[data-action="-"]`;
    else if (k === '*') selector = `.key.op[data-action="*"]`;
    else if (k === '/') selector = `.key.op[data-action="/"]`;
    else if (k === '=') selector = `.key.func[data-action="enter"]`;
    else if (k === '%') selector = `.key.func[data-action="percent"]`;
    else if (k === 'Enter') selector = `.key.func[data-action="enter"]`;

    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 140);
  }

  // init
  function init() {
    buildButtons();
    updateDisplay();
    document.addEventListener('keydown', onKeyDown);

    // accessibility: ensure all keys focusable
    Array.from(grid.querySelectorAll('.key')).forEach((b, i) => {
      b.tabIndex = 0;
      b.setAttribute('role', 'button');
    });

    // expose for debug
    window.__iphoneCalc = {
      getState: () => ({ expr, lastResult, justEvaluated }),
      setExpr: (s) => { expr = String(s); updateDisplay(); }
    };
  }

  init();
})();
