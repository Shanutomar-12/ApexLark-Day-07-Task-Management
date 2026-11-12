/**
 * app.js
 * Application entry point: holds state, wires up events and coordinates
 * the storage, validation and UI modules.
 */

import { loadTasks, saveTasks, loadTheme, saveTheme } from './storage.js';
import { validateTask, todayISO, CATEGORIES, PRIORITIES } from './validation.js';
import {
  renderTasks,
  renderStats,
  showToast,
  getFormData,
  showFieldErrors,
  clearFieldErrors,
  fillForm,
  resetForm,
  updateCharCount,
  confirmDialog,
  applyTheme,
} from './ui.js';

/* ---------- State ---------- */

const state = {
  tasks: loadTasks(),
  filters: { search: '', category: 'all', priority: 'all', status: 'all', sort: 'created-desc' },
};

const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };

/* ---------- DOM references ---------- */

const form = document.querySelector('#taskForm');
const taskList = document.querySelector('#taskList');
const searchInput = document.querySelector('#searchInput');
const filterCategory = document.querySelector('#filterCategory');
const filterPriority = document.querySelector('#filterPriority');
const filterStatus = document.querySelector('#filterStatus');
const sortBy = document.querySelector('#sortBy');

/* ---------- Utilities ---------- */

const generateId = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`);

const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/* ---------- Derived data ---------- */

/** Apply search, filters and sorting to produce the visible task list. */
const getVisibleTasks = () => {
  const { search, category, priority, status, sort } = state.filters;
  const term = search.trim().toLowerCase();

  const filtered = state.tasks
    .filter(({ title }) => title.toLowerCase().includes(term))
    .filter((task) => category === 'all' || task.category === category)
    .filter((task) => priority === 'all' || task.priority === priority)
    .filter((task) => status === 'all' || task.status === status);

  const sorters = {
    'created-desc': (a, b) => b.createdAt - a.createdAt,
    'due-asc': (a, b) => a.dueDate.localeCompare(b.dueDate) || b.createdAt - a.createdAt,
    'due-desc': (a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt - a.createdAt,
    'priority-desc': (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || a.dueDate.localeCompare(b.dueDate),
    'priority-asc': (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.dueDate.localeCompare(b.dueDate),
  };

  // copy before sorting so state.tasks keeps its original order
  return [...filtered].sort(sorters[sort] ?? sorters['created-desc']);
};

/** Compute all dashboard / statistics numbers from the full task list. */
const computeStats = (tasks) => {
  const today = todayISO();
  const weekEnd = addDays(today, 7);
  const countBy = (predicate) => tasks.filter(predicate).length;
  const open = (t) => t.status !== 'Completed';

  const total = tasks.length;
  const completed = countBy((t) => t.status === 'Completed');

  return {
    total,
    completed,
    pending: countBy((t) => t.status === 'Pending'),
    inProgress: countBy((t) => t.status === 'In Progress'),
    high: countBy((t) => t.priority === 'High'),
    percent: total ? Math.round((completed / total) * 100) : 0,
    byCategory: CATEGORIES.map((c) => [c, countBy((t) => t.category === c)]),
    byPriority: [...PRIORITIES].reverse().map((p) => [p, countBy((t) => t.priority === p)]),
    overdue: countBy((t) => open(t) && t.dueDate < today),
    dueToday: countBy((t) => open(t) && t.dueDate === today),
    dueWeek: countBy((t) => open(t) && t.dueDate >= today && t.dueDate <= weekEnd),
  };
};

/* ---------- Render + persist ---------- */

const render = () => {
  renderTasks(getVisibleTasks(), state.tasks.length);
  renderStats(computeStats(state.tasks));
};

/** Persist to Local Storage, then re-render. Called after every CRUD change. */
const commit = () => {
  if (!saveTasks(state.tasks)) showToast('Could not save to Local Storage.', 'error');
  render();
};

/* ---------- CRUD operations ---------- */

const createTask = (data) => {
  const { id, ...fields } = data; // discard empty id from form
  const now = Date.now();
  const task = { ...fields, id: generateId(), createdAt: now, updatedAt: now };
  state.tasks = [task, ...state.tasks];
  commit();
  showToast(`Task "${task.title}" added.`, 'success');
};

const updateTask = (id, data) => {
  const existing = state.tasks.find((t) => t.id === id);
  if (!existing) return showToast('Task not found.', 'error');

  state.tasks = state.tasks.map((t) => (t.id === id ? { ...t, ...data, id, updatedAt: Date.now() } : t));
  commit();
  showToast('Task updated successfully.', 'info');
};

const deleteTask = async (id) => {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const confirmed = await confirmDialog({
    title: 'Delete Task?',
    message: `"${task.title}" will be permanently deleted. This action cannot be undone.`,
    confirmText: 'Delete',
  });
  if (!confirmed) return;

  const row = taskList.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const finish = () => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    if (form.elements.id.value === id) resetForm(form); // deleting the task being edited
    commit();
    showToast('Task deleted.', 'warning');
  };

  // play exit animation, then remove
  if (row) {
    row.classList.add('task--removing');
    row.addEventListener('animationend', finish, { once: true });
  } else {
    finish();
  }
};

const toggleComplete = (id) => {
  let nowDone = false;
  state.tasks = state.tasks.map((t) => {
    if (t.id !== id) return t;
    nowDone = t.status !== 'Completed';
    return { ...t, status: nowDone ? 'Completed' : 'Pending', updatedAt: Date.now() };
  });
  commit();
  showToast(nowDone ? 'Nice! Task marked as completed. 🎉' : 'Task moved back to Pending.', nowDone ? 'success' : 'info');
};

const clearCompleted = async () => {
  const count = state.tasks.filter((t) => t.status === 'Completed').length;
  if (!count) return showToast('There are no completed tasks to clear.', 'info');

  const confirmed = await confirmDialog({
    title: 'Clear Completed Tasks?',
    message: `${count} completed task${count > 1 ? 's' : ''} will be permanently deleted.`,
    confirmText: 'Clear',
  });
  if (!confirmed) return;

  state.tasks = state.tasks.filter((t) => t.status !== 'Completed');
  commit();
  showToast(`${count} completed task${count > 1 ? 's' : ''} cleared.`, 'warning');
};

/* ---------- Event handlers ---------- */

const handleSubmit = (event) => {
  event.preventDefault();
  const data = getFormData(form);
  const isEdit = Boolean(data.id);
  const original = isEdit ? state.tasks.find((t) => t.id === data.id) : null;

  const { isValid, errors } = validateTask(data, { isEdit, originalDueDate: original?.dueDate });
  if (!isValid) {
    showFieldErrors(form, errors);
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  const { id, ...fields } = data;
  isEdit ? updateTask(id, fields) : createTask(data);
  resetForm(form);
};

const handleListClick = (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const { id } = actionEl.closest('.task').dataset;
  const { action } = actionEl.dataset;

  if (action === 'edit') {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    fillForm(form, task);
    document.querySelector('#task-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.elements.title.focus({ preventScroll: true });
  } else if (action === 'delete') {
    deleteTask(id);
  }
};

const handleListChange = (event) => {
  if (event.target.matches('[data-action="toggle"]')) {
    toggleComplete(event.target.closest('.task').dataset.id);
  }
};

const handleFilterChange = () => {
  state.filters = {
    search: searchInput.value,
    category: filterCategory.value,
    priority: filterPriority.value,
    status: filterStatus.value,
    sort: sortBy.value,
  };
  renderTasks(getVisibleTasks(), state.tasks.length);
};

const resetFilters = () => {
  searchInput.value = '';
  [filterCategory, filterPriority, filterStatus].forEach((el) => (el.value = 'all'));
  sortBy.value = 'created-desc';
  handleFilterChange();
};

const toggleTheme = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
  showToast(`${next === 'dark' ? 'Dark' : 'Light'} theme enabled.`, 'info', 1800);
};

const setupNavigation = () => {
  const toggle = document.querySelector('#navToggle');
  const nav = document.querySelector('#mainNav');
  const links = [...document.querySelectorAll('.nav__link')];

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('nav--open');
    toggle.classList.toggle('nav-toggle--open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  links.forEach((link) =>
    link.addEventListener('click', () => {
      nav.classList.remove('nav--open');
      toggle.classList.remove('nav-toggle--open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );

  // Highlight the nav link of the section currently in view
  const sections = links.map((l) => document.querySelector(l.getAttribute('href'))).filter(Boolean);
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach(({ target }) => {
          links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${target.id}`));
        });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  sections.forEach((s) => observer.observe(s));
};

