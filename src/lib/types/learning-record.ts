import type { ResponseId, ActionId } from "./fluency-record";

export interface LearningRecord {
  version: "0.1.0";
  reader_id: string;
  session_id: string;
  session_start_time?: Date; // Start time of the session
  records: LearningRecordEntry[];
}

export interface LearningRecordEntry {
  created_at: Date;
  prediction?: ResponseId;
  response: ResponseId;
  action_id: ActionId;
  word_in_reading?: [number, string];
  word_as_string?: string;
  treatment_id: TreatmentId;
  context?: LearningRecordContext;
}

export interface LearningRecordContext {
  word?: string;
  response: ResponseId;
  prediction?: [ResponseId, number?];
  action_id: ActionId;
  treatment_id: TreatmentId;
  reader_id: string;
  session_id: string;
  session_start_time?: Date;
  created_at: Date;
  page_start_time?: Date; // Start time of the page
  reading_rate?: number;
  target_fluency_record?: ResponseId[];
  preceding_fluency_record?: ResponseId[];
  choices_presented?: string[];
  incorrect_matches?: string[];
  utc_offset?: number; // UTC offset in hours
}

/**
 * Enum representing different treatment types used in the learning system.
 *
 * - **None**: No interaction or intervention applied.
 * - **AidedReading**: Provides audio playback of the word without visual
 *   combinatorial emphasis.
 * - **DrawerMatch**: Uses a drawer UI element to present matching options,
 *   including one correct word and distractor options generated through
 *   character frequency patterns.
 * - **PopoverMatch**: Similar to DrawerMatch but uses a popover UI when
 *   words are clicked.
 * - **DynamicKeying**: Utilizes an adaptive on-screen keyboard that adjusts
 *   available letters to reduce cognitive load.
 * - **QwertyKeying**: Requires users to type the word on a standard keyboard
 *   layout.
 * - **UnitBridging**: Displays the target word alongside related words from
 *   the student's established sight vocabulary that share units (e.g.,
 *   morphemes, onsets, rimes, or blends). This treatment emphasizes the
 *   combinatorial structure of language by showing how the same units appear
 *   across already-mastered words, helping learners recognize patterns and
 *   develop orthographic awareness through familiar structural similarities.
 */
export enum Treatment {
  None = "no_intervention",
  AidedReading = "aided_reading_v1.0",
  DrawerMatch = "word_match_drawer_v1.0",
  PopoverMatch = "popover_match_v1.0",
  DynamicKeying = "dynamic_keying_v1.0",
  QwertyKeying = "qwerty_keying_v1.0",
  UnitBridging = "unit_bridging_v1.0",
}

enum TreatmentId {
  AidedReading = "1a70ac1a-eede-4f8b-90ad-95e17ffdb2c8",
  DrawerMatch = "b81c3df9-8e55-42f4-8577-ab3755469741",
  PopoverMatch = "41f0b448-c7ff-45cd-88ac-0013fb22bc21",
  DynamicKeying = "37ceb4d9-f7c3-4205-9e11-bb8834a0f528",
  QwertyKeying = "80f14f9c-89c5-4dd9-bcef-910956a0114a",
  UnitBridging = "db687397-9e64-4534-9024-22895fd839c4",
}

export const TreatmentTypeToId = {
  [Treatment.None]: null,
  [Treatment.AidedReading]: TreatmentId.AidedReading,
  [Treatment.DrawerMatch]: TreatmentId.DrawerMatch,
  [Treatment.PopoverMatch]: TreatmentId.PopoverMatch,
  [Treatment.DynamicKeying]: TreatmentId.DynamicKeying,
  [Treatment.QwertyKeying]: TreatmentId.QwertyKeying,
  [Treatment.UnitBridging]: TreatmentId.UnitBridging,
};
