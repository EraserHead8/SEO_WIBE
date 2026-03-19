(function () {
  const state = { overview: null, room: null, pollTimer: null, pendingShot: false };
  const diffFallback = {
    easy: { code: "easy", title: "Р В РІР‚С”Р В Р’ВµР В РЎвЂ“Р В РЎвЂќР В РЎвЂР В РІвЂћвЂ“" },
    medium: { code: "medium", title: "Р В Р Р‹Р РЋР вЂљР В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“" },
    hard: { code: "hard", title: "Р В Р Р‹Р В Р’В»Р В РЎвЂўР В Р’В¶Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“" },
    expert: { code: "expert", title: "Р В Р’В­Р В РЎвЂќР РЋР С“Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР РЋРІР‚С™" },
  };

  function t(ru, en) { return typeof tr === "function" ? tr(ru, en) : ru; }
  function esc(v) {
    if (typeof escapeHtml === "function") return escapeHtml(v == null ? "" : String(v));
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, kind = "info") {
    const title = kind === "error" ? t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“: Р В РЎвЂўР РЋРІвЂљВ¬Р В РЎвЂР В Р’В±Р В РЎвЂќР В Р’В°", "Battleship: error") : t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“", "Battleship");
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
    if (s === "active") return t("Р В Р’ВР В РЎвЂ“Р РЋР вЂљР В Р’В° Р В РЎвЂР В РўвЂР В Р’ВµР РЋРІР‚С™", "Active");
    if (s === "finished") return t("Р В РІР‚вЂќР В Р’В°Р В Р вЂ Р В Р’ВµР РЋР вЂљР РЋРІвЂљВ¬Р В Р’ВµР В Р вЂ¦Р В Р’В°", "Finished");
    if (s === "cancelled") return t("Р В РІР‚вЂќР В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р В Р’В°", "Cancelled");
    return t("Р В РЎвЂєР В Р’В¶Р В РЎвЂР В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ", "Waiting");
  }
  function modeLabel(room) { return String(room?.mode || "human") === "bot" ? t("Р В Р Р‹ Р В Р’В±Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂўР В РЎВ", "Bot") : t("Р В РЎвЂєР В Р вЂ¦Р В Р’В»Р В Р’В°Р В РІвЂћвЂ“Р В Р вЂ¦", "Online"); }
  function resultText(room) {
    const result = String(room?.result || "").trim().toLowerCase();
    const winner = String(room?.winner || "").trim().toLowerCase();
    if (result === "draw") return t("Р В РЎС™Р В Р’В°Р РЋРІР‚С™Р РЋРІР‚РЋ Р В Р’В·Р В Р’В°Р В Р вЂ Р В Р’ВµР РЋР вЂљР РЋРІвЂљВ¬Р В РЎвЂР В Р’В»Р РЋР С“Р РЋР РЏ Р В Р вЂ¦Р В РЎвЂР РЋРІР‚РЋР РЋР Р‰Р В Р’ВµР В РІвЂћвЂ“.", "The match ended in a draw.");
    if (winner === "white") return t("Р В РІР‚ВР В Р’ВµР В Р’В»Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋРІР‚С›Р В Р’В»Р В РЎвЂўР РЋРІР‚С™ Р В РЎвЂ”Р В РЎвЂўР В Р’В±Р В Р’ВµР В РўвЂР В РЎвЂР В Р’В».", "White fleet wins.");
    if (winner === "black") return t("Р В Р’В§Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋРІР‚С›Р В Р’В»Р В РЎвЂўР РЋРІР‚С™ Р В РЎвЂ”Р В РЎвЂўР В Р’В±Р В Р’ВµР В РўвЂР В РЎвЂР В Р’В».", "Black fleet wins.");
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
    if (s === "waiting") return room?.can_join ? t("Р В РЎв„ўР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р В Р’В° Р В Р’В¶Р В РўвЂР В Р’ВµР РЋРІР‚С™ Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂўР В РЎвЂ“Р В РЎвЂў Р В РЎвЂР В РЎвЂ“Р РЋР вЂљР В РЎвЂўР В РЎвЂќР В Р’В°.", "Room waits for second player.") : t("Р В РЎвЂєР В Р’В¶Р В РЎвЂР В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋР С“Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В Р’В°.", "Waiting for opponent.");
    if (s === "active") return room?.my_turn ? t("Р В РІР‚в„ўР В Р’В°Р РЋРІвЂљВ¬ Р В Р’В·Р В Р’В°Р В Р’В»Р В РЎвЂ”. Р В РІР‚в„ўР РЋРІР‚в„–Р В Р’В±Р В Р’ВµР РЋР вЂљР В РЎвЂР РЋРІР‚С™Р В Р’Вµ Р В РЎвЂќР В Р’В»Р В Р’ВµР РЋРІР‚С™Р В РЎвЂќР РЋРЎвЂњ Р В Р вЂ¦Р В Р’В° Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р’Вµ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР РЋРІР‚С™Р В РЎвЂР В Р вЂ Р В Р вЂ¦Р В РЎвЂР В РЎвЂќР В Р’В°.", "Your shot. Choose a cell on enemy board.") : t("Р В РўС’Р В РЎвЂўР В РўвЂ Р РЋР С“Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В Р’В°. Р В РЎСџР В РЎвЂўР В Р’В»Р В Р’Вµ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚С™Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р В РЎвЂќР В РЎвЂ.", "Opponent move. Board refreshes automatically.");
    return t("Р В РЎС™Р В Р’В°Р РЋРІР‚С™Р РЋРІР‚РЋ Р РЋР С“Р В РЎвЂўР РЋРІР‚В¦Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’ВµР В Р вЂ¦ Р В Р вЂ  Р В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР В РЎвЂ.", "Match is saved in history.");
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
    const action = room?.can_join ? `socialBattleshipJoinRoom(${id})` : `socialBattleshipOpenRoom(${id})`;
    const openLabel = mine ? t("Р В РЎвЂєР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰", "Open") : (room?.can_join ? t("Р В РЎСџР В РЎвЂўР В РўвЂР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В РЎвЂР РЋРІР‚С™Р РЋР Р‰Р РЋР С“Р РЋР РЏ", "Join") : t("Р В Р Р‹Р В РЎВР В РЎвЂўР РЋРІР‚С™Р РЋР вЂљР В Р’ВµР РЋРІР‚С™Р РЋР Р‰", "View"));
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
            <div class="social-checkers-room-code">#${esc(room?.room_code || "-")} | ${esc(t("Р В Р Р‹Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В Р’В°", "Created"))}: ${esc(dt(room?.created_at))}</div>
          </div>
          <div class="social-checkers-room-actions actions"><button type="button" onclick="${action}">${esc(openLabel)}</button>${room?.can_delete ? `<button class="btn-danger" type="button" onclick="socialBattleshipDeleteRoom(${id})">${esc(t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Delete"))}</button>` : ""}</div>
        </div>
        <div class="social-checkers-room-meta">
          <span>${esc(t("Р В РІР‚ВР В Р’ВµР В Р’В»Р РЋРІР‚в„–Р В РІвЂћвЂ“", "White"))}: <b>${esc(white.nick || "-")}</b></span>
          <span>${esc(t("Р В Р’В§Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“", "Black"))}: <b>${esc(black.nick || "-")}</b></span>
          <span>${esc(t("Р В РЎвЂєР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂў", "Updated"))}: <b>${esc(dt(room?.updated_at || room?.last_move_at || room?.created_at))}</b></span>
        </div>
        <div class="social-checkers-room-note">${esc(roomSummary(room))}</div>
      </article>
    `;
  }

  function leaderboardPreview(rows) {
    const list = Array.isArray(rows) ? rows.slice(0, 8) : [];
    if (!list.length) return `<div class="social-checkers-empty">${esc(t("Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В° Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™.", "Leaderboard is empty."))}</div>`;
    return `<div class="social-checkers-rank-list">${list.map((row)=>`<div class="social-checkers-rank-row ${row.is_me ? "social-me-row" : ""}"><div class="social-checkers-rank-main"><span class="social-checkers-rank-pill">#${Number(row.rank || 0)}</span><div class="social-checkers-rank-meta"><strong>${esc(row.nick || "-")}</strong><small>${esc(t("Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Rating"))}: ${Number(row.rating || 1200)} | ${esc(t("Р В РЎСџР В Р’В°Р РЋР вЂљР РЋРІР‚С™Р В РЎвЂР В РІвЂћвЂ“", "Games"))}: ${Number(row.play_count || 0)}</small></div></div><div class="social-checkers-rank-stats"><span>${esc(t("Р В РЎСџ", "W"))}: <b>${Number(row.wins || 0)}</b></span><span>${esc(t("Р В РЎСџР В РЎвЂўР РЋР вЂљ", "L"))}: <b>${Number(row.losses || 0)}</b></span></div></div>`).join("")}</div>`;
  }

  async function socialBattleshipOpenMenu() {
    socialOpenModal(t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“", "Battleship"), `<div class="social-checkers-loading">${esc(t("Р В РІР‚вЂќР В Р’В°Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В¶Р В Р’В°Р РЋР вЂ№ Р В Р’В»Р В РЎвЂўР В Р’В±Р В Р’В±Р В РЎвЂ Р В РЎВР В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РЎвЂ“Р В РЎвЂў Р В Р’В±Р В РЎвЂўР РЋР РЏ...", "Loading battleship lobby..."))}</div>`);
    arm();
    try {
      state.overview = await socialRequest("/api/social/games/battleship/overview");
      state.room = null;
      renderMenu();
    } catch (e) {
      socialOpenModal(t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“", "Battleship"), `<div class="social-checkers-panel"><div class="hint">${esc(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎВР В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“.", "Failed to open battleship.")))}</div><div class="actions"><button type="button" onclick="socialBattleshipOpenMenu()">${esc(t("Р В РЎСџР В РЎвЂўР В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋРІР‚С™Р РЋР Р‰", "Retry"))}</button><button class="btn-secondary" type="button" onclick="socialCloseModal()">${esc(t("Р В РІР‚вЂќР В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰", "Close"))}</button></div></div>`);
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
    const defaultTitle = profile.nick ? `${t("Р В РЎв„ўР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р В Р’В°", "Room")} ${profile.nick}` : t("Р В РЎвЂєР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р В Р’В°Р РЋР РЏ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р В Р’В°", "Public room");
    socialOpenModal(t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“", "Battleship"), `
      <div class="social-checkers-shell lobby-view">
        <section class="social-checkers-main">
          <article class="social-checkers-panel social-checkers-hero"><div class="social-checkers-hero-main"><div class="social-checkers-hero-copy"><span class="social-checkers-section-kicker">${esc(t("Р В РІР‚СљР В Р’В»Р В РЎвЂўР В Р’В±Р В Р’В°Р В Р’В»Р РЋР Р‰Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Global ladder"))}</span><h4>${esc(t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“ SEO WIBE", "SEO WIBE Battleship"))}</h4><p>${esc(t("Р В Р Р‹Р В Р’ВµР РЋРІР‚С™Р В Р’ВµР В Р вЂ Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРІР‚в„–, Р В Р’ВР В Р’В-Р РЋРЎвЂњР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р вЂ¦Р В РЎвЂ Р В РЎвЂ Р В РЎвЂўР В Р’В±Р РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“ Р В РЎвЂ”Р В РЎвЂўР В Р’В±Р В Р’ВµР В РўвЂ/Р В РЎвЂ”Р В РЎвЂўР РЋР вЂљР В Р’В°Р В Р’В¶Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“.", "Network rooms, AI levels and global W/L rating."))}</p></div><div class="social-checkers-stats"><div class="social-checkers-stat"><span>${esc(t("Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Rating"))}</span><strong>${Number(profile.rating || 1200)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Р В РЎСџР В РЎвЂўР В Р’В±Р В Р’ВµР В РўвЂР РЋРІР‚в„–", "Wins"))}</span><strong>${Number(profile.wins || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Р В РЎСџР В РЎвЂўР РЋР вЂљР В Р’В°Р В Р’В¶Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ", "Losses"))}</span><strong>${Number(profile.losses || 0)}</strong></div><div class="social-checkers-stat"><span>${esc(t("Р В РЎСљР В РЎвЂР РЋРІР‚РЋР РЋР Р‰Р В РЎвЂ", "Draws"))}</span><strong>${Number(profile.draws || 0)}</strong></div></div></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В РІР‚ВР РЋРІР‚в„–Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋР вЂљР РЋРІР‚С™", "Quick start"))}</h5></div></div><div class="social-checkers-create-grid"><label class="social-checkers-input-card"><span>${esc(t("Р В РЎСљР В Р’В°Р В Р’В·Р В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРІР‚в„–", "Room title"))}</span><input id="socialBattleshipRoomTitle" type="text" maxlength="120" value="${esc(defaultTitle)}" /></label><label class="social-checkers-input-card"><span>${esc(t("Р В Р Р‹Р В Р’В»Р В РЎвЂўР В Р’В¶Р В Р вЂ¦Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р В Р’ВР В Р’В", "Bot difficulty"))}</span><select id="socialBattleshipDifficulty">${difficulties.map((d)=>`<option value="${esc(d.code)}">${esc(d.title || d.code)}</option>`).join("")}</select></label></div><div class="actions social-checkers-create-actions"><button type="button" onclick="socialBattleshipCreateRoom('bot')">${esc(t("Р В Р’ВР В РЎвЂ“Р РЋР вЂљР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р РЋР С“ Р В Р’ВР В Р’В", "Play vs AI"))}</button><button type="button" onclick="socialBattleshipCreateRoom('human')">${esc(t("Р В Р Р‹Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂўР В Р вЂ¦Р В Р’В»Р В Р’В°Р В РІвЂћвЂ“Р В Р вЂ¦-Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњ", "Create online room"))}</button><button class="btn-secondary" type="button" onclick="socialBattleshipShowLeaderboard()">${esc(t("Р В РЎСџР В РЎвЂўР В Р’В»Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Full leaderboard"))}</button></div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В РЎС™Р В РЎвЂўР В РЎвЂ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРІР‚в„–", "My rooms"))}</h5></div></div><div class="social-checkers-room-list">${myRooms.length ? myRooms.map((r)=>roomCard(r,true)).join("") : `<div class="social-checkers-empty">${esc(t("Р В Р в‚¬ Р В Р вЂ Р В Р’В°Р РЋР С“ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В° Р В Р вЂ¦Р В Р’ВµР РЋРІР‚С™ Р В Р’В°Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР В Р вЂ Р В Р вЂ¦Р РЋРІР‚в„–Р РЋРІР‚В¦ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™.", "You have no active rooms."))}</div>`}</div></article>
          <article class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В РЎвЂєР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРІР‚в„–", "Public rooms"))}</h5></div></div><div class="social-checkers-room-list">${publicRooms.length ? publicRooms.map((r)=>roomCard(r,false)).join("") : `<div class="social-checkers-empty">${esc(t("Р В Р Р‹Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚РЋР В Р’В°Р РЋР С“ Р В Р вЂ¦Р В Р’ВµР РЋРІР‚С™ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋРІР‚в„–Р РЋРІР‚В¦ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™.", "No public rooms."))}</div>`}</div></article>
        </section>
        <aside class="social-checkers-sidebar"><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В РЎС›Р В РЎвЂўР В РЎвЂ” Р В РЎвЂР В РЎвЂ“Р РЋР вЂљР В РЎвЂўР В РЎвЂќР В РЎвЂўР В Р вЂ ", "Top players"))}</h5></div></div>${leaderboardPreview(leaderboard)}</section><section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В РЎСџР В РЎвЂўР В РўвЂР РЋР С“Р В РЎвЂќР В Р’В°Р В Р’В·Р В РЎвЂќР В РЎвЂ", "Tips"))}</h5></div></div><div class="hint">${esc(t("Р В РЎв„ўР В РЎвЂўР РЋР вЂљР В Р’В°Р В Р’В±Р В Р’В»Р В РЎвЂ Р РЋР вЂљР В Р’В°Р РЋР С“Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В Р’В»Р РЋР РЏР РЋР вЂ№Р РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚С™Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р В РЎвЂќР В РЎвЂ, Р В Р вЂ Р В Р’В°Р В РЎВ Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В Р’ВµР В Р’В»Р РЋР РЏР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р РЋР вЂ№ Р РЋР С“Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В Р’В°.", "Ships are placed automatically, you only need to shoot enemy cells."))}</div><div class="actions social-checkers-actions-stack"><button class="btn-secondary" type="button" onclick="socialBattleshipShowTips()">${esc(t("Р В РЎв„ўР В Р’В°Р В РЎвЂќ Р В РЎвЂР В РЎвЂ“Р РЋР вЂљР В Р’В°Р РЋРІР‚С™Р РЋР Р‰", "How to play"))}</button></div></section></aside>
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
      toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњ.", "Failed to create room.")), "error");
    }
  }

  async function socialBattleshipJoinRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/battleship/rooms/${id}/join`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В РЎвЂР РЋРІР‚С™Р РЋР Р‰Р РЋР С“Р РЋР РЏ Р В РЎвЂќ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р В Р’Вµ.", "Failed to join room.")), "error"); }
  }

  async function socialBattleshipOpenRoom(roomId) {
    const id = Number(roomId || 0); if (!id) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/battleship/rooms/${id}`)); }
    catch (e) { toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњ.", "Failed to open room.")), "error"); }
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
      const mark = val === "H" ? "Р Р†РЎС™РІвЂћвЂ“" : (val === "M" ? "Р Р†Р вЂљРЎС›" : (boardType === "own" && val === "S" ? "Р Р†РІР‚вЂњР’В " : ""));
      const onClick = clickable ? ` onclick="socialBattleshipShoot(${r}, ${c})"` : "";
      return `<button type="button" class="social-battle-cell ${cls} ${clickable ? "target" : ""}"${onClick} ${clickable ? "" : "disabled"}>${esc(mark)}</button>`;
    }).join("")).join("")}</div>`;
  }

  function historyRows(room) {
    const rows = Array.isArray(room?.history) ? room.history.slice().reverse().slice(0, 24) : [];
    if (!rows.length) return `<div class="social-checkers-empty">${esc(t("Р В Р’ВР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В° Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋР РЏ.", "No turns yet."))}</div>`;
    return rows.map((m, idx) => {
      const side = String(m?.side || "") === "white" ? t("Р В РІР‚ВР В Р’ВµР В Р’В»Р РЋРІР‚в„–Р В РІвЂћвЂ“", "White") : t("Р В Р’В§Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“", "Black");
      const target = Array.isArray(m?.target) ? `${String.fromCharCode(65 + Number(m.target[1] || 0))}${Number(m.target[0] || 0) + 1}` : "-";
      const verdict = m?.hit ? (m?.sunk ? t("Р В РЎСџР В РЎвЂўР В РЎвЂ”Р В Р’В°Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ Р В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂўР В РЎвЂ”Р В Р’В»Р В Р’ВµР В Р вЂ¦", "Hit and sunk") : t("Р В РЎСџР В РЎвЂўР В РЎвЂ”Р В Р’В°Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ", "Hit")) : t("Р В РЎСџР РЋР вЂљР В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚В¦", "Miss");
      return `<div class="social-checkers-history-row"><strong>${Number(rows.length - idx)}</strong><div><span>${esc(side)}: <b>${esc(target)}</b> Р вЂ™Р’В· ${esc(verdict)}</span><small>${esc(dt(m?.at || ""))}</small></div></div>`;
    }).join("");
  }

  function openRoomPayload(room) {
    if (!room || typeof room !== "object") { toast(t("Р В РЎв„ўР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р В Р’В° Р В Р вЂ¦Р В Р’ВµР В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋРЎвЂњР В РЎвЂ”Р В Р вЂ¦Р В Р’В°.", "Room unavailable."), "error"); return; }
    state.room = room;
    const players = room.players && typeof room.players === "object" ? room.players : {};
    const white = players.white || {};
    const black = players.black || {};
    const title = String(room.title || `${t("Р В РЎв„ўР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р В Р’В°", "Room")} ${room.room_code || ""}`).trim();
    const note = resultText(room) || String(room.note || "").trim();
    const myStatus = room.my_side ? (String(room.my_side) === "white" ? t("Р В РІР‚ВР В Р’ВµР В Р’В»Р РЋРІР‚в„–Р В РІвЂћвЂ“", "White") : t("Р В Р’В§Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“", "Black")) : t("Р В РЎСљР В Р’В°Р В Р’В±Р В Р’В»Р РЋР вЂ№Р В РўвЂР В Р’В°Р РЋРІР‚С™Р В Р’ВµР В Р’В»Р РЋР Р‰", "Viewer");
    const ownBoard = renderBoard(room.own_board, "own", false);
    const enemyBoard = renderBoard(room.enemy_board, "enemy", Boolean(room.can_move));
    socialOpenModal(title, `
      <div class="social-checkers-shell">
        <div class="social-checkers-main">
          <section class="social-checkers-panel social-checkers-board-card">
            <div class="social-checkers-room-head compact"><div class="social-checkers-room-title-wrap"><div class="social-checkers-room-badges"><span class="social-checkers-badge ${esc(String(room.status || "waiting"))}">${esc(statusLabel(room.status))}</span><span class="social-checkers-badge ${String(room.mode || "human") === "bot" ? "bot" : "human"}">${esc(modeLabel(room))}</span>${String(room.mode || "human") === "bot" ? `<span class="social-checkers-badge soft">${esc(diffTitle(room.difficulty))}</span>` : ""}</div><strong class="social-checkers-room-title">${esc(title)}</strong><div class="social-checkers-room-meta"><span>#${esc(room.room_code || "-")}</span><span>${esc(t("Р В Р Р‹Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В Р’В°", "Created"))}: <b>${esc(dt(room.created_at))}</b></span><span>${esc(t("Р В РЎвЂєР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂў", "Updated"))}: <b>${esc(dt(room.updated_at))}</b></span></div></div><div class="social-checkers-turn-pill ${esc(String(room.turn || "white"))}">${esc(String(room.turn || "white") === "white" ? t("Р В РІР‚ВР В Р’ВµР В Р’В»Р РЋРІР‚в„–Р В РІвЂћвЂ“", "White") : t("Р В Р’В§Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“", "Black"))} | ${esc(myStatus)}</div></div>
            ${note ? `<div class="social-checkers-note ${resultText(room) ? "strong" : ""}">${esc(note)}</div>` : ""}
            <div class="social-battle-boards"><div class="social-battle-board"><h6>${esc(t("Р В РІР‚в„ўР В Р’В°Р РЋРІвЂљВ¬ Р РЋРІР‚С›Р В Р’В»Р В РЎвЂўР РЋРІР‚С™", "Your fleet"))}</h6>${ownBoard}</div><div class="social-battle-board"><h6>${esc(t("Р В РЎСџР В РЎвЂўР В Р’В»Р В Р’Вµ Р РЋР С“Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В Р’В°", "Enemy field"))}</h6>${enemyBoard}</div></div>
            <div class="social-checkers-board-footer"><span>${esc(t("Р В РЎСџР В РЎвЂўР РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“ Р В Р вЂ Р РЋРІР‚в„–Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В Р’ВµР В Р’В»", "Last shot"))}: <b>${Array.isArray(room?.last_move?.target) ? `${String.fromCharCode(65 + Number(room.last_move.target[1] || 0))}${Number(room.last_move.target[0] || 0) + 1}` : "-"}</b></span><span>${esc(t("Р В Р’В Р В Р’ВµР В Р’В¶Р В РЎвЂР В РЎВ", "Mode"))}: <b>${esc(modeLabel(room))}</b></span></div>
          </section>
        </div>
        <aside class="social-checkers-sidebar">
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’ВР В РЎвЂ“Р РЋР вЂљР В РЎвЂўР В РЎвЂќР В РЎвЂ", "Players"))}</h5></div></div><div class="social-checkers-players"><article class="social-checkers-player ${String(room.turn || "white") === "white" ? "active" : ""}"><div class="social-checkers-room-badges"><span class="social-checkers-badge white">${esc(t("Р В РІР‚ВР В Р’ВµР В Р’В»Р РЋРІР‚в„–Р В РІвЂћвЂ“", "White"))}</span>${white.is_bot ? `<span class="social-checkers-badge bot">${esc(t("Р В Р’ВР В Р’В", "AI"))}</span>` : ""}</div><strong>${esc(white.nick || "-")}</strong><div class="social-checkers-player-meta"><span>${esc(t("Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Rating"))}: <b>${Number(white.rating || 1200)}</b></span></div></article><article class="social-checkers-player ${String(room.turn || "white") === "black" ? "active" : ""}"><div class="social-checkers-room-badges"><span class="social-checkers-badge black">${esc(t("Р В Р’В§Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“", "Black"))}</span>${black.is_bot ? `<span class="social-checkers-badge bot">${esc(t("Р В Р’ВР В Р’В", "AI"))}</span>` : ""}</div><strong>${esc(black.nick || "-")}</strong><div class="social-checkers-player-meta"><span>${esc(t("Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Rating"))}: <b>${Number(black.rating || 1200)}</b></span></div></article></div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Действия", "Actions"))}</h5></div></div><div class="actions social-checkers-actions-stack">${room.can_join ? `<button type="button" onclick="socialBattleshipJoinRoom(${Number(room.id || 0)})">${esc(t("Подключиться", "Join room"))}</button>` : ""}<button class="btn-secondary" type="button" onclick="socialBattleshipRefreshRoom()">${esc(t("Обновить", "Refresh"))}</button><button class="btn-secondary" type="button" onclick="socialBattleshipOpenMenu()">${esc(t("К лобби", "Back to lobby"))}</button>${(room.my_side && (room.status === "waiting" || room.status === "active")) ? `<button type="button" onclick="socialBattleshipLeaveRoom()">${esc(room.status === "waiting" ? t("Закрыть комнату", "Close room") : t("Сдаться", "Resign"))}</button>` : ""}${room.can_delete ? `<button class="btn-danger" type="button" onclick="socialBattleshipDeleteRoom(${Number(room.id || 0)})">${esc(t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443", "Delete room"))}</button>` : ""}</div><div class="hint">${esc(room.can_move ? t("Выбирайте клетку на поле соперника для выстрела.", "Pick enemy cell to shoot.") : t("Если сейчас не ваш ход, позиция обновится автоматически.", "If not your turn, board refreshes automatically."))}</div></section>
          <section class="social-checkers-panel"><div class="social-checkers-section-head"><div><h5>${esc(t("Р В Р’ВР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В РЎвЂР РЋР РЏ Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂР В РЎвЂўР В Р вЂ ", "Turn history"))}</h5></div></div><div class="social-checkers-history">${historyRows(room)}</div></section>
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
    catch (e) { if (!silent) toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњ.", "Failed to refresh room.")), "error"); }
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
      toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В Р вЂ Р РЋРІР‚в„–Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ Р РЋРІР‚в„–Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В Р’ВµР В Р’В».", "Failed to shoot.")), "error");
    } finally {
      state.pendingShot = false;
    }
  }

  async function socialBattleshipLeaveRoom() {
    const id = Number(state.room?.id || 0);
    if (!id) return;
    const room = state.room || {};
    const ask = room.status === "waiting" ? t("Р В РІР‚вЂќР В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р РЋР РЉР РЋРІР‚С™Р РЋРЎвЂњ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњ?", "Close this room?") : t("Р В Р Р‹Р В РўвЂР В Р’В°Р РЋРІР‚С™Р РЋР Р‰Р РЋР С“Р РЋР РЏ Р В Р вЂ  Р В РЎВР В Р’В°Р РЋРІР‚С™Р РЋРІР‚РЋР В Р’Вµ?", "Resign from this match?");
    if (!window.confirm(ask)) return;
    try { openRoomPayload(await socialRequest(`/api/social/games/battleship/rooms/${id}/leave`, { method: "POST", body: JSON.stringify({}) })); }
    catch (e) { toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В Р’В·Р В Р’В°Р В Р вЂ Р В Р’ВµР РЋР вЂљР РЋРІвЂљВ¬Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњ.", "Failed to finish room.")), "error"); }
  }

  async function socialBattleshipDeleteRoom(roomId = 0) {
    const id = Number(roomId || state.room?.id || 0);
    if (!id) return;
    const room = findRoomById(id) || state.room || {};
    const title = String(room?.title || room?.room_code || "").trim();
    const ask = title
      ? t(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443 "${title}"?`, `Delete room "${title}"?`)
      : t("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0443 \u043a\u043e\u043c\u043d\u0430\u0442\u0443?", "Delete this room?");
    if (!window.confirm(ask)) return;
    try {
      await socialRequest(`/api/social/games/battleship/rooms/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      state.room = null;
      await socialBattleshipOpenMenu();
    } catch (e) {
      toast(humanError(e, t("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443.", "Failed to delete room.")), "error");
    }
  }

  function socialBattleshipShowTips() {
    socialOpenModal(t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“: Р В РЎвЂќР В Р’В°Р В РЎвЂќ Р В РЎвЂР В РЎвЂ“Р РЋР вЂљР В Р’В°Р РЋРІР‚С™Р РЋР Р‰", "Battleship: how to play"), `<div class="social-checkers-panel"><div class="hint">${esc(t("1) Р В Р’В¤Р В Р’В»Р В РЎвЂўР РЋРІР‚С™ Р РЋР вЂљР В Р’В°Р РЋР С“Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚С™Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р В РЎвЂќР В РЎвЂ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В РЎвЂ Р В РЎвЂќР В РЎвЂўР В РЎВР В Р вЂ¦Р В Р’В°Р РЋРІР‚С™Р РЋРІР‚в„–.", "1) Fleet is auto-placed on room creation."))}</div><div class="hint">${esc(t("2) Р В Р Р‹Р РЋРІР‚С™Р РЋР вЂљР В Р’ВµР В Р’В»Р РЋР РЏР В РІвЂћвЂ“Р РЋРІР‚С™Р В Р’Вµ Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р РЋР вЂ№ Р РЋР С“Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В Р’В°. Р В РЎСџР В РЎвЂўР В РЎвЂ”Р В Р’В°Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ Р В РЎвЂўР РЋРІР‚С™Р В РЎВР В Р’ВµР РЋРІР‚РЋР В Р’В°Р В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р Р†РЎС™РІвЂћвЂ“, Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚В¦ Р Р†Р вЂљРІР‚Сњ Р Р†Р вЂљРЎС›.", "2) Shoot enemy field. Hit is Р Р†РЎС™РІвЂћвЂ“, miss is Р Р†Р вЂљРЎС›."))}</div><div class="hint">${esc(t("3) Р В РЎСџР РЋР вЂљР В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂ”Р В Р’В°Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР В РЎвЂ Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР В РўвЂР В РЎвЂўР В Р’В»Р В Р’В¶Р В Р’В°Р В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ, Р В РЎвЂ”Р РЋР вЂљР В РЎвЂ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР В РЎВР В Р’В°Р РЋРІР‚В¦Р В Р’Вµ Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂ Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР РЋРІР‚В¦Р В РЎвЂўР В РўвЂР В РЎвЂР РЋРІР‚С™ Р РЋР С“Р В РЎвЂўР В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р В РЎвЂР В РЎвЂќР РЋРЎвЂњ.", "3) Hit keeps turn, miss passes turn."))}</div><div class="actions"><button type="button" onclick="socialBattleshipOpenMenu()">${esc(t("Р В РЎСљР В Р’В°Р В Р’В·Р В Р’В°Р В РўвЂ", "Back"))}</button></div></div>`);
    arm();
  }

  async function socialBattleshipShowLeaderboard() {
    try {
      const data = await socialRequest("/api/social/games/battleship/leaderboard?limit=100");
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      socialOpenModal(t("Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“ Р В РЎВР В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РЎвЂ“Р В РЎвЂў Р В Р’В±Р В РЎвЂўР РЋР РЏ", "Battleship leaderboard"), `<div class="social-checkers-scroll-table"><table><thead><tr><th>#</th><th>${esc(t("Р В Р’ВР В РЎвЂ“Р РЋР вЂљР В РЎвЂўР В РЎвЂќ", "Player"))}</th><th>${esc(t("Р В Р’В Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Rating"))}</th><th>${esc(t("Р В РЎСџР В РЎвЂўР В Р’В±Р В Р’ВµР В РўвЂР РЋРІР‚в„–", "Wins"))}</th><th>${esc(t("Р В РЎСџР В РЎвЂўР РЋР вЂљР В Р’В°Р В Р’В¶Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ", "Losses"))}</th><th>${esc(t("Р В РЎСљР В РЎвЂР РЋРІР‚РЋР РЋР Р‰Р В РЎвЂ", "Draws"))}</th></tr></thead><tbody>${rows.length ? rows.map((r)=>`<tr class="${r.is_me ? "social-me-row" : ""}"><td>${Number(r.rank || 0)}</td><td>${esc(r.nick || "-")}</td><td>${Number(r.rating || 1200)}</td><td>${Number(r.wins || 0)}</td><td>${Number(r.losses || 0)}</td><td>${Number(r.draws || 0)}</td></tr>`).join("") : `<tr><td colspan="6">${esc(t("Р В РЎСџР В РЎвЂўР В РЎвЂќР В Р’В° Р В Р вЂ¦Р В Р’ВµР РЋРІР‚С™ Р РЋР вЂљР В Р’ВµР В Р’В·Р РЋРЎвЂњР В Р’В»Р РЋР Р‰Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ ", "No results yet"))}</td></tr>`}</tbody></table></div><div class="hint">${esc(t("Р В РІР‚в„ўР В Р’В°Р РЋРІвЂљВ¬Р В Р’Вµ Р В РЎВР В Р’ВµР РЋР С“Р РЋРІР‚С™Р В РЎвЂў", "Your rank"))}: <b>${data?.my_rank ? `#${Number(data.my_rank)}` : "Р Р†Р вЂљРІР‚Сњ"}</b> | ${esc(t("Р В РІР‚в„ўР В Р’В°Р РЋРІвЂљВ¬ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“", "Your rating"))}: <b>${Number(data?.my_rating || 1200)}</b></div><div class="actions"><button type="button" onclick="socialBattleshipOpenMenu()">${esc(t("Р В РЎСљР В Р’В°Р В Р’В·Р В Р’В°Р В РўвЂ", "Back"))}</button></div>`);
      arm();
    } catch (e) {
      toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В Р’В·Р В Р’В°Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р РЋР вЂљР В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚С™Р В РЎвЂР В Р вЂ¦Р В РЎвЂ“.", "Failed to load leaderboard.")), "error");
    }
  }

  function socialBattleshipQuickStart(level = "medium") {
    const difficulty = String(level || "medium").trim().toLowerCase() || "medium";
    socialOpenModal(t("Р В РЎС™Р В РЎвЂўР РЋР вЂљР РЋР С“Р В РЎвЂќР В РЎвЂўР В РІвЂћвЂ“ Р В Р’В±Р В РЎвЂўР В РІвЂћвЂ“", "Battleship"), `<div class="social-checkers-loading">${esc(t("Р В Р Р‹Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р РЋР вЂ№ Р В РЎВР В Р’В°Р РЋРІР‚С™Р РЋРІР‚РЋ Р РЋР С“ Р В Р’ВР В Р’В...", "Creating AI match..."))}</div>`);
    arm();
    socialRequest("/api/social/games/battleship/rooms", { method: "POST", body: JSON.stringify({ mode: "bot", difficulty, is_public: false }) })
      .then((room) => openRoomPayload(room))
      .catch((e) => { toast(humanError(e, t("Р В РЎСљР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РЎВР В Р’В°Р РЋРІР‚С™Р РЋРІР‚РЋ Р РЋР С“ Р В Р’ВР В Р’В.", "Failed to create AI match.")), "error"); socialBattleshipOpenMenu(); });
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
  window.socialBattleshipDeleteRoom = socialBattleshipDeleteRoom;
})();
