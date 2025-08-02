import type { Treatment } from "./learning-record";

type AudioFormat = {
  base_url: string;
  available: boolean[];
};

type Audio = {
  sequence: string[];
  mp3: AudioFormat;
  ogg: AudioFormat;
  wav: AudioFormat;
};

export type WordObj = {
  word: string;
  slug: string;
  choices?: string[];
  audio: Audio;
  control: boolean;
  lazy_load: boolean;
  highlight: boolean;
};

export interface Reading {
  title?: string;
  byline?: string;
  reading_id?: string;
  markdown: string;
  source?: string;
  imageURL?: string;
  words: WordObj[];
}

export interface State {
  readingId?: string;
  readingStartTime?: Date;
  lastEngagementIndex?: number;
  lastEngagementTime?: Date;
  currentPage?: number;
  pageStartIndex?: number;
  pageStartTime?: Date;
  wordsPerMinute?: number;
  wordsReadThisSession?: number;
  wordsReadLifetime?: number;
  audioFormat?: "mp3" | "wav" | "ogg";
  focusIndex?: number;
  isHighlighted: boolean;
  currentWordObj?: WordObj;
  currentWord?: string;
  currentTreatment: Treatment;
  controlTreatment: Treatment;
  precedingFluencyRecord: ResponseType[];
  isEngaged: boolean; // drawer
  engagedHeading?: string;
  choices?: {
    index: number;
    text: string;
    correct: boolean;
  }[];
  choiceIndex: number | null;
  isIncorrect: boolean; // alert
  isExploding: boolean; // confetti
  isPlaying: boolean; // audio
  inputType: "touch" | "mouse" | undefined;
}
