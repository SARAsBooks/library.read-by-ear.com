import { describe, it, expect } from "vitest";
import { GetActionId } from "./learning-record-action";
import { ResponseId, ActionId } from "@/lib/types/fluency-record";

const R = ResponseId.Recognition;
const I = ResponseId.Identification;

describe("GetActionId", () => {
  it("handles empty and single-element records", () => {
    expect(GetActionId({ record: [] })).toBeNull();
    expect(GetActionId({ record: [R] })).toBe(ActionId.UnknownToInitial);
    expect(GetActionId({ record: [I] })).toBe(ActionId.UnknownToDeveloping);
  });

  it("detects strong and learned windows", () => {
    // Learned window: last 3 recognitions flips from developing -> learned
    expect(GetActionId({ record: [R, R, R] })).toBe(
      ActionId.DevelopingToLearned,
    );
    // Strong window: last 5 recognitions flips from learned -> strong
    expect(GetActionId({ record: [R, R, R, R, R] })).toBe(
      ActionId.LearnedToStrong,
    );
  });

  it("progresses and regresses according to rules", () => {
    expect(GetActionId({ record: [R, I] })).toBe(ActionId.InitialToDeveloping);
    expect(GetActionId({ record: [R, R] })).toBe(ActionId.InitialToStrong);
  });
});
