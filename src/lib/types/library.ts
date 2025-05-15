export interface Bookmark {
  readingId: string;
  currentPage: number;
  lastupdate: Date;
  completed?: boolean;
  stars?: number;
}

export interface Library {
  studentId: string | undefined;
  bookmarks: Bookmark[]; // synced to the server
  library: string[]; // requested from corpus.sara.ai
  resumeReadings?: string[]; // requested from corpus.sara.ai
  clientOptions?: undefined; // future use, TODO: sync to the server
}
