/* ============================================================
   script.js — TaskFlow Pro
   Features:
     ✔ Add / Edit / Delete / Complete tasks
     ✔ Rainbow color per task
     ✔ Emoji + image attachment per task
     ✔ Priority levels (High / Medium / Low)
     ✔ Due date + time
     ✔ Reminders with browser Notification API
     ✔ Task Management — Kanban board (3 columns)
     ✔ Plan My Day — hourly timeline
     ✔ Filter: All / Pending / Completed / High priority
     ✔ Search in real-time
     ✔ Drag-and-drop reorder (task list)
     ✔ Kanban drag-and-drop across columns
     ✔ Dark / Light mode (saved)
     ✔ LocalStorage persistence
     ✔ Toast notifications
   ============================================================ */

/* ═══════════════════════════════════════════════════════════
   1. CONSTANTS
═══════════════════════════════════════════════════════════ */

/** Rainbow palette — order matches the 8 CSS variables */
const RAINBOW = [
  { hex: '#FF6B6B', name: 'Red'    },
  { hex: '#FF9F43', name: 'Orange' },
  { hex: '#FECA57', name: 'Yellow' },
  { hex: '#48C774', name: 'Green'  },
  { hex: '#00CECE', name: 'Teal'   },
  { hex: '#5B4FE8', name: 'Indigo' },
  { hex: '#B44FE8', name: 'Violet' },
  { hex: '#FF6BB5', name: 'Pink'   },
];

/** Emoji categories for the picker */
const EMOJIS = [
  '📌','📎','🗂️','📅','⏰','🔔','🚀','💡','🎯','✅',
  '🏠','🛒','💼','📚','🏋️','🎨','🎵','🍕','🌿','✈️',
  '💻','📱','🔑','💰','🩺','🧠','👨‍👩‍👧','🐾','🌈','⚡',
  '🎉','❤️','🌟','🔥','💎','🌙','☀️','🌊','🍀','🎁',
];

/** Hours shown in the day planner (6 AM to 10 PM) */
const PLAN_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6…22

/* ═══════════════════════════════════════════════════════════
   2. STATE
═══════════════════════════════════════════════════════════ */

let tasks        = [];          // master task array
let activeFilter = 'all';       // task list filter
let searchQuery  = '';          // live search string
let dragSrcId    = null;        // task-list drag source id
let kanbanDragId = null;        // kanban drag source id

// Emoji/image picker state
let pickerEmoji     = '';       // selected emoji string or ''
let pickerImageData = '';       // base64 data URL or ''

// The "pending" values while the modal is open (committed on Confirm)
let pendingEmoji = '';
let pendingImage = '';

// Currently selected color index (default: Indigo)
let selectedColorIdx = 5;

/* ═══════════════════════════════════════════════════════════
   3. DOM REFS
═══════════════════════════════════════════════════════════ */

const taskInput      = document.getElementById('task-input');
const dueDateInput   = document.getElementById('due-date-input');
const dueTimeInput   = document.getElementById('due-time-input');
const prioritySelect = document.getElementById('priority-select');
const reminderCheck  = document.getElementById('reminder-check');
const addBtn         = document.getElementById('add-btn');
const taskList       = document.getElementById('task-list');
const emptyState     = document.getElementById('empty-state');
const inputError     = document.getElementById('input-error');
const searchInput    = document.getElementById('search-input');
const clearAllBtn    = document.getElementById('clear-all-btn');
const themeToggle    = document.getElementById('theme-toggle');
const totalCountEl   = document.getElementById('total-count');
const doneCountEl    = document.getElementById('done-count');
const pendingCountEl = document.getElementById('pending-count');
const filterBtns     = document.querySelectorAll('.filter-btn');
const toastContainer = document.getElementById('toast-container');
const navBtns        = document.querySelectorAll('.nav-btn');

