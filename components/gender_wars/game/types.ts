export type ArticleMode = 'de' | 'het';

export interface GameStats {
  score: number;
  missed: { word: string; article: string }[];
  victory?: boolean;
}

export interface WordData {
  word: string;
  article: ArticleMode;
  dim: string;
  plural: string;
  level: number;
  boss: boolean;
  english: string;
}
