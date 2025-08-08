import {
  ActionId,
  ResponseId,
  WordReadingFluencyEnum,
} from "@/lib/types/fluency-record";

export const MIN_STRONG_WINDOW = 5;
export const MIN_LEARNED_WINDOW = 3;

export const GetActionId = ({
  record,
}: {
  record: ResponseId[];
}): ActionId | null => {
  if (record.length < 1) return null;
  if (record.length === 1)
    return record[0] === ResponseId.Recognition
      ? ActionId.UnknownToInitial
      : ActionId.UnknownToDeveloping;
  if (record.length === 2 && record[0] === ResponseId.Recognition)
    return record[1] === ResponseId.Recognition
      ? ActionId.InitialToStrong
      : ActionId.InitialToDeveloping;

  const levels = (rec: ResponseId[]): [boolean, boolean, boolean] => {
    const strong =
      rec.length >= MIN_STRONG_WINDOW &&
      rec.slice(-MIN_STRONG_WINDOW).every((r) => r === ResponseId.Recognition);
    const learned =
      !strong &&
      rec.length >= MIN_LEARNED_WINDOW &&
      rec.slice(-MIN_LEARNED_WINDOW).every((r) => r === ResponseId.Recognition);
    const developing = !strong && !learned && rec.length > 0;
    return [strong, learned, developing];
  };

  const lastRecord = record.slice(0, -1);
  const [lastStrong, lastLearned, lastDeveloping] = levels(lastRecord);
  const [currentStrong, currentLearned, currentDeveloping] = levels(record);

  switch (true) {
    case lastStrong && currentStrong:
      return ActionId.StrongToStrong;
    case lastStrong && !currentStrong:
      return ActionId.StrongToDeveloping;
    case lastLearned && currentStrong:
      return ActionId.LearnedToStrong;
    case lastLearned && currentLearned:
      return ActionId.LearnedToLearned;
    case lastLearned && currentDeveloping:
      return ActionId.LearnedToDeveloping;
    case lastDeveloping && currentLearned:
      return ActionId.DevelopingToLearned;
    case lastDeveloping && currentDeveloping:
      return ActionId.DevelopingToDeveloping;
  }
  return ActionId.UnknownToDeveloping;
};

export const getWordReadingFluencyLevel = (
  target_fluency_record: ResponseId[],
): WordReadingFluencyEnum => {
  if (!target_fluency_record.length) return WordReadingFluencyEnum.Unknown;
  const actionId = GetActionId({ record: target_fluency_record });
  switch (actionId) {
    case ActionId.UnknownToInitial:
    case ActionId.PredictedToInitial:
      return WordReadingFluencyEnum.Initial;
    case ActionId.LearnedToLearned:
    case ActionId.DevelopingToLearned:
      return WordReadingFluencyEnum.Learned;
    case ActionId.InitialToStrong:
    case ActionId.LearnedToStrong:
    case ActionId.StrongToStrong:
      return WordReadingFluencyEnum.Strong;
  }
  return WordReadingFluencyEnum.Developing;
};