// Emoji modal
const emojiTrigger   = document.getElementById('emoji-trigger');
const emojiDisplay   = document.getElementById('emoji-display');
const emojiModal     = document.getElementById('emoji-modal');
const emojiModalClose= document.getElementById('emoji-modal-close');
const emojiGrid      = document.getElementById('emoji-grid');
const imgUpload      = document.getElementById('img-upload');
const imgPreview     = document.getElementById('img-preview');
const imgPreviewWrap = document.getElementById('img-preview-wrap');
const imgClear       = document.getElementById('img-clear');
const emojiCancel    = document.getElementById('emoji-cancel');
const emojiConfirm   = document.getElementById('emoji-confirm');

// Color swatches container
const colorSwatchesEl = document.getElementById('color-swatches');

// Reminder popup
const reminderPopup     = document.getElementById('reminder-popup');
const reminderPopupIcon = document.getElementById('reminder-popup-icon');
const reminderPopupTitle= document.getElementById('reminder-popup-title');
const reminderPopupTime = document.getElementById('reminder-popup-time');
const reminderClose     = document.getElementById('reminder-close');
const reminderBadge     = document.getElementById('reminder-badge');

// Kanban columns
const kTodo       = document.getElementById('k-todo');
const kInProgress = document.getElementById('k-inprogress');
const kDone       = document.getElementById('k-done');

/* ═══════════════════════════════════════════════════════════
   4. INIT
═══════════════════════════════════════════════════════════ */

function init() {
  loadTasks();
  loadTheme();
  buildColorSwatches();
  buildEmojiGrid();
  render();
  renderKanban();
  renderPlanDay();
  renderReminders();
  requestNotificationPermission();
  startReminderClock();
  feather.replace();
}

/* ═══════════════════════════════════════════════════════════
   5. LOCALSTORAGE
═══════════════════════════════════════════════════════════ */

function loadTasks() {
  const s = localStorage.getItem('taskflow_tasks');
  tasks = s ? JSON.parse(s) : [];
}

function saveTasks() {
  localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function loadTheme() {
  if (localStorage.getItem('taskflow_theme') === 'dark') applyTheme('dark');
}

/* ═══════════════════════════════════════════════════════════
   6. TASK CRUD
═══════════════════════════════════════════════════════════ */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addTask() {
  const title    = taskInput.value.trim();
  const dueDate  = dueDateInput.value;
  const dueTime  = dueTimeInput.value;
  const priority = prioritySelect.value;
  const reminder = reminderCheck.checked;

  // Validation
  if (!title) { showError('Task title cannot be empty.'); taskInput.focus(); return; }
  if (title.length > 120) { showError('Max 120 characters.'); return; }
  if (dueTime && !dueDate) { showError('Set a date when specifying a time.'); dueDateInput.focus(); return; }
  if (reminder && (!dueDate || !dueTime)) { showError('Set both date & time to use reminder.'); return; }
  clearError();

  const task = {
    id:        generateId(),
    title,
    completed: false,
    dueDate,
    dueTime,
    color:     RAINBOW[selectedColorIdx].hex,
    priority,
    reminder,               // boolean
    reminderFired: false,   // tracks if alert was already shown
    emoji:     pickerEmoji,
    image:     pickerImageData,
    status:    'todo',      // 'todo' | 'inprogress' | 'done'
    createdAt: new Date().toISOString(),
  };

  tasks.push(task);
  saveTasks();

  // Reset UI
  taskInput.value       = '';
  dueDateInput.value    = '';
  dueTimeInput.value    = '';
  prioritySelect.value  = 'none';
  reminderCheck.checked = false;
  pickerEmoji = ''; pickerImageData = '';
  emojiDisplay.innerHTML = '＋';
  emojiDisplay.classList.remove('has-img');

  render();
  renderKanban();
  renderPlanDay();
  renderReminders();
  showToast('Task added!', 'success');
  taskInput.focus();
}

function toggleComplete(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  // Sync kanban status
  if (t.completed) t.status = 'done';
  else if (t.status === 'done') t.status = 'todo';
  saveTasks();
  render();
  renderKanban();
  renderReminders();
  showToast(t.completed ? 'Task complete ✓' : 'Task marked pending', 'info');
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
  renderKanban();
  renderPlanDay();
  renderReminders();
  showToast('Task deleted.', 'error');
}

function startEdit(id) {
  const t  = tasks.find(t => t.id === id);
  if (!t) return;
  const li = taskList.querySelector(`[data-id="${id}"]`);
  if (!li) return;

  const titleEl = li.querySelector('.task-title');
  const editBtn = li.querySelector('.edit-btn');

  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'task-edit-input';
  inp.value = t.title; inp.maxLength = 120;
  titleEl.replaceWith(inp);
  inp.focus(); inp.select();

  editBtn.innerHTML = `<i data-feather="check"></i>`;
  editBtn.classList.replace('edit-btn', 'save-btn');
  feather.replace();

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit(id, inp);
    if (e.key === 'Escape') render();
  });
  editBtn.onclick = () => saveEdit(id, inp);
}

