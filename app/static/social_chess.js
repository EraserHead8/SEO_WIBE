(function () {
  const state = { overview: null, room: null, pollTimer: null, selectedFrom: "", pendingMove: false };
  const pieces = { wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙", bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟" };
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
    const title = kind === "error" ? t("Шахматы: ошибка", "Chess: error") : t("Шахматы", "Chess");
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
  function posKey(pos) { return Array.isArray(pos) && pos.length === 2 ? `${Number(pos[0])}:${Number(pos[1])}` : ""; }
  function coord(pos) { return Array.isArray(pos) && pos.length === 2 ? `${"abcdefgh"[Number(pos[1])] || "?"}${8 - Number(pos[0])}` : ""; }
  function historyText(move) {
    const from = coord(move?.from);
    const to = coord(move?.to);
    if (!from || !to) return "-";
    const cap = move?.capture ? "x" : "-";
    const promo = String(move?.promotion || "").trim();
    return promo ? `${from}${cap}${to}=${promo}` : `${from}${cap}${to}`;
  }
  function difficultyTitle(code) {
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
    if (result === "draw") return t("Партия закончилась ничьей.", "The game ended in a draw.");
    if (winner === "white") return t("Белые победили.", "White wins.");
    if (winner === "black") return t("Черные победили.", "Black wins.");
    return "";
  }

  function stop() {
    if (state.pollTimer) { clearTimeout(state.pollTimer); state.pollTimer = null; }
    state.pendingMove = false;
    const card = document.querySelector("#socialModal .social-modal-card");
    if (card) card.classList.remove("social-checkers-modal");
    if (typeof socialState === "object" && socialState) socialState.activeGameRunner = null;
  }
  function arm() {
    stop();
    const card = document.querySelector("#socialModal .social-modal-card");
    if (card) card.classList.add("social-checkers-modal");
    if (typeof socialState === "object" && socialState) {
      socialState.currentGameCode = "chess";
      socialState.activeGameRunner = { kind: "chess", stop };
    }
  }

  function boardSize(room) {
    const b = Array.isArray(room?.board) ? room.board : [];
    const row = b.length && Array.isArray(b[0]) ? Number(b[0].length || 0) : 0;
    return Math.max(8, Number(b.length || 0), row);
  }
  function flip(room) { return String(room?.my_side || "").trim().toLowerCase() === "black"; }
  function d2b(room, dr, dc) {
    const size = boardSize(room);
    if (flip(room)) return { row: size - 1 - Number(dr || 0), col: size - 1 - Number(dc || 0) };
    return { row: Number(dr || 0), col: Number(dc || 0) };
  }

  function roomSummary(room) {
    const r = resultText(room);
    if (r) return r;
    const s = String(room?.status || "waiting").trim().toLowerCase();
    if (s === "waiting") return room?.can_join ? t("Комната ждет второго игрока.", "Room waits for second player.") : t("Ожидание соперника.", "Waiting for opponent.");
    if (s === "active") return room?.my_turn ? t("Ваш ход.", "Your move.") : t("Ход соперника.", "Opponent move.");
    return t("Матч сохранен в истории.", "Match is saved in history.");
  }

  function roomCard(room, mine) {
    const players = room?.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const id = Number(room?.id || 0);
    const action = room?.can_join ? `socialChessJoinRoom(${id})` : `socialChessOpenRoom(${id})`;
    const openLabel = mine ? t("Открыть", "Open") : (room?.can_join ? t("Подключиться", "Join") : t("Смотреть", "View"));
    return `
      <article class="social-checkers-room-card ${mine ? "mine" : ""}">
        <div class="social-checkers-room-top">
          <div class="social-checkers-room-title-wrap">
            <div class="social-checkers-room-badges">
              <span class="social-checkers-badge ${esc(String(room?.status || "waiting"))}">${esc(statusLabel(room?.status))}</span>
              <span class="social-checkers-badge ${String(room?.mode || "human") === "bot" ? "bot" : "human"}">${esc(modeLabel(room))}</span>
              ${String(room?.mode || "human") === "bot" ? `<span class="social-checkers-badge soft">${esc(difficultyTitle(room?.difficulty))}</span>` : ""}
            </div>
            <strong class="social-checkers-room-title">${esc(room?.title || `#${room?.room_code || "-"}`)}</strong>
            <div class="social-checkers-room-code">#${esc(room?.room_code || "-")} | ${esc(t("Создана", "Created"))}: ${esc(dt(room?.created_at))}</div>
          </div>
          <div class="social-checkers-room-actions actions"><button type="button" onclick="${action}">${esc(openLabel)}</button></div>
        </div>
        <div class="social-checkers-room-meta">
          <span>${esc(t("Белые", "White"))}: <b>${esc(white.nick || "-")}</b></span>
          <span>${esc(t("Черные", "Black"))}: <b>${esc(black.nick || "-")}</b></span>
          <span>${esc(t("Обновлено", "Updated"))}: <b>${esc(dt(room?.updated_at || room?.last_move_at || room?.created_at))}</b></span>
        </div>
        <div class="social-checkers-room-note">${esc(roomSummary(room))}</div>
      </article>
    `;
  }

  function leaderboardPreview(rows) {
    const list = Array.isArray(rows) ? rows.slice(0, 8) : [];
    if (!list.length) return `<div class="social-checkers-empty">${esc(t("Рейтинг пока пуст.", "Leaderboard is empty."))}</div>`;
    return `
      <div class="social-checkers-rank-list">
        ${list.map((row) => `
          <div class="social-checkers-rank-row ${row.is_me ? "social-me-row" : ""}">
            <div class="social-checkers-rank-main">
              <span class="social-checkers-rank-pill">#${Number(row.rank || 0)}</span>
              <div class="social-checkers-rank-meta">
                <strong>${esc(row.nick || "-")}</strong>
                <small>${esc(t("Рейтинг", "Rating"))}: ${Number(row.rating || 1200)} | ${esc(t("Партий", "Games"))}: ${Number(row.play_count || 0)}</small>
              </div>
            </div>
            <div class="social-checkers-rank-stats"><span>${esc(t("П", "W"))}: <b>${Number(row.wins || 0)}</b></span><span>${esc(t("Пор", "L"))}: <b>${Number(row.losses || 0)}</b></span></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function socialChessOpenMenu() {
    socialOpenModal(t("Шахматы", "Chess"), `<div class="social-checkers-loading">${esc(t("Загружаю лобби шахмат...", "Loading chess lobby..."))}</div>`);
    arm();
    try {
      state.overview = await socialRequest("/api/social/games/chess/overview");
      state.room = null;
      state.selectedFrom = "";
      renderMenu();
    } catch (e) {
      socialOpenModal(t("Шахматы", "Chess"), `<div class="social-checkers-panel"><div class="hint">${esc(humanError(e, t("Не удалось открыть шахматы.", "Failed to open chess.")))}</div><div class="actions"><button type="button" onclick="socialChessOpenMenu()">${esc(t("Повторить", "Retry"))}</button><button class="btn-secondary" type="button" onclick="socialCloseModal()">${esc(t("Закрыть", "Close"))}</button></div></div>`);
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
    socialOpenModal(
      t("Шахматы", "Chess"),
      `
      <div class="social-checkers-shell lobby-view">
        <section class="social-checkers-main">
          <article class="social-checkers-panel social-checkers-hero"><div class="social-checkers-hero-main"><div class="social-checkers-hero-copy"><span class="social-checkers-section-kicker">${esc(t("Глобальный рейтинг", "Global ladder"))}</span><h4>${esc(t("Шахматы SEO WIBE", "SEO WIBE Chess"))}</h4><p>${esc(t("Онлайн-лобби, ИИ-уровни и общий рейтинг между всеми пользователями и сотрудниками.", "Online lobby, AI levels and global ranking for all users and teammates."))}</p></div><div class="social-checkers-stats"><div class="social-checkers-stat"><span>${esc(t("Рейтинг", "Rating"))}</span><strong>${Number(profile.rating || 1200)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Победы", "Wins"))}</span><strong>${Number(profile.wins || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Поражения", "Losses"))}</span><strong>${Number(profile.losses || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Ничьи", "Draws"))}</span><strong>${Number(profile.draws || 0)}</strong></div></div></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Быстрый старт", "Quick start"))}</h5></div></div><div class="social-checkers-create-grid"><label class="social-checkers-input-card"><span>${esc(t("Название комнаты", "Room title"))}</span><input id="socialChessRoomTitle" type="text" maxlength="120" value="${esc(defaultTitle)}" /></label><label class="social-checkers-input-card"><span>${esc(t("Сложность ИИ", "Bot difficulty"))}</span><select id="socialChessDifficulty">${difficulties.map((d)=>`<option value="${esc(d.code)}">${esc(d.title || d.code)}</option>`).join("")}</select></label></div><div class="actions social-checkers-create-actions"><button type="button" onclick="socialChessCreateRoom('bot')">${esc(t("Играть с ИИ", "Play vs AI"))}</button><button type="button" onclick="socialChessCreateRoom('human')">${esc(t("Создать онлайн-комнату", "Create online room"))}</button><button class="btn-secondary" type="button" onclick="socialChessShowLeaderboard()">${esc(t("Полный рейтинг", "Full leaderboard"))}</button></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Мои комнаты", "My rooms"))}</h5></div></div><div class="social-checkers-room-list">${myRooms.length ? myRooms.map((r)=>roomCard(r,true)).join("") : `<div class="social-checkers-empty">${esc(t("У вас пока нет активных комнат.", "You have no active rooms."))}</div>`}</div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Открытые комнаты", "Public rooms"))}</h5></div></div><div class="social-checkers-room-list">${publicRooms.length ? publicRooms.map((r)=>roomCard(r,false)).join("") : `<div class="social-checkers-empty">${esc(t("Сейчас нет открытых комнат.", "No public rooms."))}</div>`}</div></article>
        </section>
        <aside class="social-checkers-sidebar"><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Топ игроков", "Top players"))}</h5></div></div>${leaderboardPreview(leaderboard)}</section><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Подсказки", "Tips"))}</h5></div></div><div class="hint">${esc(t("Доска автоматически разворачивается под ваш цвет.", "Board auto-flips to your side."))}</div><div class="actions social-checkers-actions-stack"><button class="btn-secondary" type="button" onclick="socialChessShowTips()">${esc(t("Как играть", "How to play"))}</button></div></section></aside>
      </div>
      `
    );
    arm();
  }

  async function socialChessCreateRoom(mode) {
    const safeMode = String(mode || "human").trim().toLowerCase() === "bot" ? "bot" : "human";
    const title = String(document.getElementById("socialChessRoomTitle")?.value || "").trim();
    const difficulty = String(document.getElementById("socialChessDifficulty")?.value || "medium").trim().toLowerCase() || "medium";
    try {
      const room = await socialRequest("/api/social/games/chess/rooms", { method: "POST", body: JSON.stringify({ mode: safeMode, title, difficulty, is_public: safeMode === "human" }) });
      state.overview = null;
      state.selectedFrom = "";
      openRoomPayload(room);
    } catch (e) {
      toast(humanError(e, t("Не удалось создать комнату.", "Failed to create room.")), "error");
    }
  }

  async function socialChessJoinRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/chess/rooms/${id}/join`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Не удалось подключиться к комнате.", "Failed to join room.")), "error"); }
  }

  async function socialChessOpenRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/chess/rooms/${id}`)); }
    catch (e) { toast(humanError(e, t("Не удалось открыть комнату.", "Failed to open room.")), "error"); }
  }

  function legalSelection(room) {
    const moves = Array.isArray(room?.legal_moves) ? room.legal_moves : [];
    const starts = new Set();
    const targets = new Set();
    const selected = String(state.selectedFrom || "").trim();
    for (const mv of moves) {
      starts.add(posKey(mv?.from));
      if (selected && posKey(mv?.from) === selected) targets.add(posKey(mv?.to));
    }
    return { starts, targets };
  }

  function playerCard(player, side, active) {
    const p = player && typeof player === "object" ? player : {};
    return `<article class="social-checkers-player ${active ? "active" : ""}"><div class="social-checkers-room-badges"><span class="social-checkers-badge ${esc(side)}">${esc(side === "white" ? t("Белые", "White") : t("Черные", "Black"))}</span>${p.is_bot ? `<span class="social-checkers-badge bot">${esc(t("ИИ", "AI"))}</span>` : ""}</div><strong>${esc(p.nick || "-")}</strong><div class="social-checkers-player-meta"><span>${esc(t("Рейтинг", "Rating"))}: <b>${Number(p.rating || 1200)}</b></span><span>${esc(t("Партий", "Games"))}: <b>${Number(p.play_count || 0)}</b></span></div></article>`;
  }

  function historyRows(room) {
    const rows = Array.isArray(room?.history) ? room.history.slice().reverse().slice(0, 24) : [];
    if (!rows.length) return `<div class="social-checkers-empty">${esc(t("История пока пустая.", "No moves yet."))}</div>`;
    return rows.map((m, idx) => `<div class="social-checkers-history-row"><strong>${Number(rows.length - idx)}</strong><div><span>${esc(String(m?.side || "") === "white" ? t("Белые", "White") : t("Черные", "Black"))}: <b>${esc(historyText(m))}</b></span><small>${esc(dt(m?.at || ""))}</small></div></div>`).join("");
  }

  function openRoomPayload(room) {
    if (!room || typeof room !== "object") { toast(t("Комната недоступна.", "Room unavailable."), "error"); return; }
    state.room = room;
    const sel = legalSelection(room);
    const board = Array.isArray(room.board) ? room.board : [];
    const size = boardSize(room);
    const lmFrom = posKey(room?.last_move?.from);
    const lmTo = posKey(room?.last_move?.to);
    const boardHtml = Array.from({ length: size }, (_, dr) => Array.from({ length: size }, (_, dc) => {
      const c = d2b(room, dr, dc);
      const r = Number(c.row || 0);
      const col = Number(c.col || 0);
      const row = Array.isArray(board[r]) ? board[r] : [];
      const piece = String(row[col] || "");
      const key = `${r}:${col}`;
      const dark = ((dr + dc) % 2) === 1;
      const selectable = room.can_move && sel.starts.has(key);
      const target = room.can_move && sel.targets.has(key);
      const selected = String(state.selectedFrom || "") === key;
      const trail = key === lmFrom || key === lmTo;
      const glyph = pieces[piece] || "";
      const cls = piece ? (piece[0] === "w" ? "white" : "black") : "";
      return `<button type="button" class="social-checkers-cell ${dark ? "dark" : "light"} ${selectable ? "selectable" : ""} ${target ? "target" : ""} ${selected ? "selected" : ""} ${trail ? "trail" : ""}" onclick="socialChessHandleCell(${r}, ${col})" ${room.can_move ? "" : "disabled"}>${piece ? `<span class="social-chess-piece ${esc(cls)}">${esc(glyph)}</span>` : ""}</button>`;
    }).join("")).join("");

    const players = room.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const title = String(room.title || `${t("Комната", "Room")} ${room.room_code || ""}`).trim();
    const note = resultText(room) || String(room.note || "").trim();
    const myStatus = room.my_side ? (String(room.my_side) === "white" ? t("Белые", "White") : t("Черные", "Black")) : t("Наблюдатель", "Viewer");
    socialOpenModal(title, `
      <div class="social-checkers-shell">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-board-card">
            <div class="social-checkers-room-head compact"><div class="social-checkers-room-title-wrap"><div class="social-checkers-room-badges"><span class="social-checkers-badge ${esc(String(room.status || "waiting"))}">${esc(statusLabel(room.status))}</span><span class="social-checkers-badge ${String(room.mode || "human") === "bot" ? "bot" : "human"}">${esc(modeLabel(room))}</span>${String(room.mode || "human") === "bot" ? `<span class="social-checkers-badge soft">${esc(difficultyTitle(room.difficulty))}</span>` : ""}</div><strong class="social-checkers-room-title">${esc(title)}</strong><div class="social-checkers-room-meta"><span>#${esc(room.room_code || "-")}</span><span>${esc(t("Создана", "Created"))}: <b>${esc(dt(room.created_at))}</b></span><span>${esc(t("Обновлено", "Updated"))}: <b>${esc(dt(room.updated_at))}</b></span></div></div><div class="social-checkers-turn-pill ${esc(String(room.turn || "white"))}">${esc(String(room.turn || "white") === "white" ? t("Белые", "White") : t("Черные", "Black"))} | ${esc(myStatus)}</div></div>
            ${note ? `<div class="social-checkers-note ${resultText(room) ? "strong" : ""}">${esc(note)}</div>` : ""}
            <div class="social-checkers-board-wrap"><div class="social-checkers-board">${boardHtml}</div></div>
            <div class="social-checkers-board-footer"><span>${esc(t("Последний ход", "Last move"))}: <b>${esc(historyText(room?.last_move)) || "-"}</b></span><span>${esc(t("Режим", "Mode"))}: <b>${esc(modeLabel(room))}</b></span></div>
          </section>
        </div>
        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Игроки", "Players"))}</h5></div></div><div class="social-checkers-players">${playerCard(white, "white", String(room.turn || "white") === "white")}${playerCard(black, "black", String(room.turn || "white") === "black")}</div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Действия", "Actions"))}</h5></div></div><div class="actions social-checkers-actions-stack">${room.can_join ? `<button type="button" onclick="socialChessJoinRoom(${Number(room.id || 0)})">${esc(t("Подключиться", "Join room"))}</button>` : ""}<button class="btn-secondary" type="button" onclick="socialChessRefreshRoom()">${esc(t("Обновить", "Refresh"))}</button><button class="btn-secondary" type="button" onclick="socialChessOpenMenu()">${esc(t("К лобби", "Back to lobby"))}</button>${(room.my_side && (room.status === "waiting" || room.status === "active")) ? `<button type="button" onclick="socialChessLeaveRoom()">${esc(room.status === "waiting" ? t("Закрыть комнату", "Close room") : t("Сдаться", "Resign"))}</button>` : ""}</div><div class="hint">${esc(room.can_move ? t("Нажмите фигуру и выберите клетку назначения.", "Tap piece then destination square.") : t("Если ход не ваш, позиция обновится автоматически.", "If not your turn, board refreshes automatically."))}</div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("История ходов", "Move history"))}</h5></div></div><div class="social-checkers-history">${historyRows(room)}</div></section>
        </aside>
      </div>
    `);
    arm();
    schedulePoll(room);
  }

  function schedulePoll(room) {
    if (state.pollTimer) { clearTimeout(state.pollTimer); state.pollTimer = null; }
    if (!room || typeof room !== "object") return;
    const isHuman = String(room.mode || "human") === "human";
    const pollWaiting = String(room.status || "") === "waiting" && Boolean(room.my_side);
    const pollTurn = String(room.status || "") === "active" && isHuman && !Boolean(room.can_move) && !String(room.winner || "") && String(room.result || "") !== "draw";
    if (!pollWaiting && !pollTurn) return;
    state.pollTimer = setTimeout(() => socialChessRefreshRoom(true), pollWaiting ? 2600 : 1800);
  }

  async function socialChessRefreshRoom(silent) {
    const id = Number(state.room?.id || 0);
    if (!id) { if (!silent) socialChessOpenMenu(); return; }
    try { openRoomPayload(await socialRequest(`/api/social/games/chess/rooms/${id}`)); }
    catch (e) { if (!silent) toast(humanError(e, t("Не удалось обновить комнату.", "Failed to refresh room.")), "error"); }
  }

  async function sendMove(fromPos, toPos) {
    if (state.pendingMove) return;
    const id = Number(state.room?.id || 0);
    if (!id) return;
    state.pendingMove = true;
    try {
      const room = await socialRequest(`/api/social/games/chess/rooms/${id}/move`, { method: "POST", body: JSON.stringify({ from: fromPos, to: toPos, promotion: "Q" }) });
      state.selectedFrom = "";
      openRoomPayload(room);
    } catch (e) {
      toast(humanError(e, t("Не удалось выполнить ход.", "Failed to make move.")), "error");
    } finally {
      state.pendingMove = false;
    }
  }

  function socialChessHandleCell(row, col) {
    const room = state.room;
    if (!room || !room.can_move) return;
    const key = `${Number(row)}:${Number(col)}`;
    const moves = Array.isArray(room.legal_moves) ? room.legal_moves : [];
    const current = state.selectedFrom;
    const fromHere = moves.filter((m) => posKey(m.from) === key);
    if (!current) { if (!fromHere.length) return; state.selectedFrom = key; openRoomPayload(room); return; }
    if (current === key) { state.selectedFrom = ""; openRoomPayload(room); return; }
    const selectedMoves = moves.filter((m) => posKey(m.from) === current);
    const chosen = selectedMoves.find((m) => posKey(m.to) === key);
    if (chosen) { sendMove(chosen.from, chosen.to); return; }
    if (fromHere.length) { state.selectedFrom = key; openRoomPayload(room); }
  }

  async function socialChessLeaveRoom() {
    const id = Number(state.room?.id || 0);
    if (!id) return;
    const room = state.room || {};
    const ask = room.status === "waiting" ? t("Закрыть эту комнату?", "Close this room?") : t("Сдаться в партии?", "Resign from this match?");
    if (!window.confirm(ask)) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/chess/rooms/${id}/leave`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Не удалось завершить комнату.", "Failed to finish room.")), "error"); }
  }

  function socialChessShowTips() {
    socialOpenModal(t("Шахматы: как играть", "Chess: how to play"), `<div class="social-checkers-panel"><div class="hint">${esc(t("1) Белые ходят первыми. Нажмите фигуру и затем клетку назначения.", "1) White moves first. Tap a piece then destination."))}</div><div class="hint">${esc(t("2) В сетевой игре доска разворачивается под ваш цвет.", "2) In online games board is flipped to your color."))}</div><div class="hint">${esc(t("3) В лобби доступны ИИ-уровни и глобальный рейтинг.", "3) Lobby has AI levels and global ranking."))}</div><div class="actions"><button type="button" onclick="socialChessOpenMenu()">${esc(t("Назад", "Back"))}</button></div></div>`);
    arm();
  }

  async function socialChessShowLeaderboard() {
    try {
      const data = await socialRequest("/api/social/games/chess/leaderboard?limit=100");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      socialOpenModal(t("Рейтинг шахмат", "Chess leaderboard"), `<div class="social-checkers-scroll-table"><table><thead><tr><th>#</th><th>${esc(t("Игрок", "Player"))}</th><th>${esc(t("Рейтинг", "Rating"))}</th><th>${esc(t("Победы", "Wins"))}</th><th>${esc(t("Поражения", "Losses"))}</th><th>${esc(t("Ничьи", "Draws"))}</th></tr></thead><tbody>${rows.length ? rows.map((r)=>`<tr class="${r.is_me ? "social-me-row" : ""}"><td>${Number(r.rank || 0)}</td><td>${esc(r.nick || "-")}</td><td>${Number(r.rating || 1200)}</td><td>${Number(r.wins || 0)}</td><td>${Number(r.losses || 0)}</td><td>${Number(r.draws || 0)}</td></tr>`).join("") : `<tr><td colspan="6">${esc(t("Пока нет результатов", "No results yet"))}</td></tr>`}</tbody></table></div><div class="hint">${esc(t("Ваше место", "Your rank"))}: <b>${data?.my_rank ? `#${Number(data.my_rank)}` : "—"}</b> | ${esc(t("Ваш рейтинг", "Your rating"))}: <b>${Number(data?.my_rating || 1200)}</b></div><div class="actions"><button type="button" onclick="socialChessOpenMenu()">${esc(t("Назад", "Back"))}</button></div>`);
      arm();
    } catch (e) {
      toast(humanError(e, t("Не удалось загрузить рейтинг.", "Failed to load leaderboard.")), "error");
    }
  }

  function socialChessQuickStart(level = "medium") {
    const difficulty = String(level || "medium").trim().toLowerCase() || "medium";
    socialOpenModal(t("Шахматы", "Chess"), `<div class="social-checkers-loading">${esc(t("Создаю матч с ИИ...", "Creating AI match..."))}</div>`);
    arm();
    socialRequest("/api/social/games/chess/rooms", { method: "POST", body: JSON.stringify({ mode: "bot", difficulty, is_public: false }) })
      .then((room) => openRoomPayload(room))
      .catch((e) => { toast(humanError(e, t("Не удалось создать матч с ИИ.", "Failed to create AI match.")), "error"); socialChessOpenMenu(); });
  }

  window.socialChessOpenMenu = socialChessOpenMenu;
  window.socialChessShowLeaderboard = socialChessShowLeaderboard;
  window.socialChessShowTips = socialChessShowTips;
  window.socialChessQuickStart = socialChessQuickStart;
  window.socialChessCreateRoom = socialChessCreateRoom;
  window.socialChessJoinRoom = socialChessJoinRoom;
  window.socialChessOpenRoom = socialChessOpenRoom;
  window.socialChessRefreshRoom = socialChessRefreshRoom;
  window.socialChessHandleCell = socialChessHandleCell;
  window.socialChessLeaveRoom = socialChessLeaveRoom;
})();