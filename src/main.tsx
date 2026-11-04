import { getSpeechRecognition, abortRecognition, recognitionErrorMessage } from './utils/speechRecognition';
import { marked } from 'marked';
import { phrases as u3StandardPhrases } from './data/phrases-u3';
import { phrases as u3ExtraPhrases } from './data/phrases-u3-extra';
import { phrases as u2Phrases } from './data/phrases-u2';
import { phrases as u2ExtraPhrases } from './data/phrases-u2-extra';
import type { DatasetConfigItem, FlattenedQuestion, BookmarkItem } from './types';
import { APP_VERSION } from './version';
import './style.css';

// ========================================================
// データセット設定（レジストリ）
// ========================================================
const DATASET_CONFIG: Record<string, DatasetConfigItem> = {
  standard: {
    id: 'standard',
    name: '標準 (152問)',
    shortName: '標準',
    data: u3StandardPhrases
  },
  extra: {
    id: 'extra',
    name: '標準・追加 (67問)',
    shortName: '標準・追加',
    data: u3ExtraPhrases
  },
  u2: {
    id: 'u2',
    name: '基礎 (240問)',
    shortName: '基礎',
    data: u2Phrases
  },
  u2Extra: {
    id: 'u2Extra',
    name: '基礎・追加 (100問)',
    shortName: '基礎・追加',
    data: u2ExtraPhrases
  }
};

// ========================================================
// 状態管理
// ========================================================
class TrainerState {
  datasetStorageKey = 'cefr_a2b_active_dataset_v1';
  activeDatasetKey: string;
  completedIds: Set<number>;
  bookmarks: BookmarkItem[];
  currentQuestion: FlattenedQuestion | null = null;
  previousQuestion: FlattenedQuestion | null = null;
  clusterCategory: string | null = null;
  clusterRemaining = 0;
  isEvaluating = false;
  isPassed = false;
  lastEvaluation: {
    status: string;
    feedback: string;
    model_answer: string;
    alternative_answer: string;
  } | null = null;
  qaHistory: Array<{
    role: string;
    text: string;
    context?: { english: string; eval_context: string };
  }> = [];
  lastQaResponseId: string | null = null;

  constructor() {
    this.activeDatasetKey = this.loadActiveDatasetKey();
    this.completedIds = new Set(this.loadProgress());
    this.bookmarks = this.loadBookmarks();
  }

  loadActiveDatasetKey(): string {
    try {
      const saved = localStorage.getItem(this.datasetStorageKey);
      if (saved && DATASET_CONFIG[saved]) {
        return saved;
      }
    } catch (e) {
      console.error('Failed to load active dataset key', e);
    }
    return 'standard';
  }

  saveActiveDatasetKey(): void {
    try {
      localStorage.setItem(this.datasetStorageKey, this.activeDatasetKey);
    } catch (e) {
      console.error('Failed to save active dataset key', e);
    }
  }

  getActiveDatasetConfig(): DatasetConfigItem {
    return DATASET_CONFIG[this.activeDatasetKey] || DATASET_CONFIG.standard;
  }

  getCurrentQuestionsData() {
    return this.getActiveDatasetConfig().data;
  }

  getProgressStorageKey(): string {
    return `cefr_a2b_completed_${this.activeDatasetKey}_v1`;
  }

  getBookmarkStorageKey(): string {
    return `cefr_a2b_bookmarks_${this.activeDatasetKey}_v1`;
  }