/* ---------- Init ---------- */

const init = () => {
  // Theme: saved preference → OS preference → light
  const savedTheme = loadTheme();
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme ?? (prefersDark ? 'dark' : 'light'));

  // Static labels
  document.querySelector('#year').textContent = new Date().getFullYear();
  document.querySelector('#todayLabel').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  resetForm(form);

  // Form events
  form.addEventListener('submit', handleSubmit);
  document.querySelector('#resetBtn').addEventListener('click', () => resetForm(form));
  form.addEventListener('input', (e) => {
    if (e.target.name) clearFieldErrors(form, e.target.name);
    if (e.target.id === 'description') updateCharCount();
  });
  form.addEventListener('change', (e) => e.target.name && clearFieldErrors(form, e.target.name));
  document.querySelector('#cancelEditBtn').addEventListener('click', () => {
    resetForm(form);
    showToast('Edit cancelled.', 'info', 1800);
  });

  // List events (event delegation)
  taskList.addEventListener('click', handleListClick);
  taskList.addEventListener('change', handleListChange);

  // Search / filter / sort
  searchInput.addEventListener('input', handleFilterChange);
  [filterCategory, filterPriority, filterStatus, sortBy].forEach((el) => el.addEventListener('change', handleFilterChange));
  document.querySelector('#resetFiltersBtn').addEventListener('click', resetFilters);
  document.querySelector('#clearCompletedBtn').addEventListener('click', clearCompleted);

  // Theme + navigation
  document.querySelector('#themeToggle').addEventListener('click', toggleTheme);
  setupNavigation();

  // Keep tabs in sync if tasks change in another browser tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'taskflow.tasks') {
      state.tasks = loadTasks();
      render();
    }
  });

  render();
};

init();