function saveEdit(id, inp) {
  const newTitle = inp.value.trim();
  if (!newTitle) { showToast('Title cannot be empty.', 'error'); inp.focus(); return; }
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.title = newTitle;
  saveTasks();
  render();
  renderKanban();
  showToast('Task updated!', 'success');
}

function clearAll() {
  if (!tasks.length) { showToast('No tasks to clear.', 'info'); return; }
  if (!confirm('Remove all tasks?')) return;
  tasks = [];
  saveTasks();
  render();
  renderKanban();
  renderPlanDay();
  renderReminders();
  showToast('All tasks cleared.', 'error');
}

/* ═══════════════════════════════════════════════════════════
   7. RENDER — TASK LIST
═══════════════════════════════════════════════════════════ */

function render() {
  updateStats();
  const visible = getFilteredTasks();

  // Remove old cards (keep empty-state)
  Array.from(taskList.children).forEach(c => {
    if (!c.classList.contains('empty-state')) c.remove();
  });

  emptyState.style.display = visible.length === 0 ? 'flex' : 'none';
  visible.forEach(t => taskList.appendChild(buildTaskCard(t)));
  feather.replace();
}

function updateStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  totalCountEl.textContent   = total;
  doneCountEl.textContent    = done;
  pendingCountEl.textContent = total - done;
}

function getFilteredTasks() {
  let r = [...tasks];
  if (activeFilter === 'completed') r = r.filter(t => t.completed);
  if (activeFilter === 'pending')   r = r.filter(t => !t.completed);
  if (activeFilter === 'high')      r = r.filter(t => t.priority === 'high');
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    r = r.filter(t => t.title.toLowerCase().includes(q));
  }
  return r;
}

