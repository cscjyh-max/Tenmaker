/* ==========================================================================
   Tenmaker Game - Javascript Logic
   ========================================================================== */

// 1. GAME STATE DEFINITION
const gameState = {
  username: "초보 마법사",
  avatar: "🧙‍♂️",
  gold: 0,
  clears: 0,
  isMuted: false,
  
  // Game 1: Speed Match state
  speedGame: {
    timer: null,
    timeLeft: 20,
    score: 0,
    combo: 0,
    maxCombo: 0,
    target: 0,
    correctAnswer: 0
  },
  
  // Game 2: Card Memory state
  memoryGame: {
    timer: null,
    timeLeft: 30,
    cards: [],
    selectedCards: [],
    matchedPairs: 0
  },

  // Game 3: Bubble Pop state
  bubbleGame: {
    timer: null,
    timeLeft: 25,
    score: 0,
    basket: [],
    basketSum: 0,
    bubbleSpawnInterval: null,
    activeBubbles: []
  },

  // Boss Battle state
  bossBattle: {
    hp: 10,
    maxHp: 10,
    playerHearts: 3,
    maxHearts: 3,
    questionIndex: 0,
    timer: null,
    questionTimeLeft: 8,
    correctCount: 0,
    startTime: 0,
    clearTime: 0,
    currentQuestion: {
      formula: "",
      answer: 0
    },
    currentInput: ""
  }
};

// 2. AUDIO SYNTHESIZER (Web Audio API)
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (gameState.isMuted) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case 'click':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;

    case 'correct':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
      break;

    case 'wrong':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case 'pop':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;

    case 'boss_hit':
      // Exploding sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      
      osc.disconnect(gain);
      osc.connect(filter);
      filter.connect(gain);
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;

    case 'boss_attack':
      // Laser zip
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.35);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;

    case 'victory':
      // Triumphant arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, index) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = 'triangle';
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        
        subOsc.frequency.setValueAtTime(freq, now + index * 0.1);
        subGain.gain.setValueAtTime(0.1, now + index * 0.1);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.3);
        
        subOsc.start(now + index * 0.1);
        subOsc.stop(now + index * 0.1 + 0.3);
      });
      break;

    case 'gameover':
      // Sad descending tune
      const failNotes = [311.13, 293.66, 261.63, 196.00]; // Eb4, D4, C4, G3
      failNotes.forEach((freq, index) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = 'sine';
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        
        subOsc.frequency.setValueAtTime(freq, now + index * 0.15);
        subGain.gain.setValueAtTime(0.12, now + index * 0.15);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.15 + 0.4);
        
        subOsc.start(now + index * 0.15);
        subOsc.stop(now + index * 0.15 + 0.4);
      });
      break;
  }
}

