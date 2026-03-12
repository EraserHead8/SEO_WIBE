(function () {
  const socialCheckersState = {
    overview: null,
    currentRoom: null,
    pollTimer: null,
    selectedKey: "",
    pendingMove: false,
  };

  const CHECKERS_DIFFICULTY_FALLBACKS = {
    easy: { code: "easy", title: "Легкий", subtitle: "Ошибается чаще и подходит для быстрого старта.", bot_rating: 950 },
    medium: { code: "medium", title: "Средний", subtitle: "Сбалансированный режим на каждый день.", bot_rating: 1200 },
    hard: { code: "hard", title: "Сильный", subtitle: "Просчитывает глубже и наказывает за неточности.", bot_rating: 1450 },
    expert: { code: "expert", title: "Эксперт", subtitle: "Максимальная сложность для длинных партий.", bot_rating: 1650 },
  };

  function checkersTr(ru, en) {
    return typeof tr === "function" ? tr(ru, en) : ru;
  }

  function checkersEsc(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value == null ? "" : String(value));
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function checkersToast(message, kind = "info") {
    const title = kind === "error" ? checkersTr("Шашки: ошибка", "Checkers: error") : checkersTr("Шашки", "Checkers");
    if (typeof socialShowToast === "function") {
      socialShowToast(title, message);
      return;
    }
    if (kind === "error") alert(message);
  }

  function checkersHumanError(error, fallback) {
    let message = String(error?.message || fallback || "").trim();
    if (!message) return fallback;
    message = message.replace(/^unexpected status\s+\d+\s+[A-Za-z ]+:\s*/i, "").trim();
    if (
      /<(?:!doctype|html|body|head)\b/i.test(message)
      || /gateway time-?out/i.test(message)
      || /internal server error/i.test(message)
      || /bad gateway/i.test(message)
      || /traceback/i.test(message)
    ) {
      return fallback || checkersTr("Сервер временно занят. Попробуйте еще раз.", "The server is temporarily busy. Please try again.");
    }
    return message;
  }

  function checkersFormatDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    try {
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return raw;
      return dt.toLocaleString(document?.documentElement?.lang === "en" ? "en-US" : "ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return raw;
    }
  }

  function checkersCoord(pos) {
    if (!Array.isArray(pos) || pos.length !== 2) return "";
    const row = Number(pos[0]);
    const col = Number(pos[1]);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return "";
    return `${"abcdefgh"[col] || "?"}${8 - row}`;
  }

  function checkersPathText(path) {
    return Array.isArray(path) ? path.map(checkersCoord).filter(Boolean).join(" -> ") : "";
  }

  function checkersPosKey(pos) {
    return Array.isArray(pos) && pos.length === 2 ? `${Number(pos[0])}:${Number(pos[1])}` : "";
  }

  function checkersDifficultyInfo(code) {
    const safeCode = String(code || "medium").trim().toLowerCase() || "medium";
    const rows = Array.isArray(socialCheckersState.overview?.difficulties) ? socialCheckersState.overview.difficulties : [];
    const found = rows.find((item) => String(item?.code || "").trim().toLowerCase() === safeCode);
    return found || CHECKERS_DIFFICULTY_FALLBACKS[safeCode] || CHECKERS_DIFFICULTY_FALLBACKS.medium;
  }

  function checkersDifficultyTitle(code) {
    const info = checkersDifficultyInfo(code);
    return String(info?.title || CHECKERS_DIFFICULTY_FALLBACKS.medium.title);
  }

  function checkersRoomStatus(status) {
    const safe = String(status || "").trim().toLowerCase();
    if (safe === "active") return checkersTr("Игра идет", "Active");
    if (safe === "finished") return checkersTr("Завершена", "Finished");
    if (safe === "cancelled") return checkersTr("Закрыта", "Cancelled");
    return checkersTr("Ожидание", "Waiting");
  }

  function checkersRoomMode(room) {
    return String(room?.mode || "human") === "bot" ? checkersTr("С ботом", "Bot") : checkersTr("Онлайн", "Online");
  }

  function checkersResultText(room) {
    if (!room || typeof room !== "object") return "";
    const result = String(room.result || "").trim().toLowerCase();
    const winner = String(room.winner || "").trim().toLowerCase();
    if (result === "draw") return checkersTr("Партия закончилась ничьей.", "The game ended in a draw.");
    if (winner === "white") return checkersTr("Белые победили.", "White wins.");
    if (winner === "black") return checkersTr("Черные победили.", "Black wins.");
    if (result === "cancelled") return checkersTr("Комната закрыта без результата.", "The room was closed without a result.");
    if (result === "resigned") return checkersTr("Партия завершена сдачей.", "The game ended by resignation.");
    return "";
  }

  function checkersPlayerLabel(side) {
    return side === "white" ? checkersTr("Белые", "White") : checkersTr("Черные", "Black");
  }

  function checkersRoomSummary(room) {
    if (!room || typeof room !== "object") return "";
    const resultText = checkersResultText(room);
    if (resultText) return resultText;
    const status = String(room.status || "waiting").trim().toLowerCase();
    if (status === "waiting") {
      return room.can_join
        ? checkersTr("Комната ждет второго игрока. Можно подключиться и начать партию сразу.", "The room is waiting for a second player. Join and start immediately.")
        : checkersTr("Комната создана и ждет соперника. Как только он подключится, партия начнется автоматически.", "The room is ready and waiting for an opponent. The game starts as soon as someone joins.");
    }
    if (status === "active") {
      if (String(room.mode || "human") === "bot") {
        return `${checkersTr("Уровень компьютера", "Bot level")}: ${checkersDifficultyTitle(room.difficulty)}`;
      }
      return room.my_turn
        ? checkersTr("Сейчас ваш ход. Выберите свою шашку, затем подсвеченную клетку назначения.", "It is your move. Select your piece, then the highlighted target square.")
        : checkersTr("Сейчас ход соперника. Позиция обновится автоматически.", "It is the opponent's move. The board will refresh automatically.");
    }
    if (status === "cancelled") {
      return checkersTr("Комната была закрыта до окончания партии.", "The room was closed before the game finished.");
    }
    return checkersTr("Партия сохранена в истории и доступна для просмотра.", "The game is saved in history and can be reviewed.");
  }

  function checkersStopPolling() {
    if (socialCheckersState.pollTimer) {
      clearTimeout(socialCheckersState.pollTimer);
      socialCheckersState.pollTimer = null;
    }
    socialCheckersState.pendingMove = false;
    const card = document.querySelector("#socialModal .social-modal-card");
    if (card) card.classList.remove("social-checkers-modal");
    if (typeof socialState === "object" && socialState) {
      socialState.activeGameRunner = null;
    }
  }

  function checkersArmModal() {
    checkersStopPolling();
    const card = document.querySelector("#socialModal .social-modal-card");
    if (card) card.classList.add("social-checkers-modal");
    if (typeof socialState === "object" && socialState) {
      socialState.currentGameCode = "checkers";
      socialState.activeGameRunner = { kind: "checkers", stop: checkersStopPolling };
    }
  }

  function checkersOpenMenuLoading() {
    socialOpenModal(
      checkersTr("Шашки", "Checkers"),
      `<div class="social-checkers-loading">${checkersEsc(checkersTr("Загружаю лобби шашек...", "Loading checkers lobby..."))}</div>`
    );
    checkersArmModal();
  }

  function checkersTopRows(rows, limit) {
    return Array.isArray(rows) ? rows.slice(0, limit) : [];
  }

  function checkersRoomBadges(room, mine) {
    const safeRoom = room && typeof room === "object" ? room : {};
    const parts = [
      `<span class="social-checkers-badge ${checkersEsc(String(safeRoom.status || "waiting"))}">${checkersEsc(checkersRoomStatus(safeRoom.status))}</span>`,
      `<span class="social-checkers-badge ${String(safeRoom.mode || "human") === "bot" ? "bot" : "human"}">${checkersEsc(checkersRoomMode(safeRoom))}</span>`,
    ];
    if (mine) parts.push(`<span class="social-checkers-badge soft">${checkersEsc(checkersTr("Моя партия", "My game"))}</span>`);
    if (String(safeRoom.mode || "human") === "bot") parts.push(`<span class="social-checkers-badge soft">${checkersEsc(checkersDifficultyTitle(safeRoom.difficulty))}</span>`);
    return parts.join("");
  }

  function checkersRoomCard(room, mine) {
    if (!room || typeof room !== "object") return "";
    const players = room.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const roomId = Number(room.id || 0);
    const roomCode = String(room.room_code || "-").trim() || "-";
    const createdAt = checkersFormatDate(room.created_at);
    const updatedAt = checkersFormatDate(room.updated_at || room.last_move_at || room.created_at);
    const summary = checkersRoomSummary(room);
    const openLabel = mine
      ? (String(room.status || "").trim().toLowerCase() === "finished" ? checkersTr("Открыть", "Open") : checkersTr("Продолжить", "Continue"))
      : (room.can_join ? checkersTr("Подключиться", "Join") : checkersTr("Смотреть", "View"));
    const action = room.can_join ? `socialCheckersJoinRoom(${roomId})` : `socialCheckersOpenRoom(${roomId})`;
    return `
      <article class="social-checkers-room-card ${mine ? "mine" : ""}">
        <div class="social-checkers-room-top">
          <div class="social-checkers-room-title-wrap">
            <div class="social-checkers-room-badges">${checkersRoomBadges(room, mine)}</div>
            <strong class="social-checkers-room-title">${checkersEsc(room.title || `${checkersTr("Комната", "Room")} ${roomCode}`)}</strong>
            <div class="social-checkers-room-code">#${checkersEsc(roomCode)} | ${checkersEsc(checkersTr("Создана", "Created"))}: ${checkersEsc(createdAt)}</div>
          </div>
          <div class="social-checkers-room-actions actions">
            <button type="button" onclick="${action}">${checkersEsc(openLabel)}</button>
          </div>
        </div>
        <div class="social-checkers-room-meta">
          <span>${checkersEsc(checkersPlayerLabel("white"))}: <b>${checkersEsc(white.nick || "-")}</b></span>
          <span>${checkersEsc(checkersPlayerLabel("black"))}: <b>${checkersEsc(black.nick || "-")}</b></span>
          <span>${checkersEsc(checkersTr("Обновлено", "Updated"))}: <b>${checkersEsc(updatedAt)}</b></span>
        </div>
        <div class="social-checkers-room-note">${checkersEsc(summary)}</div>
      </article>
    `;
  }

  function checkersLeaderboardPreview(rows) {
    const safeRows = checkersTopRows(rows, 8);
    if (!safeRows.length) {
      return `<div class="social-checkers-empty">${checkersEsc(checkersTr("Рейтинг пока пуст. Сыграйте первую партию и задайте темп лиге.", "The ladder is empty for now. Play the first game and set the pace."))}</div>`;
    }
    return `
      <div class="social-checkers-rank-list">
        ${safeRows.map((row) => `
          <div class="social-checkers-rank-row ${row.is_me ? "social-me-row" : ""}">
            <div class="social-checkers-rank-main">
              <span class="social-checkers-rank-pill">#${Number(row.rank || 0)}</span>
              <div class="social-checkers-rank-meta">
                <strong>${checkersEsc(row.nick || "-")}</strong>
                <small>${checkersEsc(checkersTr("Рейтинг", "Rating"))}: ${Number(row.rating || 1200)} | ${checkersEsc(checkersTr("Партий", "Games"))}: ${Number(row.play_count || 0)}</small>
              </div>
            </div>
            <div class="social-checkers-rank-stats">
              <span>${checkersEsc(checkersTr("П", "W"))}: <b>${Number(row.wins || 0)}</b></span>
              <span>${checkersEsc(checkersTr("Пор", "L"))}: <b>${Number(row.losses || 0)}</b></span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function socialCheckersOpenMenu() {
    checkersOpenMenuLoading();
    try {
      socialCheckersState.overview = await socialRequest("/api/social/games/checkers/overview");
      socialCheckersState.currentRoom = null;
      socialCheckersState.selectedKey = "";
      socialCheckersRenderMenu();
    } catch (error) {
      socialOpenModal(
        checkersTr("Шашки", "Checkers"),
        `
          <div class="social-checkers-panel">
            <div class="hint">${checkersEsc(checkersHumanError(error, checkersTr("Не удалось открыть шашки. Попробуйте еще раз через пару секунд.", "Failed to open checkers. Please try again in a few seconds.")))}</div>
            <div class="actions">
              <button type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("Повторить", "Retry"))}</button>
              <button class="btn-secondary" type="button" onclick="socialCloseModal()">${checkersEsc(checkersTr("Закрыть", "Close"))}</button>
            </div>
          </div>
        `
      );
      checkersArmModal();
    }
  }
  function socialCheckersRenderMenu() {
    const data = socialCheckersState.overview || {};
    const profile = data.profile && typeof data.profile === "object" ? data.profile : {};
    const leaderboard = Array.isArray(data.leaderboard?.rows) ? data.leaderboard.rows : [];
    const rooms = data.rooms && typeof data.rooms === "object" ? data.rooms : {};
    const publicRooms = Array.isArray(rooms.public) ? rooms.public : [];
    const myRooms = Array.isArray(rooms.mine) ? rooms.mine : [];
    const difficulties = Array.isArray(data.difficulties) && data.difficulties.length ? data.difficulties : Object.values(CHECKERS_DIFFICULTY_FALLBACKS);
    const defaultTitle = profile.nick ? `${checkersTr("Комната", "Room")} ${profile.nick}` : checkersTr("Открытая комната", "Public room");
    const activeMyRooms = myRooms.filter((room) => ["waiting", "active"].includes(String(room?.status || "").trim().toLowerCase())).length;
    const html = `
      <div class="social-checkers-shell lobby-view">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-hero">
            <div class="social-checkers-hero-main">
              <div class="social-checkers-hero-copy">
                <div class="social-checkers-room-badges">
                  <span class="social-checkers-badge primary">${checkersEsc(checkersTr("Глобальный рейтинг", "Global ladder"))}</span>
                  <span class="social-checkers-badge soft">${checkersEsc(checkersTr("Веб + APK", "Web + APK"))}</span>
                </div>
                <h4>${checkersEsc(checkersTr("Шашки SEO WIBE", "SEO WIBE Checkers"))}</h4>
                <p>${checkersEsc(checkersTr("Играйте с компьютером, открывайте сетевые комнаты для коллег и поднимайтесь в общем рейтинге пользователей и сотрудников.", "Play against the computer, open online rooms for colleagues, and climb the shared ladder across all users and employees."))}</p>
              </div>
              <div class="social-checkers-toolbar actions">
                <button class="btn-secondary" type="button" onclick="socialCheckersShowLeaderboard()">${checkersEsc(checkersTr("Весь рейтинг", "Full leaderboard"))}</button>
                <button class="btn-secondary" type="button" onclick="socialCheckersShowTips()">${checkersEsc(checkersTr("Как играть", "How to play"))}</button>
                <button class="btn-secondary" type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("Обновить", "Refresh"))}</button>
              </div>
            </div>
            <div class="social-checkers-stats">
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Рейтинг", "Rating"))}</span><strong>${Number(profile.rating || 1200)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Место", "Rank"))}</span><strong>${data?.leaderboard?.my_rank ? `#${Number(data.leaderboard.my_rank)}` : "-"}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Победы", "Wins"))}</span><strong>${Number(profile.wins || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Поражения", "Losses"))}</span><strong>${Number(profile.losses || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Ничьи", "Draws"))}</span><strong>${Number(profile.draws || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Активных партий", "Active games"))}</span><strong>${Number(activeMyRooms || 0)}</strong></div>
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">AI</span>
                <h5>${checkersEsc(checkersTr("Игра с компьютером", "Play vs computer"))}</h5>
                <p>${checkersEsc(checkersTr("Четыре уровня сложности, быстрый старт в один тап и рейтинг после каждой партии.", "Four difficulty levels, one-tap start, and a live rating after every game."))}</p>
              </div>
              <span class="social-checkers-badge soft">${Number(difficulties.length || 0)} ${checkersEsc(checkersTr("уровня", "levels"))}</span>
            </div>
            <div class="social-checkers-difficulty-grid">
              ${difficulties.map((difficulty) => {
                const safeCode = String(difficulty?.code || "medium");
                const difficultyArg = JSON.stringify(safeCode);
                return `
                  <button class="social-checkers-difficulty" type="button" onclick="socialCheckersQuickStart(${difficultyArg})">
                    <strong>${checkersEsc(difficulty.title || checkersDifficultyTitle(safeCode))}</strong>
                    <span>${checkersEsc(difficulty.subtitle || checkersDifficultyInfo(safeCode).subtitle || "")}</span>
                    <small>${checkersEsc(checkersTr("Рейтинг бота", "Bot rating"))}: ${Number(difficulty.bot_rating || checkersDifficultyInfo(safeCode).bot_rating || 1200)}</small>
                  </button>
                `;
              }).join("")}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">Lobby</span>
                <h5>${checkersEsc(checkersTr("Создать онлайн-комнату", "Create an online room"))}</h5>
                <p>${checkersEsc(checkersTr("Комната появится в общем лобби. Другой пользователь или сотрудник сможет увидеть ее и подключиться.", "The room will appear in the global lobby, where another user or team member can join."))}</p>
              </div>
              <span class="social-checkers-badge soft">${checkersEsc(checkersTr("Публично", "Public"))}</span>
            </div>
            <div class="social-checkers-create-grid">
              <label class="social-checkers-input-card">
                <span>${checkersEsc(checkersTr("Название комнаты", "Room title"))}</span>
                <input id="socialCheckersRoomTitle" type="text" maxlength="120" value="${checkersEsc(defaultTitle)}" placeholder="${checkersEsc(checkersTr("Например, Утренняя партия", "For example, Morning match"))}" />
                <small>${checkersEsc(checkersTr("Если оставить поле пустым, название подставится автоматически по вашему профилю.", "If you leave this blank, the room title will be generated automatically from your profile."))}</small>
              </label>
              <div class="social-checkers-create-actions actions">
                <button type="button" onclick="socialCheckersCreateRoom()">${checkersEsc(checkersTr("Создать комнату", "Create room"))}</button>
              </div>
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">Open rooms</span>
                <h5>${checkersEsc(checkersTr("Открытые комнаты", "Open rooms"))}</h5>
                <p>${checkersEsc(checkersTr("Лобби для всех пользователей и сотрудников. Можно быстро подключиться к свободной комнате.", "A shared lobby for all users and employees. Join any available room in one tap."))}</p>
              </div>
              <span class="social-checkers-badge soft">${Number(publicRooms.length || 0)}</span>
            </div>
            <div class="social-checkers-room-list">
              ${publicRooms.length ? publicRooms.map((room) => checkersRoomCard(room, false)).join("") : `<div class="social-checkers-empty">${checkersEsc(checkersTr("Свободных комнат пока нет. Создайте первую и позовите коллегу.", "There are no open rooms yet. Create the first one and invite a colleague."))}</div>`}
            </div>
          </section>
        </div>

        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">My games</span>
                <h5>${checkersEsc(checkersTr("Ваши партии", "Your games"))}</h5>
                <p>${checkersEsc(checkersTr("Быстрый доступ к ожиданию, активным и недавно завершенным матчам.", "Quick access to waiting, active, and recently finished matches."))}</p>
              </div>
            </div>
            <div class="social-checkers-room-list compact">
              ${myRooms.length ? myRooms.map((room) => checkersRoomCard(room, true)).join("") : `<div class="social-checkers-empty">${checkersEsc(checkersTr("У вас пока нет партий. Начните игру с ботом или создайте свою комнату.", "You have no games yet. Start with the bot or create your own room."))}</div>`}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">Top</span>
                <h5>${checkersEsc(checkersTr("Лидеры рейтинга", "Top players"))}</h5>
                <p>${checkersEsc(checkersTr("Общий рейтинг по победам, поражениям и количеству сыгранных партий.", "Shared ranking by wins, losses, and total games played."))}</p>
              </div>
            </div>
            ${checkersLeaderboardPreview(leaderboard)}
          </section>
        </aside>
      </div>
    `;
    socialOpenModal(checkersTr("Шашки", "Checkers"), html);
    checkersArmModal();
  }

  async function socialCheckersShowLeaderboard() {
    try {
      const data = await socialRequest("/api/social/games/checkers/leaderboard?limit=100");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const html = `
        <div class="social-checkers-panel">
          <div class="social-checkers-section-head">
            <div>
              <h5>${checkersEsc(checkersTr("Глобальный рейтинг игроков", "Global leaderboard"))}</h5>
              <p>${checkersEsc(checkersTr("Все пользователи и сотрудники в одной таблице рейтинга.", "All users and employees in one shared ranking."))}</p>
            </div>
            <span class="social-checkers-badge soft">${checkersEsc(checkersTr("Ваше место", "Your rank"))}: ${data?.my_rank ? `#${Number(data.my_rank)}` : "-"}</span>
          </div>
          <div class="table-card social-checkers-scroll-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>${checkersEsc(checkersTr("Игрок", "Player"))}</th>
                  <th>${checkersEsc(checkersTr("Рейтинг", "Rating"))}</th>
                  <th>${checkersEsc(checkersTr("Победы", "Wins"))}</th>
                  <th>${checkersEsc(checkersTr("Поражения", "Losses"))}</th>
                  <th>${checkersEsc(checkersTr("Ничьи", "Draws"))}</th>
                  <th>${checkersEsc(checkersTr("Партий", "Games"))}</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length ? rows.map((row) => `
                  <tr class="${row.is_me ? "social-me-row" : ""}">
                    <td>${Number(row.rank || 0)}</td>
                    <td>${checkersEsc(row.nick || "-")}</td>
                    <td>${Number(row.rating || 1200)}</td>
                    <td>${Number(row.wins || 0)}</td>
                    <td>${Number(row.losses || 0)}</td>
                    <td>${Number(row.draws || 0)}</td>
                    <td>${Number(row.play_count || 0)}</td>
                  </tr>
                `).join("") : `<tr><td colspan="7">${checkersEsc(checkersTr("Пока нет результатов", "No results yet"))}</td></tr>`}
              </tbody>
            </table>
          </div>
          <div class="hint">${checkersEsc(checkersTr("Ваш рейтинг", "Your rating"))}: <b>${Number(data?.my_rating || 1200)}</b></div>
          <div class="actions">
            <button type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("Назад", "Back"))}</button>
          </div>
        </div>
      `;
      socialOpenModal(checkersTr("Рейтинг игроков", "Leaderboard"), html);
      checkersArmModal();
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("Не удалось загрузить рейтинг.", "Failed to load leaderboard.")), "error");
    }
  }

  function socialCheckersShowTips() {
    const html = `
      <div class="social-checkers-panel">
        <div class="hint">
          <b>${checkersEsc(checkersTr("Правила", "Rules"))}</b><br />
          ${checkersEsc(checkersTr("1. Белые ходят первыми. Обычная шашка ходит по диагонали вперед на одну клетку.", "1. White moves first. Men move diagonally forward by one square."))}<br />
          ${checkersEsc(checkersTr("2. Рубка обязательна. Если есть взятие, доступны только атакующие ходы.", "2. Captures are mandatory. If a capture exists, only attacking moves are legal."))}<br />
          ${checkersEsc(checkersTr("3. Множественное взятие выполняется одним ходом: выберите шашку и конечную клетку цепочки.", "3. Multi-capture is executed in one turn: select the piece and the final landing square."))}<br />
          ${checkersEsc(checkersTr("4. Дойдя до последней горизонтали, шашка становится дамкой.", "4. Reaching the last rank promotes the piece to a king."))}<br />
          ${checkersEsc(checkersTr("5. Побеждает игрок, который забрал все шашки соперника или лишил его допустимых ходов.", "5. You win by taking all enemy pieces or leaving the opponent with no legal moves."))}
        </div>
        <div class="actions">
          <button type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("Назад", "Back"))}</button>
        </div>
      </div>
    `;
    socialOpenModal(checkersTr("Как играть в шашки", "How to play Checkers"), html);
    checkersArmModal();
  }

  async function socialCheckersQuickStart(difficulty) {
    try {
      const room = await socialRequest("/api/social/games/checkers/rooms", {
        method: "POST",
        body: JSON.stringify({ mode: "bot", difficulty: String(difficulty || "medium") }),
      });
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("Не удалось начать партию с компьютером.", "Failed to start the bot game.")), "error");
    }
  }

  async function socialCheckersCreateRoom() {
    const titleInput = document.getElementById("socialCheckersRoomTitle");
    const title = String(titleInput?.value || "").trim();
    try {
      const room = await socialRequest("/api/social/games/checkers/rooms", {
        method: "POST",
        body: JSON.stringify({ mode: "human", title, is_public: true }),
      });
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("Не удалось создать комнату.", "Failed to create the room.")), "error");
    }
  }

  async function socialCheckersJoinRoom(roomId) {
    try {
      const room = await socialRequest(`/api/social/games/checkers/rooms/${Number(roomId || 0)}/join`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("Не удалось подключиться к комнате.", "Failed to join the room.")), "error");
    }
  }

  async function socialCheckersOpenRoom(roomId) {
    try {
      const room = await socialRequest(`/api/social/games/checkers/rooms/${Number(roomId || 0)}`);
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("Не удалось открыть комнату.", "Failed to open the room.")), "error");
    }
  }
  function checkersSelection(room) {
    const moves = Array.isArray(room?.legal_moves) ? room.legal_moves : [];
    const selected = socialCheckersState.selectedKey;
    const starts = new Set(moves.map((move) => checkersPosKey(move.from)));
    const selectedMoves = selected ? moves.filter((move) => checkersPosKey(move.from) === selected) : [];
    const targets = new Set(selectedMoves.map((move) => checkersPosKey(move.to)));
    return { starts, targets };
  }

  function checkersPieceHtml(piece) {
    const safe = String(piece || "");
    if (!safe) return "";
    const side = safe.toLowerCase() === "w" ? "white" : "black";
    const king = safe === "W" || safe === "B";
    return `<span class="social-checkers-piece ${side} ${king ? "king" : ""}"></span>`;
  }

  function checkersPlayerCard(player, side, active) {
    const safe = player && typeof player === "object" ? player : {};
    return `
      <div class="social-checkers-player ${active ? "active" : ""}">
        <div class="social-checkers-room-badges">
          <span class="social-checkers-badge ${side}">${checkersEsc(checkersPlayerLabel(side))}</span>
          <span class="social-checkers-badge soft">${checkersEsc(safe.is_bot ? checkersTr("Компьютер", "Bot") : checkersTr("Игрок", "Player"))}</span>
        </div>
        <strong>${checkersEsc(safe.nick || "-")}</strong>
        <div class="social-checkers-player-meta">
          <span>${checkersEsc(checkersTr("Рейтинг", "Rating"))}: <b>${Number(safe.rating || 1200)}</b></span>
          <span>${checkersEsc(checkersTr("П / Пор / Н", "W / L / D"))}: <b>${Number(safe.wins || 0)} / ${Number(safe.losses || 0)} / ${Number(safe.draws || 0)}</b></span>
        </div>
      </div>
    `;
  }

  function checkersHistoryRows(room) {
    const history = Array.isArray(room?.history) ? room.history.slice().reverse() : [];
    if (!history.length) {
      return `<div class="social-checkers-empty">${checkersEsc(checkersTr("Ходы появятся здесь после начала партии.", "Moves will appear here after the game starts."))}</div>`;
    }
    return history.map((item) => {
      const moveLabel = Number(item.capture_count || 0) > 0 ? `x${Number(item.capture_count || 0)}` : checkersTr("ход", "move");
      return `
        <div class="social-checkers-history-row">
          <strong>${checkersEsc(checkersPlayerLabel(String(item.side || "white")))}</strong>
          <span>${checkersEsc(checkersPathText(item.path)) || "-"}</span>
          <small>${moveLabel}${item.promoted ? ` | ${checkersEsc(checkersTr("дамка", "king"))}` : ""}</small>
        </div>
      `;
    }).join("");
  }

  function socialCheckersOpenRoomPayload(roomPayload) {
    const room = roomPayload && typeof roomPayload === "object" ? roomPayload : {};
    socialCheckersState.currentRoom = room;
    if (!room.can_move) socialCheckersState.selectedKey = "";
    const players = room.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const selection = checkersSelection(room);
    const lastPath = Array.isArray(room?.last_move?.path) ? room.last_move.path : [];
    const trail = new Set(lastPath.map((pos) => checkersPosKey(pos)));
    const board = Array.isArray(room.board) ? room.board : [];
    const boardHtml = board.map((row, rowIndex) => {
      const safeRow = Array.isArray(row) ? row : [];
      return safeRow.map((piece, colIndex) => {
        const key = `${rowIndex}:${colIndex}`;
        const dark = ((rowIndex + colIndex) % 2) === 1;
        const selectable = room.can_move && selection.starts.has(key);
        const target = room.can_move && selection.targets.has(key);
        const selected = socialCheckersState.selectedKey === key;
        return `
          <button
            type="button"
            class="social-checkers-cell ${dark ? "dark" : "light"} ${selectable ? "selectable" : ""} ${target ? "target" : ""} ${selected ? "selected" : ""} ${trail.has(key) ? "trail" : ""}"
            onclick="socialCheckersHandleCell(${rowIndex}, ${colIndex})"
          >
            ${checkersPieceHtml(piece)}
          </button>
        `;
      }).join("");
    }).join("");
    const roomTitle = room.title || checkersTr("Шашки", "Checkers");
    const resultText = checkersResultText(room);
    const infoText = resultText || checkersRoomSummary(room);
    const myStatus = room.my_side
      ? (room.my_turn ? checkersTr("Ваш ход", "Your move") : checkersTr("Ход соперника", "Opponent move"))
      : (room.can_join ? checkersTr("Можно подключиться", "Can join") : checkersTr("Режим просмотра", "Spectator mode"));
    const html = `
      <div class="social-checkers-shell room-view">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-board-card">
            <div class="social-checkers-statusline">
              <div class="social-checkers-room-title-wrap">
                <div class="social-checkers-room-badges">${checkersRoomBadges(room, Boolean(room.my_side))}</div>
                <strong class="social-checkers-room-title">${checkersEsc(roomTitle)}</strong>
                <div class="social-checkers-room-meta">
                  <span>#${checkersEsc(room.room_code || "-")}</span>
                  <span>${checkersEsc(checkersTr("Создана", "Created"))}: <b>${checkersEsc(checkersFormatDate(room.created_at))}</b></span>
                  <span>${checkersEsc(checkersTr("Обновлено", "Updated"))}: <b>${checkersEsc(checkersFormatDate(room.updated_at))}</b></span>
                </div>
              </div>
              <div class="social-checkers-turn-pill ${checkersEsc(String(room.turn || "white"))}">${checkersEsc(checkersPlayerLabel(String(room.turn || "white")))} | ${checkersEsc(myStatus)}</div>
            </div>
            ${infoText ? `<div class="social-checkers-note ${resultText ? "strong" : ""}">${checkersEsc(infoText)}</div>` : ""}
            <div class="social-checkers-board-wrap">
              <div class="social-checkers-board">${boardHtml}</div>
            </div>
            <div class="social-checkers-board-footer">
              <span>${checkersEsc(checkersTr("Последний ход", "Last move"))}: <b>${checkersEsc(checkersPathText(room?.last_move?.path)) || "-"}</b></span>
              <span>${checkersEsc(checkersTr("Режим", "Mode"))}: <b>${checkersEsc(checkersRoomMode(room))}</b></span>
            </div>
          </section>
        </div>

        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel">
            <div class="social-checkers-section-head"><div><h5>${checkersEsc(checkersTr("Игроки", "Players"))}</h5></div></div>
            <div class="social-checkers-players">
              ${checkersPlayerCard(white, "white", String(room.turn || "white") === "white")}
              ${checkersPlayerCard(black, "black", String(room.turn || "white") === "black")}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head"><div><h5>${checkersEsc(checkersTr("Действия", "Actions"))}</h5></div></div>
            <div class="actions social-checkers-actions-stack">
              ${room.can_join ? `<button type="button" onclick="socialCheckersJoinRoom(${Number(room.id || 0)})">${checkersEsc(checkersTr("Подключиться", "Join room"))}</button>` : ""}
              <button class="btn-secondary" type="button" onclick="socialCheckersRefreshRoom()">${checkersEsc(checkersTr("Обновить позицию", "Refresh board"))}</button>
              <button class="btn-secondary" type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("К лобби", "Back to lobby"))}</button>
              ${(room.my_side && (room.status === "waiting" || room.status === "active")) ? `<button type="button" onclick="socialCheckersLeaveRoom()">${checkersEsc(room.status === "waiting" ? checkersTr("Закрыть комнату", "Close room") : checkersTr("Сдаться", "Resign"))}</button>` : ""}
              ${(room.status === "finished" || room.status === "cancelled") ? `<button type="button" onclick="socialCheckersQuickStart('medium')">${checkersEsc(checkersTr("Новая партия с ИИ", "New bot game"))}</button>` : ""}
            </div>
            <div class="hint">${checkersEsc(room.can_move ? checkersTr("Нажмите на свою шашку, затем на подсвеченную клетку назначения.", "Tap your piece, then the highlighted destination square.") : checkersTr("Если сейчас ход не ваш, позиция обновится автоматически.", "If it is not your turn, the board will refresh automatically."))}</div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head"><div><h5>${checkersEsc(checkersTr("История ходов", "Move history"))}</h5></div></div>
            <div class="social-checkers-history">${checkersHistoryRows(room)}</div>
          </section>
        </aside>
      </div>
    `;
    socialOpenModal(roomTitle, html);
    checkersArmModal();
    socialCheckersSchedulePoll(room);
  }
  function socialCheckersSchedulePoll(room) {
    if (socialCheckersState.pollTimer) {
      clearTimeout(socialCheckersState.pollTimer);
      socialCheckersState.pollTimer = null;
    }
    if (!room || typeof room !== "object") return;
    const isHuman = String(room.mode || "human") === "human";
    const shouldPollWaiting = String(room.status || "") === "waiting" && Boolean(room.my_side);
    const shouldPollTurn = String(room.status || "") === "active" && isHuman && !Boolean(room.can_move) && !String(room.winner || "") && String(room.result || "") !== "draw";
    if (!shouldPollWaiting && !shouldPollTurn) return;
    socialCheckersState.pollTimer = setTimeout(() => {
      socialCheckersRefreshRoom(true);
    }, shouldPollWaiting ? 2600 : 1800);
  }

  async function socialCheckersRefreshRoom(silent) {
    const roomId = Number(socialCheckersState.currentRoom?.id || 0);
    if (!roomId) {
      if (!silent) socialCheckersOpenMenu();
      return;
    }
    try {
      const room = await socialRequest(`/api/social/games/checkers/rooms/${roomId}`);
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      if (!silent) {
        checkersToast(checkersHumanError(error, checkersTr("Не удалось обновить комнату.", "Failed to refresh the room.")), "error");
      }
    }
  }

  async function socialCheckersSendMove(path) {
    if (socialCheckersState.pendingMove) return;
    const roomId = Number(socialCheckersState.currentRoom?.id || 0);
    if (!roomId) return;
    socialCheckersState.pendingMove = true;
    try {
      const room = await socialRequest(`/api/social/games/checkers/rooms/${roomId}/move`, {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      socialCheckersState.selectedKey = "";
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("Не удалось выполнить ход.", "Failed to make the move.")), "error");
    } finally {
      socialCheckersState.pendingMove = false;
    }
  }

  function socialCheckersHandleCell(row, col) {
    const room = socialCheckersState.currentRoom;
    if (!room || !room.can_move) return;
    const key = `${Number(row)}:${Number(col)}`;
    const moves = Array.isArray(room.legal_moves) ? room.legal_moves : [];
    const currentSelection = socialCheckersState.selectedKey;
    const fromHere = moves.filter((move) => checkersPosKey(move.from) === key);
    if (!currentSelection) {
      if (!fromHere.length) return;
      socialCheckersState.selectedKey = key;
      socialCheckersOpenRoomPayload(room);
      return;
    }
    if (currentSelection === key) {
      socialCheckersState.selectedKey = "";
      socialCheckersOpenRoomPayload(room);
      return;
    }
    const selectedMoves = moves.filter((move) => checkersPosKey(move.from) === currentSelection);
    const chosen = selectedMoves.find((move) => checkersPosKey(move.to) === key);
    if (chosen && Array.isArray(chosen.path)) {
      socialCheckersSendMove(chosen.path);
      return;
    }
    if (fromHere.length) {
      socialCheckersState.selectedKey = key;
      socialCheckersOpenRoomPayload(room);
    }
  }

  async function socialCheckersLeaveRoom() {
    const roomId = Number(socialCheckersState.currentRoom?.id || 0);
    if (!roomId) return;
    const room = socialCheckersState.currentRoom || {};
    const question = room.status === "waiting" ? checkersTr("Закрыть эту комнату?", "Close this room?") : checkersTr("Сдаться в партии?", "Resign from this game?");
    if (!window.confirm(question)) return;
    try {
      const nextRoom = await socialRequest(`/api/social/games/checkers/rooms/${roomId}/leave`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      socialCheckersOpenRoomPayload(nextRoom);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("Не удалось завершить комнату.", "Failed to finish the room.")), "error");
    }
  }

  window.socialCheckersOpenMenu = socialCheckersOpenMenu;
  window.socialCheckersShowLeaderboard = socialCheckersShowLeaderboard;
  window.socialCheckersShowTips = socialCheckersShowTips;
  window.socialCheckersQuickStart = socialCheckersQuickStart;
  window.socialCheckersCreateRoom = socialCheckersCreateRoom;
  window.socialCheckersJoinRoom = socialCheckersJoinRoom;
  window.socialCheckersOpenRoom = socialCheckersOpenRoom;
  window.socialCheckersRefreshRoom = socialCheckersRefreshRoom;
  window.socialCheckersHandleCell = socialCheckersHandleCell;
  window.socialCheckersLeaveRoom = socialCheckersLeaveRoom;
})();