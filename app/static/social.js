let socialState = {
  boot: null,
  currentSubtab: "games",
  gamesLeaderboardCache: new Map(),
  currentGameCode: "",
  activeGameRunner: null,
  chatThreads: [],
  chatActors: [],
  currentThreadId: 0,
  chatMessages: [],
  chatOldestId: 0,
  chatHasMore: true,
  chatRefreshTimer: null,
  actors: [],
  projects: [],
  tasks: [],
  calendarEvents: [],
  calendarDate: new Date(),
  calendarSelectedDay: "",
  notes: [],
  currentNoteId: 0,
  noteSaveTimer: null,
  notificationsTimer: null,
  lastNotificationId: 0,
  unreadCount: 0,
  moduleLoaded: false,
  toastsSeen: new Set(),
};

function socialMaybeStartHooks() {
  if (!token) return;
  if (window.__socialHooksRequested) {
    try { socialStartGlobalHooks(); } catch (_) {}
  }
}

function socialRequest(url, opts = {}) {
  return requestJson(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...authHeaders(),
    },
  });
}

function socialShowToast(title, body) {
  const host = document.getElementById("socialToastHost");
  if (!host) return;
  const item = document.createElement("div");
  item.className = "social-toast";
  item.innerHTML = `<strong>${escapeHtml(String(title || ""))}</strong><div>${escapeHtml(String(body || ""))}</div>`;
  host.appendChild(item);
  setTimeout(() => item.classList.add("show"), 20);
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 260);
  }, 2600);
}

function socialSetBell(unread) {
  const btn = document.getElementById("socialBellBtn");
  const badge = document.getElementById("socialBellBadge");
  if (!btn || !badge) return;
  const canUse = enabledModules instanceof Set && enabledModules.has("social_hub");
  btn.classList.toggle("hidden", !canUse);
  if (!canUse) return;
  const value = Math.max(0, Number(unread || 0));
  badge.classList.toggle("hidden", value <= 0);
  badge.textContent = value > 99 ? "99+" : String(value);
}

async function socialPollNotifications() {
  if (!token) return;
  if (!(enabledModules instanceof Set) || !enabledModules.has("social_hub")) {
    socialSetBell(0);
    return;
  }
  const data = await socialRequest(`/api/social/notifications?since_id=${socialState.lastNotificationId}&limit=60`).catch(() => null);
  if (!data || typeof data !== "object") return;
  socialState.unreadCount = Number(data.unread || 0);
  socialSetBell(socialState.unreadCount);
  const rows = Array.isArray(data.rows) ? data.rows : [];
  for (const row of rows) {
    const id = Number(row.id || 0);
    if (id > socialState.lastNotificationId) socialState.lastNotificationId = id;
    if (!id || socialState.toastsSeen.has(id)) continue;
    socialState.toastsSeen.add(id);
    socialShowToast(row.title || tr("Уведомление", "Notification"), row.body || "");
    if (String(row.kind || "") === "chat_message" && currentTab === "social" && socialState.currentSubtab === "chat") {
      const threadId = Number(row.payload?.thread_id || 0);
      if (threadId && threadId === socialState.currentThreadId) {
        socialLoadMessages(threadId, { silent: true });
      }
    }
  }
}

function socialStartGlobalHooks() {
  if (socialState.notificationsTimer) clearInterval(socialState.notificationsTimer);
  socialSetBell(socialState.unreadCount || 0);
  socialState.notificationsTimer = setInterval(() => {
    socialPollNotifications().catch(() => null);
  }, 8000);
  socialPollNotifications().catch(() => null);
}

function socialStopGlobalHooks() {
  if (socialState.notificationsTimer) {
    clearInterval(socialState.notificationsTimer);
    socialState.notificationsTimer = null;
  }
  if (socialState.chatRefreshTimer) {
    clearInterval(socialState.chatRefreshTimer);
    socialState.chatRefreshTimer = null;
  }
}

function resetSocialState() {
  socialStopGlobalHooks();
  socialState = {
    boot: null,
    currentSubtab: "games",
    gamesLeaderboardCache: new Map(),
    currentGameCode: "",
    activeGameRunner: null,
    chatThreads: [],
    chatActors: [],
    currentThreadId: 0,
    chatMessages: [],
    chatOldestId: 0,
    chatHasMore: true,
    actors: [],
    projects: [],
    tasks: [],
    calendarEvents: [],
    calendarDate: new Date(),
    calendarSelectedDay: "",
    notes: [],
    currentNoteId: 0,
    noteSaveTimer: null,
    notificationsTimer: null,
    lastNotificationId: 0,
    unreadCount: 0,
    moduleLoaded: false,
    toastsSeen: new Set(),
  };
  socialSetBell(0);
}

function switchSocialSubtab(tab, loadNow = true) {
  const safe = ["games", "chat", "tasks", "calendar", "calculator", "notes"].includes(String(tab || ""))
    ? String(tab)
    : "games";
  socialState.currentSubtab = safe;
  currentSocialSubtab = safe;
  const mapping = {
    games: "socialSubtabGames",
    chat: "socialSubtabChat",
    tasks: "socialSubtabTasks",
    calendar: "socialSubtabCalendar",
    calculator: "socialSubtabCalculator",
    notes: "socialSubtabNotes",
  };
  Object.entries(mapping).forEach(([key, id]) => {
    const node = document.getElementById(id);
    if (node) node.classList.toggle("hidden", key !== safe);
    const btn = document.getElementById(`socialSubtab${key.charAt(0).toUpperCase()}${key.slice(1)}Btn`);
    if (btn) btn.classList.toggle("active", key === safe);
  });
  if (!loadNow) return;
  if (safe === "games") socialRenderGames();
  if (safe === "chat") {
    socialLoadThreads();
    if (!socialState.chatRefreshTimer) {
      socialState.chatRefreshTimer = setInterval(() => {
        if (currentTab === "social" && socialState.currentSubtab === "chat") {
          socialLoadThreads({ silent: true });
          if (socialState.currentThreadId) socialLoadMessages(socialState.currentThreadId, { silent: true });
        }
      }, 5000);
    }
  }
  if (safe === "tasks") {
    socialLoadTaskActors();
    socialLoadProjects();
    socialLoadTasks();
  }
  if (safe === "calendar") {
    socialLoadCalendar();
  }
  if (safe === "calculator") {
    socialRenderConverterOptions();
  }
  if (safe === "notes") {
    socialLoadNotes();
  }
}

async function loadSocialWorkspace() {
  if (!(enabledModules instanceof Set) || !enabledModules.has("social_hub")) return;
  const boot = await socialRequest("/api/social/bootstrap").catch((e) => {
    if (e?.message) alert(e.message);
    return null;
  });
  if (!boot) return;
  socialState.boot = boot;
  socialState.moduleLoaded = true;
  socialState.actors = Array.isArray(boot.company_actors) ? boot.company_actors : [];
  socialRenderGames();
  switchSocialSubtab(currentSocialSubtab || socialState.currentSubtab || "games", true);
  socialStartGlobalHooks();
}

function socialOpenModal(title, html) {
  const modal = document.getElementById("socialModal");
  const host = document.getElementById("socialModalHost");
  const titleNode = document.getElementById("socialModalTitle");
  if (!modal || !host || !titleNode) return;
  titleNode.textContent = title || tr("Социальный модуль", "Social module");
  host.innerHTML = html || "";
  modal.classList.remove("hidden");
}

function socialCloseModal(evt = null) {
  const modal = document.getElementById("socialModal");
  if (!modal) return;
  if (evt && evt.target && evt.target !== modal) return;
  if (socialState.activeGameRunner && typeof socialState.activeGameRunner.stop === "function") {
    try { socialState.activeGameRunner.stop(); } catch (_) {}
  }
  socialState.activeGameRunner = null;
  modal.classList.add("hidden");
}

function socialRenderGames() {
  const host = document.getElementById("socialGamesGrid");
  if (!host) return;
  const games = Array.isArray(socialState.boot?.games) && socialState.boot.games.length
    ? socialState.boot.games
    : [
      { code: "snake", title: "Змейка" },
      { code: "tetris", title: "Тетрис" },
      { code: "2048", title: "2048" },
    ];
  host.innerHTML = games.map((game) => {
    const icon = game.code === "snake" ? "🐍" : (game.code === "tetris" ? "🧩" : "🔢");
    return `
      <button class="social-game-card" type="button" ondblclick="socialOpenGameMenu('${escapeHtml(game.code)}')" onclick="socialOpenGameMenu('${escapeHtml(game.code)}')">
        <span class="social-game-icon" aria-hidden="true">${icon}</span>
        <span class="social-game-title">${escapeHtml(game.title || game.code)}</span>
        <small>${tr("Двойной клик или клик для входа", "Double click or click to open")}</small>
      </button>
    `;
  }).join("");
}

