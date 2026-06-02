const typeSelect = document.getElementById('typeSelect');
const mainInput  = document.getElementById('mainInput');
const itemList   = document.getElementById('itemList');
const emptyMsg   = document.getElementById('emptyMsg');
const addBtn     = document.getElementById('addBtn');

const CHECK_SVG = `<svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M1 5l3.5 3.5L11 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const GRIP_SVG = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
  <circle cx="3" cy="4"  r="1.4"/>
  <circle cx="7" cy="4"  r="1.4"/>
  <circle cx="3" cy="8"  r="1.4"/>
  <circle cx="7" cy="8"  r="1.4"/>
  <circle cx="3" cy="12" r="1.4"/>
  <circle cx="7" cy="12" r="1.4"/>
</svg>`;

const CALENDAR_SVG = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <rect x="1" y="2.5" width="11" height="9.5" rx="1.5"/>
  <line x1="1" y1="6" x2="12" y2="6"/>
  <line x1="4" y1="1" x2="4" y2="4"/>
  <line x1="9" y1="1" x2="9" y2="4"/>
</svg>`;

const PIN_SVG = `<svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <circle cx="5" cy="5" r="4.2"/>
  <line x1="8.2" y1="8.2" x2="12.5" y2="12.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="5" cy="5" r="1.6" fill="white" opacity="0.55"/>
</svg>`;

let selectMode = false;

// ── Dropdown ─────────────────────────────────────────────
const selectWrapper = typeSelect.closest('.select-wrapper');
typeSelect.addEventListener('mousedown', () => selectWrapper.classList.toggle('open'));
typeSelect.addEventListener('blur',   () => selectWrapper.classList.remove('open'));
typeSelect.addEventListener('change', () => {
  selectWrapper.classList.remove('open');
  mainInput.placeholder = typeSelect.value === 'list' ? 'タイトルを入力...' : 'タスクを入力...';
  mainInput.focus();
});

mainInput.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });
addBtn.addEventListener('click', addItem);

function addItem() {
  const text = mainInput.value.trim();
  if (!text) return;
  let el;
  if (typeSelect.value === 'list') {
    el = createListItem(text);
    logEvent('add', `リスト「${text}」を追加`);
  } else {
    el = createTaskItem(text);
    logEvent('add', `タスク「${text}」を追加`);
  }
  insertAfterPinned(itemList, el);
  mainInput.value = '';
  mainInput.focus();
  updateEmpty();
  saveState();
}

// ── Task item ────────────────────────────────────────────
function createTaskItem(text, createdAt = null, dueDate = null, dueTime = null) {
  const item = document.createElement('div');
  item.className = 'task-item';

  const dateObj = createdAt ? new Date(createdAt) : new Date();
  item.dataset.created = dateObj.toISOString();
  const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日に追加`;

  const selCheck = document.createElement('span');
  selCheck.className = 'sel-check';

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.innerHTML = GRIP_SVG;
  handle.setAttribute('aria-hidden', 'true');

  const checkBtn = document.createElement('button');
  checkBtn.className = 'check-btn';
  checkBtn.setAttribute('aria-label', '完了');
  checkBtn.innerHTML = CHECK_SVG;
  checkBtn.addEventListener('click', () => {
    item.classList.toggle('done');
    const isDone = item.classList.contains('done');
    const container = item.parentElement;

    if (!item.classList.contains('pinned')) {
      if (isDone) {
        container.appendChild(item);
      } else {
        const firstDone = [...container.children].find(
          el => el !== item && el.classList.contains('task-item') && el.classList.contains('done')
        );
        if (firstDone) container.insertBefore(item, firstDone);
      }
    }

    const wrapper = getParentListWrapper(item);
    if (wrapper) updateListCount(wrapper);
    logEvent(isDone ? 'done' : 'undone', `タスク「${text}」を${isDone ? '完了' : '未完了'}に変更`);
    saveState();
  });

  const span = document.createElement('span');
  span.className = 'task-text';
  span.textContent = text;

  // ダブルクリック / ダブルタップでインライン編集
  span.addEventListener('dblclick', () => startEditTask(span, item));
  let lastTap = 0;
  span.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 300) { e.preventDefault(); startEditTask(span, item); }
    lastTap = now;
  });

  const dateSpan = document.createElement('span');
  dateSpan.className = 'task-date-tip';
  dateSpan.textContent = dateStr;

  if (dueDate) item.dataset.due = dueDate;
  if (dueTime) item.dataset.dueTime = dueTime;

  const dueBadge = document.createElement('span');
  dueBadge.className = 'task-due';
  updateDueBadge(dueBadge, dueDate, dueTime);
  dueBadge.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); openDatePicker(dueBtn, item, text, dueBadge); });

  const dueBtn = document.createElement('button');
  dueBtn.className = 'due-btn';
  dueBtn.setAttribute('aria-label', '期限を設定');
  dueBtn.innerHTML = CALENDAR_SVG;
  dueBtn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); openDatePicker(dueBtn, item, text, dueBadge); });

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.setAttribute('aria-label', '削除');
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => {
    confirmDelete(item, `タスク「${text}」`, () => {
      const wrapper = getParentListWrapper(item);
      const listName = wrapper?.querySelector('.list-title')?.textContent;
      const msg = wrapper
        ? `リスト「${listName}」内のタスク「${text}」を削除`
        : `タスク「${text}」を削除`;
      logEvent('delete', msg);
      item.remove();
      if (wrapper) updateListCount(wrapper);
      else updateEmpty();
      saveState();
    });
  });

  const pinBtn = document.createElement('button');
  pinBtn.className = 'pin-btn';
  pinBtn.setAttribute('aria-label', 'ピン');
  pinBtn.innerHTML = PIN_SVG;
  pinBtn.addEventListener('click', () => togglePin(item));

  item.addEventListener('click', () => {
    if (!selectMode) return;
    item.classList.toggle('selected');
    updateSelectBar();
  });

  const taskContent = document.createElement('div');
  taskContent.className = 'task-content';
  taskContent.appendChild(dueBadge);
  taskContent.appendChild(span);

  item.appendChild(dateSpan);
  item.appendChild(selCheck);
  item.appendChild(handle);
  item.appendChild(checkBtn);
  item.appendChild(taskContent);
  item.appendChild(dueBtn);
  item.appendChild(pinBtn);
  item.appendChild(delBtn);

  initDrag(item, handle);
  return item;
}

// ── Task inline edit ─────────────────────────────────────
function startEditTask(span, item) {
  if (selectMode) return;
  if (span.querySelector('input')) return; // 既に編集中

  const oldText = span.textContent;
  span.textContent = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldText;
  input.className = 'task-edit-input';
  span.appendChild(input);
  input.focus();
  input.select();

  const commit = () => {
    const newText = input.value.trim();
    span.textContent = newText || oldText;
    if (newText && newText !== oldText) {
      logEvent('add', `タスク「${oldText}」→「${newText}」に名前変更`);
      saveState();
    }
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = oldText; input.blur(); }
  });
}

// ── Inline add form ──────────────────────────────────────
function showInlineForm(afterEl, container) {
  container.querySelectorAll('.inline-add-form').forEach(f => f.remove());

  const form = document.createElement('div');
  form.className = 'inline-add-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'タスクを追加...';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'inline-confirm-btn';
  confirmBtn.textContent = '追加';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'inline-cancel-btn';
  cancelBtn.textContent = '×';

  const submit = () => {
    const t = input.value.trim();
    if (!t) return;
    const newTask = createTaskItem(t);
    // 完了タスクの前、なければフォームの前に挿入
    const firstDone = [...container.children].find(
      c => c !== form && c.classList.contains('task-item') && c.classList.contains('done')
    );
    container.insertBefore(newTask, firstDone || form);
    form.remove();
    const wrapper = container.closest('.list-item');
    if (wrapper) {
      updateListCount(wrapper);
      logEvent('add', `タスク「${t}」を追加`);
      saveState();
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') form.remove();
  });
  confirmBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', () => form.remove());

  form.appendChild(input);
  form.appendChild(confirmBtn);
  form.appendChild(cancelBtn);

  if (afterEl) container.insertBefore(form, afterEl.nextSibling);
  else container.appendChild(form);
  input.focus();
}

