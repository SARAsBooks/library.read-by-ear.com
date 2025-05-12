"use client";

import { observable } from "@legendapp/state";
import {
  Treatment,
  type LearningRecordEntry,
} from "@/lib/types/learning-record";
import type { State } from "@/lib/types/state";

interface Store {
  sessionId: string | null;
  sessionStartTime: Date;
  learningRecords: LearningRecordEntry[];
  state: State;
}

export const store$ = observable<Store>({
  sessionId: null,
  sessionStartTime: new Date(),
  learningRecords: [],
  state: {
    isHighlighted: false,
    currentTreatment: Treatment.DrawerMatch,
    controlTreatment: Treatment.AidedReading,
    precedingFluencyRecord: [],
    isEngaged: false,
    choiceIndex: null,
    isIncorrect: false,
    isExploding: false,
    isPlaying: false,
    inputType: "touch",
  },
});