async function socialOpenGameMenu(gameCode) {
  const code = String(gameCode || "").trim().toLowerCase();
  if (!code) return;
  socialState.currentGameCode = code;
  const lb = await socialRequest(`/api/social/games/leaderboard?game_code=${encodeURIComponent(code)}&limit=10`).catch(() => ({ my_best: 0, my_rank: null, top: [] }));
  socialState.gamesLeaderboardCache.set(code, lb || {});
  const title = code === "snake"
    ? tr("Змейка", "Snake")
    : (code === "tetris" ? tr("Тетрис", "Tetris") : "2048");
  const myBest = Number(lb?.my_best || 0);
  const myRank = lb?.my_rank ? `#${lb.my_rank}` : "—";
  socialOpenModal(
    `${title}`,
    `
      <div class="social-game-menu">
        <div class="social-game-record">${tr("Ваш рекорд", "Your best")}: <b>${myBest}</b> • ${tr("Место", "Rank")}: <b>${myRank}</b></div>
        <div class="actions">
          <button type="button" onclick="socialStartGame('${escapeHtml(code)}')">${tr("Игра", "Play")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowLeaderboard('${escapeHtml(code)}')">${tr("Рейтинг игроков", "Leaderboard")}</button>
          <button class="btn-secondary" type="button" onclick="socialShowGameTips('${escapeHtml(code)}')">${tr("Как играть", "How to play")}</button>
        </div>
      </div>
    `
  );
}

function socialShowGameTips(code) {
  const safe = String(code || "").toLowerCase();
  const title = safe === "snake"
    ? tr("Как играть в Змейку", "How to play Snake")
    : (safe === "tetris" ? tr("Как играть в Тетрис", "How to play Tetris") : tr("Как играть в 2048", "How to play 2048"));
  const body = safe === "snake"
    ? tr("Управление: стрелки. Ешьте еду, не врезайтесь в стену и в себя. Каждые 5 очков скорость растет.", "Controls: arrows. Eat food and avoid walls or your body. Speed increases every 5 points.")
    : (safe === "tetris"
      ? tr("Управление: ← →, ↓, ↑ поворот, пробел — быстрый сброс. Собирайте линии и набирайте очки.", "Controls: ← →, ↓, ↑ rotate, Space hard drop. Complete lines to gain score.")
      : tr("Управление: стрелки. Совмещайте одинаковые плитки, чтобы получить 2048. Ход завершает игру, когда нет доступных ходов.", "Controls: arrows. Merge equal tiles to reach 2048. Game ends when no moves are available."));
  socialOpenModal(title, `<div class="hint">${escapeHtml(body)}</div><div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("Назад", "Back")}</button></div>`);
}