// ── List item ────────────────────────────────────────────
function createListItem(title) {
  const wrapper = document.createElement('div');
  wrapper.className = 'list-item';

  // header
  const header = document.createElement('div');
  header.className = 'list-header';
  header.addEventListener('click', e => {
    if (selectMode) {
      wrapper.classList.toggle('selected');
      updateSelectBar();
      return;
    }
    if (e.target.closest('.list-delete-btn') || e.target.closest('.drag-handle')) return;
    wrapper.classList.toggle('collapsed');
    saveState();
  });

  const listSelCheck = document.createElement('span');
  listSelCheck.className = 'sel-check';

  const dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = GRIP_SVG;
  dragHandle.setAttribute('aria-hidden', 'true');

  const toggleIcon = document.createElement('span');
  toggleIcon.className = 'toggle-icon';
  toggleIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 3l3 4 3-4" stroke="#9b8ff7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const titleSpan = document.createElement('span');
  titleSpan.className = 'list-title';
  titleSpan.textContent = title;

  // ダブルクリック／ダブルタップでリスト名編集
  titleSpan.addEventListener('dblclick', e => { e.stopPropagation(); startListTitleEdit(titleSpan, wrapper); });
  let lastTapList = 0;
  titleSpan.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTapList < 300) { e.preventDefault(); e.stopPropagation(); startListTitleEdit(titleSpan, wrapper); }
    lastTapList = now;
  });

  const countBadge = document.createElement('span');
  countBadge.className = 'list-count';
  countBadge.textContent = '0';

  const delBtn = document.createElement('button');
  delBtn.className = 'list-delete-btn';
  delBtn.setAttribute('aria-label', 'リストを削除');
  delBtn.textContent = '×';
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    confirmDelete(header, `リスト「${title}」`, () => {
      logEvent('delete', `リスト「${title}」を削除`);
      wrapper.remove();
      updateEmpty();
      saveState();
    });
  });

  const pinBtn = document.createElement('button');
  pinBtn.className = 'pin-btn';
  pinBtn.setAttribute('aria-label', 'ピン');
  pinBtn.innerHTML = PIN_SVG;
  pinBtn.addEventListener('click', e => { e.stopPropagation(); togglePin(wrapper); });

  const colorBtn = document.createElement('button');
  colorBtn.className = 'list-color-btn';
  colorBtn.setAttribute('aria-label', '色を設定');
  colorBtn.setAttribute('type', 'button');
  colorBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (activeColorPopup) { closeColorPicker(); }
    else { openColorPicker(colorBtn, wrapper); }
  });

  header.appendChild(listSelCheck);
  header.appendChild(dragHandle);
  header.appendChild(toggleIcon);
  header.appendChild(titleSpan);
  header.appendChild(countBadge);
  header.appendChild(colorBtn);
  header.appendChild(pinBtn);
  header.appendChild(delBtn);

  // body
  const body = document.createElement('div');
  body.className = 'list-body';

  const subList = document.createElement('div');
  subList.className = 'sub-task-list';

  const footerBtn = document.createElement('button');
  footerBtn.className = 'list-add-footer-btn';
  footerBtn.textContent = '＋ タスクを追加';
  footerBtn.addEventListener('click', () => showInlineForm(null, subList));

  body.appendChild(subList);
  body.appendChild(footerBtn);
  wrapper.appendChild(header);
  wrapper.appendChild(body);

  wrapper._countBadge = countBadge;
  wrapper._subList    = subList;

  initDrag(wrapper, dragHandle);
  initDropZone(subList);
  return wrapper;
}

