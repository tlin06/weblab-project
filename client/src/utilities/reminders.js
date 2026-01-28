const ALERT_STORAGE_KEY = "lt_reminder_alerted";
const ALERT_CACHE_LIMIT = 200;

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

export const parseReminderDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const isReminderDue = (reminder, now = new Date()) => {
  if (!isObject(reminder)) return false;
  if (reminder.dismissedAt) return false;
  const dueAt = parseReminderDate(reminder.dueAt);
  if (!dueAt) return false;
  return dueAt <= now;
};

export const getReminderId = (reminder, fallback = null) => {
  if (!isObject(reminder)) return fallback;
  const id = reminder._id ? String(reminder._id) : null;
  return id || fallback;
};

export const formatReminderTitle = (reminder, projectTitle) => {
  if (!isObject(reminder)) return "";
  const title = reminder.resourceTitle || reminder.title || "Reminder";
  return projectTitle ? `${title} • ${projectTitle}` : title;
};

export const formatReminderDueAt = (reminder) => {
  if (!isObject(reminder)) return "";
  const dueAt = parseReminderDate(reminder.dueAt);
  return dueAt ? dueAt.toLocaleString() : "";
};

const readAlertedIds = () => {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAlertedIds = (ids) => {
  try {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(ids.slice(-ALERT_CACHE_LIMIT)));
  } catch {
    // ignore storage errors
  }
};

export const hasAlertedReminder = (id) => {
  if (!id) return false;
  return readAlertedIds().includes(id);
};

export const markReminderAlerted = (id) => {
  if (!id) return;
  const ids = readAlertedIds();
  if (ids.includes(id)) return;
  ids.push(id);
  writeAlertedIds(ids);
};