  loadProgress(): number[] {
    try {
      const key = this.getProgressStorageKey();
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveProgress(): void {
    try {
      localStorage.setItem(this.getProgressStorageKey(), JSON.stringify([...this.completedIds]));
    } catch (e) {
      console.error('Failed to save progress', e);
    }
  }

  markPassed(id: number): void {
    this.completedIds.add(id);
    this.saveProgress();
  }

  loadBookmarks(): BookmarkItem[] {
    try {
      const key = this.getBookmarkStorageKey();
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveBookmarks(): void {
    try {
      localStorage.setItem(this.getBookmarkStorageKey(), JSON.stringify(this.bookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks', e);
    }
  }

  addBookmark(item: BookmarkItem): void {
    this.bookmarks.unshift(item);
    this.saveBookmarks();
  }

  removeBookmark(id: string): void {
    this.bookmarks = this.bookmarks.filter(b => b.id !== id);
    this.saveBookmarks();
  }

  findBookmark(questionId: number | string, userQuestion: string): BookmarkItem | undefined {
    return this.bookmarks.find(b => String(b.questionId) === String(questionId) && b.userQuestion === userQuestion);
  }

  clearBookmarks(): void {
    this.bookmarks = [];
    this.saveBookmarks();
  }

  getTotalQuestionsCount(): number {
    return this.getCurrentQuestionsData().reduce((sum, cat) => sum + cat.items.length, 0);
  }

  getCompletedCount(): number {
    return this.completedIds.size;
  }

  resetProgress(): void {
    this.completedIds.clear();
    this.saveProgress();
    this.clusterCategory = null;
    this.clusterRemaining = 0;
  }

  switchDataset(newKey: string): void {
    if (!DATASET_CONFIG[newKey] || newKey === this.activeDatasetKey) return;
    this.activeDatasetKey = newKey;
    this.saveActiveDatasetKey();

    this.completedIds = new Set(this.loadProgress());
    this.bookmarks = this.loadBookmarks();
    this.clusterCategory = null;
    this.clusterRemaining = 0;
    this.currentQuestion = null;
    this.previousQuestion = null;
    this.isPassed = false;
    this.lastEvaluation = null;
    this.qaHistory = [];
    this.lastQaResponseId = null;
  }
}

const state = new TrainerState();
let questionVersion = 0;
let evaluationController: AbortController | null = null;
let qaController: AbortController | null = null;

// ========================================================
// DOM要素
// ========================================================
const elDatasetSelect = document.getElementById('dataset-select') as HTMLSelectElement | null;
const elProgressBadge = document.getElementById('progress-badge') as HTMLElement;
const elProgressBar = document.getElementById('progress-bar') as HTMLElement;
const elCategoryTag = document.getElementById('category-tag') as HTMLElement;
const elQuestionText = document.getElementById('question-text') as HTMLElement;
const elInputGroup = document.querySelector('.input-group') as HTMLElement;
const elUserInput = document.getElementById('user-input') as HTMLTextAreaElement;
const elBtnMic = document.getElementById('btn-mic') as HTMLButtonElement | null;
const elBtnSubmit = document.getElementById('btn-submit') as HTMLButtonElement;
const elBtnSkip = document.getElementById('btn-skip') as HTMLButtonElement;
const elBtnRepeat = document.getElementById('btn-repeat') as HTMLButtonElement;
const elBtnNext = document.getElementById('btn-next') as HTMLButtonElement;

const elResultBox = document.getElementById('result-box') as HTMLElement;
const elAiInfoTooltip = document.getElementById('ai-info-tooltip') as HTMLElement | null;
const elStatusBadge = document.getElementById('status-badge') as HTMLElement;
const elFeedbackText = document.getElementById('feedback-text') as HTMLElement;
const elAnswersBlock = document.getElementById('answers-block') as HTMLElement;
const elModelAnswer = document.getElementById('model-answer') as HTMLElement;
const elAltAnswerItem = document.getElementById('alt-answer-item') as HTMLElement;
const elAltAnswer = document.getElementById('alt-answer') as HTMLElement;

const elQaSection = document.querySelector('.qa-section') as HTMLElement;
const elQaToggle = document.getElementById('qa-toggle') as HTMLButtonElement;
const elQaContainer = document.getElementById('qa-container') as HTMLElement;
const elQaInput = document.getElementById('qa-input') as HTMLInputElement;
const elBtnQaAsk = document.getElementById('btn-qa-ask') as HTMLButtonElement;
const elQaThread = document.getElementById('qa-thread') as HTMLElement;

const elProgressModal = document.getElementById('progress-modal') as HTMLElement;
const elModalSummary = document.getElementById('modal-summary') as HTMLElement;
const elModalBody = document.getElementById('modal-body') as HTMLElement;
const elBtnModalClose = document.getElementById('btn-modal-close') as HTMLButtonElement;
const elBtnResetProgress = document.getElementById('btn-reset-progress') as HTMLButtonElement;
const elFilterBtns = document.querySelectorAll<HTMLButtonElement>('.filter-btn');
let currentModalFilter = 'all';

const elBookmarkBadge = document.getElementById('bookmark-badge') as HTMLElement;
const elBookmarkModal = document.getElementById('bookmark-modal') as HTMLElement;
const elBookmarkModalSummary = document.getElementById('bookmark-modal-summary') as HTMLElement;
const elBookmarkModalBody = document.getElementById('bookmark-modal-body') as HTMLElement;

const elBtnBookmarkModalClose = document.getElementById('btn-bookmark-modal-close') as HTMLButtonElement;
const elBtnClearBookmarks = document.getElementById('btn-clear-bookmarks') as HTMLButtonElement;

const BOOKMARK_ICON_SVG = `<svg class="bookmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
let bookmarkRenderVersion = 0;

// ========================================================
// 音声認識 (Web Speech API / en-US)
// ========================================================
let recognitionInstance: any = null;
let isListening = false;

function stopSpeechRecognition(): void {
  if (recognitionInstance) {
    abortRecognition(recognitionInstance);
    recognitionInstance = null;
  }
  isListening = false;
  if (elBtnMic) {
    elBtnMic.classList.remove('recording');
    elBtnMic.title = '音声入力 (英語)';
  }
}

function startSpeechRecognition(): void {
  const SpeechRecognitionClass = getSpeechRecognition();
  if (!SpeechRecognitionClass) {
    alert('お使いのブラウザは音声認識に対応していません。ChromeまたはEdgeをご利用ください。');
    return;
  }

  stopSpeechRecognition();

  try {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const results = event.results;
      let text = '';
      for (let i = 0; i < results.length; i++) {
        text += results[i][0].transcript;
      }
      text = text.trim();
      if (text) {
        elUserInput.value = text;
      }
    };

    recognition.onend = () => {
      stopSpeechRecognition();
      elUserInput.focus();
    };

    recognition.onerror = (event: any) => {
      stopSpeechRecognition();
      if (event.error === 'not-allowed') {
        alert(recognitionErrorMessage('not-allowed'));
      }
    };

    recognitionInstance = recognition;
    isListening = true;
    if (elBtnMic) {
      elBtnMic.classList.add('recording');
      elBtnMic.title = '音声認識中... クリックで停止';
    }
    recognition.start();
  } catch (e) {
    stopSpeechRecognition();
    console.error('Failed to start speech recognition', e);
  }
}

if (elBtnMic) {
  if (!getSpeechRecognition()) {
    elBtnMic.style.display = 'none';
  } else {
    elBtnMic.addEventListener('click', () => {
      if (isListening) {
        stopSpeechRecognition();
      } else {
        startSpeechRecognition();
      }
    });
  }
}

function invalidateQuestionRequests(): void {
  stopSpeechRecognition();
  questionVersion++;
  evaluationController?.abort();
  qaController?.abort();
  evaluationController = null;
  qaController = null;
  state.isEvaluating = false;
  elBtnQaAsk.disabled = false;
  elQaInput.disabled = false;
}

function isCurrentQuestionRequest(version: number, controller: AbortController, activeController: AbortController | null): boolean {
  return version === questionVersion && controller === activeController && !controller.signal.aborted;
}

// ========================================================
// 出題アルゴリズム (同系構文 3〜4問集中 ➔ ランダム切替)
// ========================================================
function pickNextQuestion(): void {
  const currentQuestions = state.getCurrentQuestionsData();
  const totalCount = state.getTotalQuestionsCount();
  if (state.getCompletedCount() >= totalCount) {
    // 全問達成
    showAllCompleted();
    return;
  }

  const currentId = state.currentQuestion ? state.currentQuestion.id : null;

  // 1. 現在のクラスター（カテゴリ）が継続可能か判定（現在表示中の問題は除外）
  let categoryObj = null;
  if (state.clusterCategory && state.clusterRemaining > 0) {
    const found = currentQuestions.find(c => c.category === state.clusterCategory);
    const remainingInCat = found
      ? found.items.filter(item => !state.completedIds.has(item.id) && item.id !== currentId)
      : [];
    if (remainingInCat.length > 0) {
      categoryObj = found;
    }
  }

  // 2. クラスターが終了または未完了問題がない場合、新しいカテゴリをランダム選択
  if (!categoryObj) {
    let availableCategories = currentQuestions.filter(cat => {
      return cat.items.some(item => !state.completedIds.has(item.id) && item.id !== currentId);
    });

    if (availableCategories.length === 0) {
      availableCategories = currentQuestions.filter(cat => {
        return cat.items.some(item => !state.completedIds.has(item.id));
      });
    }

    if (availableCategories.length === 0) {
      showAllCompleted();
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableCategories.length);
    categoryObj = availableCategories[randomIndex];

    state.clusterCategory = categoryObj.category;
    const uncompletedInCat = categoryObj.items.filter(item => !state.completedIds.has(item.id));
    state.clusterRemaining = Math.min(uncompletedInCat.length, Math.floor(Math.random() * 2) + 3); // 3 または 4問
  }

  // 3. 選択されたカテゴリから未完了の問題を1つランダム選択
  let availableItems = categoryObj.items.filter(
    item => !state.completedIds.has(item.id) && item.id !== currentId
  );
  if (availableItems.length === 0) {
    availableItems = categoryObj.items.filter(item => !state.completedIds.has(item.id));
  }
  const randomItemIndex = Math.floor(Math.random() * availableItems.length);
  const chosenItem = availableItems[randomItemIndex];

  setQuestion({
    id: chosenItem.id,
    text: chosenItem.text,
    answer: chosenItem.answer,
    category: categoryObj.category
  });
}

// 画面に問題を表示
function setQuestion(q: FlattenedQuestion): void {
  invalidateQuestionRequests();
  state.currentQuestion = q;
  state.isPassed = false;

  elCategoryTag.textContent = `【No.${q.id}】`;
  elInputGroup.classList.remove('hidden');
  elQaSection.classList.remove('hidden');
  elQuestionText.textContent = q.text;
  elUserInput.value = '';
  elUserInput.disabled = false;
  elUserInput.focus();

  // ボタンとUIのリセット
  elBtnSubmit.classList.remove('hidden');
  elBtnSubmit.disabled = false;
  elBtnSubmit.innerHTML = '<span>判定する (Enter)</span>';

  elBtnRepeat.classList.add('hidden');
  elBtnSkip.classList.remove('hidden');
  elBtnSkip.disabled = false;

  elBtnNext.classList.add('hidden');
  elBtnNext.disabled = true;

  elResultBox.className = 'result-box hidden';
  document.querySelectorAll('.ai-info.active').forEach(el => el.classList.remove('active'));
  elAnswersBlock.classList.add('hidden');
  state.lastEvaluation = null;
  state.qaHistory = [];
  state.lastQaResponseId = null;
  elQaThread.innerHTML = '';
  elQaInput.value = '';

  updateProgressUI();
}

function updateProgressUI(): void {
  const total = state.getTotalQuestionsCount();
  const completed = state.getCompletedCount();
  elProgressBadge.textContent = `進捗: ${completed} / ${total}問`;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  elProgressBar.style.width = `${pct}%`;
}

// ========================================================
// 進捗一覧モーダル
// ========================================================
function openProgressModal(): void {
  renderProgressModal();
  elProgressModal.classList.remove('hidden');
  elProgressModal.setAttribute('aria-hidden', 'false');
}

function closeProgressModal(): void {
  elProgressModal.classList.add('hidden');
  elProgressModal.setAttribute('aria-hidden', 'true');
}

function renderProgressModal(): void {
  const total = state.getTotalQuestionsCount();
  const completed = state.getCompletedCount();
  const uncompleted = total - completed;
  const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

  const datasetName = state.getActiveDatasetConfig().name;
  elModalSummary.textContent = `${datasetName} : ${completed} / ${total}問 クリア (${pct}%)`;

  // フィルタボタンの件数ラベル更新
  elFilterBtns.forEach(btn => {
    const f = btn.dataset.filter;
    btn.classList.toggle('active', f === currentModalFilter);
    if (f === 'all') btn.textContent = `すべて (${total})`;
    if (f === 'uncompleted') btn.textContent = `未クリア (${uncompleted})`;
    if (f === 'completed') btn.textContent = `クリア済み (${completed})`;
  });

  elModalBody.innerHTML = '';
  let renderedCatCount = 0;

  for (const catObj of state.getCurrentQuestionsData()) {
    const catTotal = catObj.items.length;
    const catDone = catObj.items.filter(i => state.completedIds.has(i.id)).length;
    const catPct = catTotal > 0 ? (catDone / catTotal) * 100 : 0;

    const filteredItems = catObj.items.filter(item => {
      const isDone = state.completedIds.has(item.id);
      if (currentModalFilter === 'completed') return isDone;
      if (currentModalFilter === 'uncompleted') return !isDone;
      return true;
    });

    if (filteredItems.length === 0) continue;
    renderedCatCount++;

    const catEl = document.createElement('div');
    catEl.className = 'progress-cat';

    const headerEl = document.createElement('div');
    headerEl.className = 'progress-cat-header';
    headerEl.innerHTML = `
      <span class="progress-cat-title">${escapeHtml(catObj.category)}</span>
      <div class="progress-cat-meta">
        <div class="progress-cat-bar">
          <div class="progress-cat-bar-fill" style="width: ${catPct}%"></div>
        </div>
        <span class="progress-cat-count">${catDone} / ${catTotal}</span>
      </div>
    `;
    catEl.appendChild(headerEl);

    const listEl = document.createElement('div');
    listEl.className = 'progress-item-list';

    for (const item of filteredItems) {
      const isDone = state.completedIds.has(item.id);
      const isCurrent = state.currentQuestion && state.currentQuestion.id === item.id;

      const itemEl = document.createElement('div');
      itemEl.className = `progress-item${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`;
      itemEl.innerHTML = `
        <span class="progress-item-status">${isDone ? '✅' : '⬜'}</span>
        <span class="progress-item-no">No.${item.id}</span>
        <span class="progress-item-text">${escapeHtml(item.text)}</span>
        ${isCurrent ? '<span class="progress-item-current-tag">出題中</span>' : ''}
      `;
      itemEl.addEventListener('click', () => {
        state.clusterCategory = catObj.category;
        const uncompletedInCat = catObj.items.filter(i => !state.completedIds.has(i.id) && i.id !== item.id);
        state.clusterRemaining = Math.min(uncompletedInCat.length + 1, Math.floor(Math.random() * 2) + 3);
        setQuestion({
          id: item.id,
          text: item.text,
          answer: item.answer,
          category: catObj.category
        });
        closeProgressModal();
      });
      listEl.appendChild(itemEl);
    }

    catEl.appendChild(listEl);
    elModalBody.appendChild(catEl);
  }

  if (renderedCatCount === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'modal-empty';
    emptyEl.textContent = currentModalFilter === 'completed'
      ? 'まだクリア済みの問題はありません。'
      : 'すべての問題をクリアしています！ 🎉';
    elModalBody.appendChild(emptyEl);
  }
}

function showAllCompleted(): void {
  invalidateQuestionRequests();
  state.currentQuestion = null;
  state.isPassed = false;
  state.lastEvaluation = null;
  state.qaHistory = [];
  state.lastQaResponseId = null;
  elQaThread.innerHTML = '';
  elQaInput.value = '';
  elQaInput.disabled = true;
  elBtnQaAsk.disabled = true;
  elResultBox.classList.add('hidden');
  elAnswersBlock.classList.add('hidden');
  elQaContainer.classList.add('hidden');
  elQaSection.classList.add('hidden');
  const total = state.getTotalQuestionsCount();
  const datasetName = state.getActiveDatasetConfig().name;
  elCategoryTag.textContent = '🎉 全問クリア！';
  elQuestionText.innerHTML = `
    すべての問題（${datasetName}・全${total}問）を完了しました！<br>
    素晴らしい継続力です！
  `;
  elUserInput.value = '';
  elUserInput.disabled = true;
  elInputGroup.classList.add('hidden');
  elBtnSubmit.classList.add('hidden');
  elBtnSkip.classList.add('hidden');
  elBtnRepeat.classList.add('hidden');
  elBtnNext.classList.add('hidden');

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.flexWrap = 'wrap';
  btnGroup.style.alignItems = 'center';
  btnGroup.style.gap = '12px';
  btnGroup.style.marginTop = '20px';

  const btnReview = document.createElement('button');
  btnReview.className = 'btn-primary';
  btnReview.textContent = '📋 進捗一覧から復習する';
  btnReview.onclick = () => {
    openProgressModal();
  };

  const btnReset = document.createElement('button');
  btnReset.className = 'btn-danger-outline';
  btnReset.style.padding = '10px 18px';
  btnReset.style.fontSize = '0.9rem';
  btnReset.textContent = '↺ もう一度最初から練習する（進捗リセット）';
  btnReset.onclick = () => {
    const totalCount = state.getTotalQuestionsCount();
    const activeDatasetName = state.getActiveDatasetConfig().name;
    const confirmed = confirm(
      `⚠️【進捗リセットの確認】\n\n${activeDatasetName}（全${totalCount}問）のクリア記録がすべて消去され、0 / ${totalCount}問に戻ります。\nこの操作は取り消せません。\n\n本当に進捗をリセットして最初からやり直しますか？`
    );
    if (confirmed) {
      state.resetProgress();
      pickNextQuestion();
    }
  };

  btnGroup.appendChild(btnReview);
  btnGroup.appendChild(btnReset);
  elQuestionText.appendChild(btnGroup);
}

// ========================================================
// Q&A ブックマーク一覧モーダル
// ========================================================
function updateBookmarkUI(): void {
  const count = state.bookmarks.length;
  const countTextEl = document.getElementById('bookmark-count-text');
  if (countTextEl) {
    countTextEl.textContent = `${count}件`;
  } else {
    elBookmarkBadge.textContent = `${count}件`;
  }
  elBookmarkBadge.classList.toggle('has-items', count > 0);
}

function openBookmarkModal(): void {
  renderBookmarkModal();
  elBookmarkModal.classList.remove('hidden');
  elBookmarkModal.setAttribute('aria-hidden', 'false');
}

function closeBookmarkModal(): void {
  bookmarkRenderVersion++;
  elBookmarkModal.classList.add('hidden');
  elBookmarkModal.setAttribute('aria-hidden', 'true');
}

function updateActiveQaBookmarkButtons(): void {
  document.querySelectorAll<HTMLElement>('.btn-qa-bookmark').forEach(btn => {
    const qId = btn.dataset.qId;
    const userQ = btn.dataset.userQ;
    if (qId && userQ) {
      const isBookmarked = state.findBookmark(qId, userQ);
      btn.classList.toggle('active', !!isBookmarked);
      btn.title = isBookmarked ? 'ブックマークを解除' : 'このQ&Aをブックマーク';
    }
  });
}

function renderBookmarkModal(): void {
  const count = state.bookmarks.length;
  elBookmarkModalSummary.textContent = `保存件数: ${count}件`;
  elBookmarkModalBody.innerHTML = '';

  if (count === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'modal-empty';
    emptyEl.innerHTML = `
      <p style="font-size:1.05rem; font-weight:600; margin-bottom:0.5rem; color:#94a3b8;">保存されたQ&Aはありません</p>
      <p style="font-size:0.85rem; color:#64748b; line-height:1.6;">AIへの質問回答バブル右上にあるブックマークボタンを押すと、後から見返したい解説をここにストックできます。</p>
    `;
    elBookmarkModalBody.appendChild(emptyEl);
    return;
  }

  // 最新順（降順）で表示
  for (const bm of state.bookmarks) {
    const cardEl = document.createElement('div');
    cardEl.className = 'bookmark-card';

    const dateStr = bm.createdAt ? new Date(bm.createdAt).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    const headerEl = document.createElement('div');
    headerEl.className = 'bookmark-card-header';
    headerEl.innerHTML = `
      <div>
        <div class="bookmark-card-title">
          <svg class="bookmark-card-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <span>No.${escapeHtml(String(bm.questionId))} 【${escapeHtml(bm.category || '')}】</span>
        </div>
        <div class="bookmark-card-meta">
          ${dateStr ? `<span>${escapeHtml(dateStr)} 保存</span>` : ''}
          ${bm.model ? `<span>・ model: ${escapeHtml(bm.model)}</span>` : ''}
        </div>
      </div>
      <button class="btn-bookmark-del" title="このブックマークを削除" aria-label="削除">🗑️</button>
    `;

    // 削除ボタン
    const delBtn = headerEl.querySelector('.btn-bookmark-del') as HTMLButtonElement;
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.removeBookmark(bm.id);
      cardEl.remove();
      updateBookmarkUI();
      updateActiveQaBookmarkButtons();
      elBookmarkModalSummary.textContent = `保存件数: ${state.bookmarks.length}件`;
      if (state.bookmarks.length === 0) renderBookmarkModal();
    });

    const jpEl = document.createElement('div');
    jpEl.className = 'bookmark-jp';
    jpEl.innerHTML = `<strong>お題:</strong> ${escapeHtml(bm.japanese || '')}`;

    let userEngEl: HTMLElement | null = null;
    if (bm.userEnglish) {
      userEngEl = document.createElement('div');
      userEngEl.className = 'bookmark-user-eng';
      userEngEl.innerHTML = `あなたの英作文: <code>${escapeHtml(bm.userEnglish)}</code>`;
    }

    const qBox = document.createElement('div');
    qBox.className = 'bookmark-q-box';
    qBox.innerHTML = `
      <strong>あなたの質問:</strong>
      ${escapeHtml(bm.userQuestion)}
    `;

    const aBox = document.createElement('div');
    aBox.className = 'bookmark-a-box';
    aBox.innerHTML = renderMarkdown(bm.aiAnswer || '');

    const actionsEl = document.createElement('div');
    actionsEl.className = 'bookmark-actions';
    actionsEl.innerHTML = `
      <button class="btn-jump-question">👉 この問題を練習する</button>
    `;

    // ジャンプボタン
    const jumpBtn = actionsEl.querySelector('.btn-jump-question') as HTMLButtonElement;
    jumpBtn.addEventListener('click', () => {
      let targetCat = null;
      let targetItem = null;
      for (const cat of state.getCurrentQuestionsData()) {
        const item = cat.items.find(i => String(i.id) === String(bm.questionId));
        if (item) {
          targetCat = cat;
          targetItem = item;
          break;
        }
      }

      if (targetItem && targetCat) {
        state.clusterCategory = targetCat.category;
        const uncompletedInCat = targetCat.items.filter(i => !state.completedIds.has(i.id) && i.id !== targetItem.id);
        state.clusterRemaining = Math.min(uncompletedInCat.length + 1, Math.floor(Math.random() * 2) + 3);
        setQuestion({
          id: targetItem.id,
          text: targetItem.text,
          answer: targetItem.answer,
          category: targetCat.category
        });
        closeBookmarkModal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert('該当の問題データが見つかりませんでした。');
      }
    });

    cardEl.appendChild(headerEl);
    cardEl.appendChild(jpEl);
    if (userEngEl) cardEl.appendChild(userEngEl);
    cardEl.appendChild(qBox);
    cardEl.appendChild(aBox);
    cardEl.appendChild(actionsEl);
    elBookmarkModalBody.appendChild(cardEl);
  }
}

// ========================================================
// 判定リクエスト (evaluate)
// ========================================================
async function evaluateAnswer(): Promise<void> {
  stopSpeechRecognition();
  if (state.isEvaluating || !state.currentQuestion) return;

  const english = elUserInput.value.trim();
  if (!english) {
    alert('英文を入力してください。');
    elUserInput.focus();
    return;
  }

  const version = questionVersion;
  const question = { ...state.currentQuestion };
  const controller = new AbortController();
  evaluationController = controller;
  const isCurrent = () => isCurrentQuestionRequest(version, controller, evaluationController);

  state.isEvaluating = true;
  elBtnSubmit.disabled = true;
  elBtnSkip.disabled = true;
  elBtnSubmit.innerHTML = '<span class="spinner"></span> <span>添削中...</span>';

  try {
    const res = await fetch('api.php', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'evaluate',
        japanese: question.text,
        model_answer: question.answer || '',
        english: english
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTPエラー (${res.status})`);
    }

    const data = await res.json();
    if (!isCurrent()) return;
    handleEvaluationResult(data);
  } catch (err: any) {
    if (!isCurrent() || err.name === 'AbortError') return;
    console.error(err);
    alert(`エラーが発生しました: ${err.message}`);
    elBtnSubmit.disabled = false;
    elBtnSkip.disabled = false;
    elBtnSubmit.innerHTML = '<span>判定する (Enter)</span>';
  } finally {
    if (isCurrent()) {
      evaluationController = null;
      state.isEvaluating = false;
    }
  }
}

// 英文比較用の正規化関数
function normalizeEnglish(str: string): string {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/[.?!]+$/g, '')
    .replace(/\s+/g, ' ');
}

// 添削結果の表示処理
function handleEvaluationResult(data: any): void {
  const status = data.status || 'fail';
  elResultBox.className = `result-box ${status}`;
  document.querySelectorAll('.ai-info.active').forEach(el => el.classList.remove('active'));

  if (elAiInfoTooltip) {
    const modelName = data.model || 'unknown';
    const thinkingLevel = data.thinking_level || 'unknown';
    elAiInfoTooltip.innerHTML = `model: <strong>${escapeHtml(modelName)}</strong><br>thinking_level: <strong>${escapeHtml(thinkingLevel)}</strong>`;
  }

  const modelAns = state.currentQuestion?.answer || data.model_answer || '';
  const altAns = data.alternative_answer || '';
  const validAltAns = (status === 'pass' && altAns && normalizeEnglish(altAns) !== normalizeEnglish(modelAns))
    ? altAns
    : '';

  state.lastEvaluation = {
    status: status,
    feedback: data.feedback || '',
    model_answer: status === 'pass' ? modelAns : '',
    alternative_answer: validAltAns
  };

  if (status === 'pass') {
    state.isPassed = true;
    if (state.currentQuestion) {
      state.markPassed(state.currentQuestion.id);
      state.previousQuestion = { ...state.currentQuestion };
    }
    if (state.clusterRemaining > 0) {
      state.clusterRemaining--;
    }

    elStatusBadge.innerHTML = '<span>合格！ 🎉</span>';
    elFeedbackText.textContent = data.feedback || '完璧です！';

    elModelAnswer.textContent = modelAns;

    if (validAltAns) {
      elAltAnswer.textContent = validAltAns;
      elAltAnswerItem.classList.remove('hidden');
    } else {
      elAltAnswer.textContent = '';
      elAltAnswerItem.classList.add('hidden');
    }
    elAnswersBlock.classList.remove('hidden');

    elBtnSubmit.classList.add('hidden');
    elBtnSkip.classList.add('hidden');
    elBtnRepeat.classList.remove('hidden');
    elBtnRepeat.disabled = false;
    elBtnNext.classList.remove('hidden');
    elBtnNext.disabled = false;
    elBtnNext.focus();
  } else {
    state.isPassed = false;
    const badgeText = status === 'close' ? '惜しい！ あと一歩' : 'もう一度！';
    elStatusBadge.innerHTML = `<span>${badgeText}</span>`;
    
    elFeedbackText.innerHTML = `${data.feedback || '文法や語順を確認してもう一度入力してください。'}<br><strong style="color:#f8fafc; font-size:0.9rem;">👉 修正してもう一度英文を入力してください！</strong>`;

    elAnswersBlock.classList.add('hidden');
    elBtnNext.classList.add('hidden');
    elBtnRepeat.classList.add('hidden');
    elBtnSkip.classList.remove('hidden');
    elBtnSkip.disabled = false;

    elBtnSubmit.disabled = false;
    elBtnSubmit.innerHTML = '<span>もう一度判定する (Enter)</span>';
    elUserInput.focus();
  }

  elResultBox.classList.remove('hidden');
  updateProgressUI();
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    return marked.parse(text) as string;
  } catch {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
}

// ========================================================
// 質問リクエスト (ask - スレッド形式で何回でも連続質問可能)
// ========================================================
async function askQuestion(): Promise<void> {
  const question = elQaInput.value.trim();
  if (!question || !state.currentQuestion || qaController) return;
  const version = questionVersion;
  const currentQuestion = { ...state.currentQuestion };
  const controller = new AbortController();
  qaController = controller;
  const isCurrent = () => isCurrentQuestionRequest(version, controller, qaController);

  // 1. ユーザーの質問バブルを追加
  const userBubble = document.createElement('div');
  userBubble.className = 'qa-msg user';
  userBubble.innerHTML = `<strong>あなた</strong>${escapeHtml(question)}`;
  elQaThread.appendChild(userBubble);

  // 2. ローディングバブルを追加
  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'qa-loading';
  loadingBubble.innerHTML = '<span class="spinner"></span> <span>AIが回答を作成中...</span>';
  elQaThread.appendChild(loadingBubble);

  elQaInput.value = '';
  elBtnQaAsk.disabled = true;
  elQaInput.disabled = true;
  elQaThread.scrollTop = elQaThread.scrollHeight;

  const currentEnglish = elUserInput.value.trim();
  let evalContext = '';
  if (state.lastEvaluation) {
    const statusLabel =
      state.lastEvaluation.status === 'pass'
        ? '合格 (pass)'
        : state.lastEvaluation.status === 'close'
          ? '惜しい (close)'
          : 'もう一度 (fail)';
    evalContext = `\n\n【直前のAI判定結果】\n判定: ${statusLabel}\nAIの回答（解説・ヒント）: ${state.lastEvaluation.feedback}`;
    if (state.lastEvaluation.model_answer) {
      evalContext += `\n提示された模範解答: ${state.lastEvaluation.model_answer}`;
    }
    if (state.lastEvaluation.alternative_answer) {
      evalContext += `\n提示された別解: ${state.lastEvaluation.alternative_answer}`;
    }
  }

  try {
    const res = await fetch('api.php', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ask',
        japanese: currentQuestion.text,
        model_answer: currentQuestion.answer || '',
        english: currentEnglish,
        eval_context: evalContext,
        question: question,
        previous_response_id: state.lastQaResponseId || null
      })
    });

