export interface FluencyRecord {
  id?: number;
  studentId: string;
  word: string;
  response: ResponseId;
  timestamp: Date;
}

export interface TrackedFluencyRecord extends FluencyRecord {
  origin: "local" | "remote";
  synced: boolean;
}

export enum ResponseId {
  // True for recognition, false for identification
  Identification = 0,
  Recognition = 1,
}

export enum WordReadingFluencyEnum {
  Unknown = 0,
  Initial = 1,
  Strong = 2,
  Learned = 3,
  Developing = 4,
  Predicted = 5,
}

export enum ActionId {
  UnknownToDeveloping = 0,
  UnknownToInitial = 1,
  PredictedToDeveloping = 2,
  PredictedToInitial = 3,
  InitialToStrong = 4,
  LearnedToStrong = 5,
  DevelopingToLearned = 6,
  InitialToDeveloping = 7,
  LearnedToDeveloping = 8,
  StrongToDeveloping = 9,
  DevelopingToDeveloping = 10,
  LearnedToLearned = 11,
  StrongToStrong = 12,
}
