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

  item.appendChild(dateSpan);
  item.appendChild(selCheck);
  item.appendChild(handle);
  item.appendChild(checkBtn);
  item.appendChild(span);
  item.appendChild(dueBadge);
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
    container.insertBefore(newTask, form);
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

  header.appendChild(listSelCheck);
  header.appendChild(dragHandle);
  header.appendChild(toggleIcon);
  header.appendChild(titleSpan);
  header.appendChild(countBadge);
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

document.addEventListener('mousedown', e => {
  if (activePickerPopup && !activePickerPopup.contains(e.target)) closeDatePicker();
});

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
  document.body.appendChild(popup);
  activePickerPopup = popup;

  const r = anchor.getBoundingClientRect();
  const pw = 232, ph = popup.offsetHeight || 310;
  let top  = r.bottom + 6, left = r.right - pw;
  if (top + ph > window.innerHeight - 8) top = r.top - ph - 6;
  if (top < 8) top = 8;
  if (left < 4) left = 4;
  if (left + pw > window.innerWidth - 4) left = window.innerWidth - pw - 4;
  popup.style.cssText = `position:fixed;top:${top}px;left:${left}px;`;
}

// ── Pin ───────────────────────────────────────────────────
function togglePin(item) {
  const container = item.parentElement;
  item.classList.toggle('pinned');

  // ピン済み → ピン済みグループの末尾へ
  // ピンなし → ピンなしグループの先頭（最後のピン済みの直後）へ
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

    touchClone.style.left = `${touch.clientX - touchOffX}px`;
    touchClone.style.top  = `${touch.clientY - touchOffY}px`;

    // クローンを一時非表示にして指の下の要素を取得
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

  // タッチが中断された場合（着信・スワイプなど）のクリーンアップ
  handle.addEventListener('touchcancel', () => {
    if (!touchActive) return;
    touchActive = false;
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

// ドラッグ元と同じグループに属するかを判定するフィルタ関数を返す
// グループ順: [ピン済み] → [未完了] → [完了]
function groupFilter(src) {
  if (src.classList.contains('pinned'))
    return el => el.classList.contains('pinned');
  const isDone = src.classList.contains('done');
  return el => !el.classList.contains('pinned') && el.classList.contains('done') === isDone;
}

// ドラッグ元グループの末尾を示す「次の要素」を返す（null なら末尾に追加）
function groupEndMark(container, src) {
  if (src.classList.contains('pinned')) {
    return [...container.children].find(
      el => el !== dropLine && el.draggable && !el.classList.contains('pinned') && !el.classList.contains('dragging')
    ) ?? null;
  }
  if (!src.classList.contains('done')) {
    // 未完了グループの末尾 = 最初の非ピン完了アイテムの直前
    return [...container.children].find(
      el => el !== dropLine && el.draggable &&
            !el.classList.contains('pinned') && el.classList.contains('done') &&
            !el.classList.contains('dragging')
    ) ?? null;
  }
  return null; // 完了グループは末尾に追加
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
      // 親リストも選択されている場合はスキップ（リスト削除時に一緒に消える）
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

selDeleteBtn.addEventListener('click', () => {
  const n = document.querySelectorAll('.task-item.selected, .list-item.selected').length;
  selConfirmMsg.textContent = `${n}件を削除しますか？`;
  selBarMain.hidden = true;
  selBarConfirm.hidden = false;
});

document.getElementById('selConfirmYesBtn').addEventListener('click', execDeleteSelected);

document.getElementById('selConfirmNoBtn').addEventListener('click', () => {
  selBarMain.hidden = false;
  selBarConfirm.hidden = true;
});

// ── Init ─────────────────────────────────────────────────
initDropZone(itemList);
loadState();

try {
  const savedHistory = localStorage.getItem('todoHistory');
  if (savedHistory) {
    historyEntries.push(...JSON.parse(savedHistory));
    renderHistory();
  }
} catch (e) {
  console.warn('履歴の復元に失敗しました', e);
}