    const data = await res.json();
    if (!isCurrent()) return;
    if (!res.ok) throw new Error(data.error || '質問の送信に失敗しました');
    if (data.response_id) {
      state.lastQaResponseId = data.response_id;
    }

    loadingBubble.remove();

    // 3. AIの回答バブルを追加
    const modelName = data.model || 'unknown';
    const thinkingLevel = data.thinking_level || 'unknown';
    const answerText = data.answer || '回答が得られませんでした。';
    const qId = currentQuestion.id;
    const qCat = currentQuestion.category;
    const qText = currentQuestion.text;
    const userEng = currentEnglish;
    const userQ = question;

    const aiBubble = document.createElement('div');
    aiBubble.className = 'qa-msg ai';
    aiBubble.innerHTML = `
      <div class="qa-actions">
        <button class="btn-qa-bookmark" title="このQ&Aをブックマーク" aria-label="ブックマーク">
          ${BOOKMARK_ICON_SVG}
        </button>
        <div class="ai-info" tabindex="0" aria-label="AIモデル情報">
          <span class="ai-info-icon">i</span>
          <div class="ai-info-tooltip">model: <strong>${escapeHtml(modelName)}</strong><br>thinking_level: <strong>${escapeHtml(thinkingLevel)}</strong></div>
        </div>
      </div>
      ${renderMarkdown(answerText)}
    `;

