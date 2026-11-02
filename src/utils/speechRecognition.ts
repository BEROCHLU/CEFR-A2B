interface RecognitionResult {
  readonly [index: number]: { transcript: string };
}

export interface PhraseRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => PhraseRecognition;

// ブラウザ対応判定と API 取得
export function getSpeechRecognition() {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

// 安全な停止（リスナーを外してから中断してゾンビイベントを防ぐ）
export function abortRecognition(recognition: PhraseRecognition | null) {
  if (!recognition) return;
  recognition.onresult = null;
  recognition.onend = null;
  recognition.onerror = null;
  recognition.abort();
}

// エラーメッセージの日本語マッピング
export function recognitionErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'マイクの使用が許可されていません。ブラウザのアドレスバーからマイク権限を許可してください。';
    case 'audio-capture':
      return 'マイクが見つかりません。マイクの接続設定を確認してください。';
    case 'network':
      return '音声認識サービスに接続できません。ネットワーク接続を確認してください。';
    case 'language-not-supported':
      return '指定された言語の音声認識に対応していません。';
    case 'no-speech':
      return '音声を聞き取れませんでした。もう一度マイクを押して話してください。';
    case 'aborted':
      return '音声認識が中断されました。';
    default:
      return '音声認識の開始に失敗しました。';
  }
}

// LCS（最長共通部分列）による単語一致判定とスコア算出
export function comparePhrase(targetText: string, spokenText: string) {
  const cleanWord = (word: string) =>
    word.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

  const targetWords = targetText.trim().split(/\s+/).filter(w => cleanWord(w));
  const spokenWords = spokenText.trim().split(/\s+/).map(cleanWord).filter(Boolean);
  const target = targetWords.map(cleanWord);

  const lengths = Array.from({ length: target.length + 1 }, () =>
    Array<number>(spokenWords.length + 1).fill(0)
  );

  for (let i = 1; i <= target.length; i++) {
    for (let j = 1; j <= spokenWords.length; j++) {
      lengths[i][j] = target[i - 1] === spokenWords[j - 1]
        ? lengths[i - 1][j - 1] + 1
        : Math.max(lengths[i - 1][j], lengths[i][j - 1]);
    }
  }

  const matchedWords = targetWords.map(word => ({ word, isMatched: false }));
  let i = target.length;
  let j = spokenWords.length;
  while (i > 0 && j > 0) {
    if (target[i - 1] === spokenWords[j - 1]) {
      matchedWords[i - 1].isMatched = true;
      i--;
      j--;
    } else if (lengths[i - 1][j] >= lengths[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const total = Math.max(target.length, spokenWords.length);
  return {
    matchedWords,
    score: total === 0 ? 0 : Math.round((lengths[target.length][spokenWords.length] / total) * 100),
  };
}