// ── Delete confirmation ───────────────────────────────────
function confirmDelete(container, label, onConfirm) {
  document.querySelectorAll('.confirm-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const msg = document.createElement('span');
  msg.className = 'confirm-msg';
  msg.textContent = `${label}を削除しますか？`;

  const yesBtn = document.createElement('button');
  yesBtn.className = 'confirm-yes-btn';
  yesBtn.textContent = '削除';
  yesBtn.addEventListener('click', e => { e.stopPropagation(); onConfirm(); });

  const noBtn = document.createElement('button');
  noBtn.className = 'confirm-no-btn';
  noBtn.textContent = 'キャンセル';
  noBtn.addEventListener('click', e => { e.stopPropagation(); overlay.remove(); });

  overlay.appendChild(msg);
  overlay.appendChild(yesBtn);
  overlay.appendChild(noBtn);
  container.appendChild(overlay);
}

// ── Due date ─────────────────────────────────────────────
function updateDueBadge(badge, dueDate, dueTime) {
  if (!dueDate) { badge.style.display = 'none'; return; }
  const due   = new Date(dueDate + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((due - today) / 86400000);
  const datePart = `${due.getMonth() + 1}月${due.getDate()}日`;
  const timePart = dueTime ? ` ${dueTime}` : '';
  badge.style.display = 'inline-flex';
  badge.dataset.status = diff < 0 ? 'overdue' : diff === 0 ? 'today' : diff <= 3 ? 'soon' : 'future';
  badge.textContent = datePart + timePart + (diff < 0 ? ' 期限切れ' : diff === 0 ? ' 今日まで' : '');
}

// ── Custom date picker ────────────────────────────────────
let activePickerPopup = null;

function closeInlineForms(target) {
  document.querySelectorAll('.inline-add-form').forEach(form => {
    if (!form.contains(target) && !target.closest('.list-add-footer-btn')) {
      form.remove();
    }
  });
}

function shouldCloseColorPicker(target) {
  return activeColorPopup
    && !activeColorPopup.contains(target)
    && !target.closest('.list-color-btn');
}

document.addEventListener('mousedown', e => {
  if (activePickerPopup && !activePickerPopup.contains(e.target)) closeDatePicker();
  if (shouldCloseColorPicker(e.target)) closeColorPicker();
  closeInlineForms(e.target);
});

document.addEventListener('touchstart', e => {
  if (shouldCloseColorPicker(e.target)) closeColorPicker();
  closeInlineForms(e.target);
}, { passive: true });

function closeDatePicker() {
  if (activePickerPopup) { activePickerPopup.remove(); activePickerPopup = null; }
}

function openDatePicker(anchor, item, text, badge) {
  closeDatePicker();

  const curDate = item.dataset.due || null;
  const curTime = item.dataset.dueTime || '';
  let viewYear  = curDate ? +curDate.slice(0, 4) : new Date().getFullYear();
  let viewMonth = curDate ? +curDate.slice(5, 7) - 1 : new Date().getMonth();
  let selDate   = curDate;

  const popup = document.createElement('div');
  popup.className = 'dp-popup';

  // ── header ──
  const hdr = document.createElement('div'); hdr.className = 'dp-header';
  const prevBtn = document.createElement('button'); prevBtn.className = 'dp-nav'; prevBtn.textContent = '‹';
  const monthLbl = document.createElement('span'); monthLbl.className = 'dp-month-lbl';
  const nextBtn = document.createElement('button'); nextBtn.className = 'dp-nav'; nextBtn.textContent = '›';
  hdr.append(prevBtn, monthLbl, nextBtn);

  // ── grid ──
  const grid = document.createElement('div'); grid.className = 'dp-grid';

  // ── time ──
  const timeRow = document.createElement('div'); timeRow.className = 'dp-time-row';
  const timeLbl = document.createElement('span'); timeLbl.className = 'dp-time-lbl'; timeLbl.textContent = '時間';
  const timeInput = document.createElement('input'); timeInput.type = 'time'; timeInput.className = 'dp-time-input'; timeInput.value = curTime;
  timeRow.append(timeLbl, timeInput);

  // ── actions ──
  const acts = document.createElement('div'); acts.className = 'dp-actions';
  const clearBtn = document.createElement('button'); clearBtn.className = 'dp-clear'; clearBtn.textContent = 'クリア';
  const setBtn   = document.createElement('button'); setBtn.className   = 'dp-set';   setBtn.textContent   = '設定';
  acts.append(clearBtn, setBtn);

  popup.append(hdr, grid, timeRow, acts);

  const DAY_NAMES = ['日','月','火','水','木','金','土'];

  function renderGrid() {
    grid.innerHTML = '';
    monthLbl.textContent = `${viewYear}年${viewMonth + 1}月`;
    DAY_NAMES.forEach((n, i) => {
      const c = document.createElement('div'); c.className = 'dp-day-name';
      c.textContent = n;
      if (i === 0) c.style.color = '#e74c3c';
      if (i === 6) c.style.color = '#2196f3';
      grid.appendChild(c);
    });
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const days     = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayObj = new Date();
    for (let i = 0; i < firstDow; i++) grid.appendChild(document.createElement('div'));
    for (let d = 1; d <= days; d++) {
      const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow = (firstDow + d - 1) % 7;
      const cell = document.createElement('div'); cell.className = 'dp-day';
      cell.textContent = d;
      if (dow === 0) cell.classList.add('dp-sun');
      if (dow === 6) cell.classList.add('dp-sat');
      if (todayObj.getFullYear()===viewYear && todayObj.getMonth()===viewMonth && todayObj.getDate()===d) cell.classList.add('dp-today');
      if (selDate === dateStr) cell.classList.add('dp-sel');
      cell.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); selDate = dateStr; renderGrid(); });
      grid.appendChild(cell);
    }
  }

  prevBtn.addEventListener('mousedown', e => { e.preventDefault(); if (--viewMonth < 0){ viewMonth=11; viewYear--; } renderGrid(); });
  nextBtn.addEventListener('mousedown', e => { e.preventDefault(); if (++viewMonth > 11){ viewMonth=0; viewYear++; } renderGrid(); });

  clearBtn.addEventListener('mousedown', e => {
    e.preventDefault();
    item.dataset.due = ''; item.dataset.dueTime = '';
    updateDueBadge(badge, null, null);
    logEvent('delete', `タスク「${text}」の期限を削除`);
    saveState(); closeDatePicker();
  });

  setBtn.addEventListener('mousedown', e => {
    e.preventDefault();
    if (!selDate) { closeDatePicker(); return; }
    const t = timeInput.value || '';
    item.dataset.due = selDate; item.dataset.dueTime = t;
    updateDueBadge(badge, selDate, t);
    const d = new Date(selDate + 'T00:00:00');
    const dl = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    logEvent('add', `タスク「${text}」に期限 ${dl}${t ? ' ' + t : ''} を設定`);
    saveState(); closeDatePicker();
  });

  renderGrid();
  popup.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;';
  document.body.appendChild(popup);
  activePickerPopup = popup;

  const r = anchor.getBoundingClientRect();
  const pw = popup.offsetWidth || 232;
  const ph = popup.offsetHeight || 310;
  // カレンダーの右上端をボタンの左下に合わせる
  let left = r.left - pw;
  let top  = r.bottom;
  // 下にはみ出す場合はボタンの上に表示
  if (top + ph > window.innerHeight - 8) top = r.top - ph;
  if (top < 8) top = 8;
  if (left < 4) left = 4;
  if (left + pw > window.innerWidth - 4) left = window.innerWidth - pw - 4;
  popup.style.cssText = `position:fixed;top:${top}px;left:${left}px;`;
}

// ── Pin ───────────────────────────────────────────────────
function togglePin(item) {
  const container = item.parentElement;
  item.classList.toggle('pinned');

  const lastPinned = [...container.children]
    .filter(el => el !== item && el.classList.contains('pinned'))
    .at(-1);
  if (lastPinned) container.insertBefore(item, lastPinned.nextSibling);
  else container.prepend(item);

  saveState();
}

function insertAfterPinned(container, el) {
  const lastPinned = [...container.children]
    .filter(c => c.classList.contains('pinned'))
    .at(-1);
  if (lastPinned) container.insertBefore(el, lastPinned.nextSibling);
  else container.prepend(el);
}

// ── List color picker ─────────────────────────────────────
const BASE_COLORS = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#74c0fc','#b197fc'];
let activeColorPopup = null;
let colorTargetEl    = null;  // 現在編集中のリスト要素

function closeColorPicker() {
  if (activeColorPopup) { activeColorPopup.remove(); activeColorPopup = null; colorTargetEl = null; }
}

function openColorPicker(anchor, listEl) {
  const popup = document.createElement('div');
  popup.className = 'color-popup';

  // 6色スウォッチ
  const grid = document.createElement('div');
  grid.className = 'color-swatch-grid';
  BASE_COLORS.forEach(color => {
    const sw = document.createElement('button');
    sw.setAttribute('type', 'button');
    sw.className = 'color-swatch' + (listEl.dataset.color === color ? ' selected' : '');
    sw.style.background = color;
    sw.addEventListener('click', e => {
      e.stopPropagation();
      applyListColor(listEl, color);
      popup.querySelectorAll('.color-swatch').forEach((s, i) => s.classList.toggle('selected', BASE_COLORS[i] === color));
      saveState();
    });
    grid.appendChild(sw);
  });

  // カスタムカラー
  const customRow = document.createElement('div');
  customRow.className = 'color-custom-row';
  const customLabel = document.createElement('span');
  customLabel.className = 'color-custom-label';
  customLabel.textContent = 'カスタム';
  const customInput = document.createElement('input');
  customInput.type = 'color';
  customInput.className = 'color-custom-input';
  customInput.value = listEl.dataset.color || '#6c63ff';
  customInput.addEventListener('input', e => {
    e.stopPropagation();
    applyListColor(listEl, customInput.value);
    popup.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    saveState();
  });
  customRow.append(customLabel, customInput);

  // クリア
  const clearBtn = document.createElement('button');
  clearBtn.setAttribute('type', 'button');
  clearBtn.className = 'color-clear-btn';
  clearBtn.textContent = 'クリア';
  clearBtn.addEventListener('click', e => {
    e.stopPropagation();
    applyListColor(listEl, null);
    closeColorPicker();
    saveState();
  });

  popup.append(grid, customRow, clearBtn);
  document.body.appendChild(popup);
  activeColorPopup = popup;
  colorTargetEl    = listEl;

  // 位置計算
  const r  = anchor.getBoundingClientRect();
  const pw = popup.offsetWidth  || 188;
  const ph = popup.offsetHeight || 130;
  let left = r.right - pw;
  let top  = r.bottom + 4;
  if (top + ph > window.innerHeight - 8) top = r.top - ph - 4;
  if (left < 4) left = 4;
  if (left + pw > window.innerWidth - 4) left = window.innerWidth - pw - 4;
  popup.style.left = `${left}px`;
  popup.style.top  = `${top}px`;
}

function applyListColor(listEl, color) {
  const btn = listEl.querySelector('.list-color-btn');
  if (color) {
    listEl.dataset.color = color;
    if (btn) btn.style.background = color;
  } else {
    delete listEl.dataset.color;
    if (btn) btn.style.background = '';
  }
}

