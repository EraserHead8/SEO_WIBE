(function () {
  const state = { overview: null, room: null, pollTimer: null, selectedFrom: "", pendingMove: false };
  const pieces = { wK: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р Р†Р вЂљРЎСљ", wQ: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р Р†Р вЂљРЎС›", wR: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р Р†Р вЂљРІР‚Сљ", wB: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р Р†Р вЂљРІР‚Сњ", wN: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р вЂ™Р’В", wP: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р Р†РІР‚С›РЎС›", bK: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р РЋРІвЂћСћ", bQ: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р Р†Р вЂљРЎвЂќ", bR: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р РЋРЎв„ў", bB: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р РЋРЎС™", bN: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р РЋРІР‚С”", bP: "Р В Р вЂ Р Р†РІР‚С›РЎС›Р РЋРЎСџ" };
  const diffFallback = {
    easy: { code: "easy", title: "Р В Р’В Р Р†Р вЂљРЎвЂќР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ" },
    medium: { code: "medium", title: "Р В Р’В Р В Р вЂ№Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ" },
    hard: { code: "hard", title: "Р В Р’В Р В Р вЂ№Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ" },
    expert: { code: "expert", title: "Р В Р’В Р вЂ™Р’В­Р В Р’В Р РЋРІР‚СњР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ў" },
  };

  function t(ru, en) { return typeof tr === "function" ? tr(ru, en) : ru; }
  function esc(v) {
    if (typeof escapeHtml === "function") return escapeHtml(v == null ? "" : String(v));
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, kind = "info") {
    const title = kind === "error" ? t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“: Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°", "Chess: error") : t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Chess");
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
    if (s === "active") return t("Р В Р’В Р вЂ™Р’ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў", "Active");
    if (s === "finished") return t("Р В Р’В Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°", "Finished");
    if (s === "cancelled") return t("Р В Р’В Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°", "Cancelled");
    return t("Р В Р’В Р РЋРІР‚С”Р В Р’В Р вЂ™Р’В¶Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ", "Waiting");
  }
  function modeLabel(room) { return String(room?.mode || "human") === "bot" ? t("Р В Р’В Р В Р вЂ№ Р В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’В", "Bot") : t("Р В Р’В Р РЋРІР‚С”Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р’В Р В РІР‚В¦", "Online"); }
  function resultText(room) {
    const result = String(room?.result || "").trim().toLowerCase();
    const winner = String(room?.winner || "").trim().toLowerCase();
    if (result === "draw") return t("Р В Р’В Р РЋРЎСџР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р Р‹Р В Р вЂ°Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ.", "The game ended in a draw.");
    if (winner === "white") return t("Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚В.", "White wins.");
    if (winner === "black") return t("Р В Р’В Р вЂ™Р’В§Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚В.", "Black wins.");
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
    if (s === "waiting") return room?.can_join ? t("Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В° Р В Р’В Р вЂ™Р’В¶Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚Сћ Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°.", "Room waits for second player.") : t("Р В Р’В Р РЋРІР‚С”Р В Р’В Р вЂ™Р’В¶Р В Р’В Р РЋРІР‚ВР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°.", "Waiting for opponent.");
    if (s === "active") return room?.my_turn ? t("Р В Р’В Р Р†Р вЂљРІвЂћСћР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†РІР‚С™Р’В¬ Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В.", "Your move.") : t("Р В Р’В Р СћРЎвЂ™Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°.", "Opponent move.");
    return t("Р В Р’В Р РЋРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљР Р‹ Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљР’В¦Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦ Р В Р’В Р В РІР‚В  Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В.", "Match is saved in history.");
  }

  function findRoomById(roomId) {
    const id = Number(roomId || 0);
    if (!id) return null;
    if (Number(state.room?.id || 0) === id) return state.room;
    const groups = [state.overview?.rooms?.mine, state.overview?.rooms?.public];
    for (const list of groups) {
      if (!Array.isArray(list)) continue;
      const match = list.find((room) => Number(room?.id || 0) === id);
      if (match) return match;
    }
    return null;
  }

  function roomCard(room, mine) {
    const players = room?.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const id = Number(room?.id || 0);
    const action = room?.can_join ? `socialChessJoinRoom(${id})` : `socialChessOpenRoom(${id})`;
    const openLabel = mine ? t("Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°", "Open") : (room?.can_join ? t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р РЏ", "Join") : t("Р В Р’В Р В Р вЂ№Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°", "View"));
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
            <div class="social-checkers-room-code">#${esc(room?.room_code || "-")} | ${esc(t("Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°", "Created"))}: ${esc(dt(room?.created_at))}</div>
          </div>
          <div class="social-checkers-room-actions actions"><button type="button" onclick="${action}">${esc(openLabel)}</button>${room?.can_delete ? `<button class="btn-danger" type="button" onclick="socialChessDeleteRoom(${id})">${esc(t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"))}</button>` : ""}</div>
        </div>
        <div class="social-checkers-room-meta">
          <span>${esc(t("Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "White"))}: <b>${esc(white.nick || "-")}</b></span>
          <span>${esc(t("Р В Р’В Р вЂ™Р’В§Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "Black"))}: <b>${esc(black.nick || "-")}</b></span>
          <span>${esc(t("Р В Р’В Р РЋРІР‚С”Р В Р’В Р вЂ™Р’В±Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ", "Updated"))}: <b>${esc(dt(room?.updated_at || room?.last_move_at || room?.created_at))}</b></span>
        </div>
        <div class="social-checkers-room-note">${esc(roomSummary(room))}</div>
      </article>
    `;
  }

  function leaderboardPreview(rows) {
    const list = Array.isArray(rows) ? rows.slice(0, 8) : [];
    if (!list.length) return `<div class="social-checkers-empty">${esc(t("Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ў.", "Leaderboard is empty."))}</div>`;
    return `
      <div class="social-checkers-rank-list">
        ${list.map((row) => `
          <div class="social-checkers-rank-row ${row.is_me ? "social-me-row" : ""}">
            <div class="social-checkers-rank-main">
              <span class="social-checkers-rank-pill">#${Number(row.rank || 0)}</span>
              <div class="social-checkers-rank-meta">
                <strong>${esc(row.nick || "-")}</strong>
                <small>${esc(t("Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ", "Rating"))}: ${Number(row.rating || 1200)} | ${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ", "Games"))}: ${Number(row.play_count || 0)}</small>
              </div>
            </div>
            <div class="social-checkers-rank-stats"><span>${esc(t("Р В Р’В Р РЋРЎСџ", "W"))}: <b>${Number(row.wins || 0)}</b></span><span>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™", "L"))}: <b>${Number(row.losses || 0)}</b></span></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function socialChessOpenMenu() {
    socialOpenModal(t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Chess"), `<div class="social-checkers-loading">${esc(t("Р В Р’В Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚в„– Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚В Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ў...", "Loading chess lobby..."))}</div>`);
    arm();
    try {
      state.overview = await socialRequest("/api/social/games/chess/overview");
      state.room = null;
      state.selectedFrom = "";
      renderMenu();
    } catch (e) {
      socialOpenModal(t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Chess"), `<div class="social-checkers-panel"><div class="hint">${esc(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“.", "Failed to open chess.")))}</div><div class="actions"><button type="button" onclick="socialChessOpenMenu()">${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°", "Retry"))}</button><button class="btn-secondary" type="button" onclick="socialCloseModal()">${esc(t("Р В Р’В Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°", "Close"))}</button></div></div>`);
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
    const defaultTitle = profile.nick ? `${t("Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°", "Room")} ${profile.nick}` : t("Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°", "Public room");
    socialOpenModal(
      t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Chess"),
      `
      <div class="social-checkers-shell lobby-view">
        <section class="social-checkers-main">
          <article class="social-checkers-panel social-checkers-hero"><div class="social-checkers-hero-main"><div class="social-checkers-hero-copy"><span class="social-checkers-section-kicker">${esc(t("Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ", "Global ladder"))}</span><h4>${esc(t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ SEO WIBE", "SEO WIBE Chess"))}</h4><p>${esc(t("Р В Р’В Р РЋРІР‚С”Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р’В Р В РІР‚В¦-Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚В, Р В Р’В Р вЂ™Р’ВР В Р’В Р вЂ™Р’В-Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р Р‹Р Р†Р вЂљР’В°Р В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В¶Р В Р’В Р СћРІР‚ВР В Р Р‹Р РЋРІР‚Сљ Р В Р’В Р В РІР‚В Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏР В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚В Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В.", "Online lobby, AI levels and global ranking for all users and teammates."))}</p></div><div class="social-checkers-stats"><div class="social-checkers-stat"><span>${esc(t("Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ", "Rating"))}</span><strong>${Number(profile.rating || 1200)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Wins"))}</span><strong>${Number(profile.wins || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ", "Losses"))}</span><strong>${Number(profile.losses || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Р В Р’В Р РЋРЎС™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р Р‹Р В Р вЂ°Р В Р’В Р РЋРІР‚В", "Draws"))}</span><strong>${Number(profile.draws || 0)}</strong></div></div></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’В Р Р†Р вЂљР’ВР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ў", "Quick start"))}</h5></div></div><div class="social-checkers-create-grid"><label class="social-checkers-input-card"><span>${esc(t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Room title"))}</span><input id="socialChessRoomTitle" type="text" maxlength="120" value="${esc(defaultTitle)}" /></label><label class="social-checkers-input-card"><span>${esc(t("Р В Р’В Р В Р вЂ№Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р вЂ™Р’ВР В Р’В Р вЂ™Р’В", "Bot difficulty"))}</span><select id="socialChessDifficulty">${difficulties.map((d)=>`<option value="${esc(d.code)}">${esc(d.title || d.code)}</option>`).join("")}</select></label></div><div class="actions social-checkers-create-actions"><button type="button" onclick="socialChessCreateRoom('bot')">${esc(t("Р В Р’В Р вЂ™Р’ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р Р‹Р В РЎвЂњ Р В Р’В Р вЂ™Р’ВР В Р’В Р вЂ™Р’В", "Play vs AI"))}</button><button type="button" onclick="socialChessCreateRoom('human')">${esc(t("Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р’В Р В РІР‚В¦-Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚Сљ", "Create online room"))}</button><button class="btn-secondary" type="button" onclick="socialChessShowLeaderboard()">${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ", "Full leaderboard"))}</button></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’В Р РЋРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "My rooms"))}</h5></div></div><div class="social-checkers-room-list">${myRooms.length ? myRooms.map((r)=>roomCard(r,true)).join("") : `<div class="social-checkers-empty">${esc(t("Р В Р’В Р В РІвЂљВ¬ Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РЎвЂњ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚СњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљР’В¦ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ў.", "You have no active rooms."))}</div>`}</div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’В Р РЋРІР‚С”Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Public rooms"))}</h5></div></div><div class="social-checkers-room-list">${publicRooms.length ? publicRooms.map((r)=>roomCard(r,false)).join("") : `<div class="social-checkers-empty">${esc(t("Р В Р’В Р В Р вЂ№Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РЎвЂњ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљР’В¦ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ў.", "No public rooms."))}</div>`}</div></article>
        </section>
        <aside class="social-checkers-sidebar"><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’В Р РЋРЎвЂєР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚вЂќ Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В ", "Top players"))}</h5></div></div>${leaderboardPreview(leaderboard)}</section><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В", "Tips"))}</h5></div></div><div class="hint">${esc(t("Р В Р’В Р Р†Р вЂљРЎСљР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†РІР‚С™Р’В¬ Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў.", "Board auto-flips to your side."))}</div><div class="actions social-checkers-actions-stack"><button class="btn-secondary" type="button" onclick="socialChessShowTips()">${esc(t("Р В Р’В Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚Сњ Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°", "How to play"))}</button></div></section></aside>
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
      toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚Сљ.", "Failed to create room.")), "error");
    }
  }

  async function socialChessJoinRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/chess/rooms/${id}/join`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚Сњ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’Вµ.", "Failed to join room.")), "error"); }
  }

  async function socialChessOpenRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/chess/rooms/${id}`)); }
    catch (e) { toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚Сљ.", "Failed to open room.")), "error"); }
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
    return `<article class="social-checkers-player ${active ? "active" : ""}"><div class="social-checkers-room-badges"><span class="social-checkers-badge ${esc(side)}">${esc(side === "white" ? t("Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "White") : t("Р В Р’В Р вЂ™Р’В§Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "Black"))}</span>${p.is_bot ? `<span class="social-checkers-badge bot">${esc(t("Р В Р’В Р вЂ™Р’ВР В Р’В Р вЂ™Р’В", "AI"))}</span>` : ""}</div><strong>${esc(p.nick || "-")}</strong><div class="social-checkers-player-meta"><span>${esc(t("Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ", "Rating"))}: <b>${Number(p.rating || 1200)}</b></span><span>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ", "Games"))}: <b>${Number(p.play_count || 0)}</b></span></div></article>`;
  }

  function historyRows(room) {
    const rows = Array.isArray(room?.history) ? room.history.slice().reverse().slice(0, 24) : [];
    if (!rows.length) return `<div class="social-checkers-empty">${esc(t("Р В Р’В Р вЂ™Р’ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚вЂќР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В Р РЏ.", "No moves yet."))}</div>`;
    return rows.map((m, idx) => `<div class="social-checkers-history-row"><strong>${Number(rows.length - idx)}</strong><div><span>${esc(String(m?.side || "") === "white" ? t("Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "White") : t("Р В Р’В Р вЂ™Р’В§Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "Black"))}: <b>${esc(historyText(m))}</b></span><small>${esc(dt(m?.at || ""))}</small></div></div>`).join("");
  }

  function openRoomPayload(room) {
    if (!room || typeof room !== "object") { toast(t("Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В° Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚вЂќР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°.", "Room unavailable."), "error"); return; }
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
    const title = String(room.title || `${t("Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°", "Room")} ${room.room_code || ""}`).trim();
    const note = resultText(room) || String(room.note || "").trim();
    const myStatus = room.my_side ? (String(room.my_side) === "white" ? t("Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "White") : t("Р В Р’В Р вЂ™Р’В§Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "Black")) : t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°", "Viewer");
    socialOpenModal(title, `
      <div class="social-checkers-shell">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-board-card">
            <div class="social-checkers-room-head compact"><div class="social-checkers-room-title-wrap"><div class="social-checkers-room-badges"><span class="social-checkers-badge ${esc(String(room.status || "waiting"))}">${esc(statusLabel(room.status))}</span><span class="social-checkers-badge ${String(room.mode || "human") === "bot" ? "bot" : "human"}">${esc(modeLabel(room))}</span>${String(room.mode || "human") === "bot" ? `<span class="social-checkers-badge soft">${esc(difficultyTitle(room.difficulty))}</span>` : ""}</div><strong class="social-checkers-room-title">${esc(title)}</strong><div class="social-checkers-room-meta"><span>#${esc(room.room_code || "-")}</span><span>${esc(t("Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°", "Created"))}: <b>${esc(dt(room.created_at))}</b></span><span>${esc(t("Р В Р’В Р РЋРІР‚С”Р В Р’В Р вЂ™Р’В±Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ", "Updated"))}: <b>${esc(dt(room.updated_at))}</b></span></div></div><div class="social-checkers-turn-pill ${esc(String(room.turn || "white"))}">${esc(String(room.turn || "white") === "white" ? t("Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "White") : t("Р В Р’В Р вЂ™Р’В§Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", "Black"))} | ${esc(myStatus)}</div></div>
            ${note ? `<div class="social-checkers-note ${resultText(room) ? "strong" : ""}">${esc(note)}</div>` : ""}
            <div class="social-checkers-board-wrap"><div class="social-checkers-board">${boardHtml}</div></div>
            <div class="social-checkers-board-footer"><span>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В", "Last move"))}: <b>${esc(historyText(room?.last_move)) || "-"}</b></span><span>${esc(t("Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В¶Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋР’В", "Mode"))}: <b>${esc(modeLabel(room))}</b></span></div>
          </section>
        </div>
        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’В Р вЂ™Р’ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В", "Players"))}</h5></div></div><div class="social-checkers-players">${playerCard(white, "white", String(room.turn || "white") === "white")}${playerCard(black, "black", String(room.turn || "white") === "black")}</div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Действия", "Actions"))}</h5></div></div><div class="actions social-checkers-actions-stack">${room.can_join ? `<button type="button" onclick="socialChessJoinRoom(${Number(room.id || 0)})">${esc(t("Подключиться", "Join room"))}</button>` : ""}<button class="btn-secondary" type="button" onclick="socialChessRefreshRoom()">${esc(t("Обновить", "Refresh"))}</button><button class="btn-secondary" type="button" onclick="socialChessOpenMenu()">${esc(t("К лобби", "Back to lobby"))}</button>${(room.my_side && (room.status === "waiting" || room.status === "active")) ? `<button type="button" onclick="socialChessLeaveRoom()">${esc(room.status === "waiting" ? t("Закрыть комнату", "Close room") : t("Сдаться", "Resign"))}</button>` : ""}${room.can_delete ? `<button class="btn-danger" type="button" onclick="socialChessDeleteRoom(${Number(room.id || 0)})">${esc(t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443", "Delete room"))}</button>` : ""}</div><div class="hint">${esc(room.can_move ? t("Нажмите фигуру и выберите клетку назначения.", "Tap piece then destination square.") : t("Если ход не ваш, позиция обновится автоматически.", "If not your turn, board refreshes automatically."))}</div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’В Р вЂ™Р’ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В ", "Move history"))}</h5></div></div><div class="social-checkers-history">${historyRows(room)}</div></section>
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
    catch (e) { if (!silent) toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚Сљ.", "Failed to refresh room.")), "error"); }
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
      toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В.", "Failed to make move.")), "error");
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
    const ask = room.status === "waiting" ? t("Р В Р’В Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚СњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р Р‹Р В Р Р‰Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚Сљ Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚Сљ?", "Close this room?") : t("Р В Р’В Р В Р вЂ№Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р РЏ Р В Р’В Р В РІР‚В  Р В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚В?", "Resign from this match?");
    if (!window.confirm(ask)) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/chess/rooms/${id}/leave`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚Сљ.", "Failed to finish room.")), "error"); }
  }

  async function socialChessDeleteRoom(roomId = 0) {
    const id = Number(roomId || state.room?.id || 0);
    if (!id) return;
    const room = findRoomById(id) || state.room || {};
    const title = String(room?.title || room?.room_code || "").trim();
    const ask = title
      ? t(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443 "${title}"?`, `Delete room "${title}"?`)
      : t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0443 \u043a\u043e\u043c\u043d\u0430\u0442\u0443?", "Delete this room?");
    if (!window.confirm(ask)) return;
    try {
      await socialRequest(`/api/social/games/chess/rooms/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      state.room = null;
      state.selectedFrom = "";
      await socialChessOpenMenu();
    } catch (e) {
      toast(humanError(e, t("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443.", "Failed to delete room.")), "error");
    }
  }

  function socialChessShowTips() {
    socialOpenModal(t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“: Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚Сњ Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ°", "Chess: how to play"), `<div class="social-checkers-panel"><div class="hint">${esc(t("1) Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р Р‹Р В Р РЏР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚В. Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В¶Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р Р†Р вЂљРЎвЂєР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РІР‚С™Р В Р Р‹Р РЋРІР‚Сљ Р В Р’В Р РЋРІР‚В Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р РЋР’В Р В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СњР В Р Р‹Р РЋРІР‚Сљ Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ.", "1) White moves first. Tap a piece then destination."))}</div><div class="hint">${esc(t("2) Р В Р’В Р Р†Р вЂљРІвЂћСћ Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚СћР В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р РЏ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†РІР‚С™Р’В¬ Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў.", "2) In online games board is flipped to your color."))}</div><div class="hint">${esc(t("3) Р В Р’В Р Р†Р вЂљРІвЂћСћ Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В±Р В Р’В Р РЋРІР‚В Р В Р’В Р СћРІР‚ВР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚вЂќР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ Р В Р’В Р вЂ™Р’ВР В Р’В Р вЂ™Р’В-Р В Р Р‹Р РЋРІР‚СљР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚В Р В Р’В Р РЋРІР‚вЂњР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р Р†РІР‚С›РІР‚вЂњ Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ.", "3) Lobby has AI levels and global ranking."))}</div><div class="actions"><button type="button" onclick="socialChessOpenMenu()">${esc(t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р СћРІР‚В", "Back"))}</button></div></div>`);
    arm();
  }

  async function socialChessShowLeaderboard() {
    try {
      const data = await socialRequest("/api/social/games/chess/leaderboard?limit=100");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      socialOpenModal(t("Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ў", "Chess leaderboard"), `<div class="social-checkers-scroll-table"><table><thead><tr><th>#</th><th>${esc(t("Р В Р’В Р вЂ™Р’ВР В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚Сњ", "Player"))}</th><th>${esc(t("Р В Р’В Р вЂ™Р’В Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ", "Rating"))}</th><th>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’ВµР В Р’В Р СћРІР‚ВР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Wins"))}</th><th>${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ", "Losses"))}</th><th>${esc(t("Р В Р’В Р РЋРЎС™Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР Р‹Р В Р Р‹Р В Р вЂ°Р В Р’В Р РЋРІР‚В", "Draws"))}</th></tr></thead><tbody>${rows.length ? rows.map((r)=>`<tr class="${r.is_me ? "social-me-row" : ""}"><td>${Number(r.rank || 0)}</td><td>${esc(r.nick || "-")}</td><td>${Number(r.rating || 1200)}</td><td>${Number(r.wins || 0)}</td><td>${Number(r.losses || 0)}</td><td>${Number(r.draws || 0)}</td></tr>`).join("") : `<tr><td colspan="6">${esc(t("Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В° Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ў Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В·Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В ", "No results yet"))}</td></tr>`}</tbody></table></div><div class="hint">${esc(t("Р В Р’В Р Р†Р вЂљРІвЂћСћР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚Сћ", "Your rank"))}: <b>${data?.my_rank ? `#${Number(data.my_rank)}` : "Р В Р вЂ Р В РІР‚С™Р Р†Р вЂљРЎСљ"}</b> | ${esc(t("Р В Р’В Р Р†Р вЂљРІвЂћСћР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†РІР‚С™Р’В¬ Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ", "Your rating"))}: <b>${Number(data?.my_rating || 1200)}</b></div><div class="actions"><button type="button" onclick="socialChessOpenMenu()">${esc(t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р СћРІР‚В", "Back"))}</button></div>`);
      arm();
    } catch (e) {
      toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚вЂњР В Р Р‹Р В РІР‚С™Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚вЂњ.", "Failed to load leaderboard.")), "error");
    }
  }

  function socialChessQuickStart(level = "medium") {
    const difficulty = String(level || "medium").trim().toLowerCase() || "medium";
    socialOpenModal(t("Р В Р’В Р В Р С“Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В¦Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“", "Chess"), `<div class="social-checkers-loading">${esc(t("Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚в„– Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљР Р‹ Р В Р Р‹Р В РЎвЂњ Р В Р’В Р вЂ™Р’ВР В Р’В Р вЂ™Р’В...", "Creating AI match..."))}</div>`);
    arm();
    socialRequest("/api/social/games/chess/rooms", { method: "POST", body: JSON.stringify({ mode: "bot", difficulty, is_public: false }) })
      .then((room) => openRoomPayload(room))
      .catch((e) => { toast(humanError(e, t("Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’Вµ Р В Р Р‹Р РЋРІР‚СљР В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ° Р В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В Р вЂ° Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљР Р‹ Р В Р Р‹Р В РЎвЂњ Р В Р’В Р вЂ™Р’ВР В Р’В Р вЂ™Р’В.", "Failed to create AI match.")), "error"); socialChessOpenMenu(); });
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
  window.socialChessDeleteRoom = socialChessDeleteRoom;
})();
