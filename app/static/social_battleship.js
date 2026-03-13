(function () {
  const state = { overview: null, room: null, pollTimer: null, pendingShot: false };
  const diffFallback = {
    easy: { code: "easy", title: "Легкий" },
    medium: { code: "medium", title: "Средний" },
    hard: { code: "hard", title: "Сложный" },
    expert: { code: "expert", title: "Эксперт" },
  };

  function t(ru, en) { return typeof tr === "function" ? tr(ru, en) : ru; }
  function esc(v) {
    if (typeof escapeHtml === "function") return escapeHtml(v == null ? "" : String(v));
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, kind = "info") {
    const title = kind === "error" ? t("Морской бой: ошибка", "Battleship: error") : t("Морской бой", "Battleship");
    if (typeof socialShowToast === "function") { socialShowToast(title, msg); return; }
    if (kind === "error") alert(msg);
  }
  function humanError(error, fallback) {
    let m = String(error?.message || fallback || "").trim();
    m = m.replace(/^unexpected status\s+\d+\s+[A-Za-z ]+:\s*/i, "").trim();
    if (!m) return fallback;
    if (/(?:<html|gateway time-?out|bad gateway|internal server error|traceback)/i.test(m)) return fallback;
    return m;
  }
  function dt(v) {
    const raw = String(v || "").trim();
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString(document?.documentElement?.lang === "en" ? "en-US" : "ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function diffTitle(code) {
    const safe = String(code || "medium").trim().toLowerCase() || "medium";
    const found = Array.isArray(state.overview?.difficulties) ? state.overview.difficulties.find((d) => String(d?.code || "").trim().toLowerCase() === safe) : null;
    return String(found?.title || diffFallback[safe]?.title || diffFallback.medium.title);
  }
  function statusLabel(status) {
    const s = String(status || "").trim().toLowerCase();
    if (s === "active") return t("Игра идет", "Active");
    if (s === "finished") return t("Завершена", "Finished");
    if (s === "cancelled") return t("Закрыта", "Cancelled");
    return t("Ожидание", "Waiting");
  }
  function modeLabel(room) { return String(room?.mode || "human") === "bot" ? t("С ботом", "Bot") : t("Онлайн", "Online"); }
  function resultText(room) {
    const result = String(room?.result || "").trim().toLowerCase();
    const winner = String(room?.winner || "").trim().toLowerCase();
    if (result === "draw") return t("Матч завершился ничьей.", "The match ended in a draw.");
    if (winner === "white") return t("Белый флот победил.", "White fleet wins.");
    if (winner === "black") return t("Черный флот победил.", "Black fleet wins.");
    return "";
  }

  function stop() {
    if (state.pollTimer) { clearTimeout(state.pollTimer); state.pollTimer = null; }
    state.pendingShot = false;
    const card = document.querySelector("#socialModal .social-modal-card");
    if (card) card.classList.remove("social-checkers-modal");
    if (typeof socialState === "object" && socialState) socialState.activeGameRunner = null;
  }
  function arm() {
    stop();
    const card = document.querySelector("#socialModal .social-modal-card");
    if (card) card.classList.add("social-checkers-modal");
    if (typeof socialState === "object" && socialState) {
      socialState.currentGameCode = "battleship";
      socialState.activeGameRunner = { kind: "battleship", stop };
    }
  }

  function roomSummary(room) {
    const r = resultText(room);
    if (r) return r;
    const s = String(room?.status || "waiting").trim().toLowerCase();
    if (s === "waiting") return room?.can_join ? t("Комната ждет второго игрока.", "Room waits for second player.") : t("Ожидание соперника.", "Waiting for opponent.");
    if (s === "active") return room?.my_turn ? t("Ваш залп. Выберите клетку на поле противника.", "Your shot. Choose a cell on enemy board.") : t("Ход соперника. Поле обновляется автоматически.", "Opponent move. Board refreshes automatically.");
    return t("Матч сохранен в истории.", "Match is saved in history.");
  }

  function roomCard(room, mine) {
    const players = room?.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const id = Number(room?.id || 0);
    const action = room?.can_join ? `socialBattleshipJoinRoom(${id})` : `socialBattleshipOpenRoom(${id})`;
    const openLabel = mine ? t("Открыть", "Open") : (room?.can_join ? t("Подключиться", "Join") : t("Смотреть", "View"));
    return `
      <article class="social-checkers-room-card ${mine ? "mine" : ""}">
        <div class="social-checkers-room-top">
          <div class="social-checkers-room-title-wrap">
            <div class="social-checkers-room-badges">
              <span class="social-checkers-badge ${esc(String(room?.status || "waiting"))}">${esc(statusLabel(room?.status))}</span>
              <span class="social-checkers-badge ${String(room?.mode || "human") === "bot" ? "bot" : "human"}">${esc(modeLabel(room))}</span>
              ${String(room?.mode || "human") === "bot" ? `<span class="social-checkers-badge soft">${esc(diffTitle(room?.difficulty))}</span>` : ""}
            </div>
            <strong class="social-checkers-room-title">${esc(room?.title || `#${room?.room_code || "-"}`)}</strong>
            <div class="social-checkers-room-code">#${esc(room?.room_code || "-")} | ${esc(t("Создана", "Created"))}: ${esc(dt(room?.created_at))}</div>
          </div>
          <div class="social-checkers-room-actions actions"><button type="button" onclick="${action}">${esc(openLabel)}</button></div>
        </div>
        <div class="social-checkers-room-meta">
          <span>${esc(t("Белый", "White"))}: <b>${esc(white.nick || "-")}</b></span>
          <span>${esc(t("Черный", "Black"))}: <b>${esc(black.nick || "-")}</b></span>
          <span>${esc(t("Обновлено", "Updated"))}: <b>${esc(dt(room?.updated_at || room?.last_move_at || room?.created_at))}</b></span>
        </div>
        <div class="social-checkers-room-note">${esc(roomSummary(room))}</div>
      </article>
    `;
  }

  function leaderboardPreview(rows) {
    const list = Array.isArray(rows) ? rows.slice(0, 8) : [];
    if (!list.length) return `<div class="social-checkers-empty">${esc(t("Рейтинг пока пуст.", "Leaderboard is empty."))}</div>`;
    return `<div class="social-checkers-rank-list">${list.map((row)=>`<div class="social-checkers-rank-row ${row.is_me ? "social-me-row" : ""}"><div class="social-checkers-rank-main"><span class="social-checkers-rank-pill">#${Number(row.rank || 0)}</span><div class="social-checkers-rank-meta"><strong>${esc(row.nick || "-")}</strong><small>${esc(t("Рейтинг", "Rating"))}: ${Number(row.rating || 1200)} | ${esc(t("Партий", "Games"))}: ${Number(row.play_count || 0)}</small></div></div><div class="social-checkers-rank-stats"><span>${esc(t("П", "W"))}: <b>${Number(row.wins || 0)}</b></span><span>${esc(t("Пор", "L"))}: <b>${Number(row.losses || 0)}</b></span></div></div>`).join("")}</div>`;
  }

  async function socialBattleshipOpenMenu() {
    socialOpenModal(t("Морской бой", "Battleship"), `<div class="social-checkers-loading">${esc(t("Загружаю лобби морского боя...", "Loading battleship lobby..."))}</div>`);
    arm();
    try {
      state.overview = await socialRequest("/api/social/games/battleship/overview");
      state.room = null;
      renderMenu();
    } catch (e) {
      socialOpenModal(t("Морской бой", "Battleship"), `<div class="social-checkers-panel"><div class="hint">${esc(humanError(e, t("Не удалось открыть морской бой.", "Failed to open battleship.")))}</div><div class="actions"><button type="button" onclick="socialBattleshipOpenMenu()">${esc(t("Повторить", "Retry"))}</button><button class="btn-secondary" type="button" onclick="socialCloseModal()">${esc(t("Закрыть", "Close"))}</button></div></div>`);
      arm();
    }
  }

  function renderMenu() {
    const data = state.overview || {};
    const profile = data.profile || {};
    const leaderboard = Array.isArray(data?.leaderboard?.rows) ? data.leaderboard.rows : [];
    const rooms = data.rooms || {};
    const publicRooms = Array.isArray(rooms.public) ? rooms.public : [];
    const myRooms = Array.isArray(rooms.mine) ? rooms.mine : [];
    const difficulties = Array.isArray(data.difficulties) && data.difficulties.length ? data.difficulties : Object.values(diffFallback);
    const defaultTitle = profile.nick ? `${t("Комната", "Room")} ${profile.nick}` : t("Открытая комната", "Public room");
    socialOpenModal(t("Морской бой", "Battleship"), `
      <div class="social-checkers-shell lobby-view">
        <section class="social-checkers-main">
          <article class="social-checkers-panel social-checkers-hero"><div class="social-checkers-hero-main"><div class="social-checkers-hero-copy"><span class="social-checkers-section-kicker">${esc(t("Глобальный рейтинг", "Global ladder"))}</span><h4>${esc(t("Морской бой SEO WIBE", "SEO WIBE Battleship"))}</h4><p>${esc(t("Сетевые комнаты, ИИ-уровни и общий рейтинг побед/поражений.", "Network rooms, AI levels and global W/L rating."))}</p></div><div class="social-checkers-stats"><div class="social-checkers-stat"><span>${esc(t("Рейтинг", "Rating"))}</span><strong>${Number(profile.rating || 1200)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Победы", "Wins"))}</span><strong>${Number(profile.wins || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Поражения", "Losses"))}</span><strong>${Number(profile.losses || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Ничьи", "Draws"))}</span><strong>${Number(profile.draws || 0)}</strong></div></div></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Быстрый старт", "Quick start"))}</h5></div></div><div class="social-checkers-create-grid"><label class="social-checkers-input-card"><span>${esc(t("Название комнаты", "Room title"))}</span><input id="socialBattleshipRoomTitle" type="text" maxlength="120" value="${esc(defaultTitle)}" /></label><label class="social-checkers-input-card"><span>${esc(t("Сложность ИИ", "Bot difficulty"))}</span><select id="socialBattleshipDifficulty">${difficulties.map((d)=>`<option value="${esc(d.code)}">${esc(d.title || d.code)}</option>`).join("")}</select></label></div><div class="actions social-checkers-create-actions"><button type="button" onclick="socialBattleshipCreateRoom('bot')">${esc(t("Играть с ИИ", "Play vs AI"))}</button><button type="button" onclick="socialBattleshipCreateRoom('human')">${esc(t("Создать онлайн-комнату", "Create online room"))}</button><button class="btn-secondary" type="button" onclick="socialBattleshipShowLeaderboard()">${esc(t("Полный рейтинг", "Full leaderboard"))}</button></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Мои комнаты", "My rooms"))}</h5></div></div><div class="social-checkers-room-list">${myRooms.length ? myRooms.map((r)=>roomCard(r,true)).join("") : `<div class="social-checkers-empty">${esc(t("У вас пока нет активных комнат.", "You have no active rooms."))}</div>`}</div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Открытые комнаты", "Public rooms"))}</h5></div></div><div class="social-checkers-room-list">${publicRooms.length ? publicRooms.map((r)=>roomCard(r,false)).join("") : `<div class="social-checkers-empty">${esc(t("Сейчас нет открытых комнат.", "No public rooms."))}</div>`}</div></article>
        </section>
        <aside class="social-checkers-sidebar"><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Топ игроков", "Top players"))}</h5></div></div>${leaderboardPreview(leaderboard)}</section><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Подсказки", "Tips"))}</h5></div></div><div class="hint">${esc(t("Корабли расставляются автоматически, вам остается только стрелять по полю соперника.", "Ships are placed automatically, you only need to shoot enemy cells."))}</div><div class="actions social-checkers-actions-stack"><button class="btn-secondary" type="button" onclick="socialBattleshipShowTips()">${esc(t("Как играть", "How to play"))}</button></div></section></aside>
      </div>
    `);
    arm();
  }

  async function socialBattleshipCreateRoom(mode) {
    const safeMode = String(mode || "human").trim().toLowerCase() === "bot" ? "bot" : "human";
    const title = String(document.getElementById("socialBattleshipRoomTitle")?.value || "").trim();
    const difficulty = String(document.getElementById("socialBattleshipDifficulty")?.value || "medium").trim().toLowerCase() || "medium";
    try {
      openRoomPayload(await socialRequest("/api/social/games/battleship/rooms", { method: "POST", body: JSON.stringify({ mode: safeMode, title, difficulty, is_public: safeMode === "human" }) }));
      state.overview = null;
    } catch (e) {
      toast(humanError(e, t("Не удалось создать комнату.", "Failed to create room.")), "error");
    }
  }

  async function socialBattleshipJoinRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/battleship/rooms/${id}/join`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Не удалось подключиться к комнате.", "Failed to join room.")), "error"); }
  }

  async function socialBattleshipOpenRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/battleship/rooms/${id}`)); }
    catch (e) { toast(humanError(e, t("Не удалось открыть комнату.", "Failed to open room.")), "error"); }
  }

  function cellClass(boardType, value) {
    if (boardType === "own") {
      if (value === "S") return "ship";
      if (value === "H") return "hit";
      if (value === "M") return "miss";
      return "water";
    }
    if (value === "H") return "hit";
    if (value === "M") return "miss";
    return "fog";
  }

  function renderBoard(board, boardType, canShoot) {
    const grid = Array.isArray(board) ? board : [];
    const size = 10;
    return `<div class="social-battle-board-grid">${Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => {
      const row = Array.isArray(grid[r]) ? grid[r] : [];
      const val = String(row[c] || "");
      const cls = cellClass(boardType, val);
      const isShot = val === "H" || val === "M";
      const clickable = boardType === "enemy" && canShoot && !isShot;
      const mark = val === "H" ? "✹" : (val === "M" ? "•" : (boardType === "own" && val === "S" ? "■" : ""));
      const onClick = clickable ? ` onclick="socialBattleshipShoot(${r}, ${c})"` : "";
      return `<button type="button" class="social-battle-cell ${cls} ${clickable ? "target" : ""}"${onClick} ${clickable ? "" : "disabled"}>${esc(mark)}</button>`;
    }).join("")).join("")}</div>`;
  }

  function historyRows(room) {
    const rows = Array.isArray(room?.history) ? room.history.slice().reverse().slice(0, 24) : [];
    if (!rows.length) return `<div class="social-checkers-empty">${esc(t("История пока пустая.", "No turns yet."))}</div>`;
    return rows.map((m, idx) => {
      const side = String(m?.side || "") === "white" ? t("Белый", "White") : t("Черный", "Black");
      const target = Array.isArray(m?.target) ? `${String.fromCharCode(65 + Number(m.target[1] || 0))}${Number(m.target[0] || 0) + 1}` : "-";
      const verdict = m?.hit ? (m?.sunk ? t("Попадание и потоплен", "Hit and sunk") : t("Попадание", "Hit")) : t("Промах", "Miss");
      return `<div class="social-checkers-history-row"><strong>${Number(rows.length - idx)}</strong><div><span>${esc(side)}: <b>${esc(target)}</b> · ${esc(verdict)}</span><small>${esc(dt(m?.at || ""))}</small></div></div>`;
    }).join("");
  }

  function openRoomPayload(room) {
    if (!room || typeof room !== "object") { toast(t("Комната недоступна.", "Room unavailable."), "error"); return; }
    state.room = room;
    const players = room.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const title = String(room.title || `${t("Комната", "Room")} ${room.room_code || ""}`).trim();
    const note = resultText(room) || String(room.note || "").trim();
    const myStatus = room.my_side ? (String(room.my_side) === "white" ? t("Белый", "White") : t("Черный", "Black")) : t("Наблюдатель", "Viewer");
    const ownBoard = renderBoard(room.own_board, "own", false);
    const enemyBoard = renderBoard(room.enemy_board, "enemy", Boolean(room.can_move));
    socialOpenModal(title, `
      <div class="social-checkers-shell">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-board-card">
            <div class="social-checkers-room-head compact"><div class="social-checkers-room-title-wrap"><div class="social-checkers-room-badges"><span class="social-checkers-badge ${esc(String(room.status || "waiting"))}">${esc(statusLabel(room.status))}</span><span class="social-checkers-badge ${String(room.mode || "human") === "bot" ? "bot" : "human"}">${esc(modeLabel(room))}</span>${String(room.mode || "human") === "bot" ? `<span class="social-checkers-badge soft">${esc(diffTitle(room.difficulty))}</span>` : ""}</div><strong class="social-checkers-room-title">${esc(title)}</strong><div class="social-checkers-room-meta"><span>#${esc(room.room_code || "-")}</span><span>${esc(t("Создана", "Created"))}: <b>${esc(dt(room.created_at))}</b></span><span>${esc(t("Обновлено", "Updated"))}: <b>${esc(dt(room.updated_at))}</b></span></div></div><div class="social-checkers-turn-pill ${esc(String(room.turn || "white"))}">${esc(String(room.turn || "white") === "white" ? t("Белый", "White") : t("Черный", "Black"))} | ${esc(myStatus)}</div></div>
            ${note ? `<div class="social-checkers-note ${resultText(room) ? "strong" : ""}">${esc(note)}</div>` : ""}
            <div class="social-battle-boards"><div class="social-battle-board"><h6>${esc(t("Ваш флот", "Your fleet"))}</h6>${ownBoard}</div><div class="social-battle-board"><h6>${esc(t("Поле соперника", "Enemy field"))}</h6>${enemyBoard}</div></div>
            <div class="social-checkers-board-footer"><span>${esc(t("Последний выстрел", "Last shot"))}: <b>${Array.isArray(room?.last_move?.target) ? `${String.fromCharCode(65 + Number(room.last_move.target[1] || 0))}${Number(room.last_move.target[0] || 0) + 1}` : "-"}</b></span><span>${esc(t("Режим", "Mode"))}: <b>${esc(modeLabel(room))}</b></span></div>
          </section>
        </div>
        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Игроки", "Players"))}</h5></div></div><div class="social-checkers-players"><article class="social-checkers-player ${String(room.turn || "white") === "white" ? "active" : ""}"><div class="social-checkers-room-badges"><span class="social-checkers-badge white">${esc(t("Белый", "White"))}</span>${white.is_bot ? `<span class="social-checkers-badge bot">${esc(t("ИИ", "AI"))}</span>` : ""}</div><strong>${esc(white.nick || "-")}</strong><div class="social-checkers-player-meta"><span>${esc(t("Рейтинг", "Rating"))}: <b>${Number(white.rating || 1200)}</b></span></div></article><article class="social-checkers-player ${String(room.turn || "white") === "black" ? "active" : ""}"><div class="social-checkers-room-badges"><span class="social-checkers-badge black">${esc(t("Черный", "Black"))}</span>${black.is_bot ? `<span class="social-checkers-badge bot">${esc(t("ИИ", "AI"))}</span>` : ""}</div><strong>${esc(black.nick || "-")}</strong><div class="social-checkers-player-meta"><span>${esc(t("Рейтинг", "Rating"))}: <b>${Number(black.rating || 1200)}</b></span></div></article></div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Действия", "Actions"))}</h5></div></div><div class="actions social-checkers-actions-stack">${room.can_join ? `<button type="button" onclick="socialBattleshipJoinRoom(${Number(room.id || 0)})">${esc(t("Подключиться", "Join room"))}</button>` : ""}<button class="btn-secondary" type="button" onclick="socialBattleshipRefreshRoom()">${esc(t("Обновить", "Refresh"))}</button><button class="btn-secondary" type="button" onclick="socialBattleshipOpenMenu()">${esc(t("К лобби", "Back to lobby"))}</button>${(room.my_side && (room.status === "waiting" || room.status === "active")) ? `<button type="button" onclick="socialBattleshipLeaveRoom()">${esc(room.status === "waiting" ? t("Закрыть комнату", "Close room") : t("Сдаться", "Resign"))}</button>` : ""}</div><div class="hint">${esc(room.can_move ? t("Выбирайте клетку на поле соперника для выстрела.", "Pick enemy cell to shoot.") : t("Если сейчас не ваш ход, позиция обновится автоматически.", "If not your turn, board refreshes automatically."))}</div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("История ходов", "Turn history"))}</h5></div></div><div class="social-checkers-history">${historyRows(room)}</div></section>
        </aside>
      </div>
    `);
    arm();
    schedulePoll(room);
  }

  function schedulePoll(room) {
    if (state.pollTimer) { clearTimeout(state.pollTimer); state.pollTimer = null; }
    if (!room || typeof room !== "object") return;
    const human = String(room.mode || "human") === "human";
    const waitPoll = String(room.status || "") === "waiting" && Boolean(room.my_side);
    const turnPoll = String(room.status || "") === "active" && human && !Boolean(room.can_move) && !String(room.winner || "") && String(room.result || "") !== "draw";
    if (!waitPoll && !turnPoll) return;
    state.pollTimer = setTimeout(() => socialBattleshipRefreshRoom(true), waitPoll ? 2600 : 1800);
  }

  async function socialBattleshipRefreshRoom(silent) {
    const id = Number(state.room?.id || 0);
    if (!id) { if (!silent) socialBattleshipOpenMenu(); return; }
    try { openRoomPayload(await socialRequest(`/api/social/games/battleship/rooms/${id}`)); }
    catch (e) { if (!silent) toast(humanError(e, t("Не удалось обновить комнату.", "Failed to refresh room.")), "error"); }
  }

  async function socialBattleshipShoot(row, col) {
    if (state.pendingShot) return;
    const id = Number(state.room?.id || 0);
    if (!id) return;
    state.pendingShot = true;
    try {
      const room = await socialRequest(`/api/social/games/battleship/rooms/${id}/move`, { method: "POST", body: JSON.stringify({ row: Number(row), col: Number(col) }) });
      openRoomPayload(room);
    } catch (e) {
      toast(humanError(e, t("Не удалось выполнить выстрел.", "Failed to shoot.")), "error");
    } finally {
      state.pendingShot = false;
    }
  }

  async function socialBattleshipLeaveRoom() {
    const id = Number(state.room?.id || 0);
    if (!id) return;
    const room = state.room || {};
    const ask = room.status === "waiting" ? t("Закрыть эту комнату?", "Close this room?") : t("Сдаться в матче?", "Resign from this match?");
    if (!window.confirm(ask)) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/battleship/rooms/${id}/leave`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Не удалось завершить комнату.", "Failed to finish room.")), "error"); }
  }

  function socialBattleshipShowTips() {
    socialOpenModal(t("Морской бой: как играть", "Battleship: how to play"), `<div class="social-checkers-panel"><div class="hint">${esc(t("1) Флот расставляется автоматически при создании комнаты.", "1) Fleet is auto-placed on room creation."))}</div><div class="hint">${esc(t("2) Стреляйте по полю соперника. Попадание отмечается ✹, промах — •.", "2) Shoot enemy field. Hit is ✹, miss is •."))}</div><div class="hint">${esc(t("3) При попадании ход продолжается, при промахе ход переходит сопернику.", "3) Hit keeps turn, miss passes turn."))}</div><div class="actions"><button type="button" onclick="socialBattleshipOpenMenu()">${esc(t("Назад", "Back"))}</button></div></div>`);
    arm();
  }

  async function socialBattleshipShowLeaderboard() {
    try {
      const data = await socialRequest("/api/social/games/battleship/leaderboard?limit=100");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      socialOpenModal(t("Рейтинг морского боя", "Battleship leaderboard"), `<div class="social-checkers-scroll-table"><table><thead><tr><th>#</th><th>${esc(t("Игрок", "Player"))}</th><th>${esc(t("Рейтинг", "Rating"))}</th><th>${esc(t("Победы", "Wins"))}</th><th>${esc(t("Поражения", "Losses"))}</th><th>${esc(t("Ничьи", "Draws"))}</th></tr></thead><tbody>${rows.length ? rows.map((r)=>`<tr class="${r.is_me ? "social-me-row" : ""}"><td>${Number(r.rank || 0)}</td><td>${esc(r.nick || "-")}</td><td>${Number(r.rating || 1200)}</td><td>${Number(r.wins || 0)}</td><td>${Number(r.losses || 0)}</td><td>${Number(r.draws || 0)}</td></tr>`).join("") : `<tr><td colspan="6">${esc(t("Пока нет результатов", "No results yet"))}</td></tr>`}</tbody></table></div><div class="hint">${esc(t("Ваше место", "Your rank"))}: <b>${data?.my_rank ? `#${Number(data.my_rank)}` : "—"}</b> | ${esc(t("Ваш рейтинг", "Your rating"))}: <b>${Number(data?.my_rating || 1200)}</b></div><div class="actions"><button type="button" onclick="socialBattleshipOpenMenu()">${esc(t("Назад", "Back"))}</button></div>`);
      arm();
    } catch (e) {
      toast(humanError(e, t("Не удалось загрузить рейтинг.", "Failed to load leaderboard.")), "error");
    }
  }

  function socialBattleshipQuickStart(level = "medium") {
    const difficulty = String(level || "medium").trim().toLowerCase() || "medium";
    socialOpenModal(t("Морской бой", "Battleship"), `<div class="social-checkers-loading">${esc(t("Создаю матч с ИИ...", "Creating AI match..."))}</div>`);
    arm();
    socialRequest("/api/social/games/battleship/rooms", { method: "POST", body: JSON.stringify({ mode: "bot", difficulty, is_public: false }) })
      .then((room) => openRoomPayload(room))
      .catch((e) => { toast(humanError(e, t("Не удалось создать матч с ИИ.", "Failed to create AI match.")), "error"); socialBattleshipOpenMenu(); });
  }

  window.socialBattleshipOpenMenu = socialBattleshipOpenMenu;
  window.socialBattleshipShowLeaderboard = socialBattleshipShowLeaderboard;
  window.socialBattleshipShowTips = socialBattleshipShowTips;
  window.socialBattleshipQuickStart = socialBattleshipQuickStart;
  window.socialBattleshipCreateRoom = socialBattleshipCreateRoom;
  window.socialBattleshipJoinRoom = socialBattleshipJoinRoom;
  window.socialBattleshipOpenRoom = socialBattleshipOpenRoom;
  window.socialBattleshipRefreshRoom = socialBattleshipRefreshRoom;
  window.socialBattleshipShoot = socialBattleshipShoot;
  window.socialBattleshipLeaveRoom = socialBattleshipLeaveRoom;
})();