/** Build one task <li> card */
function buildTaskCard(task) {
  const li = document.createElement('li');
  li.className  = `task-item${task.completed ? ' completed' : ''}`;
  li.dataset.id = task.id;
  li.draggable  = true;
  li.style.setProperty('--task-color', task.color || RAINBOW[5].hex);

  // Priority badge
  if (task.priority && task.priority !== 'none') {
    const pb = document.createElement('span');
    pb.className = `priority-badge ${task.priority}`;
    pb.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    li.appendChild(pb);
  }

  // Reminder dot
  if (task.reminder && !task.completed) {
    const rd = document.createElement('span');
    rd.className = 'reminder-dot'; rd.title = 'Reminder set'; rd.textContent = '⏰';
    li.appendChild(rd);
  }

  // Drag handle
  const handle = document.createElement('span');
  handle.className = 'drag-handle'; handle.title = 'Drag to reorder';
  handle.innerHTML = `<i data-feather="menu"></i>`; handle.setAttribute('aria-hidden','true');

  // Thumbnail (emoji or image)
  const thumb = document.createElement('div');
  thumb.className = 'task-thumb';
  if (task.image) {
    thumb.innerHTML = `<img src="${task.image}" alt="task image" />`;
  } else if (task.emoji) {
    thumb.textContent = task.emoji;
  } else {
    thumb.style.display = 'none';
  }

  // Checkbox
  const chk = document.createElement('input');
  chk.type = 'checkbox'; chk.id = `chk-${task.id}`;
  chk.className = 'task-checkbox'; chk.checked = task.completed;

  const lbl = document.createElement('label');
  lbl.htmlFor = `chk-${task.id}`; lbl.className = 'checkbox-label';
  lbl.innerHTML = `<i data-feather="check"></i>`;
  lbl.title = task.completed ? 'Mark pending' : 'Mark complete';

  // Body
  const body = document.createElement('div');
  body.className = 'task-body';

  const titleEl = document.createElement('span');
  titleEl.className = 'task-title'; titleEl.textContent = task.title;
  body.appendChild(titleEl);

  // Due date + time badge
  if (task.dueDate) {
    const isOD = !task.completed && isDateTimeOverdue(task.dueDate, task.dueTime || '');
    const badge = document.createElement('span');
    badge.className = `task-due${isOD ? ' overdue' : ''}`;
    let html = `<i data-feather="calendar"></i> ${formatDate(task.dueDate)}`;
    if (task.dueTime) {
      html += `<span class="due-time"><i data-feather="clock"></i>${formatTime(task.dueTime)}</span>`;
    }
    badge.innerHTML = html;
    if (isOD) badge.title = 'Overdue!';
    body.appendChild(badge);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'task-btn edit-btn'; editBtn.title = 'Edit';
  editBtn.innerHTML = `<i data-feather="edit-2"></i>`;

  const delBtn = document.createElement('button');
  delBtn.className = 'task-btn delete-btn'; delBtn.title = 'Delete';
  delBtn.innerHTML = `<i data-feather="trash"></i>`;

  actions.append(editBtn, delBtn);
  li.append(handle, thumb, chk, lbl, body, actions);

  // Events
  chk.addEventListener('change',     () => toggleComplete(task.id));
  editBtn.addEventListener('click',  () => startEdit(task.id));
  delBtn.addEventListener('click',   () => deleteTask(task.id));

  // Drag-and-drop (task list)
  li.addEventListener('dragstart', onDragStart);
  li.addEventListener('dragover',  onDragOver);
  li.addEventListener('dragleave', onDragLeave);
  li.addEventListener('drop',      onDrop);
  li.addEventListener('dragend',   onDragEnd);

  return li;
}

/* ═══════════════════════════════════════════════════════════
   8. RAINBOW COLOR SWATCHES
═══════════════════════════════════════════════════════════ */

function buildColorSwatches() {
  colorSwatchesEl.innerHTML = '';
  RAINBOW.forEach((c, i) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = `color-swatch${i === selectedColorIdx ? ' selected' : ''}`;
    swatch.style.background = c.hex;
    swatch.title = c.name;
    swatch.setAttribute('role', 'radio');
    swatch.setAttribute('aria-checked', i === selectedColorIdx ? 'true' : 'false');
    swatch.setAttribute('aria-label', c.name);
    swatch.addEventListener('click', () => {
      selectedColorIdx = i;
      document.querySelectorAll('.color-swatch').forEach((s, si) => {
        s.classList.toggle('selected', si === i);
        s.setAttribute('aria-checked', si === i ? 'true' : 'false');
      });
    });
    colorSwatchesEl.appendChild(swatch);
  });
}

/* ═══════════════════════════════════════════════════════════
   9. EMOJI / IMAGE PICKER
═══════════════════════════════════════════════════════════ */

function buildEmojiGrid() {
  emojiGrid.innerHTML = '';
  EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'emoji-btn'; btn.textContent = em;
    btn.title = em; btn.setAttribute('aria-label', em);
    btn.addEventListener('click', () => {
      // Deselect all, select this
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      pendingEmoji = em;
      // Clear pending image if emoji chosen
      pendingImage = '';
      imgPreviewWrap.classList.add('hidden');
      imgUpload.value = '';
    });
    emojiGrid.appendChild(btn);
  });
}