    const bmBtn = aiBubble.querySelector('.btn-qa-bookmark') as HTMLElement;
    bmBtn.dataset.qId = String(qId);
    bmBtn.dataset.userQ = userQ;

    const existing = state.findBookmark(qId, userQ);
    if (existing) {
      bmBtn.classList.add('active');
      bmBtn.title = 'ブックマークを解除';
    }

    bmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = state.findBookmark(qId, userQ);
      if (current) {
        state.removeBookmark(current.id);
        bmBtn.classList.remove('active');
        bmBtn.title = 'このQ&Aをブックマーク';
      } else {
        state.addBookmark({
          id: 'bm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          questionId: qId,
          category: qCat,
          japanese: qText,
          userEnglish: userEng,
          userQuestion: userQ,
          aiAnswer: answerText,
          model: modelName,
          thinkingLevel: thinkingLevel,
          createdAt: Date.now()
        });
        bmBtn.classList.add('active');
        bmBtn.title = 'ブックマークを解除';
      }
      updateBookmarkUI();
    });

    elQaThread.appendChild(aiBubble);

    state.qaHistory.push({
      role: 'user',
      text: question,
      context: { english: currentEnglish, eval_context: evalContext }
    });
    state.qaHistory.push({
      role: 'model',
      text: answerText
    });

  } catch (err: any) {
    if (!isCurrent() || err.name === 'AbortError') return;
    loadingBubble.remove();
    const errBubble = document.createElement('div');
    errBubble.className = 'qa-msg ai';
    errBubble.innerHTML = `<span style="color:#f87171;">エラー: ${escapeHtml(err.message)}</span>`;
    elQaThread.appendChild(errBubble);
  } finally {
    if (isCurrent()) {
      qaController = null;
      elBtnQaAsk.disabled = false;
      elQaInput.disabled = false;
      elQaInput.focus();
      elQaThread.scrollTop = elQaThread.scrollHeight;
    }
  }
}

