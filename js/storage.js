/**
 * storage.js
 * Handles all Local Storage persistence for tasks and theme preference.
 */

const TASKS_KEY = 'taskflow.tasks';
const THEME_KEY = 'taskflow.theme';

/**
 * Load tasks from Local Storage.
 * @returns {Array<Object>} list of tasks (empty array if none / corrupted)
 */
export const loadTasks = () => {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const tasks = raw ? JSON.parse(raw) : [];
    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    console.error('Failed to read tasks from Local Storage:', error);
    return [];
  }
};

/**
 * Save the full task list to Local Storage.
 * @param {Array<Object>} tasks
 * @returns {boolean} true when saved successfully
 */
export const saveTasks = (tasks) => {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error('Failed to save tasks to Local Storage:', error);
    return false;
  }
};

/** @returns {'light'|'dark'|null} saved theme, or null if user never chose one */
export const loadTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
};

/** @param {'light'|'dark'} theme */
export const saveTheme = (theme) => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable – theme simply won't persist */
  }
};
