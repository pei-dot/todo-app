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
  if (typeSelect.value === 'list') {
    itemList.appendChild(createListItem(text));
    logEvent('add', `リスト「${text}」を追加`);
  } else {
    itemList.appendChild(createTaskItem(text));
    logEvent('add', `タスク「${text}」を追加`);
  }
  mainInput.value = '';
  mainInput.focus();
  updateEmpty();
}

// ── Task item ────────────────────────────────────────────
function createTaskItem(text) {
  const item = document.createElement('div');
  item.className = 'task-item';

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
    const wrapper = getParentListWrapper(item);
    if (wrapper) updateListCount(wrapper);
    const isDone = item.classList.contains('done');
    logEvent(isDone ? 'done' : 'undone', `タスク「${text}」を${isDone ? '完了' : '未完了'}に変更`);
  });

  const span = document.createElement('span');
  span.className = 'task-text';
  span.textContent = text;

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
    });
  });

  item.appendChild(handle);
  item.appendChild(checkBtn);
  item.appendChild(span);
  item.appendChild(delBtn);

  initDrag(item, handle);
  return item;
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
    if (e.target.closest('.list-delete-btn') || e.target.closest('.drag-handle')) return;
    wrapper.classList.toggle('collapsed');
  });

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
    });
  });

  header.appendChild(dragHandle);
  header.appendChild(toggleIcon);
  header.appendChild(titleSpan);
  header.appendChild(countBadge);
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
}

function initDropZone(container) {
  container.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragSrc) return;
    if (dragSrc.classList.contains('list-item') && container !== itemList) return;
    e.stopPropagation();

    const after = getAfterEl(container, e.clientY);
    if (!after) container.appendChild(dropLine);
    else container.insertBefore(dropLine, after);
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
  });

  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget) && dropLine.parentElement === container) {
      dropLine.remove();
    }
  });
}

function getAfterEl(container, y) {
  const items = [...container.children].filter(
    el => el.draggable && !el.classList.contains('dragging')
  );
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
  renderHistory();
});

function logEvent(type, message) {
  const now  = new Date();
  const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  historyEntries.unshift({ type, message, time });
  renderHistory();
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

// ── Init ─────────────────────────────────────────────────
initDropZone(itemList);
updateEmpty();
