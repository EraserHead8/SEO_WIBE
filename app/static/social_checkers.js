(function () {
  const socialCheckersState = {
    overview: null,
    currentRoom: null,
    pollTimer: null,
    selectedKey: "",
    pendingMove: false,
  };

  const CHECKERS_DIFFICULTY_FALLBACKS = {
    easy: { code: "easy", title: "Р›РµРіРєРёР№", subtitle: "РћС€РёР±Р°РµС‚СЃСЏ С‡Р°С‰Рµ Рё РїРѕРґС…РѕРґРёС‚ РґР»СЏ Р±С‹СЃС‚СЂРѕРіРѕ СЃС‚Р°СЂС‚Р°.", bot_rating: 950 },
    medium: { code: "medium", title: "РЎСЂРµРґРЅРёР№", subtitle: "РЎР±Р°Р»Р°РЅСЃРёСЂРѕРІР°РЅРЅС‹Р№ СЂРµР¶РёРј РЅР° РєР°Р¶РґС‹Р№ РґРµРЅСЊ.", bot_rating: 1200 },
    hard: { code: "hard", title: "РЎРёР»СЊРЅС‹Р№", subtitle: "РџСЂРѕСЃС‡РёС‚С‹РІР°РµС‚ РіР»СѓР±Р¶Рµ Рё РЅР°РєР°Р·С‹РІР°РµС‚ Р·Р° РЅРµС‚РѕС‡РЅРѕСЃС‚Рё.", bot_rating: 1450 },
    expert: { code: "expert", title: "Р­РєСЃРїРµСЂС‚", subtitle: "РњР°РєСЃРёРјР°Р»СЊРЅР°СЏ СЃР»РѕР¶РЅРѕСЃС‚СЊ РґР»СЏ РґР»РёРЅРЅС‹С… РїР°СЂС‚РёР№.", bot_rating: 1650 },
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
    const title = kind === "error" ? checkersTr("РЁР°С€РєРё: РѕС€РёР±РєР°", "Checkers: error") : checkersTr("РЁР°С€РєРё", "Checkers");
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
      return fallback || checkersTr("РЎРµСЂРІРµСЂ РІСЂРµРјРµРЅРЅРѕ Р·Р°РЅСЏС‚. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰Рµ СЂР°Р·.", "The server is temporarily busy. Please try again.");
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

  function checkersBoardSize(room) {
    const board = Array.isArray(room?.board) ? room.board : [];
    const rowSize = board.length && Array.isArray(board[0]) ? Number(board[0].length || 0) : 0;
    const size = Math.max(Number(board.length || 0), rowSize, 8);
    return Math.max(8, size);
  }

  function checkersShouldFlipBoard(room) {
    return String(room?.my_side || "").trim().toLowerCase() === "black";
  }

  function checkersDisplayToBoardCoords(room, displayRow, displayCol) {
    const size = checkersBoardSize(room);
    if (checkersShouldFlipBoard(room)) {
      return {
        row: size - 1 - Number(displayRow || 0),
        col: size - 1 - Number(displayCol || 0),
      };
    }
    return {
      row: Number(displayRow || 0),
      col: Number(displayCol || 0),
    };
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
    if (safe === "active") return checkersTr("РРіСЂР° РёРґРµС‚", "Active");
    if (safe === "finished") return checkersTr("Р—Р°РІРµСЂС€РµРЅР°", "Finished");
    if (safe === "cancelled") return checkersTr("Р—Р°РєСЂС‹С‚Р°", "Cancelled");
    return checkersTr("РћР¶РёРґР°РЅРёРµ", "Waiting");
  }

  function checkersRoomMode(room) {
    return String(room?.mode || "human") === "bot" ? checkersTr("РЎ Р±РѕС‚РѕРј", "Bot") : checkersTr("РћРЅР»Р°Р№РЅ", "Online");
  }

  function checkersResultText(room) {
    if (!room || typeof room !== "object") return "";
    const result = String(room.result || "").trim().toLowerCase();
    const winner = String(room.winner || "").trim().toLowerCase();
    if (result === "draw") return checkersTr("РџР°СЂС‚РёСЏ Р·Р°РєРѕРЅС‡РёР»Р°СЃСЊ РЅРёС‡СЊРµР№.", "The game ended in a draw.");
    if (winner === "white") return checkersTr("Р‘РµР»С‹Рµ РїРѕР±РµРґРёР»Рё.", "White wins.");
    if (winner === "black") return checkersTr("Р§РµСЂРЅС‹Рµ РїРѕР±РµРґРёР»Рё.", "Black wins.");
    if (result === "cancelled") return checkersTr("РљРѕРјРЅР°С‚Р° Р·Р°РєСЂС‹С‚Р° Р±РµР· СЂРµР·СѓР»СЊС‚Р°С‚Р°.", "The room was closed without a result.");
    if (result === "resigned") return checkersTr("РџР°СЂС‚РёСЏ Р·Р°РІРµСЂС€РµРЅР° СЃРґР°С‡РµР№.", "The game ended by resignation.");
    return "";
  }

  function checkersPlayerLabel(side) {
    return side === "white" ? checkersTr("Р‘РµР»С‹Рµ", "White") : checkersTr("Р§РµСЂРЅС‹Рµ", "Black");
  }

  function checkersRoomSummary(room) {
    if (!room || typeof room !== "object") return "";
    const resultText = checkersResultText(room);
    if (resultText) return resultText;
    const status = String(room.status || "waiting").trim().toLowerCase();
    if (status === "waiting") {
      return room.can_join
        ? checkersTr("РљРѕРјРЅР°С‚Р° Р¶РґРµС‚ РІС‚РѕСЂРѕРіРѕ РёРіСЂРѕРєР°. РњРѕР¶РЅРѕ РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ Рё РЅР°С‡Р°С‚СЊ РїР°СЂС‚РёСЋ СЃСЂР°Р·Сѓ.", "The room is waiting for a second player. Join and start immediately.")
        : checkersTr("РљРѕРјРЅР°С‚Р° СЃРѕР·РґР°РЅР° Рё Р¶РґРµС‚ СЃРѕРїРµСЂРЅРёРєР°. РљР°Рє С‚РѕР»СЊРєРѕ РѕРЅ РїРѕРґРєР»СЋС‡РёС‚СЃСЏ, РїР°СЂС‚РёСЏ РЅР°С‡РЅРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.", "The room is ready and waiting for an opponent. The game starts as soon as someone joins.");
    }
    if (status === "active") {
      if (String(room.mode || "human") === "bot") {
        return `${checkersTr("РЈСЂРѕРІРµРЅСЊ РєРѕРјРїСЊСЋС‚РµСЂР°", "Bot level")}: ${checkersDifficultyTitle(room.difficulty)}`;
      }
      return room.my_turn
        ? checkersTr("РЎРµР№С‡Р°СЃ РІР°С€ С…РѕРґ. Р’С‹Р±РµСЂРёС‚Рµ СЃРІРѕСЋ С€Р°С€РєСѓ, Р·Р°С‚РµРј РїРѕРґСЃРІРµС‡РµРЅРЅСѓСЋ РєР»РµС‚РєСѓ РЅР°Р·РЅР°С‡РµРЅРёСЏ.", "It is your move. Select your piece, then the highlighted target square.")
        : checkersTr("РЎРµР№С‡Р°СЃ С…РѕРґ СЃРѕРїРµСЂРЅРёРєР°. РџРѕР·РёС†РёСЏ РѕР±РЅРѕРІРёС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.", "It is the opponent's move. The board will refresh automatically.");
    }
    if (status === "cancelled") {
      return checkersTr("РљРѕРјРЅР°С‚Р° Р±С‹Р»Р° Р·Р°РєСЂС‹С‚Р° РґРѕ РѕРєРѕРЅС‡Р°РЅРёСЏ РїР°СЂС‚РёРё.", "The room was closed before the game finished.");
    }
    return checkersTr("РџР°СЂС‚РёСЏ СЃРѕС…СЂР°РЅРµРЅР° РІ РёСЃС‚РѕСЂРёРё Рё РґРѕСЃС‚СѓРїРЅР° РґР»СЏ РїСЂРѕСЃРјРѕС‚СЂР°.", "The game is saved in history and can be reviewed.");
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
      checkersTr("РЁР°С€РєРё", "Checkers"),
      `<div class="social-checkers-loading">${checkersEsc(checkersTr("Р—Р°РіСЂСѓР¶Р°СЋ Р»РѕР±Р±Рё С€Р°С€РµРє...", "Loading checkers lobby..."))}</div>`
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
    if (mine) parts.push(`<span class="social-checkers-badge soft">${checkersEsc(checkersTr("РњРѕСЏ РїР°СЂС‚РёСЏ", "My game"))}</span>`);
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
      ? (String(room.status || "").trim().toLowerCase() === "finished" ? checkersTr("РћС‚РєСЂС‹С‚СЊ", "Open") : checkersTr("РџСЂРѕРґРѕР»Р¶РёС‚СЊ", "Continue"))
      : (room.can_join ? checkersTr("РџРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ", "Join") : checkersTr("РЎРјРѕС‚СЂРµС‚СЊ", "View"));
    const action = room.can_join ? `socialCheckersJoinRoom(${roomId})` : `socialCheckersOpenRoom(${roomId})`;
    return `
      <article class="social-checkers-room-card ${mine ? "mine" : ""}">
        <div class="social-checkers-room-top">
          <div class="social-checkers-room-title-wrap">
            <div class="social-checkers-room-badges">${checkersRoomBadges(room, mine)}</div>
            <strong class="social-checkers-room-title">${checkersEsc(room.title || `${checkersTr("РљРѕРјРЅР°С‚Р°", "Room")} ${roomCode}`)}</strong>
            <div class="social-checkers-room-code">#${checkersEsc(roomCode)} | ${checkersEsc(checkersTr("РЎРѕР·РґР°РЅР°", "Created"))}: ${checkersEsc(createdAt)}</div>
          </div>
          <div class="social-checkers-room-actions actions">
            <button type="button" onclick="${action}">${checkersEsc(openLabel)}</button>
          </div>
        </div>
        <div class="social-checkers-room-meta">
          <span>${checkersEsc(checkersPlayerLabel("white"))}: <b>${checkersEsc(white.nick || "-")}</b></span>
          <span>${checkersEsc(checkersPlayerLabel("black"))}: <b>${checkersEsc(black.nick || "-")}</b></span>
          <span>${checkersEsc(checkersTr("РћР±РЅРѕРІР»РµРЅРѕ", "Updated"))}: <b>${checkersEsc(updatedAt)}</b></span>
        </div>
        <div class="social-checkers-room-note">${checkersEsc(summary)}</div>
      </article>
    `;
  }

  function checkersLeaderboardPreview(rows) {
    const safeRows = checkersTopRows(rows, 8);
    if (!safeRows.length) {
      return `<div class="social-checkers-empty">${checkersEsc(checkersTr("Р РµР№С‚РёРЅРі РїРѕРєР° РїСѓСЃС‚. РЎС‹РіСЂР°Р№С‚Рµ РїРµСЂРІСѓСЋ РїР°СЂС‚РёСЋ Рё Р·Р°РґР°Р№С‚Рµ С‚РµРјРї Р»РёРіРµ.", "The ladder is empty for now. Play the first game and set the pace."))}</div>`;
    }
    return `
      <div class="social-checkers-rank-list">
        ${safeRows.map((row) => `
          <div class="social-checkers-rank-row ${row.is_me ? "social-me-row" : ""}">
            <div class="social-checkers-rank-main">
              <span class="social-checkers-rank-pill">#${Number(row.rank || 0)}</span>
              <div class="social-checkers-rank-meta">
                <strong>${checkersEsc(row.nick || "-")}</strong>
                <small>${checkersEsc(checkersTr("Р РµР№С‚РёРЅРі", "Rating"))}: ${Number(row.rating || 1200)} | ${checkersEsc(checkersTr("РџР°СЂС‚РёР№", "Games"))}: ${Number(row.play_count || 0)}</small>
              </div>
            </div>
            <div class="social-checkers-rank-stats">
              <span>${checkersEsc(checkersTr("Рџ", "W"))}: <b>${Number(row.wins || 0)}</b></span>
              <span>${checkersEsc(checkersTr("РџРѕСЂ", "L"))}: <b>${Number(row.losses || 0)}</b></span>
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
        checkersTr("РЁР°С€РєРё", "Checkers"),
        `
          <div class="social-checkers-panel">
            <div class="hint">${checkersEsc(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ С€Р°С€РєРё. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰Рµ СЂР°Р· С‡РµСЂРµР· РїР°СЂСѓ СЃРµРєСѓРЅРґ.", "Failed to open checkers. Please try again in a few seconds.")))}</div>
            <div class="actions">
              <button type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("РџРѕРІС‚РѕСЂРёС‚СЊ", "Retry"))}</button>
              <button class="btn-secondary" type="button" onclick="socialCloseModal()">${checkersEsc(checkersTr("Р—Р°РєСЂС‹С‚СЊ", "Close"))}</button>
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
    const defaultTitle = profile.nick ? `${checkersTr("РљРѕРјРЅР°С‚Р°", "Room")} ${profile.nick}` : checkersTr("РћС‚РєСЂС‹С‚Р°СЏ РєРѕРјРЅР°С‚Р°", "Public room");
    const activeMyRooms = myRooms.filter((room) => ["waiting", "active"].includes(String(room?.status || "").trim().toLowerCase())).length;
    const html = `
      <div class="social-checkers-shell lobby-view">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-hero">
            <div class="social-checkers-hero-main">
              <div class="social-checkers-hero-copy">
                <div class="social-checkers-room-badges">
                  <span class="social-checkers-badge primary">${checkersEsc(checkersTr("Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ СЂРµР№С‚РёРЅРі", "Global ladder"))}</span>
                  <span class="social-checkers-badge soft">${checkersEsc(checkersTr("Р’РµР± + APK", "Web + APK"))}</span>
                </div>
                <h4>${checkersEsc(checkersTr("РЁР°С€РєРё SEO WIBE", "SEO WIBE Checkers"))}</h4>
                <p>${checkersEsc(checkersTr("РРіСЂР°Р№С‚Рµ СЃ РєРѕРјРїСЊСЋС‚РµСЂРѕРј, РѕС‚РєСЂС‹РІР°Р№С‚Рµ СЃРµС‚РµРІС‹Рµ РєРѕРјРЅР°С‚С‹ РґР»СЏ РєРѕР»Р»РµРі Рё РїРѕРґРЅРёРјР°Р№С‚РµСЃСЊ РІ РѕР±С‰РµРј СЂРµР№С‚РёРЅРіРµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Рё СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ.", "Play against the computer, open online rooms for colleagues, and climb the shared ladder across all users and employees."))}</p>
              </div>
              <div class="social-checkers-toolbar actions">
                <button class="btn-secondary" type="button" onclick="socialCheckersShowLeaderboard()">${checkersEsc(checkersTr("Р’РµСЃСЊ СЂРµР№С‚РёРЅРі", "Full leaderboard"))}</button>
                <button class="btn-secondary" type="button" onclick="socialCheckersShowTips()">${checkersEsc(checkersTr("РљР°Рє РёРіСЂР°С‚СЊ", "How to play"))}</button>
                <button class="btn-secondary" type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("РћР±РЅРѕРІРёС‚СЊ", "Refresh"))}</button>
              </div>
            </div>
            <div class="social-checkers-stats">
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("Р РµР№С‚РёРЅРі", "Rating"))}</span><strong>${Number(profile.rating || 1200)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("РњРµСЃС‚Рѕ", "Rank"))}</span><strong>${data?.leaderboard?.my_rank ? `#${Number(data.leaderboard.my_rank)}` : "-"}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("РџРѕР±РµРґС‹", "Wins"))}</span><strong>${Number(profile.wins || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("РџРѕСЂР°Р¶РµРЅРёСЏ", "Losses"))}</span><strong>${Number(profile.losses || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("РќРёС‡СЊРё", "Draws"))}</span><strong>${Number(profile.draws || 0)}</strong></div>
              <div class="social-checkers-stat"><span>${checkersEsc(checkersTr("РђРєС‚РёРІРЅС‹С… РїР°СЂС‚РёР№", "Active games"))}</span><strong>${Number(activeMyRooms || 0)}</strong></div>
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">AI</span>
                <h5>${checkersEsc(checkersTr("РРіСЂР° СЃ РєРѕРјРїСЊСЋС‚РµСЂРѕРј", "Play vs computer"))}</h5>
                <p>${checkersEsc(checkersTr("Р§РµС‚С‹СЂРµ СѓСЂРѕРІРЅСЏ СЃР»РѕР¶РЅРѕСЃС‚Рё, Р±С‹СЃС‚СЂС‹Р№ СЃС‚Р°СЂС‚ РІ РѕРґРёРЅ С‚Р°Рї Рё СЂРµР№С‚РёРЅРі РїРѕСЃР»Рµ РєР°Р¶РґРѕР№ РїР°СЂС‚РёРё.", "Four difficulty levels, one-tap start, and a live rating after every game."))}</p>
              </div>
              <span class="social-checkers-badge soft">${Number(difficulties.length || 0)} ${checkersEsc(checkersTr("СѓСЂРѕРІРЅСЏ", "levels"))}</span>
            </div>
            <div class="social-checkers-difficulty-grid">
              ${difficulties.map((difficulty) => {
                const safeCode = String(difficulty?.code || "medium");
                const difficultyArg = JSON.stringify(safeCode);
                return `
                  <button class="social-checkers-difficulty" type="button" onclick="socialCheckersQuickStart(${difficultyArg})">
                    <strong>${checkersEsc(difficulty.title || checkersDifficultyTitle(safeCode))}</strong>
                    <span>${checkersEsc(difficulty.subtitle || checkersDifficultyInfo(safeCode).subtitle || "")}</span>
                    <small>${checkersEsc(checkersTr("Р РµР№С‚РёРЅРі Р±РѕС‚Р°", "Bot rating"))}: ${Number(difficulty.bot_rating || checkersDifficultyInfo(safeCode).bot_rating || 1200)}</small>
                  </button>
                `;
              }).join("")}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">Lobby</span>
                <h5>${checkersEsc(checkersTr("РЎРѕР·РґР°С‚СЊ РѕРЅР»Р°Р№РЅ-РєРѕРјРЅР°С‚Сѓ", "Create an online room"))}</h5>
                <p>${checkersEsc(checkersTr("РљРѕРјРЅР°С‚Р° РїРѕСЏРІРёС‚СЃСЏ РІ РѕР±С‰РµРј Р»РѕР±Р±Рё. Р”СЂСѓРіРѕР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РёР»Рё СЃРѕС‚СЂСѓРґРЅРёРє СЃРјРѕР¶РµС‚ СѓРІРёРґРµС‚СЊ РµРµ Рё РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ.", "The room will appear in the global lobby, where another user or team member can join."))}</p>
              </div>
              <span class="social-checkers-badge soft">${checkersEsc(checkersTr("РџСѓР±Р»РёС‡РЅРѕ", "Public"))}</span>
            </div>
            <div class="social-checkers-create-grid">
              <label class="social-checkers-input-card">
                <span>${checkersEsc(checkersTr("РќР°Р·РІР°РЅРёРµ РєРѕРјРЅР°С‚С‹", "Room title"))}</span>
                <input id="socialCheckersRoomTitle" type="text" maxlength="120" value="${checkersEsc(defaultTitle)}" placeholder="${checkersEsc(checkersTr("РќР°РїСЂРёРјРµСЂ, РЈС‚СЂРµРЅРЅСЏСЏ РїР°СЂС‚РёСЏ", "For example, Morning match"))}" />
                <small>${checkersEsc(checkersTr("Р•СЃР»Рё РѕСЃС‚Р°РІРёС‚СЊ РїРѕР»Рµ РїСѓСЃС‚С‹Рј, РЅР°Р·РІР°РЅРёРµ РїРѕРґСЃС‚Р°РІРёС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРѕ РІР°С€РµРјСѓ РїСЂРѕС„РёР»СЋ.", "If you leave this blank, the room title will be generated automatically from your profile."))}</small>
              </label>
              <div class="social-checkers-create-actions actions">
                <button type="button" onclick="socialCheckersCreateRoom()">${checkersEsc(checkersTr("РЎРѕР·РґР°С‚СЊ РєРѕРјРЅР°С‚Сѓ", "Create room"))}</button>
              </div>
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">Open rooms</span>
                <h5>${checkersEsc(checkersTr("РћС‚РєСЂС‹С‚С‹Рµ РєРѕРјРЅР°С‚С‹", "Open rooms"))}</h5>
                <p>${checkersEsc(checkersTr("Р›РѕР±Р±Рё РґР»СЏ РІСЃРµС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Рё СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ. РњРѕР¶РЅРѕ Р±С‹СЃС‚СЂРѕ РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ Рє СЃРІРѕР±РѕРґРЅРѕР№ РєРѕРјРЅР°С‚Рµ.", "A shared lobby for all users and employees. Join any available room in one tap."))}</p>
              </div>
              <span class="social-checkers-badge soft">${Number(publicRooms.length || 0)}</span>
            </div>
            <div class="social-checkers-room-list">
              ${publicRooms.length ? publicRooms.map((room) => checkersRoomCard(room, false)).join("") : `<div class="social-checkers-empty">${checkersEsc(checkersTr("РЎРІРѕР±РѕРґРЅС‹С… РєРѕРјРЅР°С‚ РїРѕРєР° РЅРµС‚. РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ Рё РїРѕР·РѕРІРёС‚Рµ РєРѕР»Р»РµРіСѓ.", "There are no open rooms yet. Create the first one and invite a colleague."))}</div>`}
            </div>
          </section>
        </div>

        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">My games</span>
                <h5>${checkersEsc(checkersTr("Р’Р°С€Рё РїР°СЂС‚РёРё", "Your games"))}</h5>
                <p>${checkersEsc(checkersTr("Р‘С‹СЃС‚СЂС‹Р№ РґРѕСЃС‚СѓРї Рє РѕР¶РёРґР°РЅРёСЋ, Р°РєС‚РёРІРЅС‹Рј Рё РЅРµРґР°РІРЅРѕ Р·Р°РІРµСЂС€РµРЅРЅС‹Рј РјР°С‚С‡Р°Рј.", "Quick access to waiting, active, and recently finished matches."))}</p>
              </div>
            </div>
            <div class="social-checkers-room-list compact">
              ${myRooms.length ? myRooms.map((room) => checkersRoomCard(room, true)).join("") : `<div class="social-checkers-empty">${checkersEsc(checkersTr("РЈ РІР°СЃ РїРѕРєР° РЅРµС‚ РїР°СЂС‚РёР№. РќР°С‡РЅРёС‚Рµ РёРіСЂСѓ СЃ Р±РѕС‚РѕРј РёР»Рё СЃРѕР·РґР°Р№С‚Рµ СЃРІРѕСЋ РєРѕРјРЅР°С‚Сѓ.", "You have no games yet. Start with the bot or create your own room."))}</div>`}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head">
              <div>
                <span class="social-checkers-section-kicker">Top</span>
                <h5>${checkersEsc(checkersTr("Р›РёРґРµСЂС‹ СЂРµР№С‚РёРЅРіР°", "Top players"))}</h5>
                <p>${checkersEsc(checkersTr("РћР±С‰РёР№ СЂРµР№С‚РёРЅРі РїРѕ РїРѕР±РµРґР°Рј, РїРѕСЂР°Р¶РµРЅРёСЏРј Рё РєРѕР»РёС‡РµСЃС‚РІСѓ СЃС‹РіСЂР°РЅРЅС‹С… РїР°СЂС‚РёР№.", "Shared ranking by wins, losses, and total games played."))}</p>
              </div>
            </div>
            ${checkersLeaderboardPreview(leaderboard)}
          </section>
        </aside>
      </div>
    `;
    socialOpenModal(checkersTr("РЁР°С€РєРё", "Checkers"), html);
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
              <h5>${checkersEsc(checkersTr("Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ СЂРµР№С‚РёРЅРі РёРіСЂРѕРєРѕРІ", "Global leaderboard"))}</h5>
              <p>${checkersEsc(checkersTr("Р’СЃРµ РїРѕР»СЊР·РѕРІР°С‚РµР»Рё Рё СЃРѕС‚СЂСѓРґРЅРёРєРё РІ РѕРґРЅРѕР№ С‚Р°Р±Р»РёС†Рµ СЂРµР№С‚РёРЅРіР°.", "All users and employees in one shared ranking."))}</p>
            </div>
            <span class="social-checkers-badge soft">${checkersEsc(checkersTr("Р’Р°С€Рµ РјРµСЃС‚Рѕ", "Your rank"))}: ${data?.my_rank ? `#${Number(data.my_rank)}` : "-"}</span>
          </div>
          <div class="table-card social-checkers-scroll-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>${checkersEsc(checkersTr("РРіСЂРѕРє", "Player"))}</th>
                  <th>${checkersEsc(checkersTr("Р РµР№С‚РёРЅРі", "Rating"))}</th>
                  <th>${checkersEsc(checkersTr("РџРѕР±РµРґС‹", "Wins"))}</th>
                  <th>${checkersEsc(checkersTr("РџРѕСЂР°Р¶РµРЅРёСЏ", "Losses"))}</th>
                  <th>${checkersEsc(checkersTr("РќРёС‡СЊРё", "Draws"))}</th>
                  <th>${checkersEsc(checkersTr("РџР°СЂС‚РёР№", "Games"))}</th>
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
                `).join("") : `<tr><td colspan="7">${checkersEsc(checkersTr("РџРѕРєР° РЅРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ", "No results yet"))}</td></tr>`}
              </tbody>
            </table>
          </div>
          <div class="hint">${checkersEsc(checkersTr("Р’Р°С€ СЂРµР№С‚РёРЅРі", "Your rating"))}: <b>${Number(data?.my_rating || 1200)}</b></div>
          <div class="actions">
            <button type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("РќР°Р·Р°Рґ", "Back"))}</button>
          </div>
        </div>
      `;
      socialOpenModal(checkersTr("Р РµР№С‚РёРЅРі РёРіСЂРѕРєРѕРІ", "Leaderboard"), html);
      checkersArmModal();
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЂРµР№С‚РёРЅРі.", "Failed to load leaderboard.")), "error");
    }
  }

  function socialCheckersShowTips() {
    const html = `
      <div class="social-checkers-panel">
        <div class="hint">
          <b>${checkersEsc(checkersTr("РџСЂР°РІРёР»Р°", "Rules"))}</b><br />
          ${checkersEsc(checkersTr("1. Р‘РµР»С‹Рµ С…РѕРґСЏС‚ РїРµСЂРІС‹РјРё. РћР±С‹С‡РЅР°СЏ С€Р°С€РєР° С…РѕРґРёС‚ РїРѕ РґРёР°РіРѕРЅР°Р»Рё РІРїРµСЂРµРґ РЅР° РѕРґРЅСѓ РєР»РµС‚РєСѓ.", "1. White moves first. Men move diagonally forward by one square."))}<br />
          ${checkersEsc(checkersTr("2. Р СѓР±РєР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°. Р•СЃР»Рё РµСЃС‚СЊ РІР·СЏС‚РёРµ, РґРѕСЃС‚СѓРїРЅС‹ С‚РѕР»СЊРєРѕ Р°С‚Р°РєСѓСЋС‰РёРµ С…РѕРґС‹.", "2. Captures are mandatory. If a capture exists, only attacking moves are legal."))}<br />
          ${checkersEsc(checkersTr("3. РњРЅРѕР¶РµСЃС‚РІРµРЅРЅРѕРµ РІР·СЏС‚РёРµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РѕРґРЅРёРј С…РѕРґРѕРј: РІС‹Р±РµСЂРёС‚Рµ С€Р°С€РєСѓ Рё РєРѕРЅРµС‡РЅСѓСЋ РєР»РµС‚РєСѓ С†РµРїРѕС‡РєРё.", "3. Multi-capture is executed in one turn: select the piece and the final landing square."))}<br />
          ${checkersEsc(checkersTr("4. Р”РѕР№РґСЏ РґРѕ РїРѕСЃР»РµРґРЅРµР№ РіРѕСЂРёР·РѕРЅС‚Р°Р»Рё, С€Р°С€РєР° СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РґР°РјРєРѕР№.", "4. Reaching the last rank promotes the piece to a king."))}<br />
          ${checkersEsc(checkersTr("5. РџРѕР±РµР¶РґР°РµС‚ РёРіСЂРѕРє, РєРѕС‚РѕСЂС‹Р№ Р·Р°Р±СЂР°Р» РІСЃРµ С€Р°С€РєРё СЃРѕРїРµСЂРЅРёРєР° РёР»Рё Р»РёС€РёР» РµРіРѕ РґРѕРїСѓСЃС‚РёРјС‹С… С…РѕРґРѕРІ.", "5. You win by taking all enemy pieces or leaving the opponent with no legal moves."))}
        </div>
        <div class="actions">
          <button type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("РќР°Р·Р°Рґ", "Back"))}</button>
        </div>
      </div>
    `;
    socialOpenModal(checkersTr("РљР°Рє РёРіСЂР°С‚СЊ РІ С€Р°С€РєРё", "How to play Checkers"), html);
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
      checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°С‡Р°С‚СЊ РїР°СЂС‚РёСЋ СЃ РєРѕРјРїСЊСЋС‚РµСЂРѕРј.", "Failed to start the bot game.")), "error");
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
      checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РєРѕРјРЅР°С‚Сѓ.", "Failed to create the room.")), "error");
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
      checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ Рє РєРѕРјРЅР°С‚Рµ.", "Failed to join the room.")), "error");
    }
  }

  async function socialCheckersOpenRoom(roomId) {
    try {
      const room = await socialRequest(`/api/social/games/checkers/rooms/${Number(roomId || 0)}`);
      socialCheckersOpenRoomPayload(room);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ РєРѕРјРЅР°С‚Сѓ.", "Failed to open the room.")), "error");
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
          <span class="social-checkers-badge soft">${checkersEsc(safe.is_bot ? checkersTr("РљРѕРјРїСЊСЋС‚РµСЂ", "Bot") : checkersTr("РРіСЂРѕРє", "Player"))}</span>
        </div>
        <strong>${checkersEsc(safe.nick || "-")}</strong>
        <div class="social-checkers-player-meta">
          <span>${checkersEsc(checkersTr("Р РµР№С‚РёРЅРі", "Rating"))}: <b>${Number(safe.rating || 1200)}</b></span>
          <span>${checkersEsc(checkersTr("Рџ / РџРѕСЂ / Рќ", "W / L / D"))}: <b>${Number(safe.wins || 0)} / ${Number(safe.losses || 0)} / ${Number(safe.draws || 0)}</b></span>
        </div>
      </div>
    `;
  }

  function checkersHistoryRows(room) {
    const history = Array.isArray(room?.history) ? room.history.slice().reverse() : [];
    if (!history.length) {
      return `<div class="social-checkers-empty">${checkersEsc(checkersTr("РҐРѕРґС‹ РїРѕСЏРІСЏС‚СЃСЏ Р·РґРµСЃСЊ РїРѕСЃР»Рµ РЅР°С‡Р°Р»Р° РїР°СЂС‚РёРё.", "Moves will appear here after the game starts."))}</div>`;
    }
    return history.map((item) => {
      const moveLabel = Number(item.capture_count || 0) > 0 ? `x${Number(item.capture_count || 0)}` : checkersTr("С…РѕРґ", "move");
      return `
        <div class="social-checkers-history-row">
          <strong>${checkersEsc(checkersPlayerLabel(String(item.side || "white")))}</strong>
          <span>${checkersEsc(checkersPathText(item.path)) || "-"}</span>
          <small>${moveLabel}${item.promoted ? ` | ${checkersEsc(checkersTr("РґР°РјРєР°", "king"))}` : ""}</small>
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
    const boardSize = checkersBoardSize(room);
    const boardHtml = Array.from({ length: boardSize }, (_, displayRow) => {
      return Array.from({ length: boardSize }, (_, displayCol) => {
        const coords = checkersDisplayToBoardCoords(room, displayRow, displayCol);
        const rowIndex = Number(coords.row || 0);
        const colIndex = Number(coords.col || 0);
        const safeRow = Array.isArray(board[rowIndex]) ? board[rowIndex] : [];
        const piece = safeRow[colIndex];
        const key = `${rowIndex}:${colIndex}`;
        const dark = ((displayRow + displayCol) % 2) === 1;
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
    const roomTitle = room.title || checkersTr("РЁР°С€РєРё", "Checkers");
    const resultText = checkersResultText(room);
    const infoText = resultText || checkersRoomSummary(room);
    const myStatus = room.my_side
      ? (room.my_turn ? checkersTr("Р’Р°С€ С…РѕРґ", "Your move") : checkersTr("РҐРѕРґ СЃРѕРїРµСЂРЅРёРєР°", "Opponent move"))
      : (room.can_join ? checkersTr("РњРѕР¶РЅРѕ РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ", "Can join") : checkersTr("Р РµР¶РёРј РїСЂРѕСЃРјРѕС‚СЂР°", "Spectator mode"));
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
                  <span>${checkersEsc(checkersTr("РЎРѕР·РґР°РЅР°", "Created"))}: <b>${checkersEsc(checkersFormatDate(room.created_at))}</b></span>
                  <span>${checkersEsc(checkersTr("РћР±РЅРѕРІР»РµРЅРѕ", "Updated"))}: <b>${checkersEsc(checkersFormatDate(room.updated_at))}</b></span>
                </div>
              </div>
              <div class="social-checkers-turn-pill ${checkersEsc(String(room.turn || "white"))}">${checkersEsc(checkersPlayerLabel(String(room.turn || "white")))} | ${checkersEsc(myStatus)}</div>
            </div>
            ${infoText ? `<div class="social-checkers-note ${resultText ? "strong" : ""}">${checkersEsc(infoText)}</div>` : ""}
            <div class="social-checkers-board-wrap">
              <div class="social-checkers-board">${boardHtml}</div>
            </div>
            <div class="social-checkers-board-footer">
              <span>${checkersEsc(checkersTr("РџРѕСЃР»РµРґРЅРёР№ С…РѕРґ", "Last move"))}: <b>${checkersEsc(checkersPathText(room?.last_move?.path)) || "-"}</b></span>
              <span>${checkersEsc(checkersTr("Р РµР¶РёРј", "Mode"))}: <b>${checkersEsc(checkersRoomMode(room))}</b></span>
            </div>
          </section>
        </div>

        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel">
            <div class="social-checkers-section-head"><div><h5>${checkersEsc(checkersTr("РРіСЂРѕРєРё", "Players"))}</h5></div></div>
            <div class="social-checkers-players">
              ${checkersPlayerCard(white, "white", String(room.turn || "white") === "white")}
              ${checkersPlayerCard(black, "black", String(room.turn || "white") === "black")}
            </div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head"><div><h5>${checkersEsc(checkersTr("Р”РµР№СЃС‚РІРёСЏ", "Actions"))}</h5></div></div>
            <div class="actions social-checkers-actions-stack">
              ${room.can_join ? `<button type="button" onclick="socialCheckersJoinRoom(${Number(room.id || 0)})">${checkersEsc(checkersTr("РџРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ", "Join room"))}</button>` : ""}
              <button class="btn-secondary" type="button" onclick="socialCheckersRefreshRoom()">${checkersEsc(checkersTr("РћР±РЅРѕРІРёС‚СЊ РїРѕР·РёС†РёСЋ", "Refresh board"))}</button>
              <button class="btn-secondary" type="button" onclick="socialCheckersOpenMenu()">${checkersEsc(checkersTr("Рљ Р»РѕР±Р±Рё", "Back to lobby"))}</button>
              ${(room.my_side && (room.status === "waiting" || room.status === "active")) ? `<button type="button" onclick="socialCheckersLeaveRoom()">${checkersEsc(room.status === "waiting" ? checkersTr("Р—Р°РєСЂС‹С‚СЊ РєРѕРјРЅР°С‚Сѓ", "Close room") : checkersTr("РЎРґР°С‚СЊСЃСЏ", "Resign"))}</button>` : ""}
              ${(room.status === "finished" || room.status === "cancelled") ? `<button type="button" onclick="socialCheckersQuickStart('medium')">${checkersEsc(checkersTr("РќРѕРІР°СЏ РїР°СЂС‚РёСЏ СЃ РР", "New bot game"))}</button>` : ""}
            </div>
            <div class="hint">${checkersEsc(room.can_move ? checkersTr("РќР°Р¶РјРёС‚Рµ РЅР° СЃРІРѕСЋ С€Р°С€РєСѓ, Р·Р°С‚РµРј РЅР° РїРѕРґСЃРІРµС‡РµРЅРЅСѓСЋ РєР»РµС‚РєСѓ РЅР°Р·РЅР°С‡РµРЅРёСЏ.", "Tap your piece, then the highlighted destination square.") : checkersTr("Р•СЃР»Рё СЃРµР№С‡Р°СЃ С…РѕРґ РЅРµ РІР°С€, РїРѕР·РёС†РёСЏ РѕР±РЅРѕРІРёС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.", "If it is not your turn, the board will refresh automatically."))}</div>
          </section>

          <section class="social-checkers-panel">
            <div class="social-checkers-section-head"><div><h5>${checkersEsc(checkersTr("РСЃС‚РѕСЂРёСЏ С…РѕРґРѕРІ", "Move history"))}</h5></div></div>
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
        checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РєРѕРјРЅР°С‚Сѓ.", "Failed to refresh the room.")), "error");
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
      checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ С…РѕРґ.", "Failed to make the move.")), "error");
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
    const question = room.status === "waiting" ? checkersTr("Р—Р°РєСЂС‹С‚СЊ СЌС‚Сѓ РєРѕРјРЅР°С‚Сѓ?", "Close this room?") : checkersTr("РЎРґР°С‚СЊСЃСЏ РІ РїР°СЂС‚РёРё?", "Resign from this game?");
    if (!window.confirm(question)) return;
    try {
      const nextRoom = await socialRequest(`/api/social/games/checkers/rooms/${roomId}/leave`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      socialCheckersOpenRoomPayload(nextRoom);
    } catch (error) {
      checkersToast(checkersHumanError(error, checkersTr("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РІРµСЂС€РёС‚СЊ РєРѕРјРЅР°С‚Сѓ.", "Failed to finish the room.")), "error");
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