async function socialShowLeaderboard(code) {
  const safe = String(code || "").toLowerCase();
  const data = await socialRequest(`/api/social/games/leaderboard?game_code=${encodeURIComponent(safe)}&limit=100`).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  const rows = Array.isArray(data.top) ? data.top : [];
  const html = `
    <div class="table-card">
      <table>
        <thead><tr><th>#</th><th>${tr("Ник", "Nickname")}</th><th>${tr("Очки", "Score")}</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((row) => `
            <tr class="${row.is_me ? "social-me-row" : ""}"><td>${Number(row.rank || 0)}</td><td>${escapeHtml(row.nick || "-")}</td><td>${Number(row.score || 0)}</td></tr>
          `).join("") : `<tr><td colspan="3">${tr("Пока нет результатов", "No records yet")}</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="hint">${tr("Ваше место", "Your rank")}: <b>${data.my_rank ? `#${data.my_rank}` : "—"}</b> • ${tr("Ваш рекорд", "Your best")}: <b>${Number(data.my_best || 0)}</b></div>
    <div class="actions"><button type="button" onclick="socialOpenGameMenu('${escapeHtml(safe)}')">${tr("Назад", "Back")}</button></div>
  `;
  socialOpenModal(tr("Рейтинг игроков", "Leaderboard"), html);
}

async function socialStoreGameScore(code, score) {
  const safe = String(code || "").toLowerCase();
  if (!["snake", "tetris", "2048"].includes(safe)) return;
  await socialRequest("/api/social/games/score", {
    method: "POST",
    body: JSON.stringify({ game_code: safe, score: Math.max(0, Math.floor(Number(score || 0)))}),
  }).catch(() => null);
}

function socialGameOverlay(title, score, onRetry) {
  const retryFn = typeof onRetry === "function" ? "socialGameRetry()" : "";
  window.socialGameRetryCb = onRetry || null;
  return `
    <div class="social-game-overlay">
      <h3>${escapeHtml(title)}</h3>
      <div>${tr("Счет", "Score")}: <b>${Number(score || 0)}</b></div>
      <div class="actions">
        ${retryFn ? `<button type="button" onclick="${retryFn}">${tr("Еще раз", "Retry")}</button>` : ""}
        <button class="btn-secondary" type="button" onclick="socialOpenGameMenu('${escapeHtml(socialState.currentGameCode || "snake")}')">${tr("В меню", "Menu")}</button>
      </div>
    </div>
  `;
}

function socialGameRetry() {
  if (typeof window.socialGameRetryCb === "function") window.socialGameRetryCb();
}

function socialStartGame(code) {
  const safe = String(code || "").toLowerCase();
  const title = safe === "snake"
    ? tr("Змейка", "Snake")
    : (safe === "tetris" ? tr("Тетрис", "Tetris") : "2048");
  const hint = safe === "snake"
    ? tr("Управление: стрелки. Ешьте еду и не врезайтесь.", "Controls: arrows. Eat food and avoid collisions.")
    : (safe === "tetris"
      ? tr("Управление: ← →, ↓, ↑ поворот, пробел — быстрый сброс.", "Controls: ← →, ↓, ↑ rotate, Space hard drop.")
      : tr("Управление: стрелки. Совмещайте одинаковые плитки.", "Controls: arrows. Merge equal tiles."));
  const controls = safe === "tetris"
    ? `
      <div class="social-game-controls">
        <button type="button" onclick="socialGameControl('left')">←</button>
        <button type="button" onclick="socialGameControl('right')">→</button>
        <button type="button" onclick="socialGameControl('down')">↓</button>
        <button type="button" onclick="socialGameControl('rotate')">${tr("Поворот", "Rotate")}</button>
        <button type="button" onclick="socialGameControl('drop')">${tr("Сброс", "Drop")}</button>
      </div>
    `
    : "";
  socialOpenModal(
    title,
    `
      <div class="social-game-wrap">
        <div class="hint">${escapeHtml(hint)}</div>
        <canvas id="socialGameCanvas" width="420" height="620"></canvas>
        <div id="socialGameInfo" class="hint">${tr("Счет", "Score")}: 0</div>
        ${controls}
      </div>
    `
  );
  if (socialState.activeGameRunner && typeof socialState.activeGameRunner.stop === "function") {
    socialState.activeGameRunner.stop();
  }
  if (safe === "snake") socialState.activeGameRunner = socialRunSnake();
  else if (safe === "tetris") socialState.activeGameRunner = socialRunTetris();
  else socialState.activeGameRunner = socialRun2048();
}

function socialGameControl(action) {
  const runner = socialState.activeGameRunner;
  if (!runner) return;
  if (action === "left" && typeof runner.moveLeft === "function") runner.moveLeft();
  if (action === "right" && typeof runner.moveRight === "function") runner.moveRight();
  if (action === "down" && typeof runner.moveDown === "function") runner.moveDown();
  if (action === "rotate" && typeof runner.rotate === "function") runner.rotate();
  if (action === "drop" && typeof runner.hardDrop === "function") runner.hardDrop();
}

function socialRunSnake() {
  const canvas = document.getElementById("socialGameCanvas");
  const info = document.getElementById("socialGameInfo");
  if (!canvas || !info) return { stop() {} };
  const ctx = canvas.getContext("2d");
  const size = 20;
  const cols = Math.floor(canvas.width / size);
  const rows = Math.floor(canvas.height / size);
  let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 12, y: 12 };
  let running = true;
  let score = 0;
  let speed = 130;
  let timer = null;

  function spawnFood() {
    while (true) {
      const fx = Math.floor(Math.random() * cols);
      const fy = Math.floor(Math.random() * rows);
      if (!snake.some((s) => s.x === fx && s.y === fy)) {
        food = { x: fx, y: fy };
        return;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1731";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#19d3a2";
    snake.forEach((part, idx) => {
      ctx.globalAlpha = idx === 0 ? 1 : 0.85;
      ctx.fillRect(part.x * size + 1, part.y * size + 1, size - 2, size - 2);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ff6f91";
    ctx.fillRect(food.x * size + 2, food.y * size + 2, size - 4, size - 4);
    info.textContent = `${tr("Счет", "Score")}: ${score}`;
  }

  function stopGame(gameOver = false) {
    running = false;
    if (timer) clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    socialStoreGameScore("snake", score).catch(() => null);
    if (gameOver) {
      socialOpenModal(tr("Змейка", "Snake"), socialGameOverlay(tr("Игра окончена", "Game over"), score, () => socialStartGame("snake")));
    }
  }

  function step() {
    if (!running) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows || snake.some((s) => s.x === head.x && s.y === head.y)) {
      stopGame(true);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      if (score % 5 === 0) speed = Math.max(70, speed - 8);
      spawnFood();
    } else {
      snake.pop();
    }
    draw();
    timer = setTimeout(step, speed);
  }

  function onKey(e) {
    const k = e.key;
    if (k.startsWith("Arrow")) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (k === "ArrowUp" && dir.y !== 1) nextDir = { x: 0, y: -1 };
    if (k === "ArrowDown" && dir.y !== -1) nextDir = { x: 0, y: 1 };
    if (k === "ArrowLeft" && dir.x !== 1) nextDir = { x: -1, y: 0 };
    if (k === "ArrowRight" && dir.x !== -1) nextDir = { x: 1, y: 0 };
    if (k === "Escape") stopGame(false);
  }

  document.addEventListener("keydown", onKey);
  spawnFood();
  draw();
  timer = setTimeout(step, speed);

  return {
    stop() {
      stopGame(false);
    },
  };
}

function socialRunTetris() {
  const canvas = document.getElementById("socialGameCanvas");
  const info = document.getElementById("socialGameInfo");
  if (!canvas || !info) return { stop() {} };
  const ctx = canvas.getContext("2d");
  const cols = 10;
  const rows = 20;
  const cell = Math.floor(canvas.width / cols);
  canvas.height = cell * rows;
  const pad = Math.max(1, Math.round(cell * 0.08));
  const board = Array.from({ length: rows }, () => Array(cols).fill(0));
  const colors = ["#000000", "#19d3a2", "#52a7ff", "#ffb347", "#ff6f91", "#c39bff", "#4dd0e1", "#8bc34a"];
  const shapes = [
    [[1, 1, 1, 1]],
    [[2, 0, 0], [2, 2, 2]],
    [[0, 0, 3], [3, 3, 3]],
    [[4, 4], [4, 4]],
    [[0, 5, 5], [5, 5, 0]],
    [[0, 6, 0], [6, 6, 6]],
    [[7, 7, 0], [0, 7, 7]],
  ];

  let score = 0;
  let running = true;
  let timer = null;
  let speed = 450;
  let current = null;

  function randShape() {
    const matrix = JSON.parse(JSON.stringify(shapes[Math.floor(Math.random() * shapes.length)]));
    return { matrix, x: Math.floor(cols / 2) - Math.ceil(matrix[0].length / 2), y: 0 };
  }

  function collides(piece) {
    for (let y = 0; y < piece.matrix.length; y += 1) {
      for (let x = 0; x < piece.matrix[y].length; x += 1) {
        const val = piece.matrix[y][x];
        if (!val) continue;
        const px = piece.x + x;
        const py = piece.y + y;
        if (px < 0 || px >= cols || py >= rows) return true;
        if (py >= 0 && board[py][px]) return true;
      }
    }
    return false;
  }

  function merge(piece) {
    piece.matrix.forEach((row, y) => {
      row.forEach((val, x) => {
        if (!val) return;
        const py = piece.y + y;
        const px = piece.x + x;
        if (py >= 0 && py < rows && px >= 0 && px < cols) board[py][px] = val;
      });
    });
  }

  function rotate(matrix) {
    const w = matrix[0].length;
    const h = matrix.length;
    const rotated = Array.from({ length: w }, () => Array(h).fill(0));
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        rotated[x][h - y - 1] = matrix[y][x];
      }
    }
    return rotated;
  }

  function clearLines() {
    let lines = 0;
    for (let y = rows - 1; y >= 0; y -= 1) {
      if (board[y].every((v) => v > 0)) {
        board.splice(y, 1);
        board.unshift(Array(cols).fill(0));
        lines += 1;
        y += 1;
      }
    }
    if (lines > 0) {
      score += [0, 100, 250, 450, 700][Math.min(lines, 4)];
      speed = Math.max(120, speed - lines * 8);
    }
  }

  function drawCell(x, y, val) {
    ctx.fillStyle = colors[val] || "#ffffff";
    ctx.fillRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1731";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    board.forEach((row, y) => row.forEach((val, x) => val && drawCell(x, y, val)));
    if (current) {
      current.matrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (!val) return;
          drawCell(current.x + x, current.y + y, val);
        });
      });
    }
    info.textContent = `${tr("Счет", "Score")}: ${score}`;
  }

  function gameOver() {
    running = false;
    if (timer) clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    socialStoreGameScore("tetris", score).catch(() => null);
    socialOpenModal(tr("Тетрис", "Tetris"), socialGameOverlay(tr("Игра окончена", "Game over"), score, () => socialStartGame("tetris")));
  }

  function tick() {
    if (!running) return;
    current.y += 1;
    if (collides(current)) {
      current.y -= 1;
      merge(current);
      clearLines();
      current = randShape();
      if (collides(current)) {
        gameOver();
        return;
      }
    }
    draw();
    timer = setTimeout(tick, speed);
  }

  function hardDrop() {
    while (!collides(current)) current.y += 1;
    current.y -= 1;
  }

  function moveLeft() {
    current.x -= 1;
    if (collides(current)) current.x += 1;
  }

  function moveRight() {
    current.x += 1;
    if (collides(current)) current.x -= 1;
  }

  function moveDown() {
    current.y += 1;
    if (collides(current)) current.y -= 1;
  }

  function rotateCurrent() {
    const prev = current.matrix;
    current.matrix = rotate(current.matrix);
    if (collides(current)) current.matrix = prev;
  }

  function onKey(e) {
    if (!running) return;
    if (e.key.startsWith("Arrow") || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === "ArrowLeft") {
      moveLeft();
    } else if (e.key === "ArrowRight") {
      moveRight();
    } else if (e.key === "ArrowDown") {
      moveDown();
    } else if (e.key === "ArrowUp") {
      rotateCurrent();
    } else if (e.key === " ") {
      hardDrop();
    } else if (e.key === "Escape") {
      running = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      socialStoreGameScore("tetris", score).catch(() => null);
      socialOpenGameMenu("tetris");
      return;
    }
    draw();
  }

  current = randShape();
  if (collides(current)) {
    gameOver();
    return { stop() {} };
  }
  document.addEventListener("keydown", onKey);
  draw();
  timer = setTimeout(tick, speed);

  return {
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    },
    moveLeft,
    moveRight,
    moveDown,
    rotate: rotateCurrent,
    hardDrop,
  };
}

function socialRun2048() {
  const canvas = document.getElementById("socialGameCanvas");
  const info = document.getElementById("socialGameInfo");
  if (!canvas || !info) return { stop() {} };
  const ctx = canvas.getContext("2d");
  const size = 4;
  const cell = Math.floor(Math.min(canvas.width, canvas.height) / size);
  const offsetX = Math.floor((canvas.width - cell * size) / 2);
  const offsetY = Math.floor((canvas.height - cell * size) / 2);
  let board = Array.from({ length: size }, () => Array(size).fill(0));
  let score = 0;
  let running = true;

  function spawnTile() {
    const empty = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!board[y][x]) empty.push([x, y]);
      }
    }
    if (!empty.length) return;
    const [x, y] = empty[Math.floor(Math.random() * empty.length)];
    board[y][x] = Math.random() < 0.9 ? 2 : 4;
  }

  function canMove() {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!board[y][x]) return true;
        const v = board[y][x];
        if (x < size - 1 && board[y][x + 1] === v) return true;
        if (y < size - 1 && board[y + 1][x] === v) return true;
      }
    }
    return false;
  }

  function slide(row) {
    const filtered = row.filter((v) => v);
    const merged = [];
    let i = 0;
    while (i < filtered.length) {
      if (filtered[i] && filtered[i] === filtered[i + 1]) {
        const next = filtered[i] * 2;
        score += next;
        merged.push(next);
        i += 2;
      } else {
        merged.push(filtered[i]);
        i += 1;
      }
    }
    while (merged.length < size) merged.push(0);
    return merged;
  }

  function move(dir) {
    const prev = board.map((r) => r.slice());
    if (dir === "left") {
      board = board.map((row) => slide(row));
    } else if (dir === "right") {
      board = board.map((row) => slide([...row].reverse()).reverse());
    } else if (dir === "up") {
      const cols = Array.from({ length: size }, (_, x) => slide(board.map((r) => r[x])));
      board = board.map((_, y) => cols.map((c) => c[y]));
    } else if (dir === "down") {
      const cols = Array.from({ length: size }, (_, x) => slide(board.map((r) => r[x]).reverse()).reverse());
      board = board.map((_, y) => cols.map((c) => c[y]));
    }
    const changed = board.some((row, y) => row.some((val, x) => val !== prev[y][x]));
    if (changed) spawnTile();
    draw();
    if (!canMove()) {
      running = false;
      socialStoreGameScore("2048", score).catch(() => null);
      socialOpenModal("2048", socialGameOverlay(tr("Игра окончена", "Game over"), score, () => socialStartGame("2048")));
    }
  }

  function drawCell(x, y, value) {
    const colors = {
      0: "#111b33",
      2: "#f5f3ff",
      4: "#dbeafe",
      8: "#bfdbfe",
      16: "#93c5fd",
      32: "#60a5fa",
      64: "#3b82f6",
      128: "#f59e0b",
      256: "#f97316",
      512: "#ef4444",
      1024: "#ec4899",
      2048: "#a855f7",
    };
    ctx.fillStyle = colors[value] || "#1f2937";
    ctx.fillRect(offsetX + x * cell + 4, offsetY + y * cell + 4, cell - 8, cell - 8);
    if (value) {
      ctx.fillStyle = value <= 4 ? "#0f172a" : "#f8fafc";
      ctx.font = `bold ${Math.floor(cell * 0.35)}px 'Unbounded', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), offsetX + x * cell + cell / 2, offsetY + y * cell + cell / 2);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1731";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        drawCell(x, y, board[y][x]);
      }
    }
    info.textContent = `${tr("Счет", "Score")}: ${score}`;
  }

  function onKey(e) {
    if (!running) return;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === "ArrowLeft") move("left");
    if (e.key === "ArrowRight") move("right");
    if (e.key === "ArrowUp") move("up");
    if (e.key === "ArrowDown") move("down");
    if (e.key === "Escape") {
      running = false;
      socialStoreGameScore("2048", score).catch(() => null);
      socialOpenGameMenu("2048");
    }
  }

  document.addEventListener("keydown", onKey);
  spawnTile();
  spawnTile();
  draw();

  return {
    stop() {
      running = false;
      document.removeEventListener("keydown", onKey);
    },
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("seo-wibe-auth", () => {
    socialMaybeStartHooks();
  });
  if (document.readyState === "complete") {
    setTimeout(() => socialMaybeStartHooks(), 0);
  } else {
    window.addEventListener("load", () => {
      setTimeout(() => socialMaybeStartHooks(), 0);
    });
  }
  document.addEventListener("click", (e) => {
    const picker = document.getElementById("socialEmojiPicker");
    const btn = document.getElementById("socialEmojiBtn");
    if (!picker || picker.classList.contains("hidden")) return;
    const target = e.target;
    if (picker.contains(target) || (btn && btn.contains(target))) return;
    socialToggleEmojiPicker(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const picker = document.getElementById("socialEmojiPicker");
    if (picker && !picker.classList.contains("hidden")) socialToggleEmojiPicker(false);
  });
}

async function socialLoadThreads(opts = {}) {
  const data = await socialRequest("/api/social/chat/threads").catch((e) => {
    if (!opts.silent && e?.message) alert(e.message);
    return null;
  });
  if (!Array.isArray(data)) return;
  socialState.chatThreads = data;
  socialRenderThreads();
  if (!socialState.currentThreadId && data.length) {
    socialSelectThread(Number(data[0].id || 0));
  }
}

function socialRenderThreads() {
  const host = document.getElementById("socialChatThreads");
  if (!host) return;
  host.innerHTML = socialState.chatThreads.map((thread) => {
    const unread = Number(thread.unread || 0);
    const lastText = String(thread.last_message?.text || "");
    return `
      <button class="social-thread-item ${Number(thread.id) === socialState.currentThreadId ? "active" : ""}" type="button" onclick="socialSelectThread(${Number(thread.id || 0)})">
        <div class="social-thread-title">${escapeHtml(thread.title || thread.kind || "chat")}${unread > 0 ? `<span class="social-thread-unread">${unread}</span>` : ""}</div>
        <small>${escapeHtml(lastText || tr("Сообщений пока нет", "No messages yet"))}</small>
      </button>
    `;
  }).join("");
}

async function socialSelectThread(threadId) {
  const id = Number(threadId || 0);
  if (!id) return;
  socialState.currentThreadId = id;
  const row = socialState.chatThreads.find((x) => Number(x.id) === id);
  const head = document.getElementById("socialChatHead");
  if (head) head.textContent = row?.title || tr("Чат", "Chat");
  socialRenderThreads();
  await socialLoadMessages(id);
  await socialRequest(`/api/social/chat/read/${id}`, { method: "POST" }).catch(() => null);
  socialPollNotifications().catch(() => null);
}

async function socialLoadMessages(threadId, opts = {}) {
  const id = Number(threadId || socialState.currentThreadId || 0);
  if (!id) return;
  const beforeId = Number(opts.beforeId || 0);
  const limit = Number(opts.limit || 80);
  const host = document.getElementById("socialChatMessages");
  const prevScrollHeight = host ? host.scrollHeight : 0;
  const prevScrollTop = host ? host.scrollTop : 0;
  const atBottom = host ? (host.scrollHeight - host.scrollTop - host.clientHeight < 40) : true;
  const rows = await socialRequest(`/api/social/chat/messages/${id}?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ""}`).catch((e) => {
    if (!opts.silent && e?.message) alert(e.message);
    return null;
  });
  if (!Array.isArray(rows)) return;
  if (beforeId) {
    socialState.chatMessages = [...rows, ...(socialState.chatMessages || [])];
  } else {
    socialState.chatMessages = rows;
  }
  socialState.chatOldestId = socialState.chatMessages.length ? Number(socialState.chatMessages[0].id || 0) : 0;
  socialState.chatHasMore = rows.length >= limit;
  if (!host) return;
  const loadMoreBtn = socialState.chatHasMore
    ? `<button class="btn-secondary social-chat-loadmore" type="button" onclick="socialLoadOlderMessages()">${tr("Загрузить раньше", "Load earlier")}</button>`
    : `<div class="hint">${tr("Начало чата", "Start of chat")}</div>`;
  host.innerHTML = `
    <div class="social-chat-load">${loadMoreBtn}</div>
    ${socialState.chatMessages.map((msg) => `
      <div class="social-msg ${msg.is_mine ? "mine" : ""}">
        <div class="social-msg-head"><b>${escapeHtml(msg.sender_nick || "-")}</b><small>${escapeHtml((msg.created_at || "").slice(0, 16).replace("T", " "))}</small></div>
        <div class="social-msg-text">${escapeHtml(msg.text || "")}</div>
      </div>
    `).join("")}
  `;
  if (beforeId) {
    const nextScroll = host.scrollHeight - prevScrollHeight + prevScrollTop;
    host.scrollTop = Math.max(0, nextScroll);
  } else if (atBottom) {
    host.scrollTop = host.scrollHeight;
  }
}

function socialLoadOlderMessages() {
  if (!socialState.chatOldestId || !socialState.chatHasMore) return;
  socialLoadMessages(socialState.currentThreadId, { beforeId: socialState.chatOldestId, append: true, silent: true });
}

async function socialSendMessage() {
  const threadId = Number(socialState.currentThreadId || 0);
  if (!threadId) return;
  const input = document.getElementById("socialChatInput");
  if (!input) return;
  const text = String(input.value || "").trim();
  if (!text) return;
  const data = await socialRequest(`/api/social/chat/messages/${threadId}`, {
    method: "POST",
    body: JSON.stringify({ text }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!data) return;
  input.value = "";
  await socialLoadMessages(threadId, { silent: true });
  await socialLoadThreads({ silent: true });
}

async function socialOpenDirectPicker() {
  socialOpenModal(
    tr("Личный чат", "Direct chat"),
    `
      <div class="grid-2">
        <input id="socialDirectSearch" placeholder="${tr("Поиск по email", "Search by email")}" oninput="socialFilterDirectActors()" />
        <button type="button" onclick="socialFilterDirectActors()">${tr("Найти", "Search")}</button>
      </div>
      <div class="hint">${tr("Другие компании доступны через поиск по email.", "Other companies appear only via email search.")}</div>
      <div id="socialDirectActors" class="social-direct-list"></div>
    `
  );
  socialLoadDirectActors("");
}

let socialDirectSearchTimer = null;

async function socialLoadDirectActors(query) {
  const q = String(query || "").trim();
  const host = document.getElementById("socialDirectActors");
  if (!host) return;
  const endpoint = q ? `/api/social/chat/actors?q=${encodeURIComponent(q)}` : "/api/social/chat/actors";
  const actors = await socialRequest(endpoint).catch((e) => {
    host.innerHTML = `<div class="hint">${escapeHtml(e.message || tr("Ошибка загрузки", "Loading error"))}</div>`;
    return [];
  });
  if (!Array.isArray(actors)) return;
  const myActor = socialState.boot?.actor?.actor_key || "";
  socialState.chatActors = actors.filter((x) => String(x.actor_key || "") !== String(myActor || ""));
  const rows = socialState.chatActors;
  host.innerHTML = rows.map((row) => `
    <button class="social-direct-row" type="button" onclick="socialStartDirectChat('${escapeHtml(String(row.actor_key || ""))}')">
      <b>${escapeHtml(row.nick || "-")}</b>
      <small>${escapeHtml(row.company || "")}</small>
    </button>
  `).join("") || `<div class="hint">${tr("Никого не найдено", "No users found")}</div>`;
}

function socialFilterDirectActors() {
  const q = String(document.getElementById("socialDirectSearch")?.value || "");
  if (socialDirectSearchTimer) clearTimeout(socialDirectSearchTimer);
  socialDirectSearchTimer = setTimeout(() => {
    socialLoadDirectActors(q);
  }, 240);
}

async function socialStartDirectChat(actorKey) {
  const key = String(actorKey || "").trim();
  if (!key) return;
  const thread = await socialRequest("/api/social/chat/direct", {
    method: "POST",
    body: JSON.stringify({ actor_key: key }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!thread) return;
  socialCloseModal();
  await socialLoadThreads({ silent: true });
  await socialSelectThread(Number(thread.id || 0));
}

async function socialLoadTaskActors() {
  const rows = await socialRequest("/api/social/tasks/actors").catch(() => []);
  socialState.actors = Array.isArray(rows) ? rows : [];
}

async function socialLoadProjects() {
  const rows = await socialRequest("/api/social/tasks/projects").catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.projects = Array.isArray(rows) ? rows : [];
  const select = document.getElementById("socialTaskProjectFilter");
  if (!select) return;
  const keep = String(select.value || "");
  select.innerHTML = `<option value="">${tr("Все проекты", "All projects")}</option>${socialState.projects.map((p) => `<option value="${Number(p.id)}">${escapeHtml(p.title || "-")}</option>`).join("")}`;
  if ([...select.options].some((x) => x.value === keep)) select.value = keep;
}

async function socialLoadTasks() {
  const projectId = document.getElementById("socialTaskProjectFilter")?.value || "";
  const status = document.getElementById("socialTaskStatusFilter")?.value || "";
  const qp = new URLSearchParams();
  if (projectId) qp.set("project_id", projectId);
  if (status) qp.set("status", status);
  const rows = await socialRequest(`/api/social/tasks${qp.toString() ? `?${qp.toString()}` : ""}`).catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.tasks = Array.isArray(rows) ? rows : [];
  socialRenderTasks();
}

function socialRenderTasks() {
  const host = document.getElementById("socialTasksBoard");
  if (!host) return;
  const rows = socialState.tasks || [];
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  if (!rows.length) {
    host.innerHTML = `<div class="hint">${tr("Задач пока нет", "No tasks yet")}</div>`;
    return;
  }
  host.innerHTML = `
    <div class="social-task-list">
      ${rows.map((task) => {
        const status = String(task.status || "todo");
        const statusLabel = status === "todo"
          ? tr("Новые", "To do")
          : (status === "in_progress" ? tr("В работе", "In progress") : tr("Готово", "Done"));
        const priority = String(task.priority || "normal");
        const due = task.due_date ? String(task.due_date).slice(0, 10) : "";
        const project = task.project_title || tr("Без проекта", "No project");
        const isMine = myActorKey && String(task.assignee_key || "") === myActorKey;
        const mineBadge = isMine ? `<span class="social-task-tag">${tr("Ваша задача", "Your task")}</span>` : "";
        return `
          <article class="social-task-row ${isMine ? "is-assignee" : ""}" ondblclick="socialOpenTaskModal(${Number(task.id || 0)})">
            <div class="social-task-main">
              <div class="social-task-title">
                <b>${escapeHtml(task.title || "-")}</b>
                ${mineBadge}
                <span class="social-status ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
                <span class="social-priority ${escapeHtml(priority)}">${escapeHtml(priority)}</span>
              </div>
              <div class="social-task-meta">
                <span>${escapeHtml(project)}</span>
                <span>${tr("Исполнитель", "Assignee")}: <b>${escapeHtml(task.assignee_nick || "-")}</b></span>
                <span>${due ? `${tr("Дедлайн", "Deadline")}: ${escapeHtml(due)}` : tr("Без дедлайна", "No deadline")}</span>
              </div>
            </div>
            <div class="social-task-actions">
              <button type="button" onclick="socialOpenTaskModal(${Number(task.id || 0)})">${tr("Открыть", "Open")}</button>
              ${status !== "done" ? `<button class="btn-secondary" type="button" onclick="socialQuickDone(${Number(task.id || 0)})">${tr("Закрыть", "Done")}</button>` : ""}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function socialBuildTaskForm(task = null) {
  const actors = socialState.actors || [];
  const projects = socialState.projects || [];
  const status = task?.status || "todo";
  const due = task?.due_date ? String(task.due_date).slice(0, 16) : "";
  return `
    <div class="grid-2">
      <label><span>${tr("Название", "Title")}</span><input id="socialTaskTitle" value="${escapeHtml(task?.title || "")}" /></label>
      <label><span>${tr("Проект", "Project")}</span><select id="socialTaskProject"><option value="">${tr("Без проекта", "No project")}</option>${projects.map((p) => `<option value="${Number(p.id)}" ${Number(task?.project_id || 0) === Number(p.id) ? "selected" : ""}>${escapeHtml(p.title || "-")}</option>`).join("")}</select></label>
      <label><span>${tr("Исполнитель", "Assignee")}</span><select id="socialTaskAssignee">${actors.map((a) => `<option value="${escapeHtml(String(a.actor_key || ""))}" ${String(task?.assignee_key || "") === String(a.actor_key || "") ? "selected" : ""}>${escapeHtml(a.nick || "-")}</option>`).join("")}</select></label>
      <label><span>${tr("Приоритет", "Priority")}</span><select id="socialTaskPriority"><option value="low" ${task?.priority === "low" ? "selected" : ""}>low</option><option value="normal" ${task?.priority === "normal" || !task ? "selected" : ""}>normal</option><option value="high" ${task?.priority === "high" ? "selected" : ""}>high</option><option value="critical" ${task?.priority === "critical" ? "selected" : ""}>critical</option></select></label>
      <label><span>${tr("Статус", "Status")}</span><select id="socialTaskStatus"><option value="todo" ${status === "todo" ? "selected" : ""}>todo</option><option value="in_progress" ${status === "in_progress" ? "selected" : ""}>in_progress</option><option value="done" ${status === "done" ? "selected" : ""}>done</option></select></label>
      <label><span>${tr("Дедлайн", "Deadline")}</span><input id="socialTaskDue" type="datetime-local" value="${escapeHtml(due)}" /></label>
      <label class="full"><span>${tr("Описание", "Description")}</span><textarea id="socialTaskDescription" rows="5">${escapeHtml(task?.description || "")}</textarea></label>
    </div>
  `;
}

function socialOpenProjectModal() {
  socialOpenModal(
    tr("Новый проект", "New project"),
    `
      <div class="grid-1">
        <input id="socialProjectTitle" placeholder="${tr("Название проекта", "Project title")}" />
        <textarea id="socialProjectDescription" rows="4" placeholder="${tr("Описание", "Description")}"></textarea>
      </div>
      <div class="actions">
        <button type="button" onclick="socialCreateProject()">${tr("Создать", "Create")}</button>
      </div>
    `
  );
}

async function socialCreateProject() {
  const title = String(document.getElementById("socialProjectTitle")?.value || "").trim();
  const description = String(document.getElementById("socialProjectDescription")?.value || "").trim();
  if (!title) return alert(tr("Укажите название проекта", "Enter project title"));
  await socialRequest("/api/social/tasks/projects", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  }).catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadProjects();
}

function socialOpenTaskModal(taskId = 0) {
  const task = socialState.tasks.find((x) => Number(x.id) === Number(taskId || 0)) || null;
  const comments = Array.isArray(task?.comments) ? task.comments : [];
  socialOpenModal(
    task ? tr("Редактировать задачу", "Edit task") : tr("Новая задача", "New task"),
    `
      ${socialBuildTaskForm(task)}
      ${task ? `<div class="social-task-comments"><h4>${tr("Комментарии", "Comments")}</h4>${comments.map((c) => `<div class="social-task-comment"><b>${escapeHtml(c.author_nick || "-")}</b><small>${escapeHtml((c.created_at || "").slice(0,16).replace("T"," "))}</small><div>${escapeHtml(c.text || "")}</div></div>`).join("") || `<div class="hint">${tr("Комментариев пока нет", "No comments yet")}</div>`}<div class="grid-2"><input id="socialTaskCommentInput" placeholder="${tr("Комментарий", "Comment")}" /><button type="button" onclick="socialAddTaskComment(${Number(task.id)})">${tr("Добавить", "Add")}</button></div></div>` : ""}
      <div class="actions">
        <button type="button" onclick="socialSaveTask(${task ? Number(task.id) : 0})">${task ? tr("Сохранить", "Save") : tr("Создать", "Create")}</button>
      </div>
    `
  );
}

async function socialSaveTask(taskId = 0) {
  const payload = {
    project_id: Number(document.getElementById("socialTaskProject")?.value || 0) || null,
    title: String(document.getElementById("socialTaskTitle")?.value || "").trim(),
    description: String(document.getElementById("socialTaskDescription")?.value || "").trim(),
    status: String(document.getElementById("socialTaskStatus")?.value || "todo"),
    priority: String(document.getElementById("socialTaskPriority")?.value || "normal"),
    due_date: String(document.getElementById("socialTaskDue")?.value || "").trim() || null,
    assignee_key: String(document.getElementById("socialTaskAssignee")?.value || "").trim(),
  };
  if (!payload.title) return alert(tr("Название задачи обязательно", "Task title is required"));
  const req = taskId > 0
    ? socialRequest(`/api/social/tasks/${Number(taskId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/tasks", { method: "POST", body: JSON.stringify(payload) });
  await req.catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadTasks();
}

async function socialAddTaskComment(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  const input = document.getElementById("socialTaskCommentInput");
  const text = String(input?.value || "").trim();
  if (!text) return;
  await socialRequest(`/api/social/tasks/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  }).catch((e) => alert(e.message));
  await socialLoadTasks();
  socialOpenTaskModal(id);
}

async function socialQuickDone(taskId) {
  const id = Number(taskId || 0);
  if (!id) return;
  await socialRequest(`/api/social/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "done" }),
  }).catch((e) => alert(e.message));
  await socialLoadTasks();
}

async function socialLoadCalendar() {
  const monthInput = document.getElementById("socialCalendarMonth");
  if (monthInput && !monthInput.value) {
    const d = socialState.calendarDate;
    monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const monthVal = String(monthInput?.value || "");
  if (monthVal) {
    const [y, m] = monthVal.split("-").map((x) => Number(x || 0));
    if (y && m) socialState.calendarDate = new Date(y, m - 1, 1);
  }
  const start = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth(), 1);
  const end = new Date(socialState.calendarDate.getFullYear(), socialState.calendarDate.getMonth() + 1, 0, 23, 59, 59);
  const qp = new URLSearchParams({
    date_from: start.toISOString(),
    date_to: end.toISOString(),
  });
  const rows = await socialRequest(`/api/social/calendar/events?${qp.toString()}`).catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.calendarEvents = Array.isArray(rows) ? rows : [];
  socialRenderCalendar();
}

function socialShiftCalendar(deltaMonths = 0) {
  const delta = Number(deltaMonths || 0);
  if (!Number.isFinite(delta) || !delta) return;
  const d = socialState.calendarDate;
  socialState.calendarDate = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const monthInput = document.getElementById("socialCalendarMonth");
  if (monthInput) {
    monthInput.value = `${socialState.calendarDate.getFullYear()}-${String(socialState.calendarDate.getMonth() + 1).padStart(2, "0")}`;
  }
  socialLoadCalendar();
}

function socialRenderCalendar() {
  const grid = document.getElementById("socialCalendarGrid");
  const list = document.getElementById("socialCalendarEvents");
  if (!grid || !list) return;
  const d = socialState.calendarDate;
  const todayKey = typeof toYmd === "function" ? toYmd(new Date()) : "";
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const shift = (firstDay.getDay() + 6) % 7;
  const days = lastDay.getDate();
  const tasksByDay = new Map();
  const myTasksByDay = new Map();
  const myActorKey = String(socialState.boot?.actor?.actor_key || "").trim();
  (socialState.tasks || []).forEach((task) => {
    if (!task.due_date) return;
    const key = String(task.due_date).slice(0, 10);
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key).push(task);
    if (myActorKey && String(task.assignee_key || "") === myActorKey) {
      if (!myTasksByDay.has(key)) myTasksByDay.set(key, []);
      myTasksByDay.get(key).push(task);
    }
  });
  let html = `<div class="social-calendar-row head">${[tr("Пн", "Mon"), tr("Вт", "Tue"), tr("Ср", "Wed"), tr("Чт", "Thu"), tr("Пт", "Fri"), tr("Сб", "Sat"), tr("Вс", "Sun")].map((x) => `<span>${x}</span>`).join("")}</div><div class="social-calendar-cells">`;
  for (let i = 0; i < shift; i += 1) html += `<button class="social-day muted" disabled></button>`;
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const eventsCount = socialState.calendarEvents.filter((e) => String(e.start_at || "").slice(0, 10) === key).length;
    const tasksCount = (tasksByDay.get(key) || []).length;
    const myTasksCount = (myTasksByDay.get(key) || []).length;
    const active = socialState.calendarSelectedDay === key ? "active" : "";
    const isToday = todayKey && key === todayKey ? "today" : "";
    const hasEvents = eventsCount > 0 ? "has-event" : "";
    const hasTasks = tasksCount > 0 ? "has-task" : "";
    const hasMyTasks = myTasksCount > 0 ? "has-my-task" : "";
    const manyMyTasks = myTasksCount > 1 ? "my-task-many" : "";
    html += `<button class="social-day ${active} ${isToday} ${hasEvents} ${hasTasks} ${hasMyTasks} ${manyMyTasks}" type="button" onclick="socialShowDay('${key}')"><b>${day}</b><small><span class="calendar-count calendar-events">${eventsCount} ${tr("соб.", "ev.")}</span><span class="calendar-sep">•</span><span class="calendar-count calendar-tasks ${myTasksCount ? "my-task" : ""}">${tasksCount} ${tr("задач", "tasks")}</span></small></button>`;
  }
  html += `</div>`;
  grid.innerHTML = html;
  const fallback = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const inMonth = String(socialState.calendarSelectedDay || "").startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`);
  socialShowDay(inMonth ? socialState.calendarSelectedDay : fallback);
}

function socialShowDay(dayKey) {
  const list = document.getElementById("socialCalendarEvents");
  if (!list) return;
  socialState.calendarSelectedDay = dayKey;
  const events = socialState.calendarEvents.filter((e) => String(e.start_at || "").slice(0, 10) === dayKey);
  const tasks = (socialState.tasks || []).filter((t) => t.due_date && String(t.due_date).slice(0, 10) === dayKey);
  list.innerHTML = `
    <h4>${escapeHtml(dayKey)}</h4>
    <div class="social-day-events">
      <h5>${tr("События", "Events")}</h5>
      ${events.length ? events.map((e) => `<div class="social-day-item"><b>${escapeHtml(e.title || "-")}</b><small>${escapeHtml(String(e.start_at || "").slice(11,16))}${e.is_public ? ` • ${escapeHtml(tr("Общее", "Public"))}` : ` • ${escapeHtml(tr("Личное", "Private"))}`}</small><div>${escapeHtml(e.details || "")}</div><div class="actions"><button type="button" onclick="socialOpenCalendarModal(${Number(e.id)})">${tr("Изменить", "Edit")}</button><button class="btn-danger" type="button" onclick="socialDeleteEvent(${Number(e.id)})">${tr("Удалить", "Delete")}</button></div></div>`).join("") : `<div class="hint">${tr("Нет событий", "No events")}</div>`}
    </div>
    <div class="social-day-events">
      <h5>${tr("Дедлайны задач", "Task deadlines")}</h5>
      ${tasks.length ? tasks.map((t) => `<div class="social-day-item"><b>${escapeHtml(t.title || "-")}</b><small>${escapeHtml(t.assignee_nick || "-")}</small><div>${escapeHtml(t.status || "")}</div></div>`).join("") : `<div class="hint">${tr("Нет задач", "No tasks")}</div>`}
    </div>
  `;
  const grid = document.getElementById("socialCalendarGrid");
  if (grid) {
    grid.querySelectorAll(".social-day").forEach((btn) => {
      const label = btn.querySelector("b");
      if (!label) return;
      const day = String(label.textContent || "").padStart(2, "0");
      const month = String(socialState.calendarDate.getMonth() + 1).padStart(2, "0");
      const year = String(socialState.calendarDate.getFullYear());
      const key = `${year}-${month}-${day}`;
      btn.classList.toggle("active", key === dayKey);
    });
  }
}

const SOCIAL_EMOJI_SETS = {
  business: { label: "Деловые", items: ["👍", "✅", "📌", "📊", "📈", "💼", "🧾", "📎", "✉️", "🤝", "💬", "⏱️"] },
  quick: { label: "Быстрые", items: ["👌", "⚡", "🔥", "💡", "👏", "🙏", "🎯", "💥", "🔔", "🔎", "🧠", "🛠️"] },
  smile: { label: "Эмоции", items: ["🙂", "😀", "😁", "😅", "😊", "😎", "🤗", "😇", "🙌", "😉", "🫡", "🤩"] },
};
let socialEmojiSetKey = "business";

function socialEnsureEmojiPicker() {
  const host = document.getElementById("socialEmojiPicker");
  if (!host || host.childElementCount) return;
  const setEntries = Object.entries(SOCIAL_EMOJI_SETS);
  const setHtml = setEntries.map(([key, meta]) => `
    <button type="button" class="social-emoji-tab ${key === socialEmojiSetKey ? "active" : ""}" onclick="socialSwitchEmojiSet('${key}')">
      ${escapeHtml(meta.label)}
    </button>
  `).join("");
  const items = SOCIAL_EMOJI_SETS[socialEmojiSetKey]?.items || [];
  const itemsHtml = items.map((emoji) => `
    <button type="button" class="social-emoji-item" onclick="socialInsertEmoji('${emoji}')">${emoji}</button>
  `).join("");
  host.innerHTML = `
    <div class="social-emoji-tabs">${setHtml}</div>
    <div class="social-emoji-grid">${itemsHtml}</div>
  `;
}

function socialToggleEmojiPicker(force = null) {
  const host = document.getElementById("socialEmojiPicker");
  if (!host) return;
  socialEnsureEmojiPicker();
  const shouldOpen = force === null ? host.classList.contains("hidden") : Boolean(force);
  host.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen) {
    const input = document.getElementById("socialChatInput");
    if (input) input.focus();
  }
}

function socialSwitchEmojiSet(key) {
  if (!SOCIAL_EMOJI_SETS[key]) return;
  socialEmojiSetKey = key;
  const host = document.getElementById("socialEmojiPicker");
  if (!host) return;
  host.innerHTML = "";
  socialEnsureEmojiPicker();
}

function socialInsertEmoji(emoji) {
  const input = document.getElementById("socialChatInput");
  if (!input) return;
  const value = String(input.value || "");
  const start = Number(input.selectionStart || value.length);
  const end = Number(input.selectionEnd || value.length);
  const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
  input.value = next;
  const caret = start + emoji.length;
  input.setSelectionRange(caret, caret);
  input.focus();
  socialToggleEmojiPicker(true);
}

function socialOpenCalendarModal(eventId = 0) {
  const row = socialState.calendarEvents.find((x) => Number(x.id) === Number(eventId || 0)) || null;
  socialOpenModal(
    row ? tr("Изменить событие", "Edit event") : tr("Новое событие", "New event"),
    `
      <div class="grid-2">
        <label><span>${tr("Название", "Title")}</span><input id="socialEventTitle" value="${escapeHtml(row?.title || "")}" /></label>
        <label><span>${tr("Начало", "Start")}</span><input id="socialEventStart" type="datetime-local" value="${escapeHtml(row?.start_at ? String(row.start_at).slice(0,16) : "")}" /></label>
        <label><span>${tr("Конец", "End")}</span><input id="socialEventEnd" type="datetime-local" value="${escapeHtml(row?.end_at ? String(row.end_at).slice(0,16) : "")}" /></label>
        <label class="check"><input id="socialEventPublic" type="checkbox" ${row?.is_public ? "checked" : ""} /> ${tr("Общее событие (видно всем)", "Public event (visible to all)")}</label>
        <label class="full"><span>${tr("Описание", "Details")}</span><textarea id="socialEventDetails" rows="4">${escapeHtml(row?.details || "")}</textarea></label>
      </div>
      <div class="actions"><button type="button" onclick="socialSaveEvent(${row ? Number(row.id) : 0})">${row ? tr("Сохранить", "Save") : tr("Создать", "Create")}</button></div>
    `
  );
}

async function socialSaveEvent(eventId = 0) {
  const payload = {
    title: String(document.getElementById("socialEventTitle")?.value || "").trim(),
    details: String(document.getElementById("socialEventDetails")?.value || "").trim(),
    start_at: String(document.getElementById("socialEventStart")?.value || "").trim(),
    end_at: String(document.getElementById("socialEventEnd")?.value || "").trim() || null,
    is_public: Boolean(document.getElementById("socialEventPublic")?.checked),
  };
  if (!payload.title || !payload.start_at) return alert(tr("Заполните название и дату начала", "Fill title and start date"));
  const req = eventId > 0
    ? socialRequest(`/api/social/calendar/events/${Number(eventId)}`, { method: "PUT", body: JSON.stringify(payload) })
    : socialRequest("/api/social/calendar/events", { method: "POST", body: JSON.stringify(payload) });
  await req.catch((e) => alert(e.message));
  socialCloseModal();
  await socialLoadCalendar();
}

async function socialDeleteEvent(eventId) {
  const id = Number(eventId || 0);
  if (!id) return;
  await socialRequest(`/api/social/calendar/events/${id}`, { method: "DELETE" }).catch((e) => alert(e.message));
  await socialLoadCalendar();
}

function socialCalcEvaluate() {
  const expr = String(document.getElementById("socialCalcExpr")?.value || "").trim();
  const out = document.getElementById("socialCalcResult");
  if (!out) return;
  if (!expr) {
    out.textContent = "0";
    return;
  }
  const safe = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().,%]+$/.test(safe)) {
    out.textContent = tr("Недопустимое выражение", "Invalid expression");
    return;
  }
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`return (${safe.replace(/%/g, "/100")});`)();
    const normalized = Number(value);
    out.textContent = Number.isFinite(normalized)
      ? normalized.toLocaleString("ru-RU", { maximumFractionDigits: 8 })
      : tr("Ошибка вычисления", "Calculation error");
    const input = document.getElementById("socialCalcExpr");
    if (input && Number.isFinite(normalized)) {
      input.value = String(normalized);
    }
  } catch (_) {
    out.textContent = tr("Ошибка вычисления", "Calculation error");
  }
}

