// Shared engine for "tap all the targets in a grid" homework.
// Each page calls startGridGame({ storageKey, maxLevel, makeRound }).
// makeRound(level) must return { cols, cells: [{ html, label, target }], taskHtml }.
// targetName is the plural word for the targets, used in the win message ("You found all 6 stars!").
function startGridGame({ storageKey, maxLevel, makeRound, targetName = 'targets' }) {
  const $ = id => document.getElementById(id);
  const board = $('board'), overlay = $('overlay'), dotsEl = $('dots');
  const helper = $('helper'), hintBtn = $('hintBtn'), checkBtn = $('checkBtn'), result = $('result');
  let round = 0, level = 1, targets = 0, found = 0, misses = 0, hints = 0, t0 = 0, timer = null, playing = false, advance = false;

  try { level = Math.min(maxLevel, Math.max(1, parseInt(localStorage.getItem(storageKey)) || 1)); } catch {}
  const save = () => { try { localStorage.setItem(storageKey, level); } catch {} };

  // Soft sounds, created on first tap.
  let ac = null;
  const tone = (freq, dur = 0.15, type = 'sine', when = 0) => {
    if (!$('sound').checked) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume(); // iPad starts audio paused until a tap
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch {}
  };
  const sGood = () => { tone(660); tone(880, .2, 'sine', .08); };
  const sBad = () => tone(180, .2, 'triangle');
  const sWin = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'sine', i * .12));

  function build() {
    round++; // a new round cancels any pending win screen from the previous one
    const r = makeRound(level);
    targets = r.cells.filter(c => c.target).length;
    found = 0; misses = 0; hints = 0;
    board.style.gridTemplateColumns = `repeat(${r.cols}, 1fr)`;
    board.innerHTML = '';
    r.cells.forEach(c => {
      const b = document.createElement('button');
      b.className = 'tile';
      b.dataset.target = c.target ? '1' : '';
      b.setAttribute('aria-label', c.label);
      b.innerHTML = c.html;
      board.appendChild(b);
    });
    $('taskIcon').innerHTML = r.taskHtml;
    dotsEl.innerHTML = '<span class="dot"></span>'.repeat(targets);
    $('miss').textContent = 0; $('time').textContent = 0;
    $('lvlNum').textContent = level;
    result.hidden = true;
    setPlaying(false);
  }

  const setPlaying = on => { playing = on; hintBtn.disabled = checkBtn.disabled = !on; };

  // Helper mode (off by default): shows how many targets are left and a Check button.
  // With helper on, the kid decides when they are done and taps Check; with it off, the round ends by itself.
  const applyHelper = () => {
    dotsEl.hidden = checkBtn.hidden = !helper.checked;
    if (!helper.checked && playing && found === targets) finish();
  };
  helper.addEventListener('change', applyHelper);

  function start() {
    build();
    overlay.hidden = true; setPlaying(true);
    t0 = Date.now(); clearInterval(timer);
    timer = setInterval(() => { $('time').textContent = Math.floor((Date.now() - t0) / 1000); }, 250);
  }

  function finish() {
    setPlaying(false); clearInterval(timer);
    const secs = Math.round((Date.now() - t0) / 1000);
    const stars = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
    sWin();
    const thisRound = round;
    setTimeout(() => {
      if (thisRound !== round) return;
      $('ovTitle').textContent = ['', 'You found them all!', 'Great looking!', 'Super eagle eyes!'][stars];
      $('ovText').textContent = `You found all ${targets} ${targets > 1 ? targetName : targetName.replace(/s$/, '')}! · ${secs} seconds · ${misses === 0 ? 'no oops at all' : misses + ' oops'}` +
        (hints ? ` · ${hints} hint${hints > 1 ? 's' : ''}` : '') +
        (level >= maxLevel ? ' · Top level!' : '');
      const st = $('stars'); st.hidden = false;
      st.innerHTML = [1, 2, 3].map(n => `<span class="${n <= stars ? 'on' : ''}">★</span>`).join('');
      $('ovBtn').textContent = level >= maxLevel ? 'Play again' : 'Next level';
      $('ovAlt').hidden = level >= maxLevel;
      overlay.hidden = false;
      $('ovBtn').focus({ preventScroll: true });
    }, 450);
  }

  board.addEventListener('click', e => {
    const tile = e.target.closest('.tile');
    if (!tile || !playing || tile.classList.contains('found')) return;
    if (tile.dataset.target) {
      tile.classList.remove('hint');
      tile.classList.add('found');
      dotsEl.children[found].classList.add('on');
      found++; sGood();
      if (found === targets && !helper.checked) finish();
    } else {
      misses++; $('miss').textContent = misses; sBad();
      tile.classList.remove('miss'); void tile.offsetWidth; tile.classList.add('miss');
      setTimeout(() => tile.classList.remove('miss'), 450);
    }
  });

  const leftTiles = () => [...board.querySelectorAll('.tile')].filter(t => t.dataset.target && !t.classList.contains('found'));

  // Hint: wiggle one target that has not been found yet.
  hintBtn.addEventListener('click', () => {
    if (!playing || board.querySelector('.tile.hint')) return;
    const tile = pick(leftTiles());
    if (!tile) return;
    hints++;
    tile.classList.add('hint');
    setTimeout(() => tile.classList.remove('hint'), 1500);
  });

  // Check: all found → win; otherwise end the round and mark the ones still hiding.
  checkBtn.addEventListener('click', () => {
    if (!playing) return;
    const left = leftTiles();
    if (!left.length) return finish();
    setPlaying(false); clearInterval(timer); sBad();
    left.forEach(t => { t.classList.remove('hint'); t.classList.add('missed'); });
    $('resultText').textContent = `You found ${found} of ${targets}. The ${left.length} with a dashed box ${left.length > 1 ? 'were' : 'was'} still hiding!`;
    $('resNext').hidden = level >= maxLevel;
    result.hidden = false;
  });
  $('resAgain').addEventListener('click', start);
  $('resNext').addEventListener('click', () => { level++; save(); start(); });

  $('ovBtn').addEventListener('click', () => {
    if (advance && level < maxLevel) { level++; save(); }
    advance = true; start();
  });
  $('ovAlt').addEventListener('click', start);

  const changeLevel = d => {
    level = Math.min(maxLevel, Math.max(1, level + d)); save();
    if (playing) start(); else build();
  };
  $('lvlDown').addEventListener('click', () => changeLevel(-1));
  $('lvlUp').addEventListener('click', () => changeLevel(1));

  build(); // show a real grid behind the start card
  applyHelper();
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// Choose `count` distinct random indexes out of `total`.
const randomIndexes = (total, count) => {
  const s = new Set();
  while (s.size < count) s.add(Math.floor(Math.random() * total));
  return s;
};