// 3. PARTICLE SYSTEM ENGINE
function createParticles(x, y, color, targetContainer) {
  const canvas = document.createElement('canvas');
  canvas.classList.add('particles-canvas');
  targetContainer.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  const rect = targetContainer.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const localX = x - rect.left;
  const localY = y - rect.top;

  const particles = [];
  const colors = [color, '#ffffff', '#ffdf00'];

  for (let i = 0; i < 25; i++) {
    particles.push({
      x: localX,
      y: localY,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      radius: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: Math.random() * 0.03 + 0.015
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      if (p.alpha > 0) {
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha < 0) p.alpha = 0;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    if (alive) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  animate();
}

// 4. NAVIGATION & SCREEN MANAGER
const screens = {
  landing: document.getElementById('screen-landing'),
  lobby: document.getElementById('screen-lobby'),
  game1: document.getElementById('screen-game1'),
  game2: document.getElementById('screen-game2'),
  game3: document.getElementById('screen-game3'),
  boss: document.getElementById('screen-boss'),
  hall: document.getElementById('screen-hall')
};

function showScreen(screenKey) {
  playSound('click');
  
  // Hide all screens
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  
  // Show target screen
  screens[screenKey].classList.add('active');

  // Specific screen loading behaviors
  if (screenKey === 'lobby') {
    updateLobbyUI();
    document.getElementById('header-stats-container').style.display = 'flex';
  } else if (screenKey === 'landing') {
    document.getElementById('header-stats-container').style.display = 'none';
  } else if (screenKey === 'hall') {
    renderLeaderboards();
  }
}

// 5. LOCAL STORAGE & RANKINGS
const MOCK_GOLD_RANKINGS = [
  { rank: 1, badge: "⚡", name: "수학귀신 가우스", score: 950, date: "2026.07.25" },
  { rank: 2, badge: "🧙‍♂️", name: "아인슈타인", score: 820, date: "2026.07.26" },
  { rank: 3, badge: "🔥", name: "10덕후 마법사", score: 640, date: "2026.07.24" },
  { rank: 4, badge: "🔮", name: "피타고라스", score: 510, date: "2026.07.26" },
  { rank: 5, badge: "🌟", name: "수학 영재", score: 430, date: "2026.07.25" },
  { rank: 6, badge: "❄️", name: "데카르트", score: 320, date: "2026.07.23" },
  { rank: 7, badge: "🔮", name: "초보매직", score: 180, date: "2026.07.26" }
];

const MOCK_CLEARS_RANKINGS = [
  { rank: 1, badge: "⚡", name: "수학귀신 가우스", score: 35, date: "2026.07.25" },
  { rank: 2, badge: "🧙‍♂️", name: "아인슈타인", score: 28, date: "2026.07.26" },
  { rank: 3, badge: "🔮", name: "피타고라스", score: 20, date: "2026.07.26" },
  { rank: 4, badge: "🔥", name: "10덕후 마법사", score: 18, date: "2026.07.24" },
  { rank: 5, badge: "❄️", name: "데카르트", score: 14, date: "2026.07.23" },
  { rank: 6, badge: "🌟", name: "수학 영재", score: 11, date: "2026.07.25" },
  { rank: 7, badge: "🔮", name: "초보매직", score: 6, date: "2026.07.26" }
];

const MOCK_BOSS_RANKINGS = [
  { rank: 1, badge: "⚡", name: "수학귀신 가우스", score: "11.45초", timeRaw: 11.45, date: "2026.07.25" },
  { rank: 2, badge: "🧙‍♂️", name: "아인슈타인", score: "14.28초", timeRaw: 14.28, date: "2026.07.26" },
  { rank: 3, badge: "🔮", name: "피타고라스", score: "17.65초", timeRaw: 17.65, date: "2026.07.26" },
  { rank: 4, badge: "🔥", name: "10덕후 마법사", score: "22.34초", timeRaw: 22.34, date: "2026.07.24" },
  { rank: 5, badge: "🌟", name: "수학 영재", score: "28.91초", timeRaw: 28.91, date: "2026.07.25" }
];

function initRankings() {
  if (!localStorage.getItem('tenmaker_gold_rankings')) {
    localStorage.setItem('tenmaker_gold_rankings', JSON.stringify(MOCK_GOLD_RANKINGS));
  }
  if (!localStorage.getItem('tenmaker_clears_rankings')) {
    localStorage.setItem('tenmaker_clears_rankings', JSON.stringify(MOCK_CLEARS_RANKINGS));
  }
  if (!localStorage.getItem('tenmaker_boss_rankings')) {
    localStorage.setItem('tenmaker_boss_rankings', JSON.stringify(MOCK_BOSS_RANKINGS));
  }
}

function loadState() {
  gameState.username = localStorage.getItem('tenmaker_username') || "초보 마법사";
  gameState.avatar = localStorage.getItem('tenmaker_avatar') || "🧙‍♂️";
  gameState.gold = parseInt(localStorage.getItem('tenmaker_gold')) || 0;
  gameState.clears = parseInt(localStorage.getItem('tenmaker_clears')) || 0;
  gameState.isMuted = localStorage.getItem('tenmaker_is_muted') === 'true';

  document.getElementById('sound-toggle-btn').innerText = gameState.isMuted ? '🔇' : '🔊';
  updateGlobalStatsHUD();
}

function saveState() {
  localStorage.setItem('tenmaker_username', gameState.username);
  localStorage.setItem('tenmaker_avatar', gameState.avatar);
  localStorage.setItem('tenmaker_gold', gameState.gold.toString());
  localStorage.setItem('tenmaker_clears', gameState.clears.toString());
  localStorage.setItem('tenmaker_is_muted', gameState.isMuted.toString());
  updateGlobalStatsHUD();
}

function updateGlobalStatsHUD() {
  document.getElementById('player-gold-display').innerText = gameState.gold;
  document.getElementById('player-clears-display').innerText = gameState.clears;
}

function updateLobbyUI() {
  document.getElementById('lobby-avatar').innerText = gameState.avatar;
  document.getElementById('lobby-username').innerText = gameState.username;
  
  // Calculate a matching magician title based on Clears count
  let title = "초보 수습 마법사";
  if (gameState.clears >= 30) title = "신화의 차원수 마도학자";
  else if (gameState.clears >= 20) title = "대수학 마법 길드 마스터";
  else if (gameState.clears >= 10) title = "10의 비법을 터득한 현자";
  else if (gameState.clears >= 5) title = "상급 연산 마도사";
  else if (gameState.clears >= 2) title = "중급 마법 실습생";
  
  document.querySelector('.profile-card .title-text').innerText = title;
}

function recordLeaderboardEntry(type, score, timeRaw = null) {
  const listKey = `tenmaker_${type}_rankings`;
  const rankings = JSON.parse(localStorage.getItem(listKey)) || [];
  
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  
  const newEntry = {
    badge: gameState.avatar,
    name: gameState.username,
    score: score,
    date: dateStr
  };
  
  if (type === 'boss') {
    newEntry.timeRaw = timeRaw;
  }
  
  rankings.push(newEntry);
  
  // Sort
  if (type === 'boss') {
    // Ascending clear time
    rankings.sort((a, b) => a.timeRaw - b.timeRaw);
  } else {
    // Descending score
    rankings.sort((a, b) => b.score - a.score);
  }
  
  // Assign Ranks and cut off at 10 items
  const updated = rankings.slice(0, 10).map((item, idx) => {
    item.rank = idx + 1;
    return item;
  });
  
  localStorage.setItem(listKey, JSON.stringify(updated));
}

function renderLeaderboards() {
  const goldList = JSON.parse(localStorage.getItem('tenmaker_gold_rankings')) || [];
  const clearsList = JSON.parse(localStorage.getItem('tenmaker_clears_rankings')) || [];
  const bossList = JSON.parse(localStorage.getItem('tenmaker_boss_rankings')) || [];

  const goldBody = document.getElementById('leaderboard-gold-body');
  const clearsBody = document.getElementById('leaderboard-clears-body');
  const bossBody = document.getElementById('leaderboard-boss-body');

  goldBody.innerHTML = goldList.map(r => `
    <tr>
      <td>${r.rank}</td>
      <td>${r.badge}</td>
      <td>${r.name}</td>
      <td>💰 ${r.score}</td>
      <td>${r.date}</td>
    </tr>
  `).join('');

  clearsBody.innerHTML = clearsList.map(r => `
    <tr>
      <td>${r.rank}</td>
      <td>${r.badge}</td>
      <td>${r.name}</td>
      <td>🏆 ${r.score}회</td>
      <td>${r.date}</td>
    </tr>
  `).join('');

  bossBody.innerHTML = bossList.map(r => `
    <tr>
      <td>${r.rank}</td>
      <td>${r.badge}</td>
      <td>${r.name}</td>
      <td>⏱️ ${r.score}</td>
      <td>${r.date}</td>
    </tr>
  `).join('');
}

// 6. SHARED RESULT MODAL
function showResultModal(title, icon, message, goldReward, clearTime = null) {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-icon').innerText = icon;
  document.getElementById('modal-message').innerText = message;
  
  const rewardBox = document.getElementById('modal-reward-box');
  if (goldReward > 0) {
    rewardBox.style.display = 'flex';
    document.getElementById('modal-reward-val').innerText = `💰 +${goldReward} Gold`;
    gameState.gold += goldReward;
    saveState();
    recordLeaderboardEntry('gold', gameState.gold);
  } else {
    rewardBox.style.display = 'none';
  }

  const timeBox = document.getElementById('modal-time-box');
  if (clearTime !== null) {
    timeBox.style.display = 'flex';
    document.getElementById('modal-time-val').innerText = `⏱️ ${clearTime.toFixed(2)}초`;
  } else {
    timeBox.style.display = 'none';
  }

  document.getElementById('result-modal').style.display = 'flex';
}

function closeResultModal() {
  playSound('click');
  document.getElementById('result-modal').style.display = 'none';
  showScreen('lobby');
}

// ==========================================================================
// 7. MINI GAME 1: 스피드 짝꿍 (Speed Match)
// ==========================================================================
function startSpeedGame() {
  showScreen('game1');
  const g = gameState.speedGame;
  g.timeLeft = 20;
  g.score = 0;
  g.combo = 0;
  g.maxCombo = 0;
  
  document.getElementById('game1-score').innerText = '0';
  document.getElementById('game1-timer').innerText = `⏱️ ${g.timeLeft}`;
  document.getElementById('game1-combo').style.display = 'none';
  
  generateSpeedQuestion();
  
  g.timer = setInterval(() => {
    g.timeLeft--;
    document.getElementById('game1-timer').innerText = `⏱️ ${g.timeLeft}`;
    
    if (g.timeLeft <= 0) {
      endSpeedGame();
    }
  }, 1000);
}

function generateSpeedQuestion() {
  const g = gameState.speedGame;
  
  // Pick target number 1 to 9
  g.target = Math.floor(Math.random() * 9) + 1;
  g.correctAnswer = 10 - g.target;
  
  document.getElementById('game1-target').innerText = g.target;

  // Generate 4 unique choice options
  const choices = [g.correctAnswer];
  while (choices.length < 4) {
    const r = Math.floor(Math.random() * 9) + 1;
    if (!choices.includes(r)) {
      choices.push(r);
    }
  }

  // Shuffle choices
  choices.sort(() => Math.random() - 0.5);

  const container = document.getElementById('game1-choices');
  container.innerHTML = '';
  
  choices.forEach(val => {
    const btn = document.createElement('button');
    btn.classList.add('choice-btn');
    btn.innerText = val;
    btn.addEventListener('click', (e) => handleSpeedChoice(val, e));
    container.appendChild(btn);
  });
}

function handleSpeedChoice(chosenVal, event) {
  const g = gameState.speedGame;
  const buttons = document.querySelectorAll('#game1-choices .choice-btn');
  
  // Disable all buttons immediately
  buttons.forEach(btn => btn.style.pointerEvents = 'none');
  
  const rect = event.target.getBoundingClientRect();
  const clickX = rect.left + rect.width / 2;
  const clickY = rect.top + rect.height / 2;
  const parentArea = document.querySelector('.speed-match-area');

  if (chosenVal === g.correctAnswer) {
    // Correct answer
    playSound('correct');
    event.target.classList.add('correct');
    
    // Increment stats
    g.score += 10;
    g.combo++;
    if (g.combo > g.maxCombo) {
      g.maxCombo = g.combo;
    }
    
    // Visual combo
    const comboBadge = document.getElementById('game1-combo');
    if (g.combo >= 2) {
      comboBadge.innerText = `COMBO ${g.combo}`;
      comboBadge.style.display = 'block';
    }
    
    document.getElementById('game1-score').innerText = g.score;
    createParticles(clickX, clickY, '#0cf588', parentArea);
    
    setTimeout(() => {
      generateSpeedQuestion();
    }, 250);
  } else {
    // Wrong answer
    playSound('wrong');
    event.target.classList.add('wrong');
    
    // Reset combo
    g.combo = 0;
    document.getElementById('game1-combo').style.display = 'none';
    
    // Highlight correct one briefly
    buttons.forEach(btn => {
      if (parseInt(btn.innerText) === g.correctAnswer) {
        btn.classList.add('correct');
      }
    });

    createParticles(clickX, clickY, '#ff3333', parentArea);
    
    setTimeout(() => {
      generateSpeedQuestion();
    }, 450);
  }
}

function endSpeedGame() {
  const g = gameState.speedGame;
  clearInterval(g.timer);
  
  // Earned gold calculation
  const baseGold = Math.floor(g.score / 5);
  const comboBonus = Math.floor(g.maxCombo * 1.5);
  const totalGoldEarned = baseGold + comboBonus;

  if (totalGoldEarned > 0) {
    gameState.clears++;
    saveState();
    recordLeaderboardEntry('clears', gameState.clears);
  }

  playSound(totalGoldEarned > 0 ? 'victory' : 'gameover');

  showResultModal(
    "수련 완료!",
    "⚡",
    `스피드 짝꿍 수련을 끝마쳤습니다!\n획득 점수: ${g.score}점\n최대 콤보: ${g.maxCombo}회`,
    totalGoldEarned
  );
}

// ==========================================================================
// 8. MINI GAME 2: 텐 메모리 (Card Flip 10)
// ==========================================================================
function startMemoryGame() {
  showScreen('game2');
  const m = gameState.memoryGame;
  m.timeLeft = 30;
  m.matchedPairs = 0;
  m.selectedCards = [];

  document.getElementById('game2-pairs').innerText = '0';
  document.getElementById('game2-timer').innerText = `⏱️ ${m.timeLeft}`;

  setupMemoryBoard();

  m.timer = setInterval(() => {
    m.timeLeft--;
    document.getElementById('game2-timer').innerText = `⏱️ ${m.timeLeft}`;
    
    if (m.timeLeft <= 0) {
      endMemoryGame();
    }
  }, 1000);
}

function setupMemoryBoard() {
  const m = gameState.memoryGame;
  const board = document.getElementById('game2-board');
  board.innerHTML = '';

  // Generate 8 pairs adding to 10
  // e.g. 1&9, 2&8, 3&7, 4&6, 5&5, 2&8, 3&7, 4&6
  const numberPairs = [
    1, 9,
    2, 8,
    3, 7,
    4, 6,
    5, 5,
    2, 8,
    3, 7,
    4, 6
  ];

  // Shuffle pairs
  numberPairs.sort(() => Math.random() - 0.5);

  m.cards = numberPairs.map((value, idx) => {
    return {
      id: idx,
      value: value,
      isFlipped: false,
      isMatched: false
    };
  });

  m.cards.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');
    cardEl.setAttribute('data-id', card.id);

    const cardBack = document.createElement('div');
    cardBack.classList.add('card-face', 'card-back');

    const cardFront = document.createElement('div');
    cardFront.classList.add('card-face', 'card-front');
    cardFront.innerText = card.value;

    cardEl.appendChild(cardBack);
    cardEl.appendChild(cardFront);
    
    cardEl.addEventListener('click', () => handleCardClick(card, cardEl));
    board.appendChild(cardEl);
  });
}

function handleCardClick(card, cardEl) {
  const m = gameState.memoryGame;
  
  if (card.isFlipped || card.isMatched || m.selectedCards.length >= 2) return;

  playSound('click');
  card.isFlipped = true;
  cardEl.classList.add('flipped');
  m.selectedCards.push({ card, el: cardEl });

  if (m.selectedCards.length === 2) {
    const first = m.selectedCards[0];
    const second = m.selectedCards[1];

    if (first.card.value + second.card.value === 10) {
      // Matched!
      setTimeout(() => {
        playSound('correct');
        first.card.isMatched = true;
        second.card.isMatched = true;
        first.el.classList.add('matched');
        second.el.classList.add('matched');

        // Burst particles at both cards
        const rect1 = first.el.getBoundingClientRect();
        const rect2 = second.el.getBoundingClientRect();
        const board = document.getElementById('game2-board');
        
        createParticles(rect1.left + rect1.width/2, rect1.top + rect1.height/2, '#00f0ff', board);
        createParticles(rect2.left + rect2.width/2, rect2.top + rect2.height/2, '#00f0ff', board);

        m.matchedPairs++;
        document.getElementById('game2-pairs').innerText = m.matchedPairs;
        m.selectedCards = [];

        // Check clear
        if (m.matchedPairs === 8) {
          endMemoryGame();
        }
      }, 350);
    } else {
      // No match
      setTimeout(() => {
        playSound('wrong');
        first.card.isFlipped = false;
        second.card.isFlipped = false;
        first.el.classList.remove('flipped');
        second.el.classList.remove('flipped');
        
        // Brief shake effect
        first.el.classList.add('shake');
        second.el.classList.add('shake');
        setTimeout(() => {
          first.el.classList.remove('shake');
          second.el.classList.remove('shake');
        }, 300);

        m.selectedCards = [];
      }, 900);
    }
  }
}

function endMemoryGame() {
  const m = gameState.memoryGame;
  clearInterval(m.timer);

  // Stop click events
  document.querySelectorAll('.card').forEach(el => el.style.pointerEvents = 'none');

  const allMatched = m.matchedPairs === 8;
  const speedBonus = allMatched ? Math.max(0, Math.floor(m.timeLeft * 0.8)) : 0;
  const totalGoldEarned = (m.matchedPairs * 3) + speedBonus + (allMatched ? 15 : 0);

  if (totalGoldEarned > 0) {
    gameState.clears++;
    saveState();
    recordLeaderboardEntry('clears', gameState.clears);
  }

  playSound(totalGoldEarned > 0 ? 'victory' : 'gameover');

  showResultModal(
    allMatched ? "올 클리어!" : "수련 완료!",
    "🎴",
    allMatched 
      ? `텐 메모리 완벽 정복!\n남은 시간: ${m.timeLeft}초\n완료 보너스 획득!` 
      : `텐 메모리 수련을 마쳤습니다.\n맞춘 짝: ${m.matchedPairs}개`,
    totalGoldEarned
  );
}

// ==========================================================================
// 9. MINI GAME 3: 버블 팝 텐 (Bubble Pop 10)
// ==========================================================================
function startBubbleGame() {
  showScreen('game3');
  const b = gameState.bubbleGame;
  b.timeLeft = 25;
  b.score = 0;
  b.basket = [];
  b.basketSum = 0;
  b.activeBubbles = [];

  document.getElementById('game3-timer').innerText = `⏱️ ${b.timeLeft}`;
  updateBasketUI();

  // Remove any old bubbles
  const area = document.getElementById('bubble-area');
  const oldBubbles = area.querySelectorAll('.bubble');
  oldBubbles.forEach(x => x.remove());

  // Spawn loop
  b.bubbleSpawnInterval = setInterval(spawnBubble, 700);

  // Time loop
  b.timer = setInterval(() => {
    b.timeLeft--;
    document.getElementById('game3-timer').innerText = `⏱️ ${b.timeLeft}`;
    
    if (b.timeLeft <= 0) {
      endBubbleGame();
    }
  }, 1000);
}

function spawnBubble() {
  if (screens.game3.classList.contains('active') === false) return;

  const b = gameState.bubbleGame;
  const area = document.getElementById('bubble-area');
  const rect = area.getBoundingClientRect();

  const bubbleEl = document.createElement('div');
  bubbleEl.classList.add('bubble');

  // Random parameters
  const number = Math.floor(Math.random() * 9) + 1; // 1 to 9
  const bubbleSize = Math.random() * 15 + 40; // 40px to 55px
  const posX = Math.random() * (rect.width - bubbleSize - 20) + 10;
  const duration = Math.random() * 2.5 + 3.5; // 3.5s to 6s float up duration

  bubbleEl.style.width = `${bubbleSize}px`;
  bubbleEl.style.height = `${bubbleSize}px`;
  bubbleEl.style.left = `${posX}px`;
  bubbleEl.style.bottom = `-50px`;
  bubbleEl.style.animationDuration = `${duration}s`;
  bubbleEl.innerText = number;

  // Custom colors depending on number
  const hue = (number * 38) % 360;
  bubbleEl.style.background = `radial-gradient(circle at 30% 30%, hsla(${hue}, 85%, 75%, 0.95), hsla(${hue}, 90%, 45%, 0.8) 70%, hsla(${hue}, 100%, 25%, 0.9) 100%)`;
  bubbleEl.style.borderColor = `hsla(${hue}, 100%, 65%, 0.5)`;

  // Add click handler
  bubbleEl.addEventListener('click', (e) => {
    e.stopPropagation();
    handleBubbleClick(number, bubbleEl, e);
  });

  area.appendChild(bubbleEl);
  b.activeBubbles.push(bubbleEl);

  // Auto clean up when bubble animation finishes
  setTimeout(() => {
    if (bubbleEl.parentNode) {
      bubbleEl.remove();
      b.activeBubbles = b.activeBubbles.filter(x => x !== bubbleEl);
    }
  }, duration * 1000);
}

function handleBubbleClick(number, bubbleEl, event) {
  const b = gameState.bubbleGame;
  if (b.basketSum >= 10) return;
  playSound('pop');

  const rect = bubbleEl.getBoundingClientRect();
  const popX = rect.left + rect.width / 2;
  const popY = rect.top + rect.height / 2;
  const area = document.getElementById('bubble-area');

  createParticles(popX, popY, 'rgba(0, 240, 255, 0.8)', area);

  // Remove bubble
  bubbleEl.remove();
  b.activeBubbles = b.activeBubbles.filter(x => x !== bubbleEl);

  // Add to basket
  b.basket.push(number);
  b.basketSum += number;

  updateBasketUI();

  const basketPanel = document.querySelector('.basket-container');

  if (b.basketSum === 10) {
    // Sum is exactly 10!
    playSound('correct');
    b.score += 15; // Earn points
    basketPanel.classList.add('success');
    
    createParticles(window.innerWidth / 2, popY, '#0cf588', area);

    setTimeout(() => {
      b.basket = [];
      b.basketSum = 0;
      basketPanel.classList.remove('success');
      updateBasketUI();
    }, 450);
  } else if (b.basketSum > 10) {
    // Exceeded 10
    playSound('wrong');
    basketPanel.classList.add('shake');
    
    // Penalty: subtract 2 seconds
    b.timeLeft = Math.max(0, b.timeLeft - 2);
    document.getElementById('game3-timer').innerText = `⏱️ ${b.timeLeft}`;

    setTimeout(() => {
      b.basket = [];
      b.basketSum = 0;
      basketPanel.classList.remove('shake');
      updateBasketUI();
    }, 600);
  }
}

function updateBasketUI() {
  const b = gameState.bubbleGame;
  document.getElementById('basket-sum-text').innerText = `장바구니 합계: ${b.basketSum}`;
  
  const list = document.getElementById('basket-bubbles-list');
  list.innerHTML = '';
  
  b.basket.forEach(num => {
    const bubble = document.createElement('div');
    bubble.classList.add('basket-item');
    bubble.innerText = num;
    list.appendChild(bubble);
  });
}

function resetBasket() {
  playSound('click');
  const b = gameState.bubbleGame;
  b.basket = [];
  b.basketSum = 0;
  updateBasketUI();
}

function endBubbleGame() {
  const b = gameState.bubbleGame;
  clearInterval(b.timer);
  clearInterval(b.bubbleSpawnInterval);

  // Clean up bubbles
  b.activeBubbles.forEach(el => el.remove());
  b.activeBubbles = [];

  const earnedGold = Math.floor(b.score / 3);

  if (earnedGold > 0) {
    gameState.clears++;
    saveState();
    recordLeaderboardEntry('clears', gameState.clears);
  }

  playSound(earnedGold > 0 ? 'victory' : 'gameover');

  showResultModal(
    "수련 완료!",
    "🧼",
    `버블 팝 텐 수련 완료!\n터뜨린 10 조합 점수: ${b.score}점`,
    earnedGold
  );
}

// ==========================================================================
// 10. BOSS RAID CHALLENGE
// ==========================================================================
function startBossRaid() {
  // Cost verification
  if (gameState.gold < 50) {
    playSound('wrong');
    alert("보스에게 도전하기 위해서는 50 Gold가 필요합니다! 미니게임으로 골드를 더 모아오세요.");
    return;
  }

  // Deduct fee
  gameState.gold -= 50;
  saveState();
  
  showScreen('boss');

  const boss = gameState.bossBattle;
  boss.hp = 10;
  boss.playerHearts = 3;
  boss.questionIndex = 0;
  boss.correctCount = 0;
  boss.currentInput = "";
  boss.startTime = performance.now(); // Start timer
  
  updateBossHeartsUI();
  updateBossHPUI();
  
  nextBossQuestion();
}

function updateBossHeartsUI() {
  const heartsContainer = document.getElementById('boss-player-hearts');
  heartsContainer.innerHTML = '❤️ '.repeat(gameState.bossBattle.playerHearts);
}

function updateBossHPUI() {
  const boss = gameState.bossBattle;
  const hpFill = document.getElementById('boss-hp-fill');
  const hpText = document.getElementById('boss-hp-current');
  
  const percentage = (boss.hp / boss.maxHp) * 100;
  hpFill.style.width = `${percentage}%`;
  hpText.innerText = boss.hp;
}

function generateBossQuestion() {
  const boss = gameState.bossBattle;
  const index = boss.questionIndex;

  let formula = "";
  let answer = 0;

  // Design distinct kinds of questions matching current stage index
  // Ensure that 'answer' is in range [0, 9] to make it compatible with calculator pad
  if (index < 2) {
    // Type A: simple addition X + ? = 10
    const x = Math.floor(Math.random() * 8) + 1; // 1 to 8
    answer = 10 - x;
    formula = `${x} + <span class="math-blank">?</span> = 10`;
  } else if (index < 4) {
    // Type B: simple subtraction X - ? = 10
    const x = Math.floor(Math.random() * 9) + 11; // 11 to 19
    answer = x - 10;
    formula = `${x} - <span class="math-blank">?</span> = 10`;
  } else if (index < 7) {
    // Type C: three terms addition X + Y + ? = 10
    const x = Math.floor(Math.random() * 4) + 1; // 1 to 4
    const y = Math.floor(Math.random() * 4) + 1; // 1 to 4
    answer = 10 - (x + y);
    formula = `${x} + ${y} + <span class="math-blank">?</span> = 10`;
  } else {
    // Type D: mixed operations X - Y + ? = 10
    const x = Math.floor(Math.random() * 6) + 7; // 7 to 12
    const y = Math.floor(Math.random() * 5) + 1; // 1 to 5
    // Ensure answer is valid
    answer = 10 - (x - y);
    if (answer < 0 || answer > 9) {
      // Fallback to simple three terms if logic overflows
      answer = 3;
      formula = `5 + 2 + <span class="math-blank">?</span> = 10`;
    } else {
      formula = `${x} - ${y} + <span class="math-blank">?</span> = 10`;
    }
  }

  boss.currentQuestion = { formula, answer };
}

function nextBossQuestion() {
  const boss = gameState.bossBattle;
  clearInterval(boss.timer);

  if (boss.hp <= 0 || boss.playerHearts <= 0 || boss.questionIndex >= 10) {
    endBossRaid();
    return;
  }

  boss.questionIndex++;
  document.getElementById('boss-question-num').innerText = boss.questionIndex;
  
  generateBossQuestion();
  document.getElementById('boss-math-formula').innerHTML = boss.currentQuestion.formula;
  
  boss.currentInput = "";
  document.getElementById('boss-answer-display').innerText = "_";

  // Stage timer: 8 seconds per question
  boss.questionTimeLeft = 8;
  const timerBar = document.getElementById('boss-question-timer-bar');
  timerBar.style.width = '100%';

  boss.timer = setInterval(() => {
    boss.questionTimeLeft -= 0.1;
    const progress = (boss.questionTimeLeft / 8) * 100;
    timerBar.style.width = `${progress}%`;

    if (boss.questionTimeLeft <= 0) {
      clearInterval(boss.timer);
      handleBossTimeout();
    }
  }, 100);
}

function handleNumpadInput(val) {
  playSound('click');
  const boss = gameState.bossBattle;
  const display = document.getElementById('boss-answer-display');

  if (val === 'clear') {
    boss.currentInput = "";
    display.innerText = "_";
  } else if (val === 'enter') {
    submitBossAnswer();
  } else {
    // Only accept up to 2 digits just in case, although answers are [0-9]
    if (boss.currentInput.length < 2) {
      boss.currentInput += val;
      display.innerText = boss.currentInput;
    }
  }
}

function submitBossAnswer() {
  const boss = gameState.bossBattle;
  clearInterval(boss.timer);

  const userAnswer = parseInt(boss.currentInput);
  const correctAnswer = boss.currentQuestion.answer;
  const bossAvatar = document.getElementById('boss-avatar-img');

  if (userAnswer === correctAnswer) {
    // Correct
    playSound('boss_hit');
    boss.hp--;
    boss.correctCount++;
    updateBossHPUI();
    
    // Boss Hit Animation
    bossAvatar.classList.add('hit');
    setTimeout(() => {
      bossAvatar.classList.remove('hit');
    }, 400);

  } else {
    // Incorrect
    handleWrongAnswerAction();
  }

  // Next question
  setTimeout(() => {
    nextBossQuestion();
  }, 800);
}

function handleBossTimeout() {
  handleWrongAnswerAction();
  setTimeout(() => {
    nextBossQuestion();
  }, 800);
}

function handleWrongAnswerAction() {
  playSound('boss_attack');
  const boss = gameState.bossBattle;
  boss.playerHearts--;
  updateBossHeartsUI();

  // Screen/Boss attacking effects
  const bossAvatar = document.getElementById('boss-avatar-img');
  const appContainer = document.getElementById('app-container');
  
  bossAvatar.classList.add('attack');
  appContainer.classList.add('screen-shake');
  
  setTimeout(() => {
    bossAvatar.classList.remove('attack');
    appContainer.classList.remove('screen-shake');
  }, 400);
}

function endBossRaid() {
  const boss = gameState.bossBattle;
  clearInterval(boss.timer);

  const endTime = performance.now();
  boss.clearTime = (endTime - boss.startTime) / 1000; // in seconds

  const victory = boss.hp <= 0 && boss.playerHearts > 0;
  
  if (victory) {
    playSound('victory');
    // Massive gold reward
    const victoryGold = 120;
    
    // Save to Boss Rankings
    const displayTimeStr = `${boss.clearTime.toFixed(2)}초`;
    recordLeaderboardEntry('boss', displayTimeStr, boss.clearTime);
    
    showResultModal(
      "보스 토벌 성공!",
      "👑",
      `숫자 마왕 TEN을 무찌르고 세계의 계산 질서를 수호했습니다!\n체력 소모 없이 완벽 토벌!`,
      victoryGold,
      boss.clearTime
    );
  } else {
    playSound('gameover');
    
    let message = "숫자 마왕의 일격에 당해 도망쳤습니다... 연습실에서 수련을 더 하세요!";
    if (boss.playerHearts > 0 && boss.questionIndex >= 10) {
      message = `시간이 부족하여 마왕이 차원 저편으로 달아났습니다! (체력 감소로 패배)`;
    }

    showResultModal(
      "보스 도전 실패",
      "💀",
      message,
      0
    );
  }
}

// ==========================================================================
// 11. BOOTSTRAPPING & DOM EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize datasets
  initRankings();
  loadState();

  // 1. Audio and General click setup
  document.getElementById('sound-toggle-btn').addEventListener('click', () => {
    gameState.isMuted = !gameState.isMuted;
    saveState();
    document.getElementById('sound-toggle-btn').innerText = gameState.isMuted ? '🔇' : '🔊';
  });

  // Resume Web Audio context on document clicks
  document.addEventListener('click', () => {
    initAudio();
  }, { once: true });

  // 2. Landing Screen selection
  const avatarButtons = document.querySelectorAll('.avatar-opt');
  avatarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      playSound('click');
      avatarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameState.avatar = btn.getAttribute('data-avatar');
    });
  });

  document.getElementById('start-game-btn').addEventListener('click', () => {
    const usernameInput = document.getElementById('username-input').value.trim();
    if (usernameInput) {
      gameState.username = usernameInput;
    } else {
      gameState.username = "익명 마법사";
    }
    saveState();
    showScreen('lobby');
  });

  // 3. Lobby Navigation
  document.getElementById('lobby-to-hall-btn').addEventListener('click', () => showScreen('hall'));
  document.getElementById('hall-to-lobby-btn').addEventListener('click', () => showScreen('lobby'));

  // Mini-game entries
  document.getElementById('play-game1-btn').addEventListener('click', startSpeedGame);
  document.getElementById('play-game2-btn').addEventListener('click', startMemoryGame);
  document.getElementById('play-game3-btn').addEventListener('click', startBubbleGame);
  
  // Quit buttons for game HUDs
  document.querySelectorAll('.quit-game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Clear all active mini-game loops
      clearInterval(gameState.speedGame.timer);
      clearInterval(gameState.memoryGame.timer);
      clearInterval(gameState.bubbleGame.timer);
      clearInterval(gameState.bubbleGame.bubbleSpawnInterval);
      
      showScreen('lobby');
    });
  });

  // Bubble Game Specifics
  document.getElementById('basket-reset-btn').addEventListener('click', resetBasket);

  // 4. Boss Challenge entries
  document.getElementById('boss-raid-btn').addEventListener('click', startBossRaid);

  // Boss Calculator Numpad Actions
  const numpadButtons = document.querySelectorAll('.numpad-btn');
  numpadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      handleNumpadInput(val);
    });
  });

  // Support keyboard numeric inputs on Boss Screen
  document.addEventListener('keydown', (e) => {
    if (screens.boss.classList.contains('active')) {
      if (e.key >= '0' && e.key <= '9') {
        handleNumpadInput(e.key);
      } else if (e.key === 'Backspace' || e.key === 'c' || e.key === 'C') {
        handleNumpadInput('clear');
      } else if (e.key === 'Enter') {
        handleNumpadInput('enter');
      }
    }
  });

  // 5. Leaderboard Tabs Management
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      playSound('click');
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTabId = btn.getAttribute('data-tab');
      const tabs = document.querySelectorAll('.leaderboard-tab');
      tabs.forEach(t => t.classList.remove('active'));
      document.getElementById(targetTabId).classList.add('active');
    });
  });

  // 6. Modal Dismissal
  document.getElementById('modal-close-btn').addEventListener('click', closeResultModal);
});