function socialCalcPress(value) {
  const input = document.getElementById("socialCalcExpr");
  if (!input) return;
  const next = String(value || "");
  if (!input.value || input.value === "0") {
    input.value = next === "." ? "0." : next;
  } else {
    input.value = `${input.value || ""}${next}`;
  }
}

function socialCalcClear() {
  const input = document.getElementById("socialCalcExpr");
  const out = document.getElementById("socialCalcResult");
  if (input) input.value = "";
  if (out) out.textContent = "0";
}

function socialCalcBackspace() {
  const input = document.getElementById("socialCalcExpr");
  if (!input) return;
  input.value = String(input.value || "").slice(0, -1);
}

function socialCalcToggleSign() {
  const input = document.getElementById("socialCalcExpr");
  if (!input) return;
  const expr = String(input.value || "").trim();
  if (!expr) {
    input.value = "-";
    return;
  }
  const match = expr.match(/(-?\d*\.?\d+)(?!.*\d)/);
  if (!match || match.index === undefined) return;
  const numberText = match[1];
  const toggled = numberText.startsWith("-") ? numberText.slice(1) : `-${numberText}`;
  const start = match.index;
  const end = start + numberText.length;
  input.value = `${expr.slice(0, start)}${toggled}${expr.slice(end)}`;
}

