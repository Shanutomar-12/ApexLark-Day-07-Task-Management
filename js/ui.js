/**
 * ui.js
 * Everything that touches the DOM: rendering tasks, statistics, toasts,
 * form state, the confirmation modal and the theme.
 */

import { todayISO } from './validation.js';

const $ = (selector) => document.querySelector(selector);

/* ---------- Helpers ---------- */

/** Escape user-provided text before inserting it into HTML (prevents XSS). */
export const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Format YYYY-MM-DD as e.g. "14 Nov 2026" */
export const formatDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, '-');

/** Returns a small label describing how close the deadline is. */
const dueInfo = ({ dueDate, status }) => {
  if (status === 'Completed') return { label: formatDate(dueDate), cls: '' };
  const today = todayISO();
  if (dueDate < today) return { label: `Overdue · ${formatDate(dueDate)}`, cls: 'due--overdue' };
  if (dueDate === today) return { label: 'Due Today', cls: 'due--today' };
  return { label: formatDate(dueDate), cls: '' };
};

/* ---------- Task list ---------- */

const taskTemplate = (task) => {
  const { id, title, description, category, priority, dueDate, status, assignee } = task;
  const isDone = status === 'Completed';
  const due = dueInfo({ dueDate, status });
  const initials = assignee
    ? assignee.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    : '';

  return `
    <li class="task priority-${priority.toLowerCase()} ${isDone ? 'task--done' : ''}" data-id="${escapeHtml(id)}">
      <label class="task__check" title="${isDone ? 'Mark as pending' : 'Mark as complete'}">
        <input type="checkbox" data-action="toggle" ${isDone ? 'checked' : ''} aria-label="Mark ${escapeHtml(title)} as complete" />
        <span class="checkmark"></span>
      </label>

      <div class="task__body">
        <div class="task__top">
          <h3 class="task__title">${escapeHtml(title)}</h3>
          <span class="badge badge--status badge--${statusClass(status)}">${escapeHtml(status)}</span>
        </div>
        <p class="task__desc">${escapeHtml(description)}</p>
        <div class="task__meta">
          <span class="badge badge--category">🏷️ ${escapeHtml(category)}</span>
          <span class="badge badge--priority badge--${priority.toLowerCase()}">● ${escapeHtml(priority)}</span>
          <span class="task__due ${due.cls}">📅 ${escapeHtml(due.label)}</span>
          ${assignee ? `<span class="task__assignee" title="Assigned to ${escapeHtml(assignee)}"><span class="avatar">${escapeHtml(initials)}</span>${escapeHtml(assignee)}</span>` : ''}
        </div>
      </div>

      <div class="task__actions">
        <button class="icon-btn" data-action="edit" title="Edit task" aria-label="Edit ${escapeHtml(title)}">✏️</button>
        <button class="icon-btn icon-btn--danger" data-action="delete" title="Delete task" aria-label="Delete ${escapeHtml(title)}">🗑️</button>
      </div>
    </li>`;
};

/**
 * Render the (already filtered & sorted) list of tasks.
 * @param {Array<Object>} tasks - tasks to show
 * @param {number} totalCount  - total tasks stored (decides which empty message to show)
 */
export const renderTasks = (tasks, totalCount) => {
  const list = $('#taskList');
  const empty = $('#emptyState');

  list.innerHTML = tasks.map(taskTemplate).join('');
  $('#visibleCount').textContent = tasks.length;

  if (tasks.length === 0) {
    empty.hidden = false;
    $('#emptyTitle').textContent = totalCount === 0 ? 'No tasks yet' : 'No matching tasks';
    $('#emptyText').textContent = totalCount === 0
      ? 'Create your first task using the form to get started.'
      : 'Try a different search term or reset the filters.';
  } else {
    empty.hidden = true;
  }
};

/* ---------- Statistics ---------- */

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const renderBarChart = (container, entries, total) => {
  container.innerHTML = entries
    .map(([label, count, cls = '']) => {
      const pct = total ? Math.round((count / total) * 100) : 0;
      return `
        <div class="bar-row">
          <span class="bar-row__label">${escapeHtml(label)}</span>
          <div class="bar-row__track"><div class="bar-row__fill ${cls}" style="width:${pct}%"></div></div>
          <span class="bar-row__value">${count}</span>
        </div>`;
    })
    .join('');
};

/** Render dashboard cards + statistics section from a computed stats object. */
export const renderStats = (stats) => {
  const { total, completed, pending, inProgress, high, percent, byCategory, byPriority, overdue, dueToday, dueWeek } = stats;

  $('#statTotal').textContent = total;
  $('#statCompleted').textContent = completed;
  $('#statPending').textContent = pending;
  $('#statInProgress').textContent = inProgress;
  $('#statHigh').textContent = high;
  $('#statPercent').textContent = `${percent}%`;
  $('#statPercentCard').textContent = `${percent}%`;
  $('#statPercentBar').style.width = `${percent}%`;

  const ring = $('#progressRingBar');
  ring.style.strokeDasharray = RING_CIRCUMFERENCE;
  ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - percent / 100);

  renderBarChart($('#categoryChart'), byCategory, total);
  renderBarChart($('#priorityChart'), byPriority.map(([p, c]) => [p, c, `fill--${p.toLowerCase()}`]), total);

  $('#statOverdue').textContent = overdue;
  $('#statDueToday').textContent = dueToday;
  $('#statDueWeek').textContent = dueWeek;
};