// Open modal
emojiTrigger.addEventListener('click', () => {
  pendingEmoji = pickerEmoji;
  pendingImage = pickerImageData;
  // Reflect current selection
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.classList.toggle('selected', b.textContent === pendingEmoji);
  });
  if (pendingImage) {
    imgPreview.src = pendingImage;
    imgPreviewWrap.classList.remove('hidden');
  } else {
    imgPreviewWrap.classList.add('hidden');
  }
  emojiModal.classList.remove('hidden');
  feather.replace();
});

// Close via X or Cancel
function closeEmojiModal() { emojiModal.classList.add('hidden'); }
emojiModalClose.addEventListener('click', closeEmojiModal);
emojiCancel.addEventListener('click',     closeEmojiModal);
emojiModal.addEventListener('click', e => { if (e.target === emojiModal) closeEmojiModal(); });

// Image upload
imgUpload.addEventListener('change', () => {
  const file = imgUpload.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingImage = reader.result;
    imgPreview.src = pendingImage;
    imgPreviewWrap.classList.remove('hidden');
    // Clear emoji selection
    pendingEmoji = '';
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  };
  reader.readAsDataURL(file);
});

// Remove uploaded image
imgClear.addEventListener('click', () => {
  pendingImage = '';
  imgUpload.value = '';
  imgPreviewWrap.classList.add('hidden');
});

// Confirm selection
emojiConfirm.addEventListener('click', () => {
  pickerEmoji     = pendingEmoji;
  pickerImageData = pendingImage;

  // Update trigger button display
  if (pickerImage) {
    emojiDisplay.innerHTML = `<img src="${pickerImageData}" alt="task img" />`;
    emojiDisplay.classList.add('has-img');
  } else if (pickerEmoji) {
    emojiDisplay.textContent = pickerEmoji;
    emojiDisplay.classList.remove('has-img');
  } else {
    emojiDisplay.innerHTML = '＋';
    emojiDisplay.classList.remove('has-img');
  }
  closeEmojiModal();
});

// Fix reference typo
Object.defineProperty(window, 'pickerImage', { get: () => pickerImageData });

/* ═══════════════════════════════════════════════════════════
   10. TASK LIST DRAG AND DROP
═══════════════════════════════════════════════════════════ */

function onDragStart(e) {
  dragSrcId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  if (this.dataset.id !== dragSrcId) this.classList.add('drag-over');
}
function onDragLeave() { this.classList.remove('drag-over'); }
function onDrop(e) {
  e.stopPropagation();
  const targetId = this.dataset.id;
  if (dragSrcId && dragSrcId !== targetId) {
    const si = tasks.findIndex(t => t.id === dragSrcId);
    const ti = tasks.findIndex(t => t.id === targetId);
    if (si !== -1 && ti !== -1) {
      const [moved] = tasks.splice(si, 1);
      tasks.splice(ti, 0, moved);
      saveTasks(); render(); showToast('Reordered.', 'info');
    }
  }
  this.classList.remove('drag-over');
}
function onDragEnd() {
  document.querySelectorAll('.task-item').forEach(el => el.classList.remove('dragging','drag-over'));
  dragSrcId = null;
}

/* ═══════════════════════════════════════════════════════════
   11. KANBAN BOARD
═══════════════════════════════════════════════════════════ */

/** Render all three Kanban columns */
function renderKanban() {
  const cols = { todo: kTodo, inprogress: kInProgress, done: kDone };

  // Clear columns
  Object.values(cols).forEach(col => col.innerHTML = '');

  tasks.forEach(task => {
    const status = task.status || 'todo';
    const col    = cols[status] || kTodo;
    col.appendChild(buildKanbanCard(task));
  });

  // Update column counts
  document.getElementById('k-todo-count').textContent       = kTodo.children.length;
  document.getElementById('k-inprogress-count').textContent = kInProgress.children.length;
  document.getElementById('k-done-count').textContent       = kDone.children.length;

  feather.replace();
  initKanbanDragDrop();
}

