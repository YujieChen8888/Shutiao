//! Persistent calendar and interval reminders, scheduled outside WebView timers so idle rendering
//! and closing the menu do not suspend them. A missed interval is delivered once.
use chrono::{Datelike, Local, NaiveDate, NaiveTime, TimeZone};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Schedule {
    #[default]
    Interval,
    Once {
        at: u64,
    },
    Daily {
        start_date: String,
        time: String,
    },
    Weekly {
        start_date: String,
        time: String,
        weekdays: Vec<u32>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub id: String,
    pub title: String,
    pub interval_minutes: u32,
    #[serde(default)]
    pub schedule: Schedule,
    pub enabled: bool,
    #[serde(default)]
    pub completed: bool,
    #[serde(default)]
    pub next_due_at: u64,
}

pub struct ReminderStore(pub Mutex<Vec<Reminder>>);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn defaults(now: u64) -> Vec<Reminder> {
    vec![Reminder {
        id: "drink-water".into(),
        title: "主人，喝口水休息一下吧！".into(),
        interval_minutes: 120,
        schedule: Schedule::Interval,
        enabled: true,
        completed: false,
        next_due_at: now + 7_200_000,
    }]
}

fn validate(items: &[Reminder]) -> Result<(), String> {
    if items.len() > 30 {
        return Err("最多设置 30 个提醒".into());
    }
    let mut ids = HashSet::new();
    for item in items {
        if item.id.is_empty() || item.id.len() > 80 || !ids.insert(&item.id) {
            return Err("提醒 ID 为空、过长或重复".into());
        }
        if item.title.trim().is_empty() || item.title.chars().count() > 60 {
            return Err("提醒内容需要 1–60 个字符".into());
        }
        if matches!(item.schedule, Schedule::Interval)
            && !(1..=10080).contains(&item.interval_minutes)
        {
            return Err("提醒间隔需要在 1–10080 分钟之间".into());
        }
        match &item.schedule {
            Schedule::Daily { start_date, time }
            | Schedule::Weekly {
                start_date, time, ..
            } => {
                parse_calendar(start_date, time)?;
            }
            Schedule::Once { at } if *at == 0 || *at > 253_402_214_400_000 => {
                return Err("请选择有效的日期和时间".into())
            }
            _ => {}
        }
        if let Schedule::Weekly { weekdays, .. } = &item.schedule {
            if weekdays.is_empty()
                || weekdays.len() > 7
                || weekdays.iter().any(|d| !(1..=7).contains(d))
            {
                return Err("请至少选择一个有效的星期".into());
            }
        }
    }
    Ok(())
}

fn persist(items: &[Reminder]) -> Result<(), String> {
    let dir = crate::config::app_data_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("reminders.json");
    let temp = dir.join("reminders.json.tmp");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(items).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(temp, path).map_err(|e| e.to_string())
}

fn reconcile(
    mut items: Vec<Reminder>,
    old: &[Reminder],
    now: u64,
) -> Result<Vec<Reminder>, String> {
    validate(&items)?;
    for item in &mut items {
        item.title = item.title.trim().to_owned();
        // Clients cannot inject deadlines. Editing only the text preserves the timer;
        // resuming or changing the interval starts a new full interval.
        let previous = old.iter().find(|p| p.id == item.id);
        let unchanged = previous.filter(|p| {
            p.enabled == item.enabled
                && p.schedule == item.schedule
                && (!matches!(item.schedule, Schedule::Interval)
                    || p.interval_minutes == item.interval_minutes)
        });
        item.completed = unchanged.map(|p| p.completed).unwrap_or(false);
        item.next_due_at = if let Some(p) = unchanged {
            p.next_due_at
        } else {
            next_deadline(item, now)?
        };
    }
    Ok(items)
}

fn parse_calendar(date: &str, time: &str) -> Result<(NaiveDate, NaiveTime), String> {
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| "请选择有效日期")?;
    let time = NaiveTime::parse_from_str(time, "%H:%M").map_err(|_| "请选择有效时间")?;
    if !(1970..=9998).contains(&date.year()) {
        return Err("日期年份超出范围".into());
    }
    Ok((date, time))
}