// ========================================================
// イベントリスナー設定
// ========================================================

// 判定ボタン
elBtnSubmit.addEventListener('click', evaluateAnswer);

// 次の問題へボタン
elBtnNext.addEventListener('click', () => {
  pickNextQuestion();
});

// パスボタン（クリア済みにして次の問題へ）
elBtnSkip.addEventListener('click', () => {
  if (!state.isEvaluating && !state.isPassed && state.currentQuestion) {
    state.markPassed(state.currentQuestion.id);
    state.previousQuestion = { ...state.currentQuestion };
    if (state.clusterRemaining > 0) {
      state.clusterRemaining--;
    }
    if (!elProgressModal.classList.contains('hidden')) {
      renderProgressModal();
    }
    pickNextQuestion();
  }
});

// 「もう一度」ボタン
elBtnRepeat.addEventListener('click', () => {
  if (state.previousQuestion) {
    setQuestion({ ...state.previousQuestion });
  }
});

// 入力欄での Enter キー
elUserInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (state.isPassed) {
      pickNextQuestion();
    } else {
      evaluateAnswer();
    }
  }
});

// Q&A トグル
elQaToggle.addEventListener('click', () => {
  elQaContainer.classList.toggle('hidden');
  if (!elQaContainer.classList.contains('hidden')) {
    elQaInput.focus();
  }
});