// ── List title edit ───────────────────────────────────────
function startListTitleEdit(titleSpan, wrapper) {
  const original = titleSpan.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'list-title-edit-input';
  input.value = original;

  const save = () => {
    const newText = input.value.trim() || original;
    titleSpan.textContent = newText;
    input.replaceWith(titleSpan);
    if (newText !== original) {
      logEvent('edit', `リスト「${original}」を「${newText}」に変更`);
      saveState();
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = original; input.blur(); }
  });
  input.addEventListener('click', e => e.stopPropagation());

  titleSpan.replaceWith(input);
  input.focus();
  input.select();
}

// ── Helpers ──────────────────────────────────────────────
function getParentListWrapper(el) {
  return el.closest('.list-item') || null;
}

function updateListCount(listWrapper) {
  const subList = listWrapper._subList || listWrapper.querySelector('.sub-task-list');
  const tasks   = subList.querySelectorAll('.task-item');
  const done    = subList.querySelectorAll('.task-item.done');
  listWrapper._countBadge.textContent = tasks.length > 0
    ? `${done.length}/${tasks.length}`
    : '0';
}

function updateEmpty() {
  emptyMsg.style.display = itemList.children.length === 0 ? 'block' : 'none';
}

// ── Drag & Drop ───────────────────────────────────────────
let dragSrc    = null;
let fromHandle = false;
const dropLine = document.createElement('div');
dropLine.className = 'drop-line';

// ── オートスクロール（タッチドラッグ時） ──────────────────
let autoScrollRAF  = null;
let lastTouchClientY = 0;
const SCROLL_ZONE  = 80;   // 画面端からのpx
const SCROLL_SPEED = 12;   // 最大スクロール量(px/frame)