fn next_deadline(item: &Reminder, now: u64) -> Result<u64, String> {
    match &item.schedule {
        Schedule::Interval => Ok(now + u64::from(item.interval_minutes) * 60_000),
        Schedule::Once { at } => {
            if *at > now {
                Ok(*at)
            } else {
                Err("单次事件需要选择未来的日期和时间".into())
            }
        }
        Schedule::Daily { start_date, time } => calendar_deadline(start_date, time, &[], now),
        Schedule::Weekly {
            start_date,
            time,
            weekdays,
        } => calendar_deadline(start_date, time, weekdays, now),
    }
}

fn calendar_deadline(start: &str, time: &str, weekdays: &[u32], now: u64) -> Result<u64, String> {
    let (start, time) = parse_calendar(start, time)?;
    let current = Local
        .timestamp_millis_opt(now as i64)
        .single()
        .ok_or("系统时间无效")?;
    let first = start.max(current.date_naive());
    // Calendar days (not 24-hour durations) keep wall-clock time across DST.
    for offset in 0..15 {
        let Some(date) = first.checked_add_days(chrono::Days::new(offset)) else {
            break;
        };
        if !weekdays.is_empty() && !weekdays.contains(&date.weekday().number_from_monday()) {
            continue;
        }
        // Nonexistent local times are skipped; repeated times trigger only once,
        // at the earlier occurrence.
        if let Some(candidate) = Local.from_local_datetime(&date.and_time(time)).earliest() {
            let millis = candidate.timestamp_millis();
            if millis > now as i64 {
                return Ok(millis as u64);
            }
        }
    }
    Err("无法计算下次提醒时间，请检查系统时区与日期".into())
}

fn tick(items: &mut [Reminder], now: u64) -> Vec<Reminder> {
    let mut due = vec![];
    for item in items {
        if item.enabled && now >= item.next_due_at {
            due.push(item.clone());
            if matches!(item.schedule, Schedule::Once { .. }) {
                item.enabled = false;
                item.completed = true;
            } else if let Ok(next) = next_deadline(item, now) {
                item.next_due_at = next;
            } else {
                item.enabled = false;
            }
        }
    }
    due
}

#[tauri::command]
pub fn get_reminders(state: State<'_, ReminderStore>) -> Vec<Reminder> {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_reminders(
    app: AppHandle,
    state: State<'_, ReminderStore>,
    items: Vec<Reminder>,
) -> Result<Vec<Reminder>, String> {
    let mut guard = state.0.lock().unwrap();
    let next = reconcile(items, &guard, now_ms())?;
    persist(&next)?;
    *guard = next.clone();
    drop(guard);
    let _ = app.emit("shutiao-reminders-changed", &next);
    Ok(next)
}

#[tauri::command]
pub fn test_reminder(
    app: AppHandle,
    state: State<'_, ReminderStore>,
    id: String,
) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let item = guard.iter().find(|r| r.id == id).ok_or("找不到这个提醒")?;
    app.emit("shutiao-reminder", item)
        .map_err(|e| e.to_string())
}