function socialRenderConverterOptions() {
  const type = String(document.getElementById("socialConvType")?.value || "currency");
  const from = document.getElementById("socialConvFrom");
  const to = document.getElementById("socialConvTo");
  if (!from || !to) return;
  const packs = {
    currency: ["RUB", "USD", "EUR", "CNY"],
    length: ["mm", "cm", "m", "km", "inch", "ft"],
    weight: ["g", "kg", "t", "lb"],
    volume: ["ml", "l", "m3", "cm3"],
  };
  const options = packs[type] || packs.currency;
  from.innerHTML = options.map((x) => `<option value="${x}">${x}</option>`).join("");
  to.innerHTML = options.map((x) => `<option value="${x}">${x}</option>`).join("");
  if (options.length > 1) to.value = options[1];
}

function socialConvert() {
  const value = Number(document.getElementById("socialConvValue")?.value || 0);
  const type = String(document.getElementById("socialConvType")?.value || "currency");
  const from = String(document.getElementById("socialConvFrom")?.value || "");
  const to = String(document.getElementById("socialConvTo")?.value || "");
  const out = document.getElementById("socialConvResult");
  if (!out) return;
  if (!Number.isFinite(value)) {
    out.textContent = tr("Введите число", "Enter a number");
    return;
  }
  const toBase = {
    currency: { RUB: 1, USD: 91, EUR: 99, CNY: 12.5 },
    length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048 },
    weight: { g: 0.001, kg: 1, t: 1000, lb: 0.45359237 },
    volume: { ml: 0.001, l: 1, m3: 1000, cm3: 0.001 },
  };
  const pack = toBase[type] || toBase.currency;
  if (!pack[from] || !pack[to]) {
    out.textContent = tr("Выберите единицы", "Select units");
    return;
  }
  const base = value * pack[from];
  const converted = base / pack[to];
  out.textContent = `${value} ${from} = ${converted.toLocaleString("ru-RU", { maximumFractionDigits: 8 })} ${to}`;
}

