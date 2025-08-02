"use client";
import React, { useState, useEffect, useCallback } from "react";
import { SwipeableVocabularyList } from "./swipeable-vocabulary-list";
import { WordReadingFluency } from "./word-reading-fluency";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

// Define types for words.
export interface Word {
  id: number;
  text: string;
  slug: string;
  status?: "unreviewed" | "recognized" | "unrecognized";
}

export type WordListItem = {
  id: number;
  text: string;
  slug: string;
};

// Props for the main exercise component.
export interface SightVocabularyExerciseProps {
  words: WordListItem[];
  onEngageWRF: (word: WordListItem) => void;
  drawerOpen: boolean;
  onComplete: (results: Word[]) => void;
}

// Hook to detect input type.
const useInputType = (): "touch" | "mouse" => {
  const [inputType, setInputType] = useState<"touch" | "mouse">("mouse");

  useEffect(() => {
    const hasHover = window.matchMedia("(hover: hover)").matches;
    setInputType(hasHover ? "mouse" : "touch");

    const touchStartHandler = () => setInputType("touch");
    const mouseMoveHandler = () => setInputType("mouse");

    window.addEventListener("touchstart", touchStartHandler);
    window.addEventListener("mousemove", mouseMoveHandler);

    return () => {
      window.removeEventListener("touchstart", touchStartHandler);
      window.removeEventListener("mousemove", mouseMoveHandler);
    };
  }, []);

  return inputType;
};

// Tutorial component providing user instructions.
const InteractionTutorial: React.FC<{ inputType: "touch" | "mouse" }> = ({
  inputType,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm"
      role="status"
      aria-live="polite"
    >
      {inputType === "touch" ? (
        <div className="flex items-center">
          <div className="mr-2">
            <div className="relative flex h-8 w-16 items-center justify-center rounded-lg bg-gray-200">
              <div className="animate-pulse-horizontal absolute h-4 w-4 rounded-full bg-white"></div>
            </div>
          </div>
          <div>
            <strong>Swipe right</strong> on words you recognize,{" "}
            <strong>swipe left</strong> on words you don’t.
          </div>
        </div>
      ) : (
        <div className="flex items-center">
          <div className="mr-2">
            <div className="relative flex h-8 w-16 items-center justify-center rounded-lg bg-gray-200">
              <div className="h-4 w-4 rounded-full bg-white"></div>
              <ArrowRight className="absolute right-2 h-4 w-4 animate-pulse text-green-500" />
              <ArrowLeft className="absolute left-2 h-4 w-4 animate-pulse text-red-500" />
            </div>
          </div>
          <div>
            <strong>Hover</strong> over words to reveal actions, or use{" "}
            <strong>arrow keys</strong> to navigate and <strong>Space</strong>{" "}
            for Next &gt;
          </div>
        </div>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="mt-2 text-xs text-blue-600 hover:underline"
        aria-label="Dismiss tutorial"
      >
        Got it
      </button>
    </div>
  );
};

/**
 * The main exercise component.
 * Manages the word list, progress, and switching between fluency and review modes.
 */
export const SightVocabularyExercise: React.FC<
  SightVocabularyExerciseProps
> = ({ words, onEngageWRF, drawerOpen, onComplete }) => {
  const inputType = useInputType();
  const [focusMode, setFocusMode] = useState<"fluency" | "review">("fluency");
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  // Initialize word list state with all words set to "unreviewed".
  const [wordList, setWordList] = useState<Word[]>(() =>
    words.map((word) => ({
      ...word,
      status: "unreviewed",
    })),
  );

  // Update the status of a word and trigger engagement if necessary.
  const handleStatusChange = useCallback(
    (id: number, newStatus: "recognized" | "unrecognized" | "unreviewed") => {
      if (newStatus === "unrecognized") {
        const selectedWord = wordList.find((w) => w.id === id);
        if (selectedWord) {
          onEngageWRF({
            id: selectedWord.id,
            text: selectedWord.text,
            slug: selectedWord.slug,
          });
        }
      }
      setWordList((prevWords) =>
        prevWords.map((w) => (w.id === id ? { ...w, status: newStatus } : w)),
      );
    },
    [wordList, onEngageWRF],
  );

  // Mark a word as unrecognized if it remains unreviewed after the review timeout.
  const markDisfluency = useCallback(
    (index: number | null) => {
      if (index === null || index < 0 || index >= wordList.length) return;
      if (wordList[index]?.status === "unreviewed") {
        handleStatusChange(wordList[index].id, "unrecognized");
      }
    },
    [handleStatusChange, wordList],
  );

  // Switch to review mode when all words have been processed in fluency mode.
  useEffect(() => {
    if (activeIndex !== null && activeIndex >= wordList.length) {
      setFocusMode("review");
      setReviewIndex(0);
    }
  }, [activeIndex, wordList.length]);

  // Calculate review progress.
  const reviewedCount = wordList.filter(
    (w) => w.status !== "unreviewed",
  ).length;
  const progressPercentage = (reviewedCount / wordList.length) * 100;

  // Reset all words to their initial state.
  const resetAllWords = () => {
    setWordList((prevWords) =>
      prevWords.map((w) => ({ ...w, status: "unreviewed" })),
    );
    setActiveIndex(0);
    setReviewIndex(null);
    setFocusMode("fluency");
  };

  return (
    <div
      className="mx-auto w-full p-4 sm:max-w-md md:max-w-lg lg:max-w-xl"
      role="region"
      aria-label="Vocabulary review list"
    >
      <InteractionTutorial inputType={inputType} />
      <div className="sr-only" aria-live="polite">
        Use up and down arrow keys to navigate between words. Use left and right
        arrow keys to mark words as recognized or not recognized.
      </div>
      {/* Progress bar */}
      <div
        className="mb-6 h-2.5 w-full rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={progressPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${reviewedCount} of ${wordList.length} words reviewed`}
      >
        <div
          className="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      {wordList.every((w) => w.status !== "unreviewed") &&
      activeIndex &&
      activeIndex >= wordList.length ? (
        <Button
          onClick={() => onComplete(wordList)}
          className="mb-8 h-32 w-full border-2 border-slate-500 bg-blue-200 text-3xl text-slate-700 hover:bg-blue-400"
          aria-label="Continue"
        >
          Continue
        </Button>
      ) : (
        <>
          <p className="mb-4 text-center text-gray-500 italic">
            {inputType === "touch"
              ? "Swipe right on words you recognize, left to build fluency"
              : "Use the right arrow key to skip the words you know, left to build fluency"}
          </p>
          <WordReadingFluency
            words={wordList}
            onStatusChange={handleStatusChange}
            drawerOpen={drawerOpen}
            markDisfluency={markDisfluency}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
          />
        </>
      )}
      <SwipeableVocabularyList
        words={wordList}
        onStatusChange={handleStatusChange}
        drawerOpen={drawerOpen}
        focused={focusMode === "review"}
        activeIndex={activeIndex}
        reviewIndex={reviewIndex}
        setReviewIndex={setReviewIndex}
      />
      <div className="mt-6 flex flex-col space-y-3" aria-live="polite">
        {reviewedCount > 0 && (
          <Button
            variant="outline"
            onClick={resetAllWords}
            className="w-full"
            aria-label="Reset all words"
          >
            Reset All
          </Button>
        )}
      </div>
    </div>
  );
};

export default SightVocabularyExercise;
