(function socialOverridesV20260320() {
  if (typeof window === "undefined") return;
  if (window.__socialOverridesV20260320) return;
  window.__socialOverridesV20260320 = true;

  function taskBucketTitle(bucket) {
    const key = String(bucket || "upcoming").trim().toLowerCase();
    if (key === "today") return tr("Сегодня", "Today");
    if (key === "tomorrow") return tr("Завтра", "Tomorrow");
    if (key === "overdue") return tr("Просроченные", "Overdue");
    if (key === "done") return tr("Выполненные", "Done");
    return tr("Предстоящие", "Upcoming");
  }

  function taskStatusLabel(statusRaw) {
    const status = String(statusRaw || "todo").trim().toLowerCase();
    if (status === "in_progress") return tr("В работе", "In progress");
    if (status === "done") return tr("Выполнена", "Done");
    return tr("К выполнению", "To do");
  }

  function taskPriorityOptions(selected = "normal") {
    const safe = String(selected || "normal").trim().toLowerCase();
    const options = [
      { value: "low", label: tr("Низкий", "Low") },
      { value: "normal", label: tr("Обычный", "Normal") },
      { value: "high", label: tr("Высокий", "High") },
      { value: "critical", label: tr("Критичный", "Critical") },
    ];
    return options.map((option) => `<option value="${option.value}" ${option.value === safe ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
  }

  function taskStatusOptions(selected = "todo") {
    const safe = String(selected || "todo").trim().toLowerCase();
    const options = [
      { value: "todo", label: tr("К выполнению", "To do") },
      { value: "in_progress", label: tr("В работе", "In progress") },
      { value: "done", label: tr("Выполнена", "Done") },
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
      return tr("МОИ ЗАДАЧИ", "My tasks");
    }
    const projectTitle = String(task?.project_title || "").trim();
    return projectTitle || tr("Без проекта", "No project");
  }

  function calendarActiveMode() {
    const mode = String(socialState?.calendarTaskFilter || "events").trim().toLowerCase();
    if (mode === "tasks") return "tasks";
    if (mode === "my_tasks") return "my_tasks";
    return "events";
  }

  function syncCalendarModeCopy() {
    const kicker = document.querySelector("#socialSubtabCalendar .social-calendar-kicker");
    if (kicker) kicker.textContent = tr("Календарь", "Calendar");
    const host = document.getElementById("socialCalendarTaskMode");
    if (!host) return;
    const labels = {
      events: tr("События", "Events"),
      tasks: tr("Задачи", "Tasks"),
      my_tasks: tr("МОИ ЗАДАЧИ", "My tasks"),
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
        label: tr("Добавить мою задачу", "Add my task"),
        onclick: "socialCalendarOpenCreateFromMode('my_tasks')",
      };
    }
    if (safeMode === "tasks") {
      return {
        label: tr("Добавить задачу", "Add task"),
        onclick: "socialCalendarOpenCreateFromMode('tasks')",
      };
    }
    return {
      label: tr("Добавить событие", "Add event"),
      onclick: "socialCalendarOpenCreateFromMode('events')",
    };
  }

  function syncCalendarPrimaryAction() {
    const button = document.querySelector("#socialSubtabCalendar .social-calendar-hero-actions button:not(.btn-secondary)");
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

  function calendarPreviewPill(item, mode) {
    if (mode === "events") {
      const timeValue = String(item?.start_at || "").trim() ? socialCalendarTimeLabel(item.start_at) : tr("Весь день", "All day");
      return `<span class="social-day-preview-pill is-event"><span class="social-day-preview-time">${escapeHtml(timeValue)}</span><span class="social-day-preview-title">${escapeHtml(item?.title || "-")}</span></span>`;
    }
    const personal = String(item?.task_kind || "").trim().toLowerCase() === "personal";
    const dueLabel = String(item?.due_date || "").trim() ? socialCalendarTimeLabel(item.due_date) : tr("Без времени", "No time");
    return `<span class="social-day-preview-pill is-task ${personal ? "is-personal" : ""}"><span class="social-day-preview-time">${escapeHtml(dueLabel)}</span><span class="social-day-preview-title">${escapeHtml(item?.title || "-")}</span></span>`;
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
    const myNick = String(socialState?.boot?.actor?.nick || myKey || tr("Я", "Me")).trim() || tr("Я", "Me");
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
    const hint = isPersonal ? tr("Личная задача будет видна только вам и автоматически назначится на вас.", "This personal task is visible only to you and will be assigned to you automatically.") : tr("Проектная задача доступна участникам проекта и назначенному исполнителю.", "This project task is visible to project members and the selected assignee.");
    return `
      <div class="grid-2">
        <label><span>${tr("Название", "Title")}</span><input id="socialTaskTitle" value="${escapeHtml(task?.title || "")}" placeholder="${escapeHtml(tr("Например: Подготовить поставку", "For example: Prepare shipment"))}" /></label>
        <label><span>${tr("Тип задачи", "Task type")}</span><select id="socialTaskKind" onchange="socialSyncTaskKindForm()"><option value="company" ${kind === "company" ? "selected" : ""}>${tr("Проектная", "Project")}</option><option value="personal" ${kind === "personal" ? "selected" : ""}>${tr("МОИ ЗАДАЧИ", "My tasks")}</option></select></label>
        <label><span>${tr("Проект", "Project")}</span><select id="socialTaskProject" ${isPersonal ? "disabled" : ""}><option value="">${tr("Без проекта", "No project")}</option>${projects.map((project) => `<option value="${Number(project.id)}" ${!isPersonal && Number(task?.project_id || 0) === Number(project.id) ? "selected" : ""}>${escapeHtml(project.title || "-")}</option>`).join("")}</select></label>
        <label><span>${tr("Исполнитель", "Assignee")}</span><select id="socialTaskAssignee" ${isPersonal ? "disabled" : ""}>${actors.map((actor) => `<option value="${escapeHtml(String(actor.actor_key || ""))}" ${currentAssignee === String(actor.actor_key || "") ? "selected" : ""}>${escapeHtml(actor.nick || "-")}</option>`).join("")}</select></label>
        <div id="socialTaskKindHint" class="hint full">${escapeHtml(hint)}</div>
        <label><span>${tr("Приоритет", "Priority")}</span><select id="socialTaskPriority">${taskPriorityOptions(String(task?.priority || "normal"))}</select></label>
        <label><span>${tr("Статус", "Status")}</span><select id="socialTaskStatus">${taskStatusOptions(status)}</select></label>
        <label><span>${tr("Дедлайн", "Deadline")}</span><input id="socialTaskDue" type="datetime-local" value="${escapeHtml(due)}" /></label>
        <label class="full"><span>${tr("Описание", "Description")}</span><textarea id="socialTaskDescription" rows="5" placeholder="${escapeHtml(tr("Подробности, чек-лист, контекст", "Details, checklist, context"))}">${escapeHtml(task?.description || "")}</textarea></label>
      </div>
    `;
  };

  socialRenderTasks = function socialRenderTasksOverride() {
    const host = document.getElementById("socialTasksBoard");
    if (!host) return;
    const rows = Array.isArray(socialState?.tasks) ? socialState.tasks : [];
    const myActorKey = String(socialState?.boot?.actor?.actor_key || "").trim();
    if (!rows.length) {
      host.innerHTML = `<div class="hint">${escapeHtml(tr("Задач пока нет", "No tasks yet"))}</div>`;
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
        return `<article class="${classes.join(" ")}" data-task-id="${id}" draggable="true" ondragstart="socialTaskDragStart(event, ${id})"><button class="social-task-check ${isDone ? "is-done" : ""}" type="button" onclick="socialToggleTaskDone(${id}); event.stopPropagation();" title="${escapeHtml(tr("Отметить выполненной", "Mark as done"))}">${isDone ? "✓" : ""}</button><div class="social-task-content" onclick="socialOpenTaskModal(${id})"><div class="social-task-title-row"><b class="social-task-title-text">${escapeHtml(task?.title || "-")}</b><span class="social-task-kind ${String(task?.task_kind || "company").trim().toLowerCase() === "personal" ? "personal" : "company"}">${escapeHtml(taskProjectMeta(task))}</span></div><div class="social-task-subline"><span>${escapeHtml(socialTaskDueLabel(task))}</span>${socialTaskAssigneeMeta(task)}</div><div class="social-task-subline social-task-subline--secondary"><span>${escapeHtml(taskStatusLabel(task?.status))}</span>${String(task?.description || "").trim() ? `<span class="social-task-meta-trim">${escapeHtml(String(task.description || "").replace(/\s+/g, " ").trim())}</span>` : `<span class="social-task-meta-trim">${escapeHtml(tr("Без описания", "No description"))}</span>`}</div>${pending ? `<span class="social-task-pending">${escapeHtml(tr("Еще 5 секунд можно отменить повторным нажатием.", "You can undo within 5 seconds by tapping again."))}</span>` : ""}</div><button class="social-task-delete" type="button" onclick="socialDeleteTask(${id}); event.stopPropagation();" title="${escapeHtml(tr("Удалить", "Delete"))}">✕</button></article>`;
      }).join("")}</div></section>`;
    }).join("")}</div>`;
  };

  socialOpenTaskModal = function socialOpenTaskModalOverride(taskId = 0, forcedKind = "") {
    const task = (socialState?.tasks || []).find((row) => Number(row?.id || 0) === Number(taskId || 0)) || null;
    const comments = Array.isArray(task?.comments) ? task.comments : [];
    const resolvedKind = taskResolveDraftKind(task, forcedKind);
    socialState.taskDraftKind = resolvedKind;
    socialOpenModal(
      task ? tr("Редактировать задачу", "Edit task") : tr("Новая задача", "New task"),
      `${socialBuildTaskForm(task, resolvedKind)}${task ? `<div class="social-task-comments"><h4>${tr("Комментарии", "Comments")}</h4>${comments.length ? comments.map((comment) => `<div class="social-task-comment"><b>${escapeHtml(comment.author_nick || "-")}</b><small>${escapeHtml(String(comment.created_at || "").slice(0, 16).replace("T", " "))}</small><div>${escapeHtml(comment.text || "")}</div></div>`).join("") : `<div class="hint">${escapeHtml(tr("Комментариев пока нет", "No comments yet"))}</div>`}<div class="grid-2"><input id="socialTaskCommentInput" placeholder="${escapeHtml(tr("Комментарий", "Comment"))}" /><button type="button" onclick="socialAddTaskComment(${Number(task.id || 0)})">${tr("Добавить", "Add")}</button></div></div>` : ""}<div class="actions"><button type="button" onclick="socialSaveTask(${task ? Number(task.id || 0) : 0})">${task ? tr("Сохранить", "Save") : tr("Создать", "Create")}</button></div>`
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
    const previewLimit = compact ? 2 : 3;

    if (monthLabel) monthLabel.textContent = socialCalendarMonthLabel(date);

    let html = `<div class="social-calendar-row head">${[
      tr("Пн", "Mon"),
      tr("Вт", "Tue"),
      tr("Ср", "Wed"),
      tr("Чт", "Thu"),
      tr("Пт", "Fri"),
      tr("Сб", "Sat"),
      tr("Вс", "Sun"),
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
            ${todayKey && key === todayKey ? `<span class="social-day-badge">${escapeHtml(tr("Сегодня", "Today"))}</span>` : ""}
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
        const timeLabel = row?.start_at ? `${socialCalendarTimeLabel(row.start_at)}${row?.end_at ? ` - ${socialCalendarTimeLabel(row.end_at)}` : ""}` : tr("Весь день", "All day");
        const meta = [
          row?.is_public ? tr("Общее", "Shared") : tr("Личное", "Private"),
          socialCalendarRecurrenceLabel(row?.recurrence_kind, row?.recurrence_interval),
          socialCalendarReminderSummary(row?.reminder_offsets_min, row?.reminder_enabled !== false),
        ].filter(Boolean).join(" / ");
        return `<article class="social-calendar-day-card is-event"><div class="social-calendar-day-card-body" onclick="socialOpenCalendarModal(${socialCalendarEventBaseId(row)})"><div class="social-calendar-day-card-meta">${escapeHtml(timeLabel)}${meta ? ` · ${escapeHtml(meta)}` : ""}</div><h5>${escapeHtml(row?.title || "-")}</h5><div class="social-calendar-day-card-desc">${escapeHtml(socialCleanCalendarDetails(row?.details || "") || tr("Без описания", "No description"))}</div></div><div class="social-calendar-day-card-actions"><button type="button" onclick="socialOpenCalendarModal(${socialCalendarEventBaseId(row)})">${tr("Открыть", "Open")}</button><button class="btn-danger" type="button" onclick="socialDeleteEvent(${socialCalendarEventBaseId(row)})">${tr("Удалить", "Delete")}</button></div></article>`;
      }

      const id = Number(row?.id || 0);
      const status = String(row?.status || "todo").trim().toLowerCase();
      const pending = socialTaskPendingDone.has(id);
      const isDone = status === "done" || pending;
      const meta = [taskProjectMeta(row), String(row?.assignee_nick || "").trim(), taskStatusLabel(row?.status)].filter(Boolean).join(" / ");
      return `<article class="social-calendar-day-card is-task ${isDone ? "is-done" : ""}"><button class="social-calendar-day-card-check social-task-check ${isDone ? "is-done" : ""}" type="button" onclick="socialToggleTaskDone(${id}); event.stopPropagation();" title="${escapeHtml(tr("Отметить выполненной", "Mark as done"))}">${isDone ? "✓" : ""}</button><div class="social-calendar-day-card-body" onclick="socialOpenTaskModal(${id})"><div class="social-calendar-day-card-meta">${escapeHtml(socialTaskDueLabel(row))}${meta ? ` · ${escapeHtml(meta)}` : ""}</div><h5>${escapeHtml(row?.title || "-")}</h5><div class="social-calendar-day-card-desc">${escapeHtml(String(row?.description || "").trim() || tr("Без описания", "No description"))}</div>${pending ? `<div class="social-task-pending">${escapeHtml(tr("Задача завершится через 5 секунд. Нажмите еще раз, чтобы отменить.", "Task will be completed in 5 seconds. Tap again to undo."))}</div>` : ""}</div><div class="social-calendar-day-card-actions"><button type="button" onclick="socialOpenTaskModal(${id})">${tr("Открыть", "Open")}</button></div></article>`;
    }).join("") : `<div class="social-note-empty">${escapeHtml(mode === "events" ? tr("На этот день событий нет.", "No events for this day.") : tr("На этот день задач нет.", "No tasks for this day."))}</div>`;

    list.innerHTML = `<section class="social-calendar-day-sheet"><div class="social-calendar-day-sheet-head"><div><span class="social-calendar-day-sheet-kicker">${escapeHtml(mode === "events" ? tr("Выбранный день", "Selected day") : (mode === "my_tasks" ? tr("Мои задачи на день", "My tasks for the day") : tr("Задачи на день", "Tasks for the day")))}</span><h4 class="social-calendar-day-sheet-date">${escapeHtml(title)}</h4></div><div class="social-calendar-day-sheet-stat">${escapeHtml(`${rows.length} ${mode === "events" ? tr("записей", "items") : tr("задач", "tasks")}`)}</div></div><div class="social-calendar-day-sheet-list">${cards}</div><div class="social-calendar-day-sheet-footer"><button type="button" onclick="${action.onclick}">${escapeHtml(action.label)}</button></div></section>`;

    const grid = document.getElementById("socialCalendarGrid");
    if (grid) {
      grid.querySelectorAll(".social-day[data-day-key]").forEach((button) => {
        button.classList.toggle("active", String(button.getAttribute("data-day-key") || "") === dayKey);
      });
    }
  };
  function notePreviewText(note) {
    const raw = socialNormalizeNoteText(note?.content || "").replace(/\s+/g, " ").trim();
    return raw || tr("Пустая заметка", "Empty note");
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
    return filesCount > 0 ? tr(`${textLength} символов · ${filesCount} файл(ов)`, `${textLength} chars · ${filesCount} file(s)`) : tr(`${textLength} символов`, `${textLength} chars`);
  }

  function openNoteModal(noteId) {
    const note = (socialState?.notes || []).find((row) => Number(row?.id || 0) === Number(noteId || 0)) || null;
    if (!note) return;
    socialOpenModal(
      tr("Заметка", "Note"),
      `<div class="social-note-editor-modal"><div class="social-note-editor-toolbar"><div class="social-note-editor-meta"><strong>${escapeHtml(noteUpdatedLabel(note))}</strong><span id="socialNoteAutosave">${escapeHtml(tr("Автосохранение включено", "Autosave enabled"))}</span></div><div class="social-note-editor-actions"><button class="btn-secondary" type="button" onclick="socialTriggerNoteFileDialog()">${tr("Файлы", "Files")}</button><button class="btn-danger" type="button" onclick="socialDeleteCurrentNote()">${tr("Удалить", "Delete")}</button></div></div><div class="social-note-editor-body"><input id="socialNoteTitle" value="${escapeHtml(socialNormalizeNoteText(note?.title || ""))}" placeholder="${escapeHtml(tr("Название заметки", "Note title"))}" oninput="socialScheduleNoteSave()" /><textarea id="socialNoteContent" rows="14" placeholder="${escapeHtml(tr("Текст заметки", "Note text"))}" oninput="socialScheduleNoteSave()">${escapeHtml(socialNormalizeNoteText(note?.content || ""))}</textarea></div><div class="social-note-editor-files"><div class="social-note-editor-files-head"><strong>${tr("Вложения", "Attachments")}</strong><span class="hint">${escapeHtml(tr("Нажмите «Файлы», чтобы добавить вложения.", "Press “Files” to add attachments."))}</span></div><div id="socialNoteFiles"></div><input id="socialNoteFileUpload" type="file" multiple class="hidden" onchange="socialUploadNoteFiles(this.files)" /></div><div class="actions"><button type="button" onclick="socialSaveCurrentNote()">${tr("Сохранить", "Save")}</button></div></div>`
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
    if (kicker) kicker.textContent = tr("Быстрые заметки", "Quick notes");
    socialRenderNotesList();
    socialRenderCurrentNote();
  };

  socialRenderNotesList = function socialRenderNotesListOverride() {
    const host = document.getElementById("socialNotesList");
    if (!host) return;
    const rows = Array.isArray(socialState?.notes) ? socialState.notes : [];
    host.innerHTML = rows.map((row) => {
      const active = Number(row?.id || 0) === Number(socialState?.currentNoteId || 0);
      const title = String(row?.title || tr("Без названия", "Untitled")).trim() || tr("Без названия", "Untitled");
      return `<article class="social-note-card ${active ? "active" : ""}"><button class="social-note-card-delete" type="button" onclick="socialDeleteNote(${Number(row?.id || 0)}); event.stopPropagation();" title="${escapeHtml(tr("Удалить", "Delete"))}">✕</button><button class="social-note-card-main" type="button" onclick="socialSelectNote(${Number(row?.id || 0)})"><div class="social-note-card-surface"><h4 class="social-note-card-title">${escapeHtml(title)}</h4><div class="social-note-card-snippet">${escapeHtml(notePreviewText(row))}</div></div><div class="social-note-card-meta"><span>${escapeHtml(noteUpdatedLabel(row))}</span><span>${escapeHtml(noteStatLabel(row))}</span></div></button></article>`;
    }).join("") || `<div class="social-note-empty">${escapeHtml(tr("Заметок пока нет. Создайте первую карточку.", "No notes yet. Create your first card."))}</div>`;
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
    if (autosave) autosave.textContent = note ? tr("Автосохранение включено", "Autosave enabled") : tr("Выберите заметку", "Select a note");
    socialRenderNoteFiles(note);
  };

  socialSelectNote = function socialSelectNoteOverride(noteId) {
    socialState.currentNoteId = Number(noteId || 0);
    socialRenderNotesList();
    openNoteModal(socialState.currentNoteId);
  };

  socialCreateNote = async function socialCreateNoteOverride() {
    const row = await socialRequest("/api/social/notes", { method: "POST", body: JSON.stringify({ title: tr("Новая заметка", "New note"), content: "" }) }).catch((e) => {
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
    const payload = { title: String(titleNode?.value || "").trim() || tr("Без названия", "Untitled"), content: String(contentNode?.value || "") };
    if (autosave) autosave.textContent = tr("Сохраняем...", "Saving...");
    const saved = await socialRequest(`/api/social/notes/${noteId}`, { method: "PUT", body: JSON.stringify(payload) }).catch((e) => {
      if (autosave) autosave.textContent = String(e?.message || tr("Ошибка сохранения", "Save error"));
      return null;
    });
    if (!saved) return;
    const normalized = normalizeNoteRow(saved);
    const index = (socialState?.notes || []).findIndex((row) => Number(row?.id || 0) === noteId);
    if (index >= 0) socialState.notes[index] = normalized; else socialState.notes = [normalized].concat(Array.isArray(socialState?.notes) ? socialState.notes : []);
    socialRenderNotesList();
    socialRenderCurrentNote();
    if (autosave) autosave.textContent = tr("Сохранено", "Saved");
  };

  socialRenderNoteFiles = function socialRenderNoteFilesOverride(note) {
    const host = document.getElementById("socialNoteFiles");
    const uploader = document.getElementById("socialNoteFileUpload");
    if (!host) return;
    if (!note) {
      host.innerHTML = `<div class="hint">${escapeHtml(tr("Файлы появятся после открытия заметки.", "Files will appear after opening a note."))}</div>`;
      if (uploader) uploader.disabled = true;
      return;
    }
    if (uploader) uploader.disabled = false;
    const files = Array.isArray(note?.files) ? note.files : [];
    host.innerHTML = files.length ? files.map((file) => `<div class="social-note-file-row"><a href="${escapeHtml(file.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.filename || "file")}</a><small>${escapeHtml(socialFormatFileSize(file.size_bytes || 0))}</small><button class="btn-secondary" type="button" onclick="socialDeleteNoteFile(${Number(file.id || 0)})">${tr("Удалить", "Delete")}</button></div>`).join("") : `<div class="hint">${escapeHtml(tr("Файлы пока не загружены.", "No files uploaded yet."))}</div>`;
  };

  socialTriggerNoteFileDialog = function socialTriggerNoteFileDialogOverride() {
    const noteId = Number(socialState?.currentNoteId || 0);
    if (!noteId) {
      alert(tr("Сначала откройте заметку.", "Open a note first."));
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
    if (autosave) autosave.textContent = tr("Загружаем файлы...", "Uploading files...");
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
      if (autosave) autosave.textContent = tr("Файлы загружены", "Files uploaded");
    } catch (e) {
      const message = e?.message || tr("Ошибка загрузки файла", "File upload error");
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
    if (!confirm(tr("Удалить файл?", "Delete file?"))) return;
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
    if (!confirm(tr("Удалить заметку?", "Delete note?"))) return;
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
      tr("Новый проект", "New project"),
      `<div class="grid-1"><input id="socialProjectTitle" placeholder="${escapeHtml(tr("Название проекта", "Project title"))}" /><textarea id="socialProjectDescription" rows="4" placeholder="${escapeHtml(tr("Краткое описание проекта", "Short project description"))}"></textarea></div><div class="actions"><button type="button" onclick="socialCreateProject()">${tr("Создать", "Create")}</button></div>`
    );
  };

  socialOpenProjectMembersModal = async function socialOpenProjectMembersModalOverride() {
    const projectId = Number(document.getElementById("socialTaskProjectFilter")?.value || 0);
    if (!projectId) {
      alert(tr("Сначала выберите проект в фильтре.", "Select a project in the filter first."));
      return;
    }
    const rows = await socialRequest(`/api/social/tasks/projects/${projectId}/members`).catch((e) => {
      alert(e.message || tr("Не удалось загрузить участников проекта", "Failed to load project members"));
      return null;
    });
    if (!Array.isArray(rows)) return;
    const list = rows.map((row) => {
      const key = String(row?.actor_key || "").trim();
      const nick = String(row?.nick || key || "-").trim() || "-";
      const checked = row?.in_project ? "checked" : "";
      const ownerTag = row?.is_owner ? `<span class="social-task-kind company">${escapeHtml(tr("Владелец", "Owner"))}</span>` : "";
      return `<label class="check social-member-row"><input type="checkbox" data-member-key="${escapeHtml(key)}" ${checked} /> ${socialAvatarMarkup(String(row?.avatar_url || ""), nick, "xs")} <span>${escapeHtml(nick)}</span> ${ownerTag}</label>`;
    }).join("");
    socialOpenModal(
      tr("Участники проекта", "Project members"),
      `<div id="socialProjectMembersList" class="social-group-members-list">${list || `<div class="hint">${escapeHtml(tr("Список пока пуст", "No members yet"))}</div>`}</div><div class="actions"><button type="button" onclick="socialSaveProjectMembers(${projectId})">${tr("Сохранить", "Save")}</button></div>`
    );
  };
})();