function socialCalcVolume() {
  const a = Number(document.getElementById("socialVolA")?.value || 0);
  const b = Number(document.getElementById("socialVolB")?.value || 0);
  const c = Number(document.getElementById("socialVolC")?.value || 0);
  const out = document.getElementById("socialVolResult");
  if (!out) return;
  if (![a, b, c].every((n) => Number.isFinite(n) && n > 0)) {
    out.textContent = tr("Введите длину, ширину и высоту", "Enter length, width and height");
    return;
  }
  const cm3 = a * b * c;
  const liters = cm3 / 1000;
  const m3 = cm3 / 1_000_000;
  out.textContent = `${tr("Объем", "Volume")}: ${cm3.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} см³ • ${liters.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} л • ${m3.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} м³`;
}

async function socialLoadNotes() {
  const rows = await socialRequest("/api/social/notes").catch((e) => {
    alert(e.message);
    return [];
  });
  socialState.notes = Array.isArray(rows) ? rows : [];
  if (!socialState.currentNoteId && socialState.notes.length) {
    socialState.currentNoteId = Number(socialState.notes[0].id || 0);
  }
  socialRenderNotesList();
  socialRenderCurrentNote();
}

function socialRenderNotesList() {
  const host = document.getElementById("socialNotesList");
  if (!host) return;
  host.innerHTML = socialState.notes.map((row) => `
    <div class="social-note-row ${Number(row.id) === socialState.currentNoteId ? "active" : ""}">
      <button class="social-note-main" type="button" onclick="socialSelectNote(${Number(row.id)})">
        <b>${escapeHtml(row.title || tr("Без названия", "Untitled"))}</b>
        <small>${escapeHtml(String(row.updated_at || "").slice(0,16).replace("T", " "))}</small>
      </button>
      <button class="btn-secondary social-note-delete" type="button" onclick="socialDeleteNote(${Number(row.id)})">✕</button>
    </div>
  `).join("") || `<div class="hint">${tr("Заметок пока нет", "No notes yet")}</div>`;
}