// Q&A 送信ボタン
elBtnQaAsk.addEventListener('click', askQuestion);
elQaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    askQuestion();
  }
});

// 進捗バッジクリックでモーダル表示
elProgressBadge.addEventListener('click', openProgressModal);
elProgressBadge.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openProgressModal();
  }
});

// 進捗モーダルを閉じる
elBtnModalClose.addEventListener('click', closeProgressModal);
elProgressModal.addEventListener('click', (e) => {
  if (e.target === elProgressModal) {
    closeProgressModal();
  }
});

// ブックマークバッジクリックでモーダル表示
elBookmarkBadge.addEventListener('click', openBookmarkModal);
elBookmarkBadge.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openBookmarkModal();
  }
});

// ブックマークモーダルを閉じる
elBtnBookmarkModalClose.addEventListener('click', closeBookmarkModal);
elBookmarkModal.addEventListener('click', (e) => {
  if (e.target === elBookmarkModal) {
    closeBookmarkModal();
  }
});

// モーダル内の全ブックマーククリアボタン
elBtnClearBookmarks.addEventListener('click', () => {
  if (state.bookmarks.length === 0) return;
  if (confirm('保存したQ&Aブックマークをすべて削除しますか？')) {
    state.clearBookmarks();
    updateBookmarkUI();
    updateActiveQaBookmarkButtons();
    renderBookmarkModal();
  }
});

