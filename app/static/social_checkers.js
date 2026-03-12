(function () {
  const socialCheckersState = {
    overview: null,
    currentRoom: null,
    pollTimer: null,
    selectedKey: "",
    pendingMove: false,
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
    return Array.isArray(path) ? path.map(checkersCoord).filter(Boolean).join(" → ") : "";
  }

  function checkersPosKey(pos) {
    return Array.isArray(pos) && pos.length === 2 ? `${Number(pos[0])}:${Number(pos[1])}` : "";
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

  function checkersTopRows(rows, limit) {
    return Array.isArray(rows) ? rows.slice(0, limit) : [];
  }

  function checkersRoomStatus(status) {
    const safe = String(status || "").trim().toLowerCase();
    if (safe === "active") return checkersTr("Игра идет", "Active");
    if (safe === "finished") return checkersTr("Завершена", "Finished");
    if (safe === "cancelled") return checkersTr("Отменена", "Cancelled");
    return checkersTr("Ожидание", "Waiting");
  }

  function checkersResultText(room) {
    if (!room || typeof room !== "object") return "";
    const result = String(room.result || "").trim().toLowerCase();
    const winner = String(room.winner || "").trim().toLowerCase();
    if (result === "draw") return checkersTr("Ничья", "Draw");
    if (winner === "white") return checkersTr("Победа белых", "White wins");
    if (winner === "black") return checkersTr("Победа черных", "Black wins");
    if (result === "cancelled") return checkersTr("Комната закрыта", "Room cancelled");
    return "";
  }

  function checkersPlayerLabel(side) {
    return side === "white" ? checkersTr("Белые", "White") : checkersTr("Черные", "Black");
  }

  function checkersOpenMenuLoading() {
    socialOpenModal(
      checkersTr("Шашки", "Checkers"),
      `<div class="social-checkers-loading">${checkersEsc(checkersTr("Загружаю лобби шашек...", "Loading checkers lobby..."))}</div>`
    );
    checkersArmModal();
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
            <div class="hint">${checkersEsc(error?.message || checkersTr("Не удалось открыть шашки.", "Failed to open checkers."))}</div>
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

  function checkersRoomCard(room, mine) {
    if (!room || typeof room !== "object") return "";
    const players = room.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const canJoin = Boolean(room.can_join);
    const openLabel = mine ? checkersTr("Открыть", "Open") : (canJoin ? checkersTr("Подключиться", "Join") : checkersTr("Смотреть", "View"));
    const action = canJoin ? `socialCheckersJoinRoom(${Number(room.id || 0)})` : `socialCheckersOpenRoom(${Number(room.id || 0)})`;
    return `
      <div class="social-checkers-room-card">
        <div class="social-checkers-room-head">
          <div>
            <strong>${checkersEsc(room.title || `${checkersTr("Комната", "Room")} ${room.room_code || ""}`)}</strong>
            <div class="hint">#${checkersEsc(room.room_code || "-")} · ${checkersEsc(checkersRoomStatus(room.status))}</div>
          </div>
          <span class="social-checkers-badge ${checkersEsc(String(room.status || "waiting"))}">${checkersEsc(room.mode === "bot" ? checkersTr("С ботом", "Bot") : checkersRoomStatus(room.status))}</span>
        </div>
        <div class="social-checkers-room-meta">
          <span>${checkersEsc(checkersPlayerLabel("white"))}: <b>${checkersEsc(white.nick || "-")}</b></span>
          <span>${checkersEsc(checkersPlayerLabel("black"))}: <b>${checkersEsc(black.nick || "-")}</b></span>
          <span>${checkersEsc(checkersTr("Создана", "Created"))}: <b>${checkersEsc(checkersFormatDate(room.created_at))}</b></span>
        </div>
        ${room.note ? `<div class="social-checkers-note">${checkersEsc(room.note)}</div>` : ""}
        <div class="actions">
          <button type="button" onclick="${action}">${checkersEsc(openLabel)}</button>
        </div>
      </div>
    `;
  }

  function socialCheckersRenderMenu() {
    const data = socialCheckersState.overview || {};
    const profile = data.profile && typeof data.profile === "object" ? data.profile : {};
    const leaderboard = Array.isArray(data.leaderboard?.rows) ? data.leaderboard.rows : [];
    const rooms = data.rooms && typeof data.rooms === "object" ? data.rooms : {};
    const publicRooms = Array.isArray(rooms.public) ? rooms.public : [];
    const myRooms = Array.isArray(rooms.mine) ? rooms.mine : [];
    const difficulties = Array.isArray(data.difficulties) ? data.difficulties : [];
    const defaultTitle = profile.nick ? `${checkersTr("Комната", "Room")} ${profile.nick}` : checkersTr("Открытая комната", "Public room");
    const leaderboardRows = checkersTopRows(leaderboard, 8);
    const html = `
      <div class="social-checkers-shell">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-hero">
            <div>
              <span class="social-checkers-badge primary">${checkersEsc(checkersTr("Глобальный рейтинг", "Global ladder"))}</span>
              <h4>${checkersEsc(checkersTr("Шашки SEO WIBE", "SEO WIBE Checkers"))}</h4>
              <p>${checkersEsc(checkersTr("Играйте с компьютером, открывайте сетевые комнаты и растите рейтинг между всеми пользователями и сотрудниками.", "Play against the computer, create online rooms, and climb the shared ladder across all users and employees."))}</p>
            </div>
            <div class="social-checkers-stats">
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Рейтинг", "Rating"))}</span><strong>${Number(profile.rating || 1200)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Победы", "Wins"))}</span><strong>${Number(profile.wins || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Поражения", "Losses"))}</span><strong>${Number(profile.losses || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Ничьи", "Draws"))}</span><strong>${Number(profile.draws || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Партий", "Games"))}</span><strong>${Number(profile.play_count || 0)}</strong></div>
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <h5>${checkersEsc(checkersTr("Игра с компьютером", "Play vs computer"))}</h5>
                <p>${checkersEsc(checkersTr("Несколько уровней сложности и отдельный рейтинг против AI.", "Multiple difficulty levels with rating impact."))}</p>
              </div>
            </div>
            <div class="social-checkers-difficulty-grid">
              ${difficulties.map((difficulty) => `
                <button class="social-checkers-difficulty" type="button" onclick="socialCheckersQuickStart('${checkersEsc(String(difficulty.code || 'medium'))}')">
                  <strong>${checkersEsc(difficulty.title || '')}</strong>
                  <span>${checkersEsc(difficulty.subtitle || '')}</span>
                  <small>${checkersEsc(checkersTr("Рейтинг бота", "Bot rating"))}: ${Number(difficulty.bot_rating || 1200)}</small>
                </button>
              `).join("")}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <h5>${checkersEsc(checkersTr("Сетевая игра", "Online rooms"))}</h5>
                <p>${checkersEsc(checkersTr("Создайте виртуальную комнату, и другие пользователи увидят ее в списке и смогут подключиться.", "Create a virtual room so other users can see it in the lobby and join."))}</p>
              </div>
            </div>
            <div class="social-checkers-inline-form">
              <input id="socialCheckersRoomTitle" type="text" maxlength="120" value="${checkersEsc(defaultTitle)}" placeholder="${checkersEsc(checkersTr("Название комнаты", "Room title"))}" />
              <button type="button" onclick="socialCheckersCreateRoom()">${checkersEsc(checkersTr("Создать комнату", "Create room"))}</button>
            </div>
            <div class="actions">
              <button class="btn-secondary" type="button" onclick="socialCheckersShowLeaderboard()">${checkersEsc(checkersTr("Весь рейтинг", "Full leaderboard"))}</button>
              <button class="btn-secondary" type="button" onclick="socialCheckersShowTips()">${checkersEsc(checkersTr("Как играть", "How to play"))}</button>
              <button class="btn-secondary" type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("Обновить", "Refresh"))}</button>
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <h5>${checkersEsc(checkersTr("Открытые комнаты", "Open rooms"))}</h5>
                <p>${checkersEsc(checkersTr("Глобальное лобби для всех пользователей и сотрудников.", "Global lobby across all users and employees."))}</p>
              </div>
            </div>
            <div class="social-checkers-room-list">
              ${publicRooms.length ? publicRooms.map((room) => checkersRoomCard(room, false)).join("") : `<div class="social-checkers-empty">${checkersEsc(checkersTr("Пока нет открытых комнат. Создайте первую и пригласите коллег.", "No open rooms yet. Create the first one and invite colleagues."))}</div>`}
            </div>
          </section>
        </div>

        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <h5>${checkersEsc(checkersTr("Ваши партии", "Your games"))}</h5>
                <p>${checkersEsc(checkersTr("Быстрый доступ к активным и недавним матчам.", "Quick access to active and recent matches."))}</p>
              </div>
            </div>
            <div class="social-checkers-room-list compact">
              ${myRooms.length ? myRooms.map((room) => checkersRoomCard(room, true)).join("") : `<div class="social-checkers-empty">${checkersEsc(checkersTr("Активных партий пока нет.", "No active games yet."))}</div>`}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <h5>${checkersEsc(checkersTr("Топ игроков", "Top players"))}</h5>
                <p>${checkersEsc(checkersTr("Общий рейтинг по победам, поражениям и очкам Elo.", "Shared Elo ladder with wins and losses."))}</p>
              </div>
            </div>
            <div class="table-card social-checkers-mini-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${checkersEsc(checkersTr("Игрок", "Player"))}</th>
                    <th>${checkersEsc(checkersTr("Рейт.", "Rt."))}</th>
                    <th>${checkersEsc(checkersTr("В", "W"))}</th>
                    <th>${checkersEsc(checkersTr("П", "L"))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${leaderboardRows.length ? leaderboardRows.map((row) => `
                    <tr class="${row.is_me ? "social-me-row" : ""}">
                      <td>${Number(row.rank || 0)}</td>
                      <td>${checkersEsc(row.nick || "-")}</td>
                      <td>${Number(row.rating || 1200)}</td>
                      <td>${Number(row.wins || 0)}</td>
                      <td>${Number(row.losses || 0)}</td>
                    </tr>
                  `).join("") : `<tr><td colspan="5">${checkersEsc(checkersTr("Пока нет сыгранных партий", "No games yet"))}</td></tr>`}
                </tbody>
              </table>
            </div>
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
          <div class="table-card">
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
          <div class="hint">${checkersEsc(checkersTr("Ваше место", "Your rank"))}: <b>${data?.my_rank ? `#${Number(data.my_rank)}` : "—"}</b> · ${checkersEsc(checkersTr("Ваш рейтинг", "Your rating"))}: <b>${Number(data?.my_rating || 1200)}</b></div>
          <div class="actions">
            <button type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("Назад", "Back"))}</button>
          </div>
        </div>
      `;
      socialOpenModal(checkersTr("Рейтинг игроков", "Leaderboard"), html);
      checkersArmModal();
    } catch (error) {
      alert(error?.message || checkersTr("Не удалось загрузить рейтинг", "Failed to load leaderboard"));
    }
  }

  function socialCheckersShowTips() {
    const html = `
      <div class="social-checkers-panel">
        <div class="hint">
          <b>${checkersEsc(checkersTr("Правила", "Rules"))}</b><br />
          ${checkersEsc(checkersTr("1. Белые ходят первыми. Обычная шашка идет по диагонали вперед на одну клетку.", "1. White moves first. Men move diagonally forward by one square."))}<br />
          ${checkersEsc(checkersTr("2. Рубка обязательна. Если есть взятие, доступны только атакующие ходы.", "2. Captures are mandatory. If a capture exists, only attacking moves are legal."))}<br />
          ${checkersEsc(checkersTr("3. Множественное взятие выполняется одним ходом: выберите шашку и конечную клетку цепочки.", "3. Multi-capture is executed in one turn: pick the piece and the final landing square."))}<br />
          ${checkersEsc(checkersTr("4. Дойдя до последней горизонтали, шашка становится дамкой и получает букву K на фишке.", "4. Reaching the last rank promotes the piece and adds a K marker."))}<br />
          ${checkersEsc(checkersTr("5. Побеждает игрок, который съел все шашки соперника или лишил его ходов.", "5. You win by taking all enemy pieces or leaving the opponent with no legal moves."))}
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
      alert(error?.message || checkersTr("Не удалось начать партию", "Failed to start game"));
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
      alert(error?.message || checkersTr("Не удалось создать комнату", "Failed to create room"));
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
      alert(error?.message || checkersTr("Не удалось подключиться к комнате", "Failed to join room"));
    }
  }

  async function socialCheckersOpenRoom(roomId) {
    try {
      const room = await socialRequest(`/api/social/games/checkers/rooms/${Number(roomId || 0)}`);
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      alert(error?.message || checkersTr("Не удалось открыть комнату", "Failed to open room"));
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
        <div class="social-checkers-player-head">
          <span class="social-checkers-badge ${side}">${checkersEsc(checkersPlayerLabel(side))}</span>
          <span class="hint">${safe.is_bot ? checkersEsc(checkersTr("Бот", "Bot")) : checkersEsc(checkersTr("Игрок", "Player"))}</span>
        </div>
        <strong>${checkersEsc(safe.nick || "-")}</strong>
        <div class="social-checkers-player-meta">
          <span>${checkersEsc(checkersTr("Рейтинг", "Rating"))}: <b>${Number(safe.rating || 1200)}</b></span>
          <span>${checkersEsc(checkersTr("В / П / Н", "W / L / D"))}: <b>${Number(safe.wins || 0)} / ${Number(safe.losses || 0)} / ${Number(safe.draws || 0)}</b></span>
        </div>
      </div>
    `;
  }

  function checkersHistoryRows(room) {
    const history = Array.isArray(room?.history) ? room.history.slice().reverse() : [];
    if (!history.length) {
      return `<div class="social-checkers-empty">${checkersEsc(checkersTr("Ходы появятся здесь после старта партии.", "Moves will appear here after the game starts."))}</div>`;
    }
    return history.map((item) => `
      <div class="social-checkers-history-row">
        <strong>${checkersEsc(checkersPlayerLabel(String(item.side || "white")))}</strong>
        <span>${checkersEsc(checkersPathText(item.path))}</span>
        <small>${Number(item.capture_count || 0) > 0 ? `x${Number(item.capture_count || 0)}` : checkersEsc(checkersTr("ход", "move"))}${item.promoted ? ` · ${checkersEsc(checkersTr("дамка", "king"))}` : ""}</small>
      </div>
    `).join("");
  }

  function socialCheckersOpenRoomPayload(roomPayload) {
    const room = roomPayload && typeof roomPayload === "object" ? roomPayload : {};
    socialCheckersState.currentRoom = room;
    if (!room.can_move) {
      socialCheckersState.selectedKey = "";
    }
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
    const myStatus = room.my_side
      ? (room.my_turn ? checkersTr("Ваш ход", "Your move") : checkersTr("Ход соперника", "Opponent move"))
      : (room.can_join ? checkersTr("Можно подключиться к комнате", "You can join this room") : checkersTr("Комната доступна только участникам", "This room is only available to participants"));
    const html = `
      <div class="social-checkers-shell room-view">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-board-card">
            <div class="social-checkers-statusline">
              <div>
                <div class="social-checkers-room-head compact">
                  <strong>${checkersEsc(roomTitle)}</strong>
                  <span class="social-checkers-badge ${checkersEsc(String(room.status || "waiting"))}">${checkersEsc(checkersRoomStatus(room.status))}</span>
                </div>
                <div class="hint">#${checkersEsc(room.room_code || "-")} · ${checkersEsc(room.mode === "bot" ? checkersTr("Матч с компьютером", "Bot match") : checkersTr("Сетевая партия", "Online match"))}${room.difficulty ? ` · ${checkersEsc(room.difficulty)}` : ""}</div>
              </div>
              <div class="social-checkers-turn-pill ${checkersEsc(String(room.turn || "white"))}">${checkersEsc(checkersPlayerLabel(String(room.turn || "white")))} · ${checkersEsc(myStatus)}</div>
            </div>
            ${resultText ? `<div class="social-checkers-note strong">${checkersEsc(resultText)}</div>` : room.note ? `<div class="social-checkers-note">${checkersEsc(room.note)}</div>` : ""}
            <div class="social-checkers-board-wrap">
              <div class="social-checkers-board">${boardHtml}</div>
            </div>
            <div class="social-checkers-board-footer">
              <span>${checkersEsc(checkersTr("Последний ход", "Last move"))}: <b>${checkersEsc(checkersPathText(room?.last_move?.path)) || "-"}</b></span>
              <span>${checkersEsc(checkersTr("Обновлено", "Updated"))}: <b>${checkersEsc(checkersFormatDate(room.updated_at))}</b></span>
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
              <button class="btn-secondary" type="button" onclick="socialCheckersRefreshRoom()">${checkersEsc(checkersTr("Обновить позицию", "Refresh position"))}</button>
              <button class="btn-secondary" type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("К лобби", "Back to lobby"))}</button>
              ${(room.my_side && (room.status === "waiting" || room.status === "active")) ? `<button type="button" onclick="socialCheckersLeaveRoom()">${checkersEsc(room.status === "waiting" ? checkersTr("Закрыть комнату", "Close room") : checkersTr("Сдаться", "Resign"))}</button>` : ""}
              ${(room.status === "finished" || room.status === "cancelled") ? `<button type="button" onclick="socialCheckersQuickStart('medium')">${checkersEsc(checkersTr("Новая партия с ИИ", "New bot game"))}</button>` : ""}
            </div>
            <div class="hint">${checkersEsc(room.can_move ? checkersTr("Коснитесь своей шашки, затем выделенной клетки назначения.", "Tap your piece, then the highlighted target square.") : checkersTr("Если сейчас ход не ваш, позиция обновится автоматически.", "If it is not your turn, the position will refresh automatically."))}</div>
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
      if (!silent) alert(error?.message || checkersTr("Не удалось обновить комнату", "Failed to refresh room"));
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
      alert(error?.message || checkersTr("Не удалось выполнить ход", "Failed to make move"));
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
    const question = room.status === "waiting"
      ? checkersTr("Закрыть эту комнату?", "Close this room?")
      : checkersTr("Сдаться в партии?", "Resign from this game?");
    if (!window.confirm(question)) return;
    try {
      const nextRoom = await socialRequest(`/api/social/games/checkers/rooms/${roomId}/leave`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      socialCheckersOpenRoomPayload(nextRoom);
    } catch (error) {
      alert(error?.message || checkersTr("Не удалось завершить комнату", "Failed to finish room"));
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