/* ---------- Toast notifications ---------- */

const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type='success']
 * @param {number} [duration=3000] ms
 */
export const showToast = (message, type = 'success', duration = 3000) => {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<span class="toast__icon">${TOAST_ICONS[type] ?? ''}</span><span class="toast__msg">${escapeHtml(message)}</span><button class="toast__close" aria-label="Dismiss">×</button>`;

  const remove = () => {
    toast.classList.add('toast--leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast__close').addEventListener('click', remove);
  container.appendChild(toast);
  setTimeout(remove, duration);
};

/* ---------- Form helpers ---------- */

export const getFormData = (form) => {
  const formData = new FormData(form);
  return {
    id: formData.get('id') || '',
    title: (formData.get('title') || '').trim(),
    description: (formData.get('description') || '').trim(),
    category: formData.get('category') || '',
    priority: formData.get('priority') || '',
    dueDate: formData.get('dueDate') || '',
    status: formData.get('status') || '',
    assignee: (formData.get('assignee') || '').trim(),
  };
};

export const showFieldErrors = (form, errors) => {
  clearFieldErrors(form);
  Object.entries(errors).forEach(([field, message]) => {
    const msgEl = form.querySelector(`[data-error-for="${field}"]`);
    if (msgEl) msgEl.textContent = message;
    form.querySelectorAll(`[name="${field}"]`).forEach((input) => {
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
    });
  });
  // Focus the first invalid field for accessibility
  const first = form.querySelector('.invalid');
  if (first) first.focus();
};

export const clearFieldErrors = (form, field = null) => {
  const selector = field ? `[data-error-for="${field}"]` : '[data-error-for]';
  form.querySelectorAll(selector).forEach((el) => (el.textContent = ''));
  const inputs = field ? form.querySelectorAll(`[name="${field}"]`) : form.querySelectorAll('.invalid');
  inputs.forEach((input) => {
    input.classList.remove('invalid');
    input.removeAttribute('aria-invalid');
  });
};

export const updateCharCount = () => {
  const len = $('#description').value.length;
  const counter = $('#descCount');
  counter.textContent = `${len} / 300`;
  counter.classList.toggle('char-count--warn', len > 270);
};

/** Put the form into "edit" mode and fill it with the task's values. */
export const fillForm = (form, task) => {
  const { id, title, description, category, priority, dueDate, status, assignee } = task;
  const f = form.elements;
  clearFieldErrors(form);
  f.id.value = id;
  f.title.value = title;
  f.description.value = description;
  f.category.value = category;
  f.dueDate.value = dueDate;
  f.status.value = status;
  f.assignee.value = assignee ?? '';
  form.querySelectorAll('[name="priority"]').forEach((r) => (r.checked = r.value === priority));
  f.dueDate.removeAttribute('min'); // allow keeping an existing past date

  $('#formTitle').textContent = 'Edit Task';
  $('#submitBtn').textContent = '💾 Update Task';
  $('#cancelEditBtn').hidden = false;
  $('#resetBtn').hidden = true;
  $('#task-form-section').classList.add('form-card--editing');
  updateCharCount();
};

/** Return the form to "create" mode with empty values. */
export const resetForm = (form) => {
  form.reset();
  form.elements.id.value = '';
  clearFieldErrors(form);
  form.elements.dueDate.min = todayISO();
  $('#formTitle').textContent = 'Create New Task';
  $('#submitBtn').textContent = '➕ Add Task';
  $('#cancelEditBtn').hidden = true;
  $('#resetBtn').hidden = false;
  $('#task-form-section').classList.remove('form-card--editing');
  updateCharCount();
};

/* ---------- Confirmation modal ---------- */

/**
 * Show a confirmation dialog.
 * @returns {Promise<boolean>} resolves true if the user confirmed
 */
export const confirmDialog = ({ title = 'Are you sure?', message = '', confirmText = 'Delete' } = {}) =>
  new Promise((resolve) => {
    const modal = $('#confirmModal');
    const confirmBtn = $('#modalConfirm');
    const cancelBtn = $('#modalCancel');
    const previouslyFocused = document.activeElement;

    $('#modalTitle').textContent = title;
    $('#modalMessage').textContent = message;
    confirmBtn.textContent = confirmText;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    cancelBtn.focus();

    const close = (result) => {
      modal.hidden = true;
      document.body.classList.remove('no-scroll');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
      resolve(result);
    };
    const onConfirm = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = (e) => e.target.hasAttribute('data-close') && close(false);
    const onKey = (e) => e.key === 'Escape' && close(false);

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });

/* ---------- Theme ---------- */

export const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  $('#themeToggle').setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
};