function socialRenderCurrentNote() {
  const note = socialState.notes.find((x) => Number(x.id) === Number(socialState.currentNoteId || 0)) || null;
  const title = document.getElementById("socialNoteTitle");
  const content = document.getElementById("socialNoteContent");
  if (!title || !content) return;
  title.value = note?.title || "";
  content.value = note?.content || "";
  const autosave = document.getElementById("socialNoteAutosave");
  if (autosave) autosave.textContent = note ? tr("Автосохранение включено", "Autosave enabled") : tr("Выберите заметку", "Select note");
}

function socialSelectNote(noteId) {
  socialState.currentNoteId = Number(noteId || 0);
  socialRenderNotesList();
  socialRenderCurrentNote();
}

async function socialCreateNote() {
  const row = await socialRequest("/api/social/notes", {
    method: "POST",
    body: JSON.stringify({ title: tr("Новая заметка", "New note"), content: "" }),
  }).catch((e) => {
    alert(e.message);
    return null;
  });
  if (!row) return;
  await socialLoadNotes();
  socialSelectNote(Number(row.id || 0));
}

function socialScheduleNoteSave() {
  if (socialState.noteSaveTimer) clearTimeout(socialState.noteSaveTimer);
  socialState.noteSaveTimer = setTimeout(() => {
    socialSaveCurrentNote().catch(() => null);
  }, 800);
}

