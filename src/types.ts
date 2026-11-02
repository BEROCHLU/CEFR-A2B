export interface PhraseItem {
  id: number;
  text: string;
  answer: string;
  answers?: string[];
}

export interface CategoryGroup {
  category: string;
  items: PhraseItem[];
}

export interface FlattenedQuestion {
  id: number;
  category: string;
  text: string;
  answer: string;
  answers?: string[];
  datasetKey?: string;
}

export interface DatasetConfigItem {
  id: string;
  name: string;
  shortName: string;
  data: CategoryGroup[];
}

export interface EvaluationResult {
  status: 'correct' | 'accepted' | 'retry' | 'incorrect' | 'skipped' | 'error';
  feedback?: string;
  modelAnswer?: string;
  altAnswer?: string;
  model?: string;
  thinkingLevel?: string;
  userNormalized?: string;
}

export interface BookmarkItem {
  id: string;
  questionId: number | string;
  category: string;
  japanese: string;
  userEnglish: string;
  userQuestion: string;
  aiAnswer: string;
  model?: string;
  thinkingLevel?: string;
  createdAt: number;
  datasetKey?: string;
}

export interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
}