pub fn start(app: &AppHandle) {
    let path = crate::config::app_data_dir().join("reminders.json");
    let items = match fs::read(&path) {
        Ok(bytes) => match serde_json::from_slice::<Vec<Reminder>>(&bytes) {
            Ok(items) if validate(&items).is_ok() => items,
            _ => {
                // Preserve malformed user data before restoring a working default.
                let _ = fs::copy(
                    &path,
                    path.with_extension(format!("invalid-{}.json", now_ms())),
                );
                defaults(now_ms())
            }
        },
        Err(_) => defaults(now_ms()),
    };
    if let Err(e) = persist(&items) {
        eprintln!("[Shutiao] reminder save: {e}");
    }
    app.manage(ReminderStore(Mutex::new(items)));
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));
        let state = app.state::<ReminderStore>();
        let mut guard = state.0.lock().unwrap();
        let before = guard.clone();
        let due = tick(&mut guard, now_ms());
        if due.is_empty() {
            continue;
        }
        if let Err(e) = persist(&guard) {
            *guard = before;
            eprintln!("[Shutiao] reminder save: {e}");
            continue;
        }
        let next = guard.clone();
        drop(guard);
        for item in due {
            let _ = app.emit("shutiao-reminder", item);
        }
        let _ = app.emit("shutiao-reminders-changed", next);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_water_is_due_every_two_hours() {
        let mut r = defaults(100);
        assert!(tick(&mut r, 7_200_099).is_empty());
        assert_eq!(tick(&mut r, 7_200_100).len(), 1);
        assert!(tick(&mut r, 7_200_101).is_empty());
        assert_eq!(tick(&mut r, 14_400_100).len(), 1);
    }
    #[test]
    fn sleep_does_not_cause_a_reminder_storm_and_pause_is_respected() {
        let mut r = defaults(0);
        assert_eq!(tick(&mut r, 90_000_000).len(), 1);
        assert_eq!(r[0].next_due_at, 97_200_000);
        r[0].enabled = false;
        assert!(tick(&mut r, 200_000_000).is_empty());
    }
    #[test]
    fn edits_preserve_deadlines_resume_resets_and_invalid_input_fails() {
        let old = defaults(0);
        let mut edit = old.clone();
        edit[0].title = "喝茶".into();
        edit[0].next_due_at = 1;
        assert_eq!(
            reconcile(edit.clone(), &old, 900).unwrap()[0].next_due_at,
            7_200_000
        );
        edit[0].interval_minutes = 5;
        assert_eq!(
            reconcile(edit.clone(), &old, 900).unwrap()[0].next_due_at,
            300_900
        );
        edit[0].interval_minutes = 0;
        assert!(reconcile(edit, &old, 900).is_err());
        assert!(validate(&[old[0].clone(), old[0].clone()]).is_err());
        let mut paused = old.clone();
        paused[0].enabled = false;
        assert_eq!(
            reconcile(old, &paused, 500).unwrap()[0].next_due_at,
            7_200_500
        );
        assert!(reconcile(vec![], &paused, 500).unwrap().is_empty());
    }
    #[test]
    fn once_fires_only_once_and_rejects_past_dates() {
        let mut r = defaults(0);
        r[0].schedule = Schedule::Once { at: 5000 };
        r = reconcile(r, &[], 1000).unwrap();
        assert!(tick(&mut r, 4999).is_empty());
        assert_eq!(tick(&mut r, 5000).len(), 1);
        assert!(!r[0].enabled);
        assert!(r[0].completed);
        assert!(tick(&mut r, 9000).is_empty());
        r[0].enabled = true;
        assert!(reconcile(r, &[], 9000).is_err());
    }

    #[test]
    fn daily_and_weekly_keep_calendar_time_and_future_start() {
        let now = Local
            .with_ymd_and_hms(2026, 11, 26, 10, 30, 0)
            .unwrap()
            .timestamp_millis() as u64;
        let today = calendar_deadline("2026-11-26", "11:00", &[], now).unwrap();
        let expected = Local
            .with_ymd_and_hms(2026, 11, 26, 11, 0, 0)
            .unwrap()
            .timestamp_millis() as u64;
        assert_eq!(today, expected);
        let tomorrow = calendar_deadline("2026-11-26", "10:00", &[], now).unwrap();
        assert_eq!(
            Local.timestamp_millis_opt(tomorrow as i64).unwrap().day(),
            27
        );
        let next_monday = calendar_deadline("2026-11-26", "09:00", &[1], now).unwrap();
        assert_eq!(
            Local
                .timestamp_millis_opt(next_monday as i64)
                .unwrap()
                .weekday()
                .number_from_monday(),
            1
        );
        let future = calendar_deadline("2026-12-15", "09:00", &[], now).unwrap();
        assert_eq!(
            Local
                .timestamp_millis_opt(future as i64)
                .unwrap()
                .date_naive()
                .to_string(),
            "2026-12-15"
        );
    }

    #[test]
    fn legacy_intervals_migrate_and_bad_calendar_input_is_rejected() {
        let raw =
            r#"{"id":"old","title":"喝水","intervalMinutes":120,"enabled":true,"nextDueAt":100}"#;
        let old: Reminder = serde_json::from_str(raw).unwrap();
        assert_eq!(old.schedule, Schedule::Interval);
        let mut r = vec![old];
        r[0].schedule = Schedule::Weekly {
            start_date: "2026-11-26".into(),
            time: "09:00".into(),
            weekdays: vec![],
        };
        assert!(validate(&r).is_err());
        r[0].schedule = Schedule::Daily {
            start_date: "2026-02-30".into(),
            time: "25:00".into(),
        };
        assert!(validate(&r).is_err());
    }
}