/** Build one Kanban card <li> */
function buildKanbanCard(task) {
  const li = document.createElement('li');
  li.className  = 'kanban-card';
  li.dataset.id = task.id;
  li.draggable  = true;
  li.style.setProperty('--task-color', task.color || RAINBOW[5].hex);

  let thumbHtml = '';
  if (task.image) {
    thumbHtml = `<span class="kanban-card-thumb"><img src="${task.image}" style="width:1.2rem;height:1.2rem;border-radius:3px;vertical-align:middle" alt="" /></span>`;
  } else if (task.emoji) {
    thumbHtml = `<span class="kanban-card-thumb">${task.emoji}</span>`;
  }

  let metaHtml = '';
  if (task.dueDate) metaHtml += `<span>📅 ${formatDate(task.dueDate)}${task.dueTime ? ' '+formatTime(task.dueTime) : ''}</span>`;
  if (task.priority && task.priority !== 'none') metaHtml += `<span>${task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} ${task.priority}</span>`;

  li.innerHTML = `
    <div class="kanban-card-title">${thumbHtml}${escapeHtml(task.title)}</div>
    ${metaHtml ? `<div class="kanban-card-meta">${metaHtml}</div>` : ''}
  `;
  return li;
}

/** Wire drag-and-drop for all Kanban cards + column drop zones */
function initKanbanDragDrop() {
  // Card dragging
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      kanbanDragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-target-col'));
      document.querySelectorAll('.kanban-card').forEach(c => c.classList.remove('drag-over-card'));
      kanbanDragId = null;
    });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over-card'); });
    card.addEventListener('dragleave',  () => card.classList.remove('drag-over-card'));
    card.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      card.classList.remove('drag-over-card');
      if (!kanbanDragId || kanbanDragId === card.dataset.id) return;
      // Reorder within same column
      const si = tasks.findIndex(t => t.id === kanbanDragId);
      const ti = tasks.findIndex(t => t.id === card.dataset.id);
      if (si !== -1 && ti !== -1 && tasks[si].status === tasks[ti].status) {
        const [moved] = tasks.splice(si, 1);
        tasks.splice(ti, 0, moved);
        saveTasks(); renderKanban(); render();
      }
    });
  });

  // Column drop zones (change status)
  document.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-target-col');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-target-col'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-target-col');
      if (!kanbanDragId) return;
      const newStatus = col.dataset.status;
      const task = tasks.find(t => t.id === kanbanDragId);
      if (task && task.status !== newStatus) {
        task.status    = newStatus;
        task.completed = newStatus === 'done';
        saveTasks(); renderKanban(); render(); renderReminders();
        showToast(`Moved to "${col.querySelector('h3').textContent}"`, 'info');
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   12. PLAN MY DAY
═══════════════════════════════════════════════════════════ */

function renderPlanDay() {
  const slotsEl   = document.getElementById('planner-slots');
  const planTasksEl= document.getElementById('planner-tasks');
  const unschEl   = document.getElementById('unscheduled-list');
  const dateLabel = document.getElementById('plan-date-label');

  // Header date
  const today = new Date();
  dateLabel.textContent = today.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  // Identify today's tasks
  const todayStr = today.toISOString().slice(0,10);
  const todayTasks   = tasks.filter(t => t.dueDate === todayStr);
  const scheduled    = todayTasks.filter(t => t.dueTime);
  const unscheduled  = todayTasks.filter(t => !t.dueTime);

  // Build hour slots
  slotsEl.innerHTML   = '';
  planTasksEl.innerHTML = '';
  const nowHour = today.getHours();

  PLAN_HOURS.forEach(h => {
    // Legend label
    const label = document.createElement('div');
    label.className = 'planner-slot-label';
    label.textContent = `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
    slotsEl.appendChild(label);

    // Task row
    const row = document.createElement('div');
    row.className = `planner-row${h === nowHour ? ' now-row' : ''}`;

    // Chip for each scheduled task in this hour
    scheduled.filter(t => {
      const [th] = t.dueTime.split(':').map(Number);
      return th === h;
    }).forEach(t => {
      const chip = document.createElement('div');
      chip.className = 'planner-chip';
      chip.style.setProperty('--task-color', t.color || RAINBOW[5].hex);
      const thumbPart = t.emoji ? `<span class="planner-chip-thumb">${t.emoji}</span>` : '';
      chip.innerHTML = `${thumbPart}${escapeHtml(t.title)} <small>${formatTime(t.dueTime)}</small>`;
      row.appendChild(chip);
    });

    planTasksEl.appendChild(row);
  });

  // Unscheduled list
  unschEl.innerHTML = '';
  if (unscheduled.length === 0) {
    unschEl.innerHTML = `<li style="color:var(--text-muted);font-size:.85rem">No unscheduled tasks for today.</li>`;
  } else {
    unscheduled.forEach(t => {
      const chip = document.createElement('li');
      chip.className = 'unscheduled-chip';
      chip.style.setProperty('--task-color', t.color || RAINBOW[5].hex);
      chip.innerHTML = `${t.emoji ? `<span>${t.emoji}</span>` : ''} ${escapeHtml(t.title)}`;
      unschEl.appendChild(chip);
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   13. REMINDERS VIEW + NOTIFICATIONS
═══════════════════════════════════════════════════════════ */

function renderReminders() {
  const list = document.getElementById('reminder-list');
  const reminderTasks = tasks.filter(t => t.reminder && !t.completed);

  // Update nav badge
  if (reminderTasks.length > 0) {
    reminderBadge.style.display = 'inline';
    reminderBadge.textContent   = reminderTasks.length;
  } else {
    reminderBadge.style.display = 'none';
  }

  list.innerHTML = '';
  if (reminderTasks.length === 0) {
    list.innerHTML = `
      <li class="empty-state">
        <span class="empty-icon">🔔</span>
        <p>No reminders set. Mark a task as ⏰ Remind when adding.</p>
      </li>`;
    return;
  }

  reminderTasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'reminder-item';
    li.style.setProperty('--task-color', t.color || RAINBOW[5].hex);

    const icon = t.image
      ? `<img src="${t.image}" style="width:2.5rem;height:2.5rem;border-radius:8px;object-fit:cover" alt="" />`
      : `<span class="reminder-item-icon">${t.emoji || '⏰'}</span>`;

    const priBadge = t.priority && t.priority !== 'none'
      ? `<span class="reminder-item-priority priority-badge ${t.priority}">${t.priority}</span>`
      : '';

    let timeStr = '';
    if (t.dueDate) {
      timeStr = formatDate(t.dueDate);
      if (t.dueTime) timeStr += ' at ' + formatTime(t.dueTime);
    }

    li.innerHTML = `
      ${icon}
      <div class="reminder-item-body">
        <div class="reminder-item-title">${escapeHtml(t.title)} ${priBadge}</div>
        <div class="reminder-item-time">${timeStr ? '📅 ' + timeStr : 'No due date/time set'}</div>
      </div>`;
    list.appendChild(li);
  });
}

/** Ask browser for Notification permission on first load */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/** Poll every 30 seconds to check if any reminder is due */
function startReminderClock() {
  checkReminders();
  setInterval(checkReminders, 30_000);
}

function checkReminders() {
  const now = new Date();
  tasks.forEach(t => {
    if (!t.reminder || t.reminderFired || t.completed) return;
    if (!t.dueDate || !t.dueTime) return;

    const [y,m,d]  = t.dueDate.split('-').map(Number);
    const [hr,min] = t.dueTime.split(':').map(Number);
    const due      = new Date(y, m - 1, d, hr, min, 0);

    // Fire if due time is within the past 5 minutes (catches missed alerts)
    const diff = now - due;
    if (diff >= 0 && diff <= 5 * 60_000) {
      t.reminderFired = true;
      saveTasks();
      fireReminder(t);
    }
  });
}

/** Show popup + optional browser notification */
function fireReminder(task) {
  // In-app popup
  reminderPopupIcon.textContent  = task.emoji || '⏰';
  reminderPopupTitle.textContent = task.title;
  reminderPopupTime.textContent  = task.dueDate
    ? `Due: ${formatDate(task.dueDate)}${task.dueTime ? ' at ' + formatTime(task.dueTime) : ''}`
    : '';
  reminderPopup.classList.remove('hidden');
  feather.replace();

  // Browser notification (if allowed)
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`⏰ TaskFlow Reminder`, {
      body: task.title,
      icon: 'https://cdn-icons-png.flaticon.com/512/2098/2098402.png',
    });
  }

  showToast(`⏰ Reminder: ${task.title}`, 'info');
}

// Dismiss popup
reminderClose.addEventListener('click', () => reminderPopup.classList.add('hidden'));

/* ═══════════════════════════════════════════════════════════
   14. VIEW NAVIGATION
═══════════════════════════════════════════════════════════ */

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${target}`).classList.add('active');

    // Re-render the relevant view fresh on every visit
    if (target === 'plan')      renderPlanDay();
    if (target === 'manage')    renderKanban();
    if (target === 'reminders') renderReminders();
  });
});

