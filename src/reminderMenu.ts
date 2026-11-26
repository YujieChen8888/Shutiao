import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Schedule =
  | { kind: "interval" }
  | { kind: "once"; at: number }
  | { kind: "daily"; startDate: string; time: string }
  | { kind: "weekly"; startDate: string; time: string; weekdays: number[] };
export interface Reminder {
  id: string;
  title: string;
  intervalMinutes: number;
  enabled: boolean;
  completed?: boolean;
  nextDueAt: number;
  schedule: Schedule;
}
const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDate(at: number): string {
  return new Date(at).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function mountReminderMenu(root: HTMLElement) {
  let items: Reminder[] = [],
    editing: string | null = null,
    busy = false;
  let selected = dateKey(new Date());
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  root.innerHTML = `
    <div class="shutiao-section-title">陈薯条的小日历</div>
    <p class="shutiao-note">选一个日子，记下事件和时间。按电脑本地时间提醒。</p>
    <div class="calendar-header"><button type="button" id="cal-prev" aria-label="上个月">‹</button><strong id="cal-month"></strong><button type="button" id="cal-next" aria-label="下个月">›</button></div>
    <div class="calendar-week">${weekdayLabels.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="calendar-grid" id="cal-days" aria-label="选择事件日期"></div>
    <div class="calendar-agenda-title"><strong>日程与提醒</strong><button type="button" id="new-event" class="kb-pill">＋ 新建事件</button></div>
    <div id="reminder-list" class="reminder-list"></div>
    <form id="reminder-form" class="reminder-form">
      <label>事件<input name="title" maxlength="60" required placeholder="例如：开会／给陈薯条喂饭" autocomplete="off"></label>
      <label>重复方式<select name="kind"><option value="once">不重复 · 指定日期时间</option><option value="daily">每天</option><option value="weekly">每周（选择星期）</option><option value="interval">按间隔 · 喝水等习惯</option></select></label>
      <div id="calendar-fields" class="calendar-fields"><label>日期 / 开始日期<input name="date" type="date" required></label><label>时间<input name="time" type="time" required></label></div>
      <fieldset id="weekday-field" hidden><legend>每周几</legend><div class="weekday-choices">${weekdayLabels.map((d, i) => `<label><input type="checkbox" name="weekday" value="${i + 1}"><span>${d}</span></label>`).join("")}</div></fieldset>
      <label id="interval-field" hidden>间隔（分钟）<input name="minutes" type="number" min="1" max="10080" step="1" value="120" inputmode="numeric"></label>
      <div class="reminder-actions"><button class="shutiao-primary" type="submit">添加事件</button><button class="kb-pill" type="button" id="reminder-cancel" hidden>取消修改</button></div>
    </form>
    <p class="shutiao-status" role="status" aria-live="polite"></p>
    <p class="shutiao-note">默认每 2 小时提醒喝水，可在上方修改或暂停。桌宠运行时提醒，休眠后只补一次。</p>`;
  const list = root.querySelector<HTMLDivElement>("#reminder-list")!;
  const form = root.querySelector<HTMLFormElement>("form")!;
  const field = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement;
  const title = field("title"),
    minutes = field("minutes"),
    date = field("date"),
    time = field("time");
  const kind = form.elements.namedItem("kind") as HTMLSelectElement;
  const submit = form.querySelector<HTMLButtonElement>("[type=submit]")!;
  const cancel = root.querySelector<HTMLButtonElement>("#reminder-cancel")!;
  const status = root.querySelector<HTMLParagraphElement>("[role=status]")!;
  const checkboxes = [
    ...form.querySelectorAll<HTMLInputElement>("[name=weekday]"),
  ];

  function syncFields() {
    const interval = kind.value === "interval";
    root.querySelector<HTMLElement>("#calendar-fields")!.hidden = interval;
    root.querySelector<HTMLElement>("#interval-field")!.hidden = !interval;
    root.querySelector<HTMLElement>("#weekday-field")!.hidden =
      kind.value !== "weekly";
    date.disabled = time.disabled = interval;
    minutes.disabled = !interval;
  }
  function reset() {
    editing = null;
    form.reset();
    submit.textContent = "添加事件";
    cancel.hidden = true;
    const later = new Date(Date.now() + 15 * 60_000);
    date.value = selected;
    time.value = localTime(later);
    for (const c of checkboxes)
      c.checked =
        Number(c.value) === (new Date(selected + "T12:00:00").getDay() || 7);
    syncFields();
  }
  function occursOn(day: string, item: Reminder): boolean {
    if (!item.enabled) return false;
    const s = item.schedule;
    if (s.kind === "daily") return day >= s.startDate;
    if (s.kind === "weekly")
      return (
        day >= s.startDate &&
        s.weekdays.includes(new Date(day + "T12:00:00").getDay() || 7)
      );
    return dateKey(new Date(item.nextDueAt)) === day;
  }
  function renderCalendar() {
    root.querySelector("#cal-month")!.textContent =
      `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`;
    const grid = root.querySelector("#cal-days")!;
    grid.replaceChildren();
    const offset = (month.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++)
      grid.append(document.createElement("span"));
    const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    for (let n = 1; n <= count; n++) {
      const day = dateKey(new Date(month.getFullYear(), month.getMonth(), n));
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(n);
      btn.className = "calendar-day";
      btn.classList.toggle("selected", day === selected);
      btn.classList.toggle("today", day === dateKey(new Date()));
      btn.classList.toggle(
        "has-event",
        items.some((r) => occursOn(day, r)),
      );
      btn.setAttribute(
        "aria-label",
        `${day}${items.some((r) => occursOn(day, r)) ? " 有日程" : ""}`,
      );
      btn.setAttribute("aria-pressed", String(day === selected));
      btn.addEventListener("click", () => {
        selected = day;
        date.value = day;
        if (kind.value === "interval") {
          kind.value = "once";
          syncFields();
        }
        renderCalendar();
      });
      grid.append(btn);
    }
  }
  function render() {
    renderCalendar();
    list.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "shutiao-note";
      p.textContent = "还没有日程。选择日期，添加第一个事件吧。";
      list.append(p);
    }
    const sorted = [...items].sort(
      (a, b) =>
        Number(b.enabled) - Number(a.enabled) || a.nextDueAt - b.nextDueAt,
    );
    for (const item of sorted) {
      const card = document.createElement("article");
      card.className = "reminder-card";
      const text = document.createElement("strong");
      text.textContent = item.title;
      card.append(text);
      const meta = document.createElement("p");
      meta.className = "shutiao-note";
      const s = item.schedule;
      let repeat =
        s.kind === "once"
          ? "单次"
          : s.kind === "daily"
            ? `每天 ${s.time}`
            : s.kind === "weekly"
              ? `每周${s.weekdays.map((d) => weekdayLabels[d - 1]).join("、")} ${s.time}`
              : `每 ${item.intervalMinutes % 60 === 0 ? item.intervalMinutes / 60 + " 小时" : item.intervalMinutes + " 分钟"}`;
      const completed = s.kind === "once" && Boolean(item.completed);
      meta.textContent = `${repeat} · ${item.enabled ? formatDate(item.nextDueAt) : completed ? "已完成" : "已暂停"}`;
      card.append(meta);
      const actions = document.createElement("div");
      actions.className = "reminder-actions";
      for (const [label, action] of [
        [item.enabled ? "暂停" : completed ? "重新安排" : "启用", "toggle"],
        ["修改", "edit"],
        ["试一下", "test"],
        ["删除", "delete"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "kb-pill";
        button.textContent = label;
        button.disabled = busy;
        button.setAttribute("aria-label", `${label}：${item.title}`);
        button.addEventListener("click", () => {
          if (busy) return;
          if (
            action === "edit" ||
            (action === "toggle" &&
              s.kind === "once" &&
              item.nextDueAt <= Date.now())
          ) {
            edit(item);
            return;
          }
          if (action === "test") {
            void run(async () => {
              await invoke("test_reminder", { id: item.id });
              status.textContent = "已向桌面发送测试提醒";
            });
            return;
          }
          void save(
            action === "delete"
              ? items.filter((r) => r.id !== item.id)
              : items.map((r) =>
                  r.id === item.id ? { ...r, enabled: !r.enabled } : r,
                ),
          );
        });
        actions.append(button);
      }
      card.append(actions);
      list.append(card);
    }
  }
  function edit(item: Reminder) {
    reset();
    editing = item.id;
    title.value = item.title;
    minutes.value = String(item.intervalMinutes);
    kind.value = item.schedule.kind;
    const s = item.schedule;
    if (s.kind === "once") {
      date.value = dateKey(new Date(s.at));
      time.value = localTime(new Date(s.at));
    } else if (s.kind === "daily" || s.kind === "weekly") {
      date.value = s.startDate;
      time.value = s.time;
    }
    if (s.kind === "weekly")
      for (const c of checkboxes)
        c.checked = s.weekdays.includes(Number(c.value));
    if (s.kind !== "interval") {
      selected = date.value;
      month = new Date(selected + "T12:00:00");
      month.setDate(1);
    }
    submit.textContent = "保存修改";
    cancel.hidden = false;
    syncFields();
    renderCalendar();
    title.focus();
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    submit.disabled = true;
    render();
    status.textContent = "";
    try {
      await fn();
    } catch (e) {
      status.textContent = `未保存：${String(e)}`;
    } finally {
      busy = false;
      submit.disabled = false;
      render();
    }
  }
  async function save(next: Reminder[]) {
    await run(async () => {
      items = await invoke<Reminder[]>("save_reminders", { items: next });
      reset();
      status.textContent = "已保存，陈薯条会按时提醒你";
    });
  }
  kind.addEventListener("change", syncFields);
  date.addEventListener("change", () => {
    if (date.value) {
      selected = date.value;
      month = new Date(selected + "T12:00:00");
      month.setDate(1);
      renderCalendar();
    }
  });
  cancel.addEventListener("click", reset);
  root.querySelector("#new-event")!.addEventListener("click", () => {
    reset();
    title.focus();
  });
  for (const [id, delta] of [
    ["cal-prev", -1],
    ["cal-next", 1],
  ] as const)
    root.querySelector("#" + id)!.addEventListener("click", () => {
      month.setMonth(month.getMonth() + delta);
      renderCalendar();
    });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy || !form.reportValidity()) return;
    if (!title.value.trim()) {
      status.textContent = "请填写事件";
      return;
    }
    let schedule: Schedule = { kind: "interval" };
    if (kind.value === "once") {
      const at = new Date(`${date.value}T${time.value}:00`).getTime();
      if (!Number.isFinite(at) || at <= Date.now()) {
        status.textContent = "请选择未来的日期和时间";
        return;
      }
      schedule = { kind: "once", at };
    } else if (kind.value === "daily")
      schedule = { kind: "daily", startDate: date.value, time: time.value };
    else if (kind.value === "weekly") {
      const weekdays = checkboxes
        .filter((c) => c.checked)
        .map((c) => Number(c.value));
      if (!weekdays.length) {
        status.textContent = "请至少选择一个星期";
        return;
      }
      schedule = {
        kind: "weekly",
        startDate: date.value,
        time: time.value,
        weekdays,
      };
    }
    const previous = items.find((r) => r.id === editing);
    const rearm =
      previous?.schedule.kind === "once" &&
      !previous.enabled &&
      previous.nextDueAt <= Date.now();
    const item: Reminder = {
      id:
        editing ??
        `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      title: title.value.trim(),
      intervalMinutes: Number(minutes.value) || 120,
      enabled: rearm ? true : (previous?.enabled ?? true),
      nextDueAt: 0,
      schedule,
    };
    void save(
      editing
        ? items.map((r) => (r.id === editing ? item : r))
        : [...items, item],
    );
  });
  reset();
  render();
  try {
    await listen<Reminder[]>("shutiao-reminders-changed", (ev) => {
      items = ev.payload;
      render();
    });
    items = await invoke<Reminder[]>("get_reminders");
    items = items.map((r) => ({
      ...r,
      schedule: r.schedule ?? { kind: "interval" },
    }));
    render();
  } catch {
    status.textContent = "日历提醒需要在 Shutiao 桌面应用中使用";
    submit.disabled = true;
  }
}
