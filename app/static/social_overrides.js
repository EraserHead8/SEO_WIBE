(function socialOverridesV20260320() {
  if (typeof window === "undefined") return;
  if (window.__socialOverridesV20260320) return;
  window.__socialOverridesV20260320 = true;

  function taskBucketTitle(bucket) {
    const key = String(bucket || "upcoming").trim().toLowerCase();
    if (key === "today") return tr("РЎРµРіРѕРґРЅСЏ", "Today");
    if (key === "tomorrow") return tr("Р—Р°РІС‚СЂР°", "Tomorrow");
    if (key === "overdue") return tr("РџСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Рµ", "Overdue");
    if (key === "done") return tr("Р’С‹РїРѕР»РЅРµРЅРЅС‹Рµ", "Done");
    return tr("РџСЂРµРґСЃС‚РѕСЏС‰РёРµ", "Upcoming");
  }

  function taskStatusLabel(statusRaw) {
    const status = String(statusRaw || "todo").trim().toLowerCase();
    if (status === "in_progress") return tr("Р’ СЂР°Р±РѕС‚Рµ", "In progress");
    if (status === "done") return tr("Р’С‹РїРѕР»РЅРµРЅР°", "Done");
    return tr("Рљ РІС‹РїРѕР»РЅРµРЅРёСЋ", "To do");
  }

  function taskPriorityOptions(selected = "normal") {
    const safe = String(selected || "normal").trim().toLowerCase();
    const options = [
      { value: "low", label: tr("РќРёР·РєРёР№", "Low") },
      { value: "normal", label: tr("РћР±С‹С‡РЅС‹Р№", "Normal") },
      { value: "high", label: tr("Р’С‹СЃРѕРєРёР№", "High") },
      { value: "critical", label: tr("РљСЂРёС‚РёС‡РЅС‹Р№", "Critical") },
    ];
    return options.map((option) => `<option value="${option.value}" ${option.value === safe ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
  }

  function taskStatusOptions(selected = "todo") {
    const safe = String(selected || "todo").trim().toLowerCase();
    const options = [
      { value: "todo", label: tr("Рљ РІС‹РїРѕР»РЅРµРЅРёСЋ", "To do") },
      { value: "in_progress", label: tr("Р’ СЂР°Р±РѕС‚Рµ", "In progress") },
      { value: "done", label: tr("Р’С‹РїРѕР»РЅРµРЅР°", "Done") },
    ];
    return options.map((option) => `<option value="${option.value}" ${option.value === safe ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
  }

  function taskResolveDraftKind(task = null, forcedKind = "") {
    if (task && typeof task === "object") {
      return String(task.task_kind || "company").trim().toLowerCase() === "personal" ? "personal" : "company";
    }
    const forced = String(forcedKind || socialState?.taskDraftKind || "").trim().toLowerCase();
    if (forced === "personal") return "personal";
    if (forced === "company") return "company";
    const calendarMode = String(socialState?.calendarTaskFilter || "").trim().toLowerCase();
    return calendarMode === "my_tasks" ? "personal" : "company";
  }

  function taskDefaultDueValue() {
    const selectedDay = String(socialState?.calendarSelectedDay || "").trim();
    if (selectedDay && /^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) {
      return `${selectedDay}T09:00`;
    }
    return "";
  }

  function taskProjectMeta(task) {
    if (String(task?.task_kind || "").trim().toLowerCase() === "personal") {
      return tr("РњРћР Р—РђР”РђР§Р", "My tasks");
    }
    const projectTitle = String(task?.project_title || "").trim();
    return projectTitle || tr("Р‘РµР· РїСЂРѕРµРєС‚Р°", "No project");
  }

  function calendarActiveMode() {
    const mode = String(socialState?.calendarTaskFilter || "events").trim().toLowerCase();
    if (mode === "tasks") return "tasks";
    if (mode === "my_tasks") return "my_tasks";
    return "events";
  }

  function syncCalendarModeCopy() {
    const kicker = document.querySelector("#socialSubtabCalendar .social-calendar-kicker");
    if (kicker) kicker.textContent = tr("РљР°Р»РµРЅРґР°СЂСЊ", "Calendar");
    const host = document.getElementById("socialCalendarTaskMode");
    if (!host) return;
    const labels = {
      events: tr("РЎРѕР±С‹С‚РёСЏ", "Events"),
      tasks: tr("Р—Р°РґР°С‡Рё", "Tasks"),
      my_tasks: tr("РњРћР Р—РђР”РђР§Р", "My tasks"),
    };
    host.querySelectorAll("button[data-mode]").forEach((button) => {
      const mode = String(button.getAttribute("data-mode") || "").trim().toLowerCase();
      if (labels[mode]) button.textContent = labels[mode];
    });
  }

  function calendarPrimaryActionConfig(mode = "") {
    const safeMode = String(mode || calendarActiveMode()).trim().toLowerCase();
    if (safeMode === "my_tasks") {
      return {
        label: tr("Р”РѕР±Р°РІРёС‚СЊ РјРѕСЋ Р·Р°РґР°С‡Сѓ", "Add my task"),
        onclick: "socialCalendarOpenCreateFromMode('my_tasks')",
      };
    }
    if (safeMode === "tasks") {
      return {
        label: tr("Р”РѕР±Р°РІРёС‚СЊ Р·Р°РґР°С‡Сѓ", "Add task"),
        onclick: "socialCalendarOpenCreateFromMode('tasks')",
      };
    }
    return {
      label: tr("Р”РѕР±Р°РІРёС‚СЊ СЃРѕР±С‹С‚РёРµ", "Add event"),
      onclick: "socialCalendarOpenCreateFromMode('events')",
    };
  }

  function syncCalendarPrimaryAction() {
    const button = document.getElementById("socialCalendarPrimaryAction") || document.querySelector("#socialSubtabCalendar .social-calendar-hero-actions button:not(.btn-secondary)");
    if (!button) return;
    const config = calendarPrimaryActionConfig();
    button.textContent = config.label;
    button.setAttribute("onclick", config.onclick);
  }

  function calendarModeRowsForDay(dayKey) {
    const mode = calendarActiveMode();
    if (mode === "events") {
      return (socialState?.calendarEvents || [])
        .filter((eventRow) => socialCalendarDayKey(eventRow?.start_at || "") === dayKey)
        .sort((left, right) => (socialCalendarParseDate(left?.start_at)?.getTime() || 0) - (socialCalendarParseDate(right?.start_at)?.getTime() || 0));
    }
    return (socialState?.tasks || [])
      .filter((task) => socialCalendarDayKey(task?.due_date || "") === dayKey)
      .filter((task) => mode !== "my_tasks" || String(task?.task_kind || "").trim().toLowerCase() === "personal")
      .sort((left, right) => {
        const leftDue = socialParseDateSafe(left?.due_date)?.getTime() || 0;
        const rightDue = socialParseDateSafe(right?.due_date)?.getTime() || 0;
        if (leftDue !== rightDue) return leftDue - rightDue;
        return String(left?.title || "").localeCompare(String(right?.title || ""), currentLang === "en" ? "en" : "ru");
      });
  }

  function calendarPreviewColor(item, mode) {
    const raw = String(item?.color || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
    if (mode === "events") return "#9dc4ff";
    return String(item?.task_kind || "").trim().toLowerCase() === "personal" ? "#b8e3c2" : "#d8e8ff";
  }

  function calendarPreviewStyle(item, mode) {
    const color = calendarPreviewColor(item, mode);
    return `style="--social-preview-color:${escapeHtml(color)}"`;
  }

  function calendarPreviewPill(item, mode) {
    if (mode === "events") {
      const timeValue = String(item?.start_at || "").trim() ? socialCalendarTimeLabel(item.start_at) : tr("Весь день", "All day");
      return `<span class="social-day-preview-pill is-event" ${calendarPreviewStyle(item, mode)}><span class="social-day-preview-time">${escapeHtml(timeValue)}</span><span class="social-day-preview-title">${escapeHtml(item?.title || "-")}</span></span>`;
    }
    const personal = String(item?.task_kind || "").trim().toLowerCase() === "personal";
    const dueLabel = String(item?.due_date || "").trim() ? socialCalendarTimeLabel(item.due_date) : tr("Без времени", "No time");
    return `<span class="social-day-preview-pill is-task ${personal ? "is-personal" : ""}" ${calendarPreviewStyle(item, mode)}><span class="social-day-preview-time">${escapeHtml(dueLabel)}</span><span class="social-day-preview-title">${escapeHtml(item?.title || "-")}</span></span>`;
  }

  function normalizeNoteRow(row) {
    if (!row || typeof row !== "object") return row;
    return {
      ...row,
      title: socialNormalizeNoteText(row.title || ""),
      content: socialNormalizeNoteText(row.content || ""),
    };
  }

  socialTaskBucketTitle = taskBucketTitle;

  socialBuildTaskForm = function socialBuildTaskFormOverride(task = null, forcedKind = "") {
    const actorsRaw = Array.isArray(socialState?.actors) ? socialState.actors : [];
    const projects = Array.isArray(socialState?.projects) ? socialState.projects : [];
    const kind = taskResolveDraftKind(task, forcedKind);
    const status = String(task?.status || "todo").trim().toLowerCase() || "todo";
    const due = task?.due_date ? String(task.due_date).slice(0, 16) : taskDefaultDueValue();
    const myKey = socialTaskCurrentActorKey();
    const myNick = String(socialState?.boot?.actor?.nick || myKey || tr("РЇ", "Me")).trim() || tr("РЇ", "Me");
    const actorMap = new Map();
    actorsRaw.forEach((row) => {
      const key = String(row?.actor_key || "").trim();
      if (!key || actorMap.has(key)) return;
      actorMap.set(key, row);
    });
    if (myKey && !actorMap.has(myKey)) actorMap.set(myKey, { actor_key: myKey, nick: myNick });
    const actors = [...actorMap.values()];
    const isPersonal = kind === "personal";
    const currentAssignee = isPersonal && myKey ? myKey : (String(task?.assignee_key || "").trim() || myKey || String(actors[0]?.actor_key || ""));
    const hint = isPersonal ? tr("Р›РёС‡РЅР°СЏ Р·Р°РґР°С‡Р° Р±СѓРґРµС‚ РІРёРґРЅР° С‚РѕР»СЊРєРѕ РІР°Рј Рё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РЅР°Р·РЅР°С‡РёС‚СЃСЏ РЅР° РІР°СЃ.", "This personal task is visible only to you and will be assigned to you automatically.") : tr("РџСЂРѕРµРєС‚РЅР°СЏ Р·Р°РґР°С‡Р° РґРѕСЃС‚СѓРїРЅР° СѓС‡Р°СЃС‚РЅРёРєР°Рј РїСЂРѕРµРєС‚Р° Рё РЅР°Р·РЅР°С‡РµРЅРЅРѕРјСѓ РёСЃРїРѕР»РЅРёС‚РµР»СЋ.", "This project task is visible to project members and the selected assignee.");
    return `
      <div class="grid-2">
        <label><span>${tr("РќР°Р·РІР°РЅРёРµ", "Title")}</span><input id="socialTaskTitle" value="${escapeHtml(task?.title || "")}" placeholder="${escapeHtml(tr("РќР°РїСЂРёРјРµСЂ: РџРѕРґРіРѕС‚РѕРІРёС‚СЊ РїРѕСЃС‚Р°РІРєСѓ", "For example: Prepare shipment"))}" /></label>
        <label><span>${tr("РўРёРї Р·Р°РґР°С‡Рё", "Task type")}</span><select id="socialTaskKind" onchange="socialSyncTaskKindForm()"><option value="company" ${kind === "company" ? "selected" : ""}>${tr("РџСЂРѕРµРєС‚РЅР°СЏ", "Project")}</option><option value="personal" ${kind === "personal" ? "selected" : ""}>${tr("РњРћР Р—РђР”РђР§Р", "My tasks")}</option></select></label>
        <label><span>${tr("РџСЂРѕРµРєС‚", "Project")}</span><select id="socialTaskProject" ${isPersonal ? "disabled" : ""}><option value="">${tr("Р‘РµР· РїСЂРѕРµРєС‚Р°", "No project")}</option>${projects.map((project) => `<option value="${Number(project.id)}" ${!isPersonal && Number(task?.project_id || 0) === Number(project.id) ? "selected" : ""}>${escapeHtml(project.title || "-")}</option>`).join("")}</select></label>
        <label><span>${tr("РСЃРїРѕР»РЅРёС‚РµР»СЊ", "Assignee")}</span><select id="socialTaskAssignee" ${isPersonal ? "disabled" : ""}>${actors.map((actor) => `<option value="${escapeHtml(String(actor.actor_key || ""))}" ${currentAssignee === String(actor.actor_key || "") ? "selected" : ""}>${escapeHtml(actor.nick || "-")}</option>`).join("")}</select></label>
        <div id="socialTaskKindHint" class="hint full">${escapeHtml(hint)}</div>
        <label><span>${tr("РџСЂРёРѕСЂРёС‚РµС‚", "Priority")}</span><select id="socialTaskPriority">${taskPriorityOptions(String(task?.priority || "normal"))}</select></label>
        <label><span>${tr("РЎС‚Р°С‚СѓСЃ", "Status")}</span><select id="socialTaskStatus">${taskStatusOptions(status)}</select></label>
        <label><span>${tr("Р”РµРґР»Р°Р№РЅ", "Deadline")}</span><input id="socialTaskDue" type="datetime-local" value="${escapeHtml(due)}" /></label>
        <label class="full"><span>${tr("РћРїРёСЃР°РЅРёРµ", "Description")}</span><textarea id="socialTaskDescription" rows="5" placeholder="${escapeHtml(tr("РџРѕРґСЂРѕР±РЅРѕСЃС‚Рё, С‡РµРє-Р»РёСЃС‚, РєРѕРЅС‚РµРєСЃС‚", "Details, checklist, context"))}">${escapeHtml(task?.description || "")}</textarea></label>
      </div>
    `;
  };

  socialRenderTasks = function socialRenderTasksOverride() {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    const rows = Array.isArray(socialState?.tasks) ? socialState.tasks : [];
    const myActorKey = String(socialState?.boot?.actor?.actor_key || "").trim();
    if (!rows.length) {
      host.innerHTML = `<div class="hint">${escapeHtml(tr("Р—Р°РґР°С‡ РїРѕРєР° РЅРµС‚", "No tasks yet"))}</div>`;
      return;
    }
    const grouped = new Map();
    rows.forEach((task) => {
      const bucket = String(task?.bucket || "upcoming").trim().toLowerCase();
      if (!grouped.has(bucket)) grouped.set(bucket, []);
      grouped.get(bucket).push(task);
    });
    const bucketOrder = [...grouped.keys()].sort((a, b) => socialTaskBucketSort(a) - socialTaskBucketSort(b));
    host.innerHTML = `<div class="social-task-board-v2">${bucketOrder.map((bucket) => {
      const items = grouped.get(bucket) || [];
      return `<section class="social-task-bucket" data-bucket="${escapeHtml(bucket)}"><header><h4>${escapeHtml(taskBucketTitle(bucket))}</h4><span>${items.length}</span></header><div class="social-task-bucket-list" ondragover="socialTaskAllowDrop(event)" ondrop="socialTaskDrop(event, '${escapeHtml(bucket)}')">${items.map((task) => {
        const id = Number(task?.id || 0);
        const status = String(task?.status || "todo").trim().toLowerCase();
        const pending = socialTaskPendingDone.has(id);
        const isDone = status === "done" || pending;
        const isMine = myActorKey && String(task?.assignee_key || "").trim() === myActorKey;
        const classes = ["social-task-item"];
        if (isMine) classes.push("is-assignee");
        if (isDone) classes.push("is-done");
        if (bucket === "overdue" && !isDone) classes.push("is-overdue");
        return `<article class="${classes.join(" ")}" data-task-id="${id}" draggable="true" ondragstart="socialTaskDragStart(event, ${id})"><button class="social-task-check ${isDone ? "is-done" : ""}" type="button" onclick="socialToggleTaskDone(${id}); event.stopPropagation();" title="${escapeHtml(tr("РћС‚РјРµС‚РёС‚СЊ РІС‹РїРѕР»РЅРµРЅРЅРѕР№", "Mark as done"))}">${isDone ? "✓" : ""}</button><div class="social-task-content" onclick="socialOpenTaskModal(${id})"><div class="social-task-title-row"><b class="social-task-title-text">${escapeHtml(task?.title || "-")}</b><span class="social-task-kind ${String(task?.task_kind || "company").trim().toLowerCase() === "personal" ? "personal" : "company"}">${escapeHtml(taskProjectMeta(task))}</span></div><div class="social-task-subline"><span>${escapeHtml(socialTaskDueLabel(task))}</span>${socialTaskAssigneeMeta(task)}</div><div class="social-task-subline social-task-subline--secondary"><span>${escapeHtml(taskStatusLabel(task?.status))}</span>${String(task?.description || "").trim() ? `<span class="social-task-meta-trim">${escapeHtml(String(task.description || "").replace(/\s+/g, " ").trim())}</span>` : `<span class="social-task-meta-trim">${escapeHtml(tr("Р‘РµР· РѕРїРёСЃР°РЅРёСЏ", "No description"))}</span>`}</div>${pending ? `<span class="social-task-pending">${escapeHtml(tr("Р•С‰Рµ 5 СЃРµРєСѓРЅРґ РјРѕР¶РЅРѕ РѕС‚РјРµРЅРёС‚СЊ РїРѕРІС‚РѕСЂРЅС‹Рј РЅР°Р¶Р°С‚РёРµРј.", "You can undo within 5 seconds by tapping again."))}</span>` : ""}</div><button class="social-task-delete" type="button" onclick="socialDeleteTask(${id}); event.stopPropagation();" title="${escapeHtml(tr("РЈРґР°Р»РёС‚СЊ", "Delete"))}">✕</button></article>`;
      }).join("")}</div></section>`;
    }).join("")}</div>`;
  };

  socialOpenTaskModal = function socialOpenTaskModalOverride(taskId = 0, forcedKind = "") {
    const task = (socialState?.tasks || []).find((row) => Number(row?.id || 0) === Number(taskId || 0)) || null;
    const comments = Array.isArray(task?.comments) ? task.comments : [];
    const resolvedKind = taskResolveDraftKind(task, forcedKind);
    socialState.taskDraftKind = resolvedKind;
    socialOpenModal(
      task ? tr("Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ Р·Р°РґР°С‡Сѓ", "Edit task") : tr("РќРѕРІР°СЏ Р·Р°РґР°С‡Р°", "New task"),
      `${socialBuildTaskForm(task, resolvedKind)}${task ? `<div class="social-task-comments"><h4>${tr("РљРѕРјРјРµРЅС‚Р°СЂРёРё", "Comments")}</h4>${comments.length ? comments.map((comment) => `<div class="social-task-comment"><b>${escapeHtml(comment.author_nick || "-")}</b><small>${escapeHtml(String(comment.created_at || "").slice(0, 16).replace("T", " "))}</small><div>${escapeHtml(comment.text || "")}</div></div>`).join("") : `<div class="hint">${escapeHtml(tr("РљРѕРјРјРµРЅС‚Р°СЂРёРµРІ РїРѕРєР° РЅРµС‚", "No comments yet"))}</div>`}<div class="grid-2"><input id="socialTaskCommentInput" placeholder="${escapeHtml(tr("РљРѕРјРјРµРЅС‚Р°СЂРёР№", "Comment"))}" /><button type="button" onclick="socialAddTaskComment(${Number(task.id || 0)})">${tr("Р”РѕР±Р°РІРёС‚СЊ", "Add")}</button></div></div>` : ""}<div class="actions"><button type="button" onclick="socialSaveTask(${task ? Number(task.id || 0) : 0})">${task ? tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save") : tr("РЎРѕР·РґР°С‚СЊ", "Create")}</button></div>`
    );
    socialSyncTaskKindForm();
    socialState.taskDraftKind = "";
  };

  socialCalendarOpenCreateFromMode = function socialCalendarOpenCreateFromModeOverride(mode = "") {
    const safeMode = String(mode || calendarActiveMode()).trim().toLowerCase();
    if (safeMode === "events") {
      socialOpenCalendarModal();
      return;
    }
    socialState.taskDraftKind = safeMode === "my_tasks" ? "personal" : "company";
    socialOpenTaskModal(0, socialState.taskDraftKind);
  };

  const originalOpenCalendarModal = typeof socialOpenCalendarModal === "function" ? socialOpenCalendarModal : null;
  if (originalOpenCalendarModal) {
    socialOpenCalendarModal = async function socialOpenCalendarModalOverride(eventId = 0) {
      await originalOpenCalendarModal.call(this, eventId);
      const grid = document.querySelector(".social-calendar-edit-grid");
      const titleInput = document.getElementById("socialEventTitle");
      if (!grid || !titleInput || document.getElementById("socialEventColor")) return;
      const eventRow = (socialState?.calendarEvents || []).find((item) => Number(socialCalendarEventBaseId(item) || 0) === Number(eventId || 0)) || null;
      const currentColor = /^#[0-9a-fA-F]{6}$/.test(String(eventRow?.color || "").trim()) ? String(eventRow.color).trim() : "#9dc4ff";
      const titleLabel = titleInput.closest("label");
      const colorLabel = document.createElement("label");
      colorLabel.innerHTML = `<span>${escapeHtml(tr("Цвет", "Color"))}</span><div class="social-event-color-row"><input id="socialEventColor" type="color" value="${escapeHtml(currentColor)}" /><span class="hint">${escapeHtml(tr("Цвет события будет виден на календаре.", "The event color is shown on the calendar."))}</span></div>`;
      if (titleLabel && titleLabel.nextElementSibling) {
        titleLabel.insertAdjacentElement("afterend", colorLabel);
      } else {
        grid.appendChild(colorLabel);
      }
    };
  }

  socialSaveEvent = async function socialSaveEventOverride(eventId = 0) {
    const startAt = String(document.getElementById("socialEventStart")?.value || "").trim();
    const endAt = String(document.getElementById("socialEventEnd")?.value || "").trim();
    const recurrenceKind = String(document.getElementById("socialEventRecurrenceKind")?.value || "none").trim().toLowerCase();
    const recurrenceInterval = Math.max(1, Math.round(Number(document.getElementById("socialEventRecurrenceInterval")?.value || 1)) || 1);
    const reminderEnabled = Boolean(document.getElementById("socialEventReminderEnabled")?.checked);
    const payload = {
      title: String(document.getElementById("socialEventTitle")?.value || "").trim(),
      details: String(document.getElementById("socialEventDetails")?.value || "").trim(),
      start_at: startAt,
      end_at: endAt || null,
      is_public: Boolean(document.getElementById("socialEventPublic")?.checked),
      color: String(document.getElementById("socialEventColor")?.value || "").trim(),
      recurrence_kind: recurrenceKind,
      recurrence_interval: recurrenceKind === "none" ? 1 : recurrenceInterval,
      reminder_enabled: reminderEnabled,
      reminder_offsets_min: reminderEnabled ? socialCalendarCollectReminderOffsets() : [],
    };
    if (!payload.title || !payload.start_at) {
      alert(tr("Заполните название и дату начала", "Fill title and start date"));
      return;
    }
    const startDate = socialCalendarParseDate(payload.start_at);
    const endDate = payload.end_at ? socialCalendarParseDate(payload.end_at) : null;
    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      alert(tr("Время окончания не может быть раньше начала", "End time cannot be earlier than start time"));
      return;
    }
    const requestPromise = eventId > 0
      ? socialRequest(`/api/social/calendar/events/${Number(eventId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : socialRequest("/api/social/calendar/events", { method: "POST", body: JSON.stringify(payload) });
    const saved = await requestPromise.catch((e) => {
      alert(e.message);
      return null;
    });
    if (!saved) return;
    socialState.calendarSelectedDay = socialCalendarDayKey(saved?.start_at || payload.start_at) || socialState.calendarSelectedDay;
    socialCloseModal();
    await socialLoadCalendar();
  };

  socialRenderCalendar = function socialRenderCalendarOverride() {
    const grid = document.getElementById("socialCalendarGrid");
    const list = document.getElementById("socialCalendarEvents");
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (!grid || !list) return;
    syncCalendarModeCopy();
    syncCalendarPrimaryAction();

    const date = socialState.calendarDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    const todayKey = socialCalendarDayKey(new Date());
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = lastDay.getDate();
    const mode = calendarActiveMode();
    const compact = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 980px)").matches;
    const previewLimit = compact ? 1 : 2;

    if (monthLabel) monthLabel.textContent = socialCalendarMonthLabel(date);

    let html = `<div class="social-calendar-row head">${[
      tr("РџРЅ", "Mon"),
      tr("Р’С‚", "Tue"),
      tr("РЎСЂ", "Wed"),
      tr("Р§С‚", "Thu"),
      tr("РџС‚", "Fri"),
      tr("РЎР±", "Sat"),
      tr("Р’СЃ", "Sun"),
    ].map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div><div class="social-calendar-cells">`;

    for (let i = 0; i < shift; i += 1) {
      html += `<button class="social-day muted rich" disabled type="button"></button>`;
    }

    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${socialCalendarPad(month + 1)}-${socialCalendarPad(day)}`;
      const rows = calendarModeRowsForDay(key);
      const preview = rows.slice(0, previewLimit).map((item) => calendarPreviewPill(item, mode)).join("");
      const moreCount = rows.length - previewLimit;
      const active = socialState.calendarSelectedDay === key ? "active" : "";
      const isToday = todayKey && key === todayKey ? "today" : "";
      const hasRows = rows.length ? "has-preview" : "";
      html += `
        <button class="social-day rich ${active} ${isToday} ${hasRows}" data-day-key="${key}" type="button" onclick="socialShowDay('${key}')">
          <div class="social-day-head">
            <b>${day}</b>
            ${todayKey && key === todayKey ? `<span class="social-day-badge">${escapeHtml(tr("РЎРµРіРѕРґРЅСЏ", "Today"))}</span>` : ""}
          </div>
          <div class="social-day-preview-stack">${preview}</div>
          ${moreCount > 0 ? `<div class="social-day-more">+${moreCount}</div>` : ""}
        </button>
      `;
    }

    html += "</div>";
    grid.innerHTML = html;
    const inMonth = String(socialState.calendarSelectedDay || "").startsWith(`${year}-${socialCalendarPad(month + 1)}-`);
    const fallback = (todayKey && String(todayKey).startsWith(`${year}-${socialCalendarPad(month + 1)}-`)) ? todayKey : `${year}-${socialCalendarPad(month + 1)}-01`;
    socialShowDay(inMonth ? socialState.calendarSelectedDay : fallback);
  };

  socialShowDay = function socialShowDayOverride(dayKey) {
    const list = document.getElementById("socialCalendarEvents");
    if (!list) return;
    socialState.calendarSelectedDay = dayKey;
    syncCalendarPrimaryAction();

    const mode = calendarActiveMode();
    const rows = calendarModeRowsForDay(dayKey);
    const title = socialCalendarDayLabel(dayKey);
    const action = calendarPrimaryActionConfig(mode);

    const cards = rows.length ? rows.map((row) => {
      if (mode === "events") {
        const timeLabel = row?.start_at ? `${socialCalendarTimeLabel(row.start_at)}${row?.end_at ? ` - ${socialCalendarTimeLabel(row.end_at)}` : ""}` : tr("Р’РµСЃСЊ РґРµРЅСЊ", "All day");
        const meta = [
          row?.is_public ? tr("РћР±С‰РµРµ", "Shared") : tr("Р›РёС‡РЅРѕРµ", "Private"),
          socialCalendarRecurrenceLabel(row?.recurrence_kind, row?.recurrence_interval),
          socialCalendarReminderSummary(row?.reminder_offsets_min, row?.reminder_enabled !== false),
        ].filter(Boolean).join(" / ");
        return `<article class="social-calendar-day-card is-event" style="--social-preview-color:${escapeHtml(calendarPreviewColor(row, \"events\"))}"><div class="social-calendar-day-card-body" onclick="socialOpenCalendarModal(${socialCalendarEventBaseId(row)})"><div class="social-calendar-day-card-meta">${escapeHtml(timeLabel)}${meta ? ` · ${escapeHtml(meta)}` : ""}</div><h5>${escapeHtml(row?.title || "-")}</h5><div class="social-calendar-day-card-desc">${escapeHtml(socialCleanCalendarDetails(row?.details || "") || tr("Р‘РµР· РѕРїРёСЃР°РЅРёСЏ", "No description"))}</div></div><div class="social-calendar-day-card-actions"><button type="button" onclick="socialOpenCalendarModal(${socialCalendarEventBaseId(row)})">${tr("РћС‚РєСЂС‹С‚СЊ", "Open")}</button><button class="btn-danger" type="button" onclick="socialDeleteEvent(${socialCalendarEventBaseId(row)})">${tr("РЈРґР°Р»РёС‚СЊ", "Delete")}</button></div></article>`;
      }

      const id = Number(row?.id || 0);
      const status = String(row?.status || "todo").trim().toLowerCase();
      const pending = socialTaskPendingDone.has(id);
      const isDone = status === "done" || pending;
      const meta = [taskProjectMeta(row), String(row?.assignee_nick || "").trim(), taskStatusLabel(row?.status)].filter(Boolean).join(" / ");
      return `<article class="social-calendar-day-card is-task ${isDone ? "is-done" : ""}" style="--social-preview-color:${escapeHtml(calendarPreviewColor(row, \"tasks\"))}"><button class="social-calendar-day-card-check social-task-check ${isDone ? "is-done" : ""}" type="button" onclick="socialToggleTaskDone(${id}); event.stopPropagation();" title="${escapeHtml(tr("РћС‚РјРµС‚РёС‚СЊ РІС‹РїРѕР»РЅРµРЅРЅРѕР№", "Mark as done"))}">${isDone ? "✓" : ""}</button><div class="social-calendar-day-card-body" onclick="socialOpenTaskModal(${id})"><div class="social-calendar-day-card-meta">${escapeHtml(socialTaskDueLabel(row))}${meta ? ` · ${escapeHtml(meta)}` : ""}</div><h5>${escapeHtml(row?.title || "-")}</h5><div class="social-calendar-day-card-desc">${escapeHtml(String(row?.description || "").trim() || tr("Р‘РµР· РѕРїРёСЃР°РЅРёСЏ", "No description"))}</div>${pending ? `<div class="social-task-pending">${escapeHtml(tr("Р—Р°РґР°С‡Р° Р·Р°РІРµСЂС€РёС‚СЃСЏ С‡РµСЂРµР· 5 СЃРµРєСѓРЅРґ. РќР°Р¶РјРёС‚Рµ РµС‰Рµ СЂР°Р·, С‡С‚РѕР±С‹ РѕС‚РјРµРЅРёС‚СЊ.", "Task will be completed in 5 seconds. Tap again to undo."))}</div>` : ""}</div><div class="social-calendar-day-card-actions"><button type="button" onclick="socialOpenTaskModal(${id})">${tr("РћС‚РєСЂС‹С‚СЊ", "Open")}</button></div></article>`;
    }).join("") : `<div class="social-note-empty">${escapeHtml(mode === "events" ? tr("РќР° СЌС‚РѕС‚ РґРµРЅСЊ СЃРѕР±С‹С‚РёР№ РЅРµС‚.", "No events for this day.") : tr("РќР° СЌС‚РѕС‚ РґРµРЅСЊ Р·Р°РґР°С‡ РЅРµС‚.", "No tasks for this day."))}</div>`;

    list.innerHTML = `<section class="social-calendar-day-sheet"><div class="social-calendar-day-sheet-head"><div><span class="social-calendar-day-sheet-kicker">${escapeHtml(mode === "events" ? tr("Р’С‹Р±СЂР°РЅРЅС‹Р№ РґРµРЅСЊ", "Selected day") : (mode === "my_tasks" ? tr("РњРѕРё Р·Р°РґР°С‡Рё РЅР° РґРµРЅСЊ", "My tasks for the day") : tr("Р—Р°РґР°С‡Рё РЅР° РґРµРЅСЊ", "Tasks for the day")))}</span><h4 class="social-calendar-day-sheet-date">${escapeHtml(title)}</h4></div><div class="social-calendar-day-sheet-stat">${escapeHtml(`${rows.length} ${mode === "events" ? tr("Р·Р°РїРёСЃРµР№", "items") : tr("Р·Р°РґР°С‡", "tasks")}`)}</div></div><div class="social-calendar-day-sheet-list">${cards}</div><div class="social-calendar-day-sheet-footer"><button type="button" onclick="${action.onclick}">${escapeHtml(action.label)}</button></div></section>`;

    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.querySelectorAll(".social-day[data-day-key]").forEach((button) => {
        button.classList.toggle("active", String(button.getAttribute("data-day-key") || "") === dayKey);
      });
    }
  };
  function notePreviewText(note) {
    const raw = socialNormalizeNoteText(note?.content || "").replace(/\s+/g, " ").trim();
    return raw || tr("РџСѓСЃС‚Р°СЏ Р·Р°РјРµС‚РєР°", "Empty note");
  }

  function noteUpdatedLabel(note) {
    const value = String(note?.updated_at || "").trim();
    if (!value) return "-";
    const parsed = socialParseDateSafe(value);
    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
      return value.replace("T", " ").slice(0, 16);
    }
    return parsed.toLocaleString(currentLang === "en" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function noteStatLabel(note) {
    const textLength = String(note?.content || "").trim().length;
    const filesCount = Array.isArray(note?.files) ? note.files.length : 0;
    return filesCount > 0 ? tr(`${textLength} СЃРёРјРІРѕР»РѕРІ · ${filesCount} С„Р°Р№Р»(РѕРІ)`, `${textLength} chars · ${filesCount} file(s)`) : tr(`${textLength} СЃРёРјРІРѕР»РѕРІ`, `${textLength} chars`);
  }

  function openNoteModal(noteId) {
    const note = (socialState?.notes || []).find((row) => Number(row?.id || 0) === Number(noteId || 0)) || null;
    if (!note) return;
    socialOpenModal(
      tr("Р—Р°РјРµС‚РєР°", "Note"),
      `<div class="social-note-editor-modal"><div class="social-note-editor-toolbar"><div class="social-note-editor-meta"><strong>${escapeHtml(noteUpdatedLabel(note))}</strong><span id="socialNoteAutosave">${escapeHtml(tr("РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ РІРєР»СЋС‡РµРЅРѕ", "Autosave enabled"))}</span></div><div class="social-note-editor-actions"><button class="btn-secondary" type="button" onclick="socialTriggerNoteFileDialog()">${tr("Р¤Р°Р№Р»С‹", "Files")}</button><button class="btn-danger" type="button" onclick="socialDeleteCurrentNote()">${tr("РЈРґР°Р»РёС‚СЊ", "Delete")}</button></div></div><div class="social-note-editor-body"><input id="socialNoteTitle" value="${escapeHtml(socialNormalizeNoteText(note?.title || ""))}" placeholder="${escapeHtml(tr("РќР°Р·РІР°РЅРёРµ Р·Р°РјРµС‚РєРё", "Note title"))}" oninput="socialScheduleNoteSave()" /><textarea id="socialNoteContent" rows="14" placeholder="${escapeHtml(tr("РўРµРєСЃС‚ Р·Р°РјРµС‚РєРё", "Note text"))}" oninput="socialScheduleNoteSave()">${escapeHtml(socialNormalizeNoteText(note?.content || ""))}</textarea></div><div class="social-note-editor-files"><div class="social-note-editor-files-head"><strong>${tr("Р’Р»РѕР¶РµРЅРёСЏ", "Attachments")}</strong><span class="hint">${escapeHtml(tr("РќР°Р¶РјРёС‚Рµ В«Р¤Р°Р№Р»С‹В», С‡С‚РѕР±С‹ РґРѕР±Р°РІРёС‚СЊ РІР»РѕР¶РµРЅРёСЏ.", "Press вЂњFilesвЂќ to add attachments."))}</span></div><div id="socialNoteFiles"></div><input id="socialNoteFileUpload" type="file" multiple class="hidden" onchange="socialUploadNoteFiles(this.files)" /></div><div class="actions"><button type="button" onclick="socialSaveCurrentNote()">${tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save")}</button></div></div>`
    );
    socialRenderCurrentNote();
  }

  socialLoadNotes = async function socialLoadNotesOverride() {
    const rows = await socialRequest("/api/social/notes").catch((e) => {
      alert(e.message);
      return [];
    });
    socialState.notes = Array.isArray(rows) ? rows.map((row) => normalizeNoteRow(row)).filter(Boolean) : [];
    if (!socialState.currentNoteId && socialState.notes.length) socialState.currentNoteId = Number(socialState.notes[0].id || 0);
    const kicker = document.querySelector("#socialSubtabNotes .social-calendar-kicker");
    if (kicker) kicker.textContent = tr("Р‘С‹СЃС‚СЂС‹Рµ Р·Р°РјРµС‚РєРё", "Quick notes");
    socialRenderNotesList();
    socialRenderCurrentNote();
  };

  socialRenderNotesList = function socialRenderNotesListOverride() {
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    const rows = Array.isArray(socialState?.notes) ? socialState.notes : [];
    host.innerHTML = rows.map((row) => {
      const active = Number(row?.id || 0) === Number(socialState?.currentNoteId || 0);
      const title = String(row?.title || tr("Р‘РµР· РЅР°Р·РІР°РЅРёСЏ", "Untitled")).trim() || tr("Р‘РµР· РЅР°Р·РІР°РЅРёСЏ", "Untitled");
      return `<article class="social-note-card ${active ? "active" : ""}"><button class="social-note-card-delete" type="button" onclick="socialDeleteNote(${Number(row?.id || 0)}); event.stopPropagation();" title="${escapeHtml(tr("РЈРґР°Р»РёС‚СЊ", "Delete"))}">✕</button><button class="social-note-card-main" type="button" onclick="socialSelectNote(${Number(row?.id || 0)})"><div class="social-note-card-surface"><h4 class="social-note-card-title">${escapeHtml(title)}</h4><div class="social-note-card-snippet">${escapeHtml(notePreviewText(row))}</div></div><div class="social-note-card-meta"><span>${escapeHtml(noteUpdatedLabel(row))}</span><span>${escapeHtml(noteStatLabel(row))}</span></div></button></article>`;
    }).join("") || `<div class="social-note-empty">${escapeHtml(tr("Р—Р°РјРµС‚РѕРє РїРѕРєР° РЅРµС‚. РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ РєР°СЂС‚РѕС‡РєСѓ.", "No notes yet. Create your first card."))}</div>`;
  };

  socialRenderCurrentNote = function socialRenderCurrentNoteOverride() {
    const note = (socialState?.notes || []).find((row) => Number(row?.id || 0) === Number(socialState?.currentNoteId || 0)) || null;
    const title = document.getElementById("socialNoteTitle");
    const content = document.getElementById("socialNoteContent");
    const autosave = document.getElementById("socialNoteAutosave");
    if (title) {
      title.disabled = !note;
      title.value = note ? socialNormalizeNoteText(note?.title || "") : "";
    }
    if (content) {
      content.disabled = !note;
      content.value = note ? socialNormalizeNoteText(note?.content || "") : "";
    }
    if (autosave) autosave.textContent = note ? tr("РђРІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёРµ РІРєР»СЋС‡РµРЅРѕ", "Autosave enabled") : tr("Р’С‹Р±РµСЂРёС‚Рµ Р·Р°РјРµС‚РєСѓ", "Select a note");
    socialRenderNoteFiles(note);
  };

  socialSelectNote = function socialSelectNoteOverride(noteId) {
    socialState.currentNoteId = Number(noteId || 0);
    socialRenderNotesList();
    openNoteModal(socialState.currentNoteId);
  };

  socialCreateNote = async function socialCreateNoteOverride() {
    const row = await socialRequest("/api/social/notes", { method: "POST", body: JSON.stringify({ title: tr("РќРѕРІР°СЏ Р·Р°РјРµС‚РєР°", "New note"), content: "" }) }).catch((e) => {
      alert(e.message);
      return null;
    });
    if (!row) return;
    await socialLoadNotes();
    socialSelectNote(Number(row.id || 0));
  };

  socialSaveCurrentNote = async function socialSaveCurrentNoteOverride() {
    const noteId = Number(socialState?.currentNoteId || 0);
    if (!noteId) return;
    const titleNode = document.getElementById("socialNoteTitle");
    const contentNode = document.getElementById("socialNoteContent");
    const autosave = document.getElementById("socialNoteAutosave");
    const payload = { title: String(titleNode?.value || "").trim() || tr("Р‘РµР· РЅР°Р·РІР°РЅРёСЏ", "Untitled"), content: String(contentNode?.value || "") };
    if (autosave) autosave.textContent = tr("РЎРѕС…СЂР°РЅСЏРµРј...", "Saving...");
    const saved = await socialRequest(`/api/social/notes/${noteId}`, { method: "PUT", body: JSON.stringify(payload) }).catch((e) => {
      if (autosave) autosave.textContent = String(e?.message || tr("РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ", "Save error"));
      return null;
    });
    if (!saved) return;
    const normalized = normalizeNoteRow(saved);
    const index = (socialState?.notes || []).findIndex((row) => Number(row?.id || 0) === noteId);
    if (index >= 0) socialState.notes[index] = normalized; else socialState.notes = [normalized].concat(Array.isArray(socialState?.notes) ? socialState.notes : []);
    socialRenderNotesList();
    socialRenderCurrentNote();
    if (autosave) autosave.textContent = tr("РЎРѕС…СЂР°РЅРµРЅРѕ", "Saved");
  };

  socialRenderNoteFiles = function socialRenderNoteFilesOverride(note) {
    const host = document.getElementById("socialNoteFiles");
    const uploader = document.getElementById("socialNoteFileUpload");
    if (!host) return;
    if (!note) {
      host.innerHTML = `<div class="hint">${escapeHtml(tr("Р¤Р°Р№Р»С‹ РїРѕСЏРІСЏС‚СЃСЏ РїРѕСЃР»Рµ РѕС‚РєСЂС‹С‚РёСЏ Р·Р°РјРµС‚РєРё.", "Files will appear after opening a note."))}</div>`;
      if (uploader) uploader.disabled = true;
      return;
    }
    if (uploader) uploader.disabled = false;
    const files = Array.isArray(note?.files) ? note.files : [];
    host.innerHTML = files.length ? files.map((file) => `<div class="social-note-file-row"><a href="${escapeHtml(file.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.filename || "file")}</a><small>${escapeHtml(socialFormatFileSize(file.size_bytes || 0))}</small><button class="btn-secondary" type="button" onclick="socialDeleteNoteFile(${Number(file.id || 0)})">${tr("РЈРґР°Р»РёС‚СЊ", "Delete")}</button></div>`).join("") : `<div class="hint">${escapeHtml(tr("Р¤Р°Р№Р»С‹ РїРѕРєР° РЅРµ Р·Р°РіСЂСѓР¶РµРЅС‹.", "No files uploaded yet."))}</div>`;
  };

  socialTriggerNoteFileDialog = function socialTriggerNoteFileDialogOverride() {
    const noteId = Number(socialState?.currentNoteId || 0);
    if (!noteId) {
      alert(tr("РЎРЅР°С‡Р°Р»Р° РѕС‚РєСЂРѕР№С‚Рµ Р·Р°РјРµС‚РєСѓ.", "Open a note first."));
      return;
    }
    const input = document.getElementById("socialNoteFileUpload");
    if (input) input.click();
  };

  socialUploadNoteFiles = async function socialUploadNoteFilesOverride(fileList) {
    const noteId = Number(socialState?.currentNoteId || 0);
    const autosave = document.getElementById("socialNoteAutosave");
    const input = document.getElementById("socialNoteFileUpload");
    const files = Array.from(fileList || []);
    if (!noteId || !files.length) return;
    if (autosave) autosave.textContent = tr("Р—Р°РіСЂСѓР¶Р°РµРј С„Р°Р№Р»С‹...", "Uploading files...");
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        await requestJson(`/api/social/notes/${noteId}/files`, { method: "POST", headers, body, timeoutMs: 90000, retryOnPost: true, maxRetries: 1 });
      }
      await socialLoadNotes();
      socialState.currentNoteId = noteId;
      socialRenderNotesList();
      socialRenderCurrentNote();
      if (autosave) autosave.textContent = tr("Р¤Р°Р№Р»С‹ Р·Р°РіСЂСѓР¶РµРЅС‹", "Files uploaded");
    } catch (e) {
      const message = e?.message || tr("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»Р°", "File upload error");
      if (autosave) autosave.textContent = String(message);
      alert(message);
    } finally {
      if (input) input.value = "";
    }
  };

  socialDeleteNoteFile = async function socialDeleteNoteFileOverride(fileId) {
    const id = Number(fileId || 0);
    const noteId = Number(socialState?.currentNoteId || 0);
    if (!id || !noteId) return;
    if (!confirm(tr("РЈРґР°Р»РёС‚СЊ С„Р°Р№Р»?", "Delete file?"))) return;
    await socialRequest(`/api/social/notes/${noteId}/files/${id}`, { method: "DELETE" }).catch((e) => {
      alert(e.message);
      return null;
    });
    await socialLoadNotes();
    socialState.currentNoteId = noteId;
    socialRenderNotesList();
    socialRenderCurrentNote();
  };

  socialDeleteCurrentNote = async function socialDeleteCurrentNoteOverride() {
    const noteId = Number(socialState?.currentNoteId || 0);
    if (!noteId) return;
    await socialDeleteNote(noteId);
  };

  socialDeleteNote = async function socialDeleteNoteOverride(noteId) {
    const id = Number(noteId || 0);
    if (!id) return;
    if (!confirm(tr("РЈРґР°Р»РёС‚СЊ Р·Р°РјРµС‚РєСѓ?", "Delete note?"))) return;
    await socialRequest(`/api/social/notes/${id}`, { method: "DELETE" }).catch((e) => {
      alert(e.message);
      return null;
    });
    if (Number(socialState?.currentNoteId || 0) === id) {
      socialState.currentNoteId = 0;
      socialCloseModal();
    }
    await socialLoadNotes();
  };

  syncCalendarModeCopy();
  syncCalendarPrimaryAction();
})();
(function socialProjectModalTextOverride() {
  socialOpenProjectModal = function socialOpenProjectModalOverride() {
    socialOpenModal(
      tr("РќРѕРІС‹Р№ РїСЂРѕРµРєС‚", "New project"),
      `<div class="grid-1"><input id="socialProjectTitle" placeholder="${escapeHtml(tr("РќР°Р·РІР°РЅРёРµ РїСЂРѕРµРєС‚Р°", "Project title"))}" /><textarea id="socialProjectDescription" rows="4" placeholder="${escapeHtml(tr("РљСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ РїСЂРѕРµРєС‚Р°", "Short project description"))}"></textarea></div><div class="actions"><button type="button" onclick="socialCreateProject()">${tr("РЎРѕР·РґР°С‚СЊ", "Create")}</button></div>`
    );
  };

  socialOpenProjectMembersModal = async function socialOpenProjectMembersModalOverride() {
    const projectId = Number(document.getElementById("socialTaskProjectFilter")?.value || 0);
    if (!projectId) {
      alert(tr("РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ РїСЂРѕРµРєС‚ РІ С„РёР»СЊС‚СЂРµ.", "Select a project in the filter first."));
      return;
    }
    const rows = await socialRequest(`/api/social/tasks/projects/${projectId}/members`).catch((e) => {
      alert(e.message || tr("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєРѕРІ РїСЂРѕРµРєС‚Р°", "Failed to load project members"));
      return null;
    });
    if (!Array.isArray(rows)) return;
    const list = rows.map((row) => {
      const key = String(row?.actor_key || "").trim();
      const nick = String(row?.nick || key || "-").trim() || "-";
      const checked = row?.in_project ? "checked" : "";
      const ownerTag = row?.is_owner ? `<span class="social-task-kind company">${escapeHtml(tr("Р’Р»Р°РґРµР»РµС†", "Owner"))}</span>` : "";
      return `<label class="check social-member-row"><input type="checkbox" data-member-key="${escapeHtml(key)}" ${checked} /> ${socialAvatarMarkup(String(row?.avatar_url || ""), nick, "xs")} <span>${escapeHtml(nick)}</span> ${ownerTag}</label>`;
    }).join("");
    socialOpenModal(
      tr("РЈС‡Р°СЃС‚РЅРёРєРё РїСЂРѕРµРєС‚Р°", "Project members"),
      `<div id="socialProjectMembersList" class="social-group-members-list">${list || `<div class="hint">${escapeHtml(tr("РЎРїРёСЃРѕРє РїРѕРєР° РїСѓСЃС‚", "No members yet"))}</div>`}</div><div class="actions"><button type="button" onclick="socialSaveProjectMembers(${projectId})">${tr("РЎРѕС…СЂР°РЅРёС‚СЊ", "Save")}</button></div>`
    );
  };
})();



(function socialSamsungCalendarRefitV20260320() {
  if (typeof window === "undefined") return;
  if (window.__socialSamsungCalendarRefitV20260320) return;
  window.__socialSamsungCalendarRefitV20260320 = true;

  function i18n(ru, en) {
    return currentLang === "en" ? en : ru;
  }

  function normDate(value) {
    if (typeof socialCalendarParseDate === "function") return socialCalendarParseDate(value);
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function dayKey(value) {
    if (typeof socialCalendarDayKey === "function") return socialCalendarDayKey(value);
    const dt = normDate(value);
    if (!dt) return "";
    const m = `${dt.getMonth() + 1}`.padStart(2, "0");
    const d = `${dt.getDate()}`.padStart(2, "0");
    return `${dt.getFullYear()}-${m}-${d}`;
  }

  function timeLabel(value) {
    if (typeof socialCalendarTimeLabel === "function") return socialCalendarTimeLabel(value);
    const dt = normDate(value);
    if (!dt) return "";
    return dt.toLocaleTimeString(currentLang === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function dayLabel(value) {
    if (typeof socialCalendarDayLabel === "function") return socialCalendarDayLabel(value);
    const dt = normDate(value);
    if (!dt) return String(value || "");
    return dt.toLocaleDateString(currentLang === "en" ? "en-US" : "ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function currentMode() {
    const mode = String(socialState?.calendarTaskFilter || "events").trim().toLowerCase();
    if (mode === "tasks") return "tasks";
    if (mode === "my_tasks") return "my_tasks";
    return "events";
  }

  function eventBaseId(row) {
    if (typeof socialCalendarEventBaseId === "function") return Number(socialCalendarEventBaseId(row) || 0);
    return Number(row?.id || 0);
  }

  function rowColor(row, mode) {
    const raw = String(row?.color || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
    if (mode === "events") return "#b9d5ff";
    return String(row?.task_kind || "").trim().toLowerCase() === "personal" ? "#bde5c8" : "#d8e6ff";
  }

  function eventRowsForDay(day) {
    return (socialState?.calendarEvents || [])
      .filter((row) => dayKey(row?.start_at || "") === day)
      .sort((a, b) => (normDate(a?.start_at)?.getTime() || 0) - (normDate(b?.start_at)?.getTime() || 0));
  }

  function taskRowsForDay(day, mode) {
    return (socialState?.tasks || [])
      .filter((row) => dayKey(row?.due_date || "") === day)
      .filter((row) => mode !== "my_tasks" || String(row?.task_kind || "").trim().toLowerCase() === "personal")
      .sort((a, b) => (normDate(a?.due_date)?.getTime() || 0) - (normDate(b?.due_date)?.getTime() || 0));
  }

  function rowsForDay(day, mode) {
    if (mode === "events") return eventRowsForDay(day);
    return taskRowsForDay(day, mode);
  }

  function renderCellChip(row, mode) {
    const title = String(row?.title || "-").trim() || "-";
    const isEvent = mode === "events";
    const rawTime = isEvent ? String(row?.start_at || "").trim() : String(row?.due_date || "").trim();
    const time = rawTime ? timeLabel(rawTime) : "";
    const style = `style="--sw-chip-color:${escapeHtml(rowColor(row, mode))}"`;
    return `<span class="sw-calendar-chip ${isEvent ? "is-event" : "is-task"}" ${style}><span class="sw-calendar-chip-title">${escapeHtml(time ? `${time} ${title}` : title)}</span></span>`;
  }

  function setModeButtonsState(mode) {
    const host = document.getElementById("socialCalendarTaskMode");
    if (!host) return;
    host.querySelectorAll("[data-mode]").forEach((btn) => {
      const key = String(btn.getAttribute("data-mode") || "").trim().toLowerCase();
      btn.classList.toggle("is-active", key === mode);
    });
  }

  function calendarMonthTitle(date) {
    const dt = normDate(date) || new Date();
    const month = dt.toLocaleDateString(currentLang === "en" ? "en-US" : "ru-RU", { month: "long" });
    return String(month || "").toUpperCase();
  }

  function ensureCalendarFab() {
    const shell = document.querySelector("#socialSubtabCalendar .social-calendar-shell");
    if (!shell) return;
    let fab = document.getElementById("socialCalendarSamsungFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "socialCalendarSamsungFab";
      fab.className = "social-calendar-samsung-fab";
      fab.type = "button";
      fab.textContent = "+";
      fab.setAttribute("aria-label", i18n("Добавить", "Add"));
      fab.setAttribute("title", i18n("Добавить", "Add"));
      fab.setAttribute("onclick", "socialCalendarSamsungOpenCreate()");
      shell.appendChild(fab);
    }
  }

  function hideLegacyCalendarControls() {
    const root = document.getElementById("socialSubtabCalendar");
    if (!root) return;
    root.classList.add("social-calendar-samsung-mode");
  }

  function buildDayItem(row, mode, index, selectedDay) {
    const isEvent = mode === "events";
    const rowId = isEvent ? eventBaseId(row) : Number(row?.id || 0);
    const key = `${mode}:${rowId}:${index}:${selectedDay}`;
    const expanded = String(socialState?.calendarExpandedItemKey || "") === key;
    const title = String(row?.title || "-").trim() || "-";
    const time = isEvent
      ? (String(row?.start_at || "").trim() ? `${timeLabel(row.start_at)}${row?.end_at ? ` - ${timeLabel(row.end_at)}` : ""}` : i18n("Весь день", "All day"))
      : (String(row?.due_date || "").trim() ? timeLabel(row.due_date) : i18n("Без времени", "No time"));
    const descriptionRaw = isEvent
      ? (typeof socialCleanCalendarDetails === "function" ? socialCleanCalendarDetails(row?.details || "") : String(row?.details || "").trim())
      : String(row?.description || "").trim();
    const description = descriptionRaw || i18n("Без описания", "No description");
    const recurrence = isEvent && typeof socialCalendarRecurrenceLabel === "function"
      ? socialCalendarRecurrenceLabel(row?.recurrence_kind, row?.recurrence_interval)
      : "";
    const reminder = isEvent && typeof socialCalendarReminderSummary === "function"
      ? socialCalendarReminderSummary(row?.reminder_offsets_min, row?.reminder_enabled !== false)
      : "";
    const taskStatus = !isEvent ? (String(row?.status || "todo").trim().toLowerCase() === "done" ? i18n("Выполнена", "Done") : i18n("К выполнению", "To do")) : "";
    const assignee = !isEvent ? String(row?.assignee_nick || "").trim() : "";
    const metaBits = isEvent
      ? [
          row?.is_public ? i18n("Общее", "Shared") : i18n("Личное", "Private"),
          recurrence,
          reminder,
        ].filter(Boolean)
      : [
          taskStatus,
          assignee,
        ].filter(Boolean);
    const meta = metaBits.join(" · ");
    const color = rowColor(row, mode);
    const openFn = isEvent ? `socialOpenCalendarModal(${rowId})` : `socialOpenTaskModal(${rowId})`;
    const deleteFn = isEvent ? `socialDeleteEvent(${rowId})` : `socialDeleteTask(${rowId})`;

    return `
      <article class="sw-day-item ${expanded ? "is-expanded" : ""}" style="--sw-chip-color:${escapeHtml(color)}" onclick="socialToggleCalendarItemExpanded('${escapeHtml(key)}')">
        <div class="sw-day-item-head">
          <div class="sw-day-item-title-wrap">
            <div class="sw-day-item-time">${escapeHtml(time)}</div>
            <h5 class="sw-day-item-title">${escapeHtml(title)}</h5>
          </div>
          <span class="sw-day-item-arrow" aria-hidden="true">${expanded ? "v" : ">"}</span>
        </div>
        ${expanded ? `
          <div class="sw-day-item-body">
            ${meta ? `<div class="sw-day-item-meta">${escapeHtml(meta)}</div>` : ""}
            <div class="sw-day-item-desc">${escapeHtml(description)}</div>
            <div class="sw-day-item-actions">
              <button type="button" onclick="${openFn}; event.stopPropagation();">${escapeHtml(i18n("Редактировать", "Edit"))}</button>
              <button class="btn-danger" type="button" onclick="${deleteFn}; event.stopPropagation();">${escapeHtml(i18n("Удалить", "Delete"))}</button>
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }

  function selectedDayFallback(year, month, todayKey) {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const selected = String(socialState?.calendarSelectedDay || "").trim();
    if (selected.startsWith(monthPrefix)) return selected;
    if (todayKey && todayKey.startsWith(monthPrefix)) return todayKey;
    return `${monthPrefix}01`;
  }

  window.socialCalendarSamsungOpenCreate = function socialCalendarSamsungOpenCreate() {
    const mode = currentMode();
    if (mode === "events") {
      socialOpenCalendarModal();
      return;
    }
    socialState.taskDraftKind = mode === "my_tasks" ? "personal" : "company";
    socialOpenTaskModal(0, socialState.taskDraftKind);
  };

  window.socialToggleCalendarItemExpanded = function socialToggleCalendarItemExpanded(key) {
    const current = String(socialState?.calendarExpandedItemKey || "");
    socialState.calendarExpandedItemKey = current === String(key || "") ? "" : String(key || "");
    const selected = String(socialState?.calendarSelectedDay || "").trim();
    if (selected) socialShowDay(selected);
  };

  socialRenderCalendar = function socialRenderCalendarSamsungOverride() {
    const grid = document.getElementById("socialCalendarGrid");
    const list = document.getElementById("socialCalendarEvents");
    const monthLabel = document.getElementById("socialCalendarMonthLabel");
    if (!grid || !list) return;

    hideLegacyCalendarControls();
    ensureCalendarFab();

    const date = socialState.calendarDate instanceof Date ? socialState.calendarDate : new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 0, 0, 0, 0);
    const shift = (firstDay.getDay() + 6) % 7;
    const days = lastDay.getDate();
    const mode = currentMode();
    const todayKey = dayKey(new Date());
    const compact = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 980px)").matches;
    const previewLimit = compact ? 2 : 3;

    if (monthLabel) monthLabel.textContent = calendarMonthTitle(date);
    setModeButtonsState(mode);

    let html = `<div class="social-calendar-row head">${[
      i18n("Пн", "Mon"),
      i18n("Вт", "Tue"),
      i18n("Ср", "Wed"),
      i18n("Чт", "Thu"),
      i18n("Пт", "Fri"),
      i18n("Сб", "Sat"),
      i18n("Вс", "Sun"),
    ].map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div><div class="social-calendar-cells">`;

    for (let i = 0; i < shift; i += 1) {
      html += `<button class="social-day muted rich" type="button" disabled></button>`;
    }

    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const rows = rowsForDay(key, mode);
      const preview = rows.slice(0, previewLimit).map((row) => renderCellChip(row, mode)).join("");
      const more = rows.length - previewLimit;
      const active = String(socialState?.calendarSelectedDay || "") === key ? "active" : "";
      const today = todayKey === key ? "today" : "";
      html += `
        <button class="social-day rich ${active} ${today} ${rows.length ? "has-preview" : ""}" type="button" data-day-key="${key}" onclick="socialShowDay('${key}')">
          <div class="social-day-head"><b>${day}</b></div>
          <div class="social-day-preview-stack">${preview}</div>
          ${more > 0 ? `<div class="social-day-more">+${more}</div>` : ""}
        </button>
      `;
    }

    html += "</div>";
    grid.innerHTML = html;
    socialShowDay(selectedDayFallback(year, month, todayKey));
  };

  socialShowDay = function socialShowDaySamsungOverride(day) {
    const list = document.getElementById("socialCalendarEvents");
    if (!list) return;
    const mode = currentMode();
    const selectedDay = String(day || "").trim();
    socialState.calendarSelectedDay = selectedDay;

    const rows = rowsForDay(selectedDay, mode);
    const title = dayLabel(selectedDay);
    const cards = rows.length
      ? rows.map((row, idx) => buildDayItem(row, mode, idx, selectedDay)).join("")
      : `<div class="social-note-empty">${escapeHtml(mode === "events" ? i18n("На этот день событий нет.", "No events for this day.") : i18n("На этот день задач нет.", "No tasks for this day."))}</div>`;

    list.innerHTML = `
      <section class="sw-day-sheet">
        <header class="sw-day-sheet-head">
          <div class="sw-day-sheet-kicker">${escapeHtml(i18n("Выбранный день", "Selected day"))}</div>
          <h4 class="sw-day-sheet-date">${escapeHtml(title)}</h4>
          <div class="sw-day-sheet-stat">${escapeHtml(`${rows.length}`)} ${escapeHtml(mode === "events" ? i18n("событий", "events") : i18n("задач", "tasks"))}</div>
        </header>
        <div class="sw-day-sheet-list">${cards}</div>
      </section>
    `;

    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.querySelectorAll(".social-day[data-day-key]").forEach((btn) => {
        btn.classList.toggle("active", String(btn.getAttribute("data-day-key") || "") === selectedDay);
      });
    }
  };

  const originalRenderNotesList = typeof socialRenderNotesList === "function" ? socialRenderNotesList : null;
  socialRenderNotesList = function socialRenderNotesListCompactOverride() {
    if (originalRenderNotesList) originalRenderNotesList();
    const root = document.getElementById("socialSubtabNotes");
    if (!root) return;
    const hint = root.querySelector(".social-notes-board-copy .hint");
    if (hint) hint.textContent = i18n("Три карточки в ряд. Откройте заметку нажатием.", "Three cards per row. Tap a card to open it.");
  };

  const originalSwitchSocialSubtab = typeof switchSocialSubtab === "function" ? switchSocialSubtab : null;
  if (originalSwitchSocialSubtab && !originalSwitchSocialSubtab.__socialSamsungWrapped) {
    const wrapped = function wrappedSwitchSocialSubtab() {
      const result = originalSwitchSocialSubtab.apply(this, arguments);
      const active = String(arguments[0] || "").trim().toLowerCase();
      if (active === "calendar") {
        hideLegacyCalendarControls();
        ensureCalendarFab();
      }
      return result;
    };
    wrapped.__socialSamsungWrapped = true;
    switchSocialSubtab = wrapped;
  }

  hideLegacyCalendarControls();
  ensureCalendarFab();
})();
