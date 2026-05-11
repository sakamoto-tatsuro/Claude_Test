/* =============================================
   定数・設定
   ============================================= */
const STORAGE_KEY = 'tasks_v1';
const DARK_MODE_KEY = 'darkMode';

const PRIORITY_LABEL = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' };

/* =============================================
   DOM要素の取得
   ※ HTMLが読み込まれた後に実行されるので安全
   ============================================= */
const taskInput       = document.getElementById('taskInput');
const dueDateInput    = document.getElementById('dueDateInput');
const priorityInput   = document.getElementById('priorityInput');
const addTaskBtn      = document.getElementById('addTaskBtn');
const taskList        = document.getElementById('taskList');
const emptyState      = document.getElementById('emptyState');
const searchInput     = document.getElementById('searchInput');
const statsText       = document.getElementById('statsText');
const darkModeToggle  = document.getElementById('darkModeToggle');

// 編集モーダル
const editModal       = document.getElementById('editModal');
const modalOverlay    = document.getElementById('modalOverlay');
const editTaskInput   = document.getElementById('editTaskInput');
const editDueDateInput = document.getElementById('editDueDateInput');
const editPriorityInput = document.getElementById('editPriorityInput');
const editSaveBtn     = document.getElementById('editSaveBtn');
const editCancelBtn   = document.getElementById('editCancelBtn');

/* =============================================
   状態管理
   ============================================= */
let tasks = [];           // タスクの配列
let currentFilter = 'all'; // 現在のフィルター
let editingId = null;     // 編集中のタスクID

/* =============================================
   LocalStorage：保存・読み込み

   【エラーポイント】
   JSON.parse は不正な文字列でエラーになるので
   try-catch で囲む
   ============================================= */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('保存エラー:', e);
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('読み込みエラー:', e);
    tasks = [];
  }
}

/* =============================================
   タスク追加
   ============================================= */
function addTask() {
  const title = taskInput.value.trim();

  // バリデーション（空は追加しない）
  if (!title) {
    taskInput.focus();
    taskInput.classList.add('shake');
    setTimeout(() => taskInput.classList.remove('shake'), 400);
    return;
  }

  const newTask = {
    id: Date.now().toString(),  // ミリ秒のユニークID
    title,
    completed: false,
    priority: priorityInput.value,
    dueDate: dueDateInput.value,
    createdAt: new Date().toISOString(),
  };

  tasks.unshift(newTask); // 先頭に追加
  saveTasks();
  renderTasks();

  // フォームをリセット
  taskInput.value = '';
  dueDateInput.value = '';
  priorityInput.value = 'medium';
  taskInput.focus();
}

/* =============================================
   タスク削除
   ============================================= */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
}

/* =============================================
   完了トグル
   ============================================= */
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }
}

/* =============================================
   編集モーダル：開く・閉じる・保存
   ============================================= */
function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingId = id;
  editTaskInput.value = task.title;
  editDueDateInput.value = task.dueDate || '';
  editPriorityInput.value = task.priority;

  editModal.hidden = false;
  editTaskInput.focus();
}

function closeEditModal() {
  editModal.hidden = true;
  editingId = null;
}

function saveEdit() {
  const title = editTaskInput.value.trim();
  if (!title) return;

  const task = tasks.find(t => t.id === editingId);
  if (task) {
    task.title = title;
    task.dueDate = editDueDateInput.value;
    task.priority = editPriorityInput.value;
    saveTasks();
    renderTasks();
  }
  closeEditModal();
}

/* =============================================
   日付ユーティリティ

   "2026-05-20" → "2026/05/20" に変換
   期限切れかどうかも判定
   ============================================= */
function formatDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${y}/${m}/${d}`;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  return due < today;
}

/* =============================================
   フィルタリング（表示するタスクを絞り込む）
   ============================================= */
function getFilteredTasks() {
  const query = searchInput.value.trim().toLowerCase();

  return tasks.filter(task => {
    // テキスト検索
    const matchSearch = task.title.toLowerCase().includes(query);

    // 完了フィルター
    const matchFilter =
      currentFilter === 'all' ? true :
      currentFilter === 'active' ? !task.completed :
      task.completed;

    return matchSearch && matchFilter;
  });
}

/* =============================================
   タスクリスト描画（メイン関数）

   この関数1つで画面を全部書き直す。
   どの操作後でも renderTasks() を呼べばOK。
   ============================================= */
function renderTasks() {
  const filtered = getFilteredTasks();

  // 統計テキスト更新
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const active    = total - completed;
  statsText.textContent = `全 ${total} 件 ／ 未完了 ${active} 件 ／ 完了 ${completed} 件`;

  // リストをクリア
  taskList.innerHTML = '';

  // 空の場合
  if (filtered.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  // 各タスクのHTML生成
  filtered.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.priority = task.priority;

    // 日付表示
    const dueDateHtml = task.dueDate
      ? `<span class="task-item__due ${!task.completed && isOverdue(task.dueDate) ? 'overdue' : ''}">
           📅 ${formatDate(task.dueDate)}${!task.completed && isOverdue(task.dueDate) ? ' ⚠️ 期限切れ' : ''}
         </span>`
      : '';

    li.innerHTML = `
      <input
        type="checkbox"
        class="task-item__checkbox"
        ${task.completed ? 'checked' : ''}
        aria-label="完了にする"
      />
      <div class="task-item__body">
        <p class="task-item__title">${escapeHtml(task.title)}</p>
        <div class="task-item__meta">
          <span class="badge badge--${task.priority}">${PRIORITY_LABEL[task.priority]}</span>
          ${dueDateHtml}
        </div>
      </div>
      <div class="task-item__actions">
        <button class="btn btn--icon" aria-label="編集" title="編集">✏️</button>
        <button class="btn btn--icon btn--danger" aria-label="削除" title="削除">🗑️</button>
      </div>
    `;

    // イベント設定
    li.querySelector('.task-item__checkbox')
      .addEventListener('change', () => toggleComplete(task.id));

    li.querySelector('[aria-label="編集"]')
      .addEventListener('click', () => openEditModal(task.id));

    li.querySelector('[aria-label="削除"]')
      .addEventListener('click', () => {
        if (confirm(`「${task.title}」を削除しますか？`)) {
          deleteTask(task.id);
        }
      });

    taskList.appendChild(li);
  });
}

/* =============================================
   XSS対策：ユーザー入力をHTMLに表示するときは
   必ずエスケープする（セキュリティ基本）
   ============================================= */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =============================================
   ダークモード
   ============================================= */
function applyDarkMode(isDark) {
  document.body.classList.toggle('dark', isDark);
  darkModeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem(DARK_MODE_KEY, isDark ? '1' : '0');
}

function initDarkMode() {
  const saved = localStorage.getItem(DARK_MODE_KEY);
  // 保存がなければシステム設定に従う
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyDarkMode(saved !== null ? saved === '1' : prefersDark);
}

/* =============================================
   イベントリスナー登録
   ============================================= */

// タスク追加：ボタンクリック
addTaskBtn.addEventListener('click', addTask);

// タスク追加：Enterキー
taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

// リアルタイム検索
searchInput.addEventListener('input', renderTasks);

// フィルターボタン
document.querySelectorAll('.btn--filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn--filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// ダークモード切替
darkModeToggle.addEventListener('click', () => {
  applyDarkMode(!document.body.classList.contains('dark'));
});

// 編集モーダル：保存
editSaveBtn.addEventListener('click', saveEdit);

// 編集モーダル：キャンセル
editCancelBtn.addEventListener('click', closeEditModal);

// 編集モーダル：オーバーレイクリックで閉じる
modalOverlay.addEventListener('click', closeEditModal);

// 編集モーダル：Enterキーで保存
editTaskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveEdit();
});

// Escキーでモーダルを閉じる
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !editModal.hidden) closeEditModal();
});

/* =============================================
   入力フォームのシェイクアニメーション用CSS
   （JavaScriptからスタイルを動的に追加）
   ============================================= */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(6px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }
  .shake { animation: shake 0.4s ease; border-color: var(--color-danger) !important; }
`;
document.head.appendChild(shakeStyle);

/* =============================================
   初期化（ページ読み込み時に実行）
   ============================================= */
loadTasks();
initDarkMode();
renderTasks();