// ESCキーで開いているモーダルを閉じる
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!elProgressModal.classList.contains('hidden')) {
      closeProgressModal();
    }
    if (!elBookmarkModal.classList.contains('hidden')) {
      closeBookmarkModal();
    }
  }
});

// モーダル内のフィルタ切替
elFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentModalFilter = btn.dataset.filter || 'all';
    renderProgressModal();
  });
});

// モーダル内の進捗リセットボタン
elBtnResetProgress.addEventListener('click', () => {
  const current = state.getCompletedCount();
  const total = state.getTotalQuestionsCount();
  if (current === 0) {
    alert('現在、クリア済みの問題はありません。');
    return;
  }
  const confirmed = confirm(
    `⚠️【進捗リセットの確認】\n\n現在クリア済みの記録（${current} / ${total}問）がすべて消去され、0問に戻ります。\nこの操作は取り消せません。\n\n本当に進捗をリセットしますか？`
  );
  if (confirmed) {
    state.resetProgress();
    updateProgressUI();
    renderProgressModal();
    pickNextQuestion();
  }
});

// インフォボタン（ⓘ）のツールチップトグル
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  const infoEl = target?.closest('.ai-info');
  if (infoEl) {
    e.stopPropagation();
    const isAlreadyActive = infoEl.classList.contains('active');
    document.querySelectorAll('.ai-info.active').forEach(el => el.classList.remove('active'));
    if (!isAlreadyActive) {
      infoEl.classList.add('active');
    }
  } else {
    document.querySelectorAll('.ai-info.active').forEach(el => el.classList.remove('active'));
  }
});

// ========================================================
// データセット切替UI
// ========================================================
function initDatasetSelect(): void {
  if (!elDatasetSelect) return;
  elDatasetSelect.innerHTML = '';
  Object.values(DATASET_CONFIG).forEach(cfg => {
    const opt = document.createElement('option');
    opt.value = cfg.id;
    opt.textContent = cfg.name;
    opt.selected = (cfg.id === state.activeDatasetKey);
    elDatasetSelect.appendChild(opt);
  });

  elDatasetSelect.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    const newKey = target.value;
    if (newKey !== state.activeDatasetKey) {
      state.switchDataset(newKey);
      updateProgressUI();
      updateBookmarkUI();
      if (!elProgressModal.classList.contains('hidden')) {
        renderProgressModal();
      }
      if (!elBookmarkModal.classList.contains('hidden')) {
        renderBookmarkModal();
      }
      pickNextQuestion();
    }
  });
}

// 初期化実行
const elAppVersion = document.getElementById('app-version');
if (elAppVersion) elAppVersion.textContent = APP_VERSION;
initDatasetSelect();
initDatasetSelect();
updateBookmarkUI();
pickNextQuestion();