/* ═══════════════════════════════════════════════════════════
   15. FILTER + SEARCH
═══════════════════════════════════════════════════════════ */

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  render();
});

/* ═══════════════════════════════════════════════════════════
   16. ADD + CLEAR TRIGGERS
═══════════════════════════════════════════════════════════ */

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown',    e => { if (e.key === 'Enter') addTask(); });
dueDateInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
dueTimeInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
taskInput.addEventListener('input', clearError);
clearAllBtn.addEventListener('click', clearAll);

/* ═══════════════════════════════════════════════════════════
   17. DARK / LIGHT MODE
═══════════════════════════════════════════════════════════ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = theme === 'dark' ? 'sun' : 'moon';
  const label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  themeToggle.innerHTML = `<i data-feather="${icon}"></i><span>${label}</span>`;
  localStorage.setItem('taskflow_theme', theme);
  feather.replace();
}

themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

/* ═══════════════════════════════════════════════════════════
   18. DATE / TIME HELPERS
═══════════════════════════════════════════════════════════ */

function formatDate(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const date    = new Date(y, m-1, d);
  const today   = new Date(); today.setHours(0,0,0,0);
  const tom     = new Date(today); tom.setDate(today.getDate()+1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tom.getTime())   return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h,min] = timeStr.split(':').map(Number);
  const period  = h >= 12 ? 'PM' : 'AM';
  return `${h%12||12}:${String(min).padStart(2,'0')} ${period}`;
}

function isDateTimeOverdue(dateStr, timeStr) {
  if (!dateStr) return false;
  const [y,m,d] = dateStr.split('-').map(Number);
  if (timeStr) {
    const [h,mn] = timeStr.split(':').map(Number);
    return new Date(y, m-1, d, h, mn) < new Date();
  }
  const due = new Date(y, m-1, d);
  const now = new Date(); now.setHours(0,0,0,0);
  return due < now;
}

/* ═══════════════════════════════════════════════════════════
   19. TOAST
═══════════════════════════════════════════════════════════ */

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'check-circle', error:'x-circle', info:'info' };
  t.innerHTML = `<i data-feather="${icons[type]||'info'}"></i> ${msg}`;
  toastContainer.appendChild(t);
  feather.replace();
  setTimeout(() => t.remove(), 3000);
}

/* ═══════════════════════════════════════════════════════════
   20. VALIDATION HELPERS
═══════════════════════════════════════════════════════════ */

function showError(msg) { inputError.textContent = msg; }
function clearError()   { inputError.textContent = ''; }

/** Safely escape text for innerHTML insertion */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════════════════
   21. KICK OFF
═══════════════════════════════════════════════════════════ */

init();