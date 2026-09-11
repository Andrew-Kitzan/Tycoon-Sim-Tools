// Calculator tool — a simple scientific calculator that understands the
// game's number abbreviations as input (e.g. "1.5B", "24sx") and shows the
// result both abbreviated and as a full number. Self-contained IIFE, no ES
// modules, same pattern as capgrader-generator.js/luck-crate-generator.js.
// Uses plain floating-point math (Number) — accurate to ~15-16 significant
// digits, which is "good enough" for every real in-game comparison; this is
// not an arbitrary-precision decimal engine.
(function () {
  const section = document.querySelector('#calc-tool');
  if (!section) return;

  const input = section.querySelector('#calc-input');
  const errorEl = section.querySelector('#calc-error');
  const resultEl = section.querySelector('#calc-result');
  const resultAbbrevEl = section.querySelector('#calc-result-abbrev');
  const resultFullEl = section.querySelector('#calc-result-full');

  // Same suffix scale already used elsewhere on the site (app.js's
  // abbreviatedRate, capgrader-generator.js's money parser) — keep this in
  // sync with those if that table ever grows.
  const UNITS = [
    ['td', 1e42], ['dd', 1e39], ['ud', 1e36], ['dc', 1e33],
    ['no', 1e30], ['oc', 1e27], ['sp', 1e24], ['sx', 1e21], ['qn', 1e18],
    ['qd', 1e15], ['t', 1e12], ['b', 1e9], ['m', 1e6], ['k', 1e3],
  ];
  const UNITS_BY_LENGTH_DESC = [...UNITS].sort((a, b) => b[0].length - a[0].length);
  const DISPLAY_UNITS = [
    [1e42, 'Td'], [1e39, 'Dd'], [1e36, 'Ud'], [1e33, 'Dc'],
    [1e30, 'No'], [1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'], [1e18, 'Qn'],
    [1e15, 'Qd'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'],
  ];

  // ---- Tokenizer --------------------------------------------------------
  function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      const ch = source[i];
      if (/\s/.test(ch)) { i += 1; continue; }
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
        const numberText = source.slice(i, j);
        if ((numberText.match(/\./g) || []).length > 1) throw new Error(`Malformed number "${numberText}"`);
        let value = Number(numberText);
        if (!Number.isFinite(value)) throw new Error(`Malformed number "${numberText}"`);
        i = j;
        // optional immediate suffix (K, M, B, T, Qd, Qn, Sx, Sp, Oc, No)
        const rest = source.slice(i).toLowerCase();
        const unit = UNITS_BY_LENGTH_DESC.find(([suffix]) => rest.startsWith(suffix));
        if (unit) {
          value *= unit[1];
          i += unit[0].length;
        }
        tokens.push({ type: 'number', value });
        continue;
      }
      if (/[a-zA-Z]/.test(ch)) {
        let j = i;
        while (j < source.length && /[a-zA-Z]/.test(source[j])) j += 1;
        const word = source.slice(i, j).toLowerCase();
        if (word === 'sqrt') { tokens.push({ type: 'sqrt' }); i = j; continue; }
        throw new Error(`Unknown symbol "${source.slice(i, j)}"`);
      }
      if ('+-*/^()'.includes(ch)) { tokens.push({ type: ch }); i += 1; continue; }
      throw new Error(`Unexpected character "${ch}"`);
    }
    return tokens;
  }

  // ---- Recursive-descent parser + evaluator ------------------------------
  // expression := term (('+'|'-') term)*
  // term       := power (('*'|'/') power)*
  // power      := unary ('^' power)?            (right-associative)
  // unary      := '-' unary | primary
  // primary    := number | '(' expression ')' | 'sqrt' '(' expression ')'
  function evaluate(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const consume = (type) => {
      const token = tokens[pos];
      if (!token || token.type !== type) throw new Error(`Expected "${type}"`);
      pos += 1;
      return token;
    };

    function parseExpression() {
      let value = parseTerm();
      while (peek() && (peek().type === '+' || peek().type === '-')) {
        const op = consume(peek().type).type;
        const rhs = parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
      }
      return value;
    }
    function parseTerm() {
      let value = parsePower();
      while (peek() && (peek().type === '*' || peek().type === '/')) {
        const op = consume(peek().type).type;
        const rhs = parsePower();
        if (op === '/' && rhs === 0) throw new Error('Division by zero');
        value = op === '*' ? value * rhs : value / rhs;
      }
      return value;
    }
    function parsePower() {
      const base = parseUnary();
      if (peek() && peek().type === '^') {
        consume('^');
        const exponent = parsePower(); // right-associative
        return base ** exponent;
      }
      return base;
    }
    function parseUnary() {
      if (peek() && peek().type === '-') { consume('-'); return -parseUnary(); }
      if (peek() && peek().type === '+') { consume('+'); return parseUnary(); }
      return parsePrimary();
    }
    function parsePrimary() {
      const token = peek();
      if (!token) throw new Error('Unexpected end of expression');
      if (token.type === 'number') { consume('number'); return token.value; }
      if (token.type === '(') {
        consume('(');
        const value = parseExpression();
        consume(')');
        return value;
      }
      if (token.type === 'sqrt') {
        consume('sqrt');
        consume('(');
        const value = parseExpression();
        consume(')');
        if (value < 0) throw new Error('Cannot take the square root of a negative number');
        return Math.sqrt(value);
      }
      throw new Error(`Unexpected token "${token.type}"`);
    }

    const result = parseExpression();
    if (pos !== tokens.length) throw new Error(`Unexpected "${tokens[pos].type}"`);
    return result;
  }

  function evaluateExpression(source) {
    const trimmed = source.trim();
    if (!trimmed) throw new Error('Enter an expression');
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) throw new Error('Enter an expression');
    const value = evaluate(tokens);
    if (!Number.isFinite(value)) throw new Error('Result is not a finite number');
    return value;
  }

  // ---- Formatting ---------------------------------------------------------
  function trimTrailingZeros(text) {
    return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
  }

  function formatAbbreviated(value) {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    const unit = DISPLAY_UNITS.find(([minimum]) => abs >= minimum);
    if (!unit) return sign + abs.toFixed(2);
    const [divisor, suffix] = unit;
    return `${sign}${(abs / divisor).toFixed(2)}${suffix}`;
  }

  function formatFullNumber(value) {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs < 1e21) {
      return sign + abs.toLocaleString('en-US', { maximumFractionDigits: 6 });
    }
    // Number.prototype.toFixed refuses fixed-point notation at this scale,
    // so expand the exponential form into a full digit string by hand.
    const [mantissaText, exponentText] = abs.toExponential(15).split('e');
    const exponent = Number(exponentText);
    const digits = mantissaText.replace('.', '');
    const pointPosition = 1 + exponent;
    const padded = pointPosition > digits.length ? digits.padEnd(pointPosition, '0') : digits;
    const intPart = padded.slice(0, pointPosition) || '0';
    const fracPart = trimTrailingZeros('.' + padded.slice(pointPosition)).slice(1);
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + withCommas + (fracPart ? '.' + fracPart : '');
  }

  // ---- UI ---------------------------------------------------------------
  function showResult(value) {
    errorEl.hidden = true;
    resultEl.hidden = false;
    resultAbbrevEl.textContent = formatAbbreviated(value);
    resultFullEl.textContent = formatFullNumber(value);
  }

  function showError(message) {
    resultEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function clearResult() {
    resultEl.hidden = true;
    errorEl.hidden = true;
  }

  const ERROR_DEBOUNCE_MS = 600;
  let errorDebounceTimer = null;

  function runSilently() {
    // Live preview as the user types — incomplete expressions are common
    // mid-typing, so just clear the result instead of flashing an error.
    try {
      const value = evaluateExpression(input.value);
      showResult(value);
      return true;
    } catch {
      clearResult();
      return false;
    }
  }

  function runWithError() {
    try {
      const value = evaluateExpression(input.value);
      showResult(value);
    } catch (error) {
      showError(error.message || 'Could not evaluate that expression');
    }
  }

  function scheduleErrorCheck() {
    if (errorDebounceTimer) clearTimeout(errorDebounceTimer);
    if (!input.value.trim()) return;
    errorDebounceTimer = setTimeout(() => {
      // Only surface an error if it's still invalid once typing has paused —
      // don't flash errors for expressions that are just mid-typing.
      if (!runSilently()) runWithError();
    }, ERROR_DEBOUNCE_MS);
  }

  function handleInput() {
    runSilently();
    scheduleErrorCheck();
  }

  function insertAtCursor(text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const caret = start + text.length;
    input.setSelectionRange(caret, caret);
    input.focus();
    handleInput();
  }

  function backspace() {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    if (start === end && start > 0) {
      input.value = input.value.slice(0, start - 1) + input.value.slice(end);
      input.setSelectionRange(start - 1, start - 1);
    } else {
      input.value = input.value.slice(0, start) + input.value.slice(end);
      input.setSelectionRange(start, start);
    }
    input.focus();
    handleInput();
  }

  function clearAll() {
    if (errorDebounceTimer) clearTimeout(errorDebounceTimer);
    input.value = '';
    clearResult();
    input.focus();
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (errorDebounceTimer) clearTimeout(errorDebounceTimer);
      runWithError();
    }
  });

  section.querySelectorAll('[data-calc-key]').forEach((button) => {
    button.addEventListener('click', () => insertAtCursor(button.dataset.calcKey));
  });
  section.querySelector('[data-calc-action="clear"]')?.addEventListener('click', clearAll);
  section.querySelector('[data-calc-action="backspace"]')?.addEventListener('click', backspace);

  document.addEventListener('calc-tool:activated', () => input.focus());
})();