async function socialSaveCurrentNote() {
  const noteId = Number(socialState.currentNoteId || 0);
  if (!noteId) return;
  const titleNode = document.getElementById("socialNoteTitle");
  const contentNode = document.getElementById("socialNoteContent");
  const autosave = document.getElementById("socialNoteAutosave");
  const payload = {
    title: String(titleNode?.value || "").trim() || tr("Без названия", "Untitled"),
    content: String(contentNode?.value || ""),
  };
  if (autosave) autosave.textContent = tr("Сохраняем...", "Saving...");
  const saved = await socialRequest(`/api/social/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).catch((e) => {
    if (autosave) autosave.textContent = e.message;
    return null;
  });
  if (!saved) return;
  const idx = socialState.notes.findIndex((x) => Number(x.id) === noteId);
  if (idx >= 0) socialState.notes[idx] = saved;
  socialRenderNotesList();
  if (autosave) autosave.textContent = tr("Сохранено", "Saved");
}

async function socialDeleteCurrentNote() {
  const noteId = Number(socialState.currentNoteId || 0);
  if (!noteId) return;
  await socialRequest(`/api/social/notes/${noteId}`, { method: "DELETE" }).catch((e) => alert(e.message));
  socialState.currentNoteId = 0;
  await socialLoadNotes();
}

async function socialDeleteNote(noteId) {
  const id = Number(noteId || 0);
  if (!id) return;
  if (!confirm(tr("Удалить заметку?", "Delete note?"))) return;
  await socialRequest(`/api/social/notes/${id}`, { method: "DELETE" }).catch((e) => alert(e.message));
  if (socialState.currentNoteId === id) socialState.currentNoteId = 0;
  await socialLoadNotes();
}

window.loadSocialWorkspace = loadSocialWorkspace;
window.switchSocialSubtab = switchSocialSubtab;
window.socialOpenGameMenu = socialOpenGameMenu;
window.socialShowLeaderboard = socialShowLeaderboard;
window.socialShowGameTips = socialShowGameTips;
window.socialStartGame = socialStartGame;
window.socialGameControl = socialGameControl;
window.socialCloseModal = socialCloseModal;
window.socialGameRetry = socialGameRetry;
window.socialOpenDirectPicker = socialOpenDirectPicker;
window.socialFilterDirectActors = socialFilterDirectActors;
window.socialStartDirectChat = socialStartDirectChat;
window.socialSelectThread = socialSelectThread;
window.socialSendMessage = socialSendMessage;
window.socialLoadOlderMessages = socialLoadOlderMessages;
window.socialOpenProjectModal = socialOpenProjectModal;
window.socialCreateProject = socialCreateProject;
window.socialOpenTaskModal = socialOpenTaskModal;
window.socialSaveTask = socialSaveTask;
window.socialAddTaskComment = socialAddTaskComment;
window.socialQuickDone = socialQuickDone;
window.socialOpenCalendarModal = socialOpenCalendarModal;
window.socialSaveEvent = socialSaveEvent;
window.socialDeleteEvent = socialDeleteEvent;
window.socialShiftCalendar = socialShiftCalendar;
window.socialLoadCalendar = socialLoadCalendar;
window.socialRenderCalendar = socialRenderCalendar;
window.socialShowDay = socialShowDay;
window.socialSetBell = socialSetBell;
window.socialMaybeStartHooks = socialMaybeStartHooks;
window.socialToggleEmojiPicker = socialToggleEmojiPicker;
window.socialInsertEmoji = socialInsertEmoji;
window.socialSwitchEmojiSet = socialSwitchEmojiSet;
window.socialCalcEvaluate = socialCalcEvaluate;
window.socialCalcPress = socialCalcPress;
window.socialCalcClear = socialCalcClear;
window.socialCalcBackspace = socialCalcBackspace;
window.socialCalcToggleSign = socialCalcToggleSign;
window.socialRenderConverterOptions = socialRenderConverterOptions;
window.socialConvert = socialConvert;
window.socialCalcVolume = socialCalcVolume;
window.socialCreateNote = socialCreateNote;
window.socialSelectNote = socialSelectNote;
window.socialScheduleNoteSave = socialScheduleNoteSave;
window.socialDeleteCurrentNote = socialDeleteCurrentNote;
window.socialDeleteNote = socialDeleteNote;
window.socialStartGlobalHooks = socialStartGlobalHooks;
window.socialStopGlobalHooks = socialStopGlobalHooks;
window.resetSocialState = resetSocialState;

socialMaybeStartHooks();