function runAutoScroll() {
  const vh = window.innerHeight;
  if (lastTouchClientY < SCROLL_ZONE) {
    const r = 1 - lastTouchClientY / SCROLL_ZONE;
    window.scrollBy(0, -Math.round(SCROLL_SPEED * r));
  } else if (lastTouchClientY > vh - SCROLL_ZONE) {
    const r = 1 - (vh - lastTouchClientY) / SCROLL_ZONE;
    window.scrollBy(0, Math.round(SCROLL_SPEED * r));
  }
  autoScrollRAF = requestAnimationFrame(runAutoScroll);
}
function startAutoScroll() {
  if (!autoScrollRAF) autoScrollRAF = requestAnimationFrame(runAutoScroll);
}
function stopAutoScroll() {
  if (autoScrollRAF) { cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
}

document.addEventListener('mouseup', () => { fromHandle = false; });

function initDrag(item, handle) {
  handle.addEventListener('mousedown', () => { fromHandle = true; });

  item.draggable = true;

  item.addEventListener('dragstart', e => {
    if (!fromHandle) { e.preventDefault(); return; }
    dragSrc = item;
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
    setTimeout(() => item.classList.add('dragging'), 0);
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    if (dropLine.parentElement) dropLine.remove();
    dragSrc    = null;
    fromHandle = false;
  });

  // ── タッチ対応 ──────────────────────────────────────────
  let touchActive = false;
  let touchClone  = null;
  let touchOffX, touchOffY;

  handle.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect  = item.getBoundingClientRect();
    touchOffX = touch.clientX - rect.left;
    touchOffY = touch.clientY - rect.top;

    fromHandle = true;
    dragSrc    = item;
    touchActive = true;

    touchClone = item.cloneNode(true);
    touchClone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;`
      + `width:${rect.width}px;opacity:0.85;pointer-events:none;z-index:1000;`
      + `box-shadow:0 8px 24px rgba(0,0,0,0.18);border-radius:8px;`;
    document.body.appendChild(touchClone);
    setTimeout(() => item.classList.add('dragging'), 0);
  }, { passive: false });

  handle.addEventListener('touchmove', e => {
    if (!touchActive) return;
    e.preventDefault();
    const touch = e.touches[0];

    lastTouchClientY = touch.clientY;
    startAutoScroll();

    touchClone.style.left = `${touch.clientX - touchOffX}px`;
    touchClone.style.top  = `${touch.clientY - touchOffY}px`;

    touchClone.style.visibility = 'hidden';
    const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.style.visibility = '';
    if (!elBelow) return;

    const container = elBelow.closest('.sub-task-list') || elBelow.closest('#itemList');
    if (!container) { if (dropLine.parentElement) dropLine.remove(); return; }
    if (dragSrc.classList.contains('list-item') && container !== itemList) {
      if (dropLine.parentElement) dropLine.remove(); return;
    }

    const filter = groupFilter(dragSrc);
    const after  = getAfterEl(container, touch.clientY, filter);
    if (after) {
      container.insertBefore(dropLine, after);
    } else {
      const mark = groupEndMark(container, dragSrc);
      if (mark) container.insertBefore(dropLine, mark);
      else container.appendChild(dropLine);
    }
  }, { passive: false });

  handle.addEventListener('touchend', () => {
    if (!touchActive) return;
    touchActive = false;
    stopAutoScroll();
    if (touchClone) { touchClone.remove(); touchClone = null; }
    item.classList.remove('dragging');

    if (dropLine.parentElement) {
      const container    = dropLine.parentElement;
      const oldContainer = dragSrc.parentElement;
      container.insertBefore(dragSrc, dropLine);
      dropLine.remove();

      const isSubList  = container.classList.contains('sub-task-list');
      const wasSubList = oldContainer?.classList.contains('sub-task-list');
      const taskName   = dragSrc.querySelector('.task-text')?.textContent
                       || dragSrc.querySelector('.list-title')?.textContent;

      if (wasSubList) { const ow = oldContainer.closest('.list-item'); if (ow) updateListCount(ow); }
      if (isSubList)  { const nw = container.closest('.list-item');    if (nw) updateListCount(nw); }

      if (wasSubList && !isSubList) {
        const oldListName = oldContainer.closest('.list-item')?.querySelector('.list-title')?.textContent;
        logEvent('move', `タスク「${taskName}」をリスト「${oldListName}」から外に移動`);
      } else if (!wasSubList && isSubList) {
        const listName = container.closest('.list-item')?.querySelector('.list-title')?.textContent;
        logEvent('move', `タスク「${taskName}」をリスト「${listName}」に移動`);
      } else {
        logEvent('move', `「${taskName}」を並び替え`);
      }
      updateEmpty();
      saveState();
    } else {
      if (dropLine.parentElement) dropLine.remove();
    }
    dragSrc    = null;
    fromHandle = false;
  });

  handle.addEventListener('touchcancel', () => {
    if (!touchActive) return;
    touchActive = false;
    stopAutoScroll();
    if (touchClone) { touchClone.remove(); touchClone = null; }
    item.classList.remove('dragging');
    if (dropLine.parentElement) dropLine.remove();
    dragSrc    = null;
    fromHandle = false;
  });
}

function initDropZone(container) {
  container.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragSrc) return;
    if (dragSrc.classList.contains('list-item') && container !== itemList) return;
    e.stopPropagation();

    const filter = groupFilter(dragSrc);
    const after  = getAfterEl(container, e.clientY, filter);
    if (after) {
      container.insertBefore(dropLine, after);
    } else {
      const mark = groupEndMark(container, dragSrc);
      if (mark) container.insertBefore(dropLine, mark);
      else container.appendChild(dropLine);
    }
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrc) return;
    if (dragSrc.classList.contains('list-item') && container !== itemList) return;
    if (dropLine.parentElement !== container) return;
    e.stopPropagation();

    const oldContainer = dragSrc.parentElement;
    container.insertBefore(dragSrc, dropLine);
    dropLine.remove();

    const isSubList    = container.classList.contains('sub-task-list');
    const wasSubList   = oldContainer?.classList.contains('sub-task-list');
    const taskName     = dragSrc.querySelector('.task-text')?.textContent
                       || dragSrc.querySelector('.list-title')?.textContent;

    if (wasSubList) {
      const oldWrapper = oldContainer.closest('.list-item');
      if (oldWrapper) updateListCount(oldWrapper);
    }
    if (isSubList) {
      const newWrapper = container.closest('.list-item');
      if (newWrapper) updateListCount(newWrapper);
    }

    if (wasSubList && !isSubList) {
      const oldListName = oldContainer.closest('.list-item')?.querySelector('.list-title')?.textContent;
      logEvent('move', `タスク「${taskName}」をリスト「${oldListName}」から外に移動`);
    } else if (!wasSubList && isSubList) {
      const listName = container.closest('.list-item')?.querySelector('.list-title')?.textContent;
      logEvent('move', `タスク「${taskName}」をリスト「${listName}」に移動`);
    } else {
      logEvent('move', `「${taskName}」を並び替え`);
    }

    updateEmpty();
    saveState();
  });

  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget) && dropLine.parentElement === container) {
      dropLine.remove();
    }
  });
}

function groupFilter(src) {
  if (src.classList.contains('pinned'))
    return el => el.classList.contains('pinned');
  const isDone = src.classList.contains('done');
  return el => !el.classList.contains('pinned') && el.classList.contains('done') === isDone;
}

function groupEndMark(container, src) {
  if (src.classList.contains('pinned')) {
    return [...container.children].find(
      el => el !== dropLine && el.draggable && !el.classList.contains('pinned') && !el.classList.contains('dragging')
    ) ?? null;
  }
  if (!src.classList.contains('done')) {
    return [...container.children].find(
      el => el !== dropLine && el.draggable &&
            !el.classList.contains('pinned') && el.classList.contains('done') &&
            !el.classList.contains('dragging')
    ) ?? null;
  }
  return null;
}

function getAfterEl(container, y, filterFn) {
  const items = [...container.children].filter(el => {
    if (!el.draggable || el.classList.contains('dragging')) return false;
    return !filterFn || filterFn(el);
  });
  return items.reduce((closest, child) => {
    const box    = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, el: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).el;
}

// ── History ───────────────────────────────────────────────
const historyEntries = [];
const historyPanel   = document.getElementById('historyPanel');
const historyList    = document.getElementById('historyList');
const historyEmptyMsg = document.getElementById('historyEmptyMsg');

document.getElementById('historyBtn').addEventListener('click', () => {
  historyPanel.hidden = false;
});
document.getElementById('historyCloseBtn').addEventListener('click', () => {
  historyPanel.hidden = true;
});
document.getElementById('historyClearBtn').addEventListener('click', () => {
  historyEntries.length = 0;
  localStorage.removeItem('todoHistory');
  renderHistory();
});

function logEvent(type, message) {
  const now  = new Date();
  const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  historyEntries.unshift({ type, message, time });
  if (historyEntries.length > 50) historyEntries.length = 50;
  renderHistory();
  localStorage.setItem('todoHistory', JSON.stringify(historyEntries));
}

function renderHistory() {
  historyList.innerHTML = '';
  if (historyEntries.length === 0) {
    historyEmptyMsg.style.display = 'block';
    return;
  }
  historyEmptyMsg.style.display = 'none';
  historyEntries.forEach(({ type, message, time }) => {
    const entry = document.createElement('div');
    entry.className = `history-entry ${type}`;

    const timeEl = document.createElement('span');
    timeEl.className = 'history-time';
    timeEl.textContent = time;

    const textEl = document.createElement('span');
    textEl.className = 'history-text';
    textEl.textContent = message;

    entry.appendChild(timeEl);
    entry.appendChild(textEl);
    historyList.appendChild(entry);
  });
}

// ── Persistence ──────────────────────────────────────────
function getState() {
  const items = [];
  for (const el of itemList.children) {
    if (el.classList.contains('task-item')) {
      items.push({
        type: 'task',
        text: el.querySelector('.task-text').textContent,
        done: el.classList.contains('done'),
        pinned: el.classList.contains('pinned'),
        createdAt: el.dataset.created,
        dueDate: el.dataset.due || null,
        dueTime: el.dataset.dueTime || null
      });
    } else if (el.classList.contains('list-item')) {
      const subList = el.querySelector('.sub-task-list');
      const tasks = [...subList.querySelectorAll(':scope > .task-item')].map(t => ({
        text: t.querySelector('.task-text').textContent,
        done: t.classList.contains('done'),
        pinned: t.classList.contains('pinned'),
        createdAt: t.dataset.created,
        dueDate: t.dataset.due || null,
        dueTime: t.dataset.dueTime || null
      }));
      items.push({
        type: 'list',
        title: el.querySelector('.list-title').textContent,
        collapsed: el.classList.contains('collapsed'),
        pinned: el.classList.contains('pinned'),
        color: el.dataset.color || null,
        tasks
      });
    }
  }
  return items;
}

function saveState() {
  localStorage.setItem('todoState', JSON.stringify(getState()));
}

function loadState() {
  const raw = localStorage.getItem('todoState');
  if (!raw) return;
  try {
    const items = JSON.parse(raw);
    for (const item of items) {
      if (item.type === 'task') {
        const el = createTaskItem(item.text, item.createdAt, item.dueDate, item.dueTime);
        if (item.done)   el.classList.add('done');
        if (item.pinned) el.classList.add('pinned');
        itemList.appendChild(el);
      } else if (item.type === 'list') {
        const el = createListItem(item.title);
        if (item.collapsed) el.classList.add('collapsed');
        if (item.pinned)    el.classList.add('pinned');
        if (item.color) applyListColor(el, item.color);
        for (const task of item.tasks) {
          const taskEl = createTaskItem(task.text, task.createdAt, task.dueDate, task.dueTime);
          if (task.done)   taskEl.classList.add('done');
          if (task.pinned) taskEl.classList.add('pinned');
          el._subList.appendChild(taskEl);
        }
        updateListCount(el);
        itemList.appendChild(el);
      }
    }
  } catch (e) {
    console.warn('状態の復元に失敗しました', e);
  }
  updateEmpty();
}

// ── Bulk select ──────────────────────────────────────────
const mainContainer   = document.querySelector('.container');
const selectBar       = document.getElementById('selectBar');
const selBarMain      = document.getElementById('selBarMain');
const selBarConfirm   = document.getElementById('selBarConfirm');
const selCount        = document.getElementById('selCount');
const selDeleteBtn    = document.getElementById('selDeleteBtn');
const selConfirmMsg   = document.getElementById('selConfirmMsg');

function enterSelectMode() {
  selectMode = true;
  mainContainer.classList.add('select-mode');
  historyPanel.hidden = true;
  closeDatePicker();
  selectBar.hidden = false;
  selBarMain.hidden = false;
  selBarConfirm.hidden = true;
  updateSelectBar();
}

function exitSelectMode() {
  selectMode = false;
  mainContainer.classList.remove('select-mode');
  document.querySelectorAll('.task-item.selected, .list-item.selected')
    .forEach(el => el.classList.remove('selected'));
  selectBar.hidden = true;
}

function updateSelectBar() {
  const n = document.querySelectorAll('.task-item.selected, .list-item.selected').length;
  selCount.textContent = `${n}件選択中`;
  selDeleteBtn.disabled = n === 0;
}

function execDeleteSelected() {
  const selected = [...document.querySelectorAll('.task-item.selected, .list-item.selected')];
  const affectedLists = new Set();

  for (const el of selected) {
    if (el.classList.contains('task-item')) {
      const wrapper = getParentListWrapper(el);
      if (wrapper?.classList.contains('selected')) continue;
      const text = el.querySelector('.task-text').textContent;
      if (wrapper) {
        logEvent('delete', `リスト「${wrapper.querySelector('.list-title').textContent}」内のタスク「${text}」を削除`);
        el.remove();
        affectedLists.add(wrapper);
      } else {
        logEvent('delete', `タスク「${text}」を削除`);
        el.remove();
      }
    } else if (el.classList.contains('list-item')) {
      logEvent('delete', `リスト「${el.querySelector('.list-title').textContent}」を削除`);
      el.remove();
    }
  }

  affectedLists.forEach(w => { if (w.isConnected) updateListCount(w); });
  updateEmpty();
  saveState();
  exitSelectMode();
}

document.getElementById('selectModeBtn').addEventListener('click', () => {
  if (selectMode) exitSelectMode();
  else enterSelectMode();
});

document.getElementById('selAllBtn').addEventListener('click', () => {
  const topItems = [...itemList.children].filter(
    el => el.classList.contains('task-item') || el.classList.contains('list-item')
  );
  const allSelected = topItems.length > 0 && topItems.every(el => el.classList.contains('selected'));
  topItems.forEach(el => el.classList.toggle('selected', !allSelected));
  updateSelectBar();
});

document.getElementById('selCancelBtn').addEventListener('click', exitSelectMode);

let pendingConfirmAction = null;

function showConfirm(message, action) {
  pendingConfirmAction = action;
  selConfirmMsg.textContent = message;
  selBarMain.hidden = true;
  selBarConfirm.hidden = false;
}

selDeleteBtn.addEventListener('click', () => {
  const n = document.querySelectorAll('.task-item.selected, .list-item.selected').length;
  showConfirm(`${n}件を削除しますか？`, execDeleteSelected);
});

document.getElementById('selConfirmYesBtn').addEventListener('click', () => {
  if (pendingConfirmAction) { pendingConfirmAction(); pendingConfirmAction = null; }
});

document.getElementById('selDeleteDoneBtn').addEventListener('click', () => {
  const doneItems = [...document.querySelectorAll('.task-item.done')];
  if (doneItems.length === 0) return;
  showConfirm(`完了済み${doneItems.length}件を削除しますか？`, () => {
    const affectedLists = new Set();
    doneItems.forEach(el => {
      const wrapper = getParentListWrapper(el);
      const text = el.querySelector('.task-text').textContent;
      if (wrapper) {
        logEvent('delete', `リスト「${wrapper.querySelector('.list-title').textContent}」内のタスク「${text}」を削除`);
        el.remove();
        affectedLists.add(wrapper);
      } else {
        logEvent('delete', `タスク「${text}」を削除`);
        el.remove();
      }
    });
    affectedLists.forEach(w => { if (w.isConnected) updateListCount(w); });
    updateEmpty();
    saveState();
    exitSelectMode();
  });
});

document.getElementById('selConfirmNoBtn').addEventListener('click', () => {
  pendingConfirmAction = null;
  selBarMain.hidden = false;
  selBarConfirm.hidden = true;
});

// ── Calendar Mode ────────────────────────────────────────
let calViewYear   = new Date().getFullYear();
let calViewMonth  = new Date().getMonth();
let calWeekMode   = false;   // true = 週表示
let calWeekStart  = null;    // 週表示の起点日（Dateオブジェクト）

const calendarView  = document.getElementById('calendarView');
const calMonthLabel = document.getElementById('calMonthLabel');
const calGrid       = document.getElementById('calGrid');
const calDayDetail  = document.getElementById('calDayDetail');
const calDetailDate = document.getElementById('calDetailDate');
const calDetailList = document.getElementById('calDetailList');
const calModeBtn    = document.getElementById('calendarModeBtn');

calModeBtn.addEventListener('click', () => {
  const active = calendarView.hidden;
  if (active) enterCalendarMode();
  else exitCalendarMode();
});

document.getElementById('calPrevBtn').addEventListener('click', () => {
  if (calWeekMode) {
    calWeekStart = new Date(calWeekStart);
    calWeekStart.setDate(calWeekStart.getDate() - 7);
  } else {
    if (--calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
  }
  renderCalendar();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
  if (calWeekMode) {
    calWeekStart = new Date(calWeekStart);
    calWeekStart.setDate(calWeekStart.getDate() + 7);
  } else {
    if (++calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
  }
  renderCalendar();
});
document.getElementById('calViewToggleBtn').addEventListener('click', () => {
  calWeekMode = !calWeekMode;
  const btn = document.getElementById('calViewToggleBtn');
  if (calWeekMode) {
    // 今週の日曜日を起点に
    const today = new Date();
    calWeekStart = new Date(today);
    calWeekStart.setDate(today.getDate() - today.getDay());
    btn.textContent = '月';
    btn.classList.add('active');
    document.querySelector('.cal-weekdays').hidden = false;
  } else {
    btn.textContent = '週';
    btn.classList.remove('active');
  }
  renderCalendar();
});
document.getElementById('calDetailCloseBtn').addEventListener('click', () => {
  calDayDetail.hidden = true;
});

function enterCalendarMode() {
  calViewYear  = new Date().getFullYear();
  calViewMonth = new Date().getMonth();
  calWeekMode  = false;
  document.getElementById('calViewToggleBtn').textContent = '週';
  document.getElementById('calViewToggleBtn').classList.remove('active');
  calModeBtn.classList.add('active');
  mainContainer.classList.add('cal-mode');
  // セレクトモードが有効なら解除
  if (selectMode) exitSelectMode();
  closeDatePicker();
  calendarView.hidden = false;
  calDayDetail.hidden = true;
  renderCalendar();
}

function exitCalendarMode() {
  calModeBtn.classList.remove('active');
  mainContainer.classList.remove('cal-mode');
  calendarView.hidden = true;
  updateEmpty();
}

// ── カレンダーのみタスク ──────────────────────────────────
let calOnlyTasks = [];

function saveCalOnlyTasks() {
  localStorage.setItem('calOnlyTasks', JSON.stringify(calOnlyTasks));
}
function loadCalOnlyTasks() {
  try {
    const raw = localStorage.getItem('calOnlyTasks');
    if (raw) calOnlyTasks = JSON.parse(raw);
  } catch(e) {}
}

function getAllDueTasks() {
  const tasks = [];
  document.querySelectorAll('#itemList .task-item').forEach(el => {
    if (el.dataset.due) {
      const listEl = el.closest('.list-item');
      tasks.push({
        text: el.querySelector('.task-text').textContent,
        due: el.dataset.due,
        dueTime: el.dataset.dueTime || '',
        done: el.classList.contains('done'),
        calOnly: false,
        color: listEl?.dataset.color || null,
        domEl: el   // 削除用にDOM参照を保持
      });
    }
  });
  // カレンダーのみタスクを追加
  calOnlyTasks.forEach((t, i) => tasks.push({ ...t, calOnly: true, calOnlyIndex: i }));
  return tasks;
}

// 日付ごとのカスタム順序 { 'YYYY-MM-DD': ['key1', 'key2', ...] }
const taskOrderByDate = {};

function taskKey(t) {
  return `${t.calOnly ? 'c' : 'r'}|${t.text}|${t.dueTime}`;
}

function applyTaskOrder(date, tasks) {
  const order = taskOrderByDate[date];
  if (!order) return tasks;
  return [...tasks].sort((a, b) => {
    const ai = order.indexOf(taskKey(a));
    const bi = order.indexOf(taskKey(b));
    if (ai === -1 && bi === -1) return 0;
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function renderCalendar() {
  const today = new Date();
  calGrid.innerHTML = '';
  calDayDetail.hidden = true;

  // 期限付きタスクを日付別に整理（カスタム順序を適用）
  const tasksByDate = {};
  getAllDueTasks().forEach(task => {
    tasksByDate[task.due] = tasksByDate[task.due] || [];
    tasksByDate[task.due].push(task);
  });
  Object.keys(tasksByDate).forEach(date => {
    tasksByDate[date] = applyTaskOrder(date, tasksByDate[date]);
  });

  calGrid.classList.toggle('cal-grid--week', calWeekMode);
  if (calWeekMode) {
    renderWeekCalendar(today, tasksByDate);
  } else {
    renderMonthCalendar(today, tasksByDate);
  }
}

function renderMonthCalendar(today, tasksByDate) {
  calMonthLabel.textContent = `${calViewYear}年${calViewMonth + 1}月`;
  document.querySelector('.cal-weekdays').hidden = false;

  const firstDow    = new Date(calViewYear, calViewMonth, 1).getDay();
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell cal-cell--empty';
    calGrid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow     = (firstDow + d - 1) % 7;
    const isToday = calViewYear === today.getFullYear()
                 && calViewMonth === today.getMonth()
                 && d === today.getDate();
    calGrid.appendChild(buildCell(d, dateStr, dow, isToday, tasksByDate[dateStr] || [], 2));
  }
}

function renderWeekCalendar(today, tasksByDate) {
  const ws = new Date(calWeekStart);
  const we = new Date(ws); we.setDate(ws.getDate() + 6);
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  calMonthLabel.textContent = `${ws.getFullYear()}年 ${fmt(ws)}〜${fmt(we)}`;
  document.querySelector('.cal-weekdays').hidden = false;

  // 週表示は縦長セル（7列1行）
  calGrid.classList.add('cal-grid--week');
  for (let i = 0; i < 7; i++) {
    const cur = new Date(ws); cur.setDate(ws.getDate() + i);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const dow     = cur.getDay();
    const isToday = dateStr === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    calGrid.appendChild(buildCell(cur.getDate(), dateStr, dow, isToday, tasksByDate[dateStr] || [], 5));
  }
}

function buildCell(d, dateStr, dow, isToday, tasks, maxShow) {
  const cell = document.createElement('div');
  cell.className = 'cal-cell';

  const numEl = document.createElement('span');
  numEl.className = 'cal-date-num'
    + (dow === 0 ? ' cal-sun' : dow === 6 ? ' cal-sat' : '')
    + (isToday ? ' cal-today' : '');
  numEl.textContent = d;
  cell.appendChild(numEl);

  tasks.slice(0, maxShow).forEach(task => {
    const chip = document.createElement('div');
    chip.className = 'cal-task-chip' + (task.done ? ' cal-task-chip--done' : '');
    if (!task.done && task.color) chip.style.background = task.color;
    chip.textContent = task.text;
    cell.appendChild(chip);
  });
  if (tasks.length > maxShow) {
    const more = document.createElement('div');
    more.className = 'cal-task-more';
    more.textContent = `他${tasks.length - maxShow}件`;
    cell.appendChild(more);
  }
  if (tasks.length > 0) cell.classList.add('cal-cell--has-tasks');
  cell.classList.add('cal-cell--clickable');
  cell.addEventListener('click', () => showDayDetail(d, dateStr, tasks));
  return cell;
}

let currentDetailDate = null;
let currentDetailDay  = null;

function showDayDetail(day, dateStr, tasks) {
  currentDetailDate = dateStr;
  currentDetailDay  = day;
  calDetailDate.textContent = `${calViewYear}年${calViewMonth + 1}月${day}日`;
  document.getElementById('calAddForm').hidden = true;
  document.getElementById('calDetailAddBtn').classList.remove('active');
  renderDetailList(sortDetailTasks(tasks));
  calDayDetail.hidden = false;
}

function renderDetailList(tasks) {
  calDetailList.innerHTML = '';
  if (tasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cal-detail-empty';
    empty.textContent = 'タスクはありません';
    calDetailList.appendChild(empty);
    return;
  }

  let detailDragSrcIdx = null;
  let touchDragClone   = null;
  let touchDragOffY    = 0;

  tasks.forEach((task, i) => {
    const item = document.createElement('div');
    item.className = 'cal-detail-item'
      + (task.done    ? ' cal-detail-item--done'     : '')
      + (task.calOnly ? ' cal-detail-item--cal-only' : '');
    item.dataset.detailIndex = i;

    // グリップ
    const grip = document.createElement('span');
    grip.className = 'cal-detail-grip';
    grip.innerHTML = GRIP_SVG;

    // サークル
    const circle = document.createElement('span');
    circle.className = 'cal-detail-circle';
    if (!task.done && task.color) circle.style.background = task.color;

    // テキスト（ダブルクリック/ダブルタップでリネーム）
    const textEl = document.createElement('span');
    textEl.className = 'cal-detail-text';
    textEl.textContent = task.text;
    textEl.addEventListener('dblclick', () => startCalDetailRename(textEl, task));
    let lastTapDetail = 0;
    textEl.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTapDetail < 300) { e.preventDefault(); startCalDetailRename(textEl, task); }
      lastTapDetail = now;
    });

    item.append(grip, circle, textEl);

    if (task.dueTime) {
      const timeEl = document.createElement('span');
      timeEl.className = 'cal-detail-time';
      timeEl.textContent = task.dueTime;
      item.appendChild(timeEl);
    }
    if (task.calOnly) {
      const badge = document.createElement('span');
      badge.className = 'cal-detail-cal-only-badge';
      badge.textContent = 'カレンダーのみ';
      item.appendChild(badge);
    }

    // 削除ボタン
    const delBtn = document.createElement('button');
    delBtn.className = 'cal-detail-del-btn';
    delBtn.setAttribute('type', 'button');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      const allTasks = getAllDueTasks().filter(t => t.due === currentDetailDate);
      const confirmContainer = allTasks.length === 1 ? calDetailList : item;
      confirmDelete(confirmContainer, `タスク「${task.text}」`, () => {
        if (task.calOnly) {
          calOnlyTasks.splice(task.calOnlyIndex, 1);
          saveCalOnlyTasks();
          logEvent('delete', `タスク「${task.text}」を削除`);
        } else {
          const wrapper = getParentListWrapper(task.domEl);
          logEvent('delete', `タスク「${task.text}」を削除`);
          task.domEl.remove();
          if (wrapper) updateListCount(wrapper);
          else updateEmpty();
          saveState();
        }
        const updated = sortDetailTasks(getAllDueTasks().filter(t => t.due === currentDetailDate));
        renderCalendar();
        renderDetailList(updated);
        calDayDetail.hidden = false;
      });
    });
    item.appendChild(delBtn);

    // ── HTML5ドラッグ（PC） ──
    item.draggable = true;
    item.addEventListener('dragstart', e => {
      detailDragSrcIdx = i;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.classList.add('cal-detail-dragging'), 0);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('cal-detail-dragging');
      calDetailList.querySelectorAll('.cal-detail-drop-line').forEach(el => el.remove());
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      calDetailList.querySelectorAll('.cal-detail-drop-line').forEach(el => el.remove());
      const rect = item.getBoundingClientRect();
      const line = document.createElement('div');
      line.className = 'cal-detail-drop-line';
      if (e.clientY < rect.top + rect.height / 2) calDetailList.insertBefore(line, item);
      else calDetailList.insertBefore(line, item.nextSibling);
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      calDetailList.querySelectorAll('.cal-detail-drop-line').forEach(el => el.remove());
      if (detailDragSrcIdx === null || detailDragSrcIdx === i) return;
      reorderDetailTasks(tasks, detailDragSrcIdx, i);
    });

    // ── タッチドラッグ（モバイル） ──
    grip.addEventListener('touchstart', e => {
      e.preventDefault();
      detailDragSrcIdx = i;
      const touch = e.touches[0];
      const rect = item.getBoundingClientRect();
      touchDragOffY = touch.clientY - rect.top;
      touchDragClone = item.cloneNode(true);
      touchDragClone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;`
        + `width:${rect.width}px;opacity:0.85;pointer-events:none;z-index:1000;`
        + `border-radius:8px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
      document.body.appendChild(touchDragClone);
      item.classList.add('cal-detail-dragging');
    }, { passive: false });

    grip.addEventListener('touchmove', e => {
      if (detailDragSrcIdx === null) return;
      e.preventDefault();
      touchDragClone.style.top = `${e.touches[0].clientY - touchDragOffY}px`;
    }, { passive: false });

    grip.addEventListener('touchend', e => {
      if (detailDragSrcIdx === null) return;
      const touch = e.changedTouches[0];
      if (touchDragClone) { touchDragClone.remove(); touchDragClone = null; }
      item.classList.remove('cal-detail-dragging');
      const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetItem = elBelow?.closest('[data-detail-index]');
      if (targetItem && targetItem !== item) {
        const toIdx = parseInt(targetItem.dataset.detailIndex);
        if (!isNaN(toIdx)) reorderDetailTasks(tasks, i, toIdx);
      }
      detailDragSrcIdx = null;
    });

    grip.addEventListener('touchcancel', () => {
      if (touchDragClone) { touchDragClone.remove(); touchDragClone = null; }
      item.classList.remove('cal-detail-dragging');
      detailDragSrcIdx = null;
    });

    calDetailList.appendChild(item);
  });
}

function startCalDetailRename(textEl, task) {
  const original = task.text;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cal-detail-edit-input';
  input.value = original;

  const save = () => {
    const newText = input.value.trim() || original;
    if (newText !== original) {
      if (task.calOnly) {
        calOnlyTasks[task.calOnlyIndex].text = newText;
        saveCalOnlyTasks();
      } else if (task.domEl) {
        task.domEl.querySelector('.task-text').textContent = newText;
        saveState();
      }
      logEvent('edit', `「${original}」を「${newText}」に変更`);
      textEl.textContent = newText;
      renderCalendar();
    }
    input.replaceWith(textEl);
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = original; input.blur(); }
  });

  textEl.replaceWith(input);
  input.focus();
  input.select();
}

function reorderDetailTasks(tasks, fromIndex, toIndex) {
  const newTasks = [...tasks];
  const [moved] = newTasks.splice(fromIndex, 1);
  newTasks.splice(toIndex, 0, moved);

  // calOnlyタスクの順序を更新
  const calOnlyOrdered = newTasks.filter(t => t.calOnly);
  if (calOnlyOrdered.length > 0) {
    const other     = calOnlyTasks.filter(t => t.due !== currentDetailDate);
    const reordered = calOnlyOrdered.map(t => ({ ...calOnlyTasks[t.calOnlyIndex] }));
    calOnlyTasks.length = 0;
    calOnlyTasks.push(...other, ...reordered);
    saveCalOnlyTasks();
  }

  // 通常タスクの順序を更新（同じ親コンテナ内のみ）
  const regularOrdered = newTasks.filter(t => !t.calOnly && t.domEl);
  if (regularOrdered.length > 1) {
    const parents = new Set(regularOrdered.map(t => t.domEl.parentElement));
    if (parents.size === 1) {
      const container = [...parents][0];
      regularOrdered.forEach(t => container.appendChild(t.domEl));
      saveState();
    }
  }

  // カスタム順序を保存
  const sorted = sortDetailTasks(newTasks);
  taskOrderByDate[currentDetailDate] = sorted.map(taskKey);

  renderCalendar();
  renderDetailList(sorted);
  calDayDetail.hidden = false;
}

function sortDetailTasks(tasks) {
  return [...tasks].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
}

// ── カレンダー詳細パネル操作 ─────────────────────────────
document.getElementById('calDetailAddBtn').addEventListener('click', () => {
  const form = document.getElementById('calAddForm');
  const addBtn = document.getElementById('calDetailAddBtn');
  if (!form.hidden) {
    form.hidden = true;
    addBtn.classList.remove('active');
    return;
  }
  // リスト一覧をセレクトに反映
  const select = document.getElementById('calAddTarget');
  [...select.options].forEach(o => {
    if (o.value !== 'none' && o.value !== 'cal-only') o.remove();
  });
  const calOnlyOpt = select.querySelector('option[value="cal-only"]');
  document.querySelectorAll('#itemList .list-item').forEach((el, i) => {
    const opt = document.createElement('option');
    opt.value = `list-${i}`;
    opt.textContent = el.querySelector('.list-title').textContent;
    select.insertBefore(opt, calOnlyOpt);
  });
  form.hidden = false;
  addBtn.classList.add('active');
  document.getElementById('calAddInput').focus();
});

document.getElementById('calAddCancel').addEventListener('click', () => {
  document.getElementById('calAddForm').hidden = true;
  document.getElementById('calDetailAddBtn').classList.remove('active');
});

document.getElementById('calAddInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitCalAdd();
  if (e.key === 'Escape') document.getElementById('calAddForm').hidden = true;
});

document.getElementById('calAddSubmit').addEventListener('click', submitCalAdd);

function submitCalAdd() {
  const input  = document.getElementById('calAddInput');
  const select = document.getElementById('calAddTarget');
  const text   = input.value.trim();
  if (!text || !currentDetailDate) return;

  const target = select.value;
  const due    = currentDetailDate;

  if (target === 'cal-only') {
    calOnlyTasks.push({ text, due, dueTime: '', done: false });
    saveCalOnlyTasks();
    logEvent('add', `タスク「${text}」をカレンダーに追加`);
  } else if (target === 'none') {
    const el = createTaskItem(text);
    el.dataset.due = due;
    updateDueBadge(el.querySelector('.task-due'), due, '');
    insertAfterPinned(itemList, el);
    saveState();
    logEvent('add', `タスク「${text}」を追加`);
  } else {
    const idx    = parseInt(target.replace('list-', ''));
    const listEl = [...document.querySelectorAll('#itemList .list-item')][idx];
    if (listEl) {
      const taskEl = createTaskItem(text);
      taskEl.dataset.due = due;
      updateDueBadge(taskEl.querySelector('.task-due'), due, '');
      const subList   = listEl._subList;
      const firstDone = [...subList.children].find(
        c => c.classList.contains('task-item') && c.classList.contains('done')
      );
      if (firstDone) subList.insertBefore(taskEl, firstDone);
      else subList.appendChild(taskEl);
      updateListCount(listEl);
      saveState();
      logEvent('add', `タスク「${text}」をリスト「${listEl.querySelector('.list-title').textContent}」に追加`);
    }
  }

  input.value = '';
  document.getElementById('calAddForm').hidden = true;
  document.getElementById('calDetailAddBtn').classList.remove('active');

  // パネルとカレンダーを再描画
  const updatedTasks = sortDetailTasks(getAllDueTasks().filter(t => t.due === due));
  renderCalendar();
  renderDetailList(updatedTasks);
  // 閉じたパネルを再表示
  calDayDetail.hidden = false;
}

// ── Init ─────────────────────────────────────────────────
initDropZone(itemList);
loadState();
loadCalOnlyTasks();

try {
  const savedHistory = localStorage.getItem('todoHistory');
  if (savedHistory) {
    historyEntries.push(...JSON.parse(savedHistory));
    renderHistory();
  }
} catch (e) {
  console.warn('履歴の復元に失敗しました', e);
}
