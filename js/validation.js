/**
 * validation.js
 * Client-side validation rules for the task form.
 */

export const CATEGORIES = ['Work', 'Personal', 'Meeting', 'Development', 'Learning', 'Other'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const STATUSES = ['Pending', 'In Progress', 'Completed'];

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
export const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isValidDateString = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

/**
 * Validate task form data.
 * @param {Object} data - { title, description, category, priority, dueDate, status, assignee }
 * @param {Object} [options]
 * @param {boolean} [options.isEdit=false] - when editing, a past due date is allowed
 *                                           if it was already the task's saved date
 * @param {string}  [options.originalDueDate]
 * @returns {{ isValid: boolean, errors: Record<string,string> }}
 */
export const validateTask = (data, { isEdit = false, originalDueDate = '' } = {}) => {
  const { title = '', description = '', category = '', priority = '', dueDate = '', status = '', assignee = '' } = data;
  const errors = {};

  // Title: required, 3–60 characters
  const cleanTitle = title.trim();
  if (!cleanTitle) errors.title = 'Title is required.';
  else if (cleanTitle.length < 3) errors.title = 'Title must be at least 3 characters.';
  else if (cleanTitle.length > 60) errors.title = 'Title cannot exceed 60 characters.';

  // Description: required, 10–300 characters
  const cleanDesc = description.trim();
  if (!cleanDesc) errors.description = 'Description is required.';
  else if (cleanDesc.length < 10) errors.description = 'Description must be at least 10 characters.';
  else if (cleanDesc.length > 300) errors.description = 'Description cannot exceed 300 characters.';

  // Category / Priority / Status: must be one of the allowed values
  if (!CATEGORIES.includes(category)) errors.category = 'Please select a category.';
  if (!PRIORITIES.includes(priority)) errors.priority = 'Please choose a priority.';
  if (!STATUSES.includes(status)) errors.status = 'Please select a valid status.';

  // Due date: required, valid, and not in the past (unless unchanged during edit)
  if (!dueDate) {
    errors.dueDate = 'Due date is required.';
  } else if (!isValidDateString(dueDate)) {
    errors.dueDate = 'Please enter a valid date.';
  } else if (dueDate < todayISO() && !(isEdit && dueDate === originalDueDate)) {
    errors.dueDate = 'Due date cannot be in the past.';
  }

  // Assignee: optional, but if provided must be 2–40 letters / spaces / . ' -
  const cleanAssignee = assignee.trim();
  if (cleanAssignee) {
    if (cleanAssignee.length < 2) errors.assignee = 'Name must be at least 2 characters.';
    else if (!/^[A-Za-z][A-Za-z .'-]*$/.test(cleanAssignee)) errors.assignee = 'Name can only contain letters, spaces, . \' and -';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};
