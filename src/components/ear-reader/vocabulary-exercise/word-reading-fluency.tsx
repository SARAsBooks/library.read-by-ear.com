"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { SwipeableItem, type Word } from "./swipeable-item";
import {
  Pagination,
  PaginationContent,
  PaginationNext,
} from "@/components/ui/pagination";

// Props for the word reading fluency component.
export interface WordReadingFluencyProps {
  words: Word[];
  onStatusChange: (
    id: number,
    status: "recognized" | "unrecognized" | "unreviewed",
  ) => void;
  drawerOpen: boolean;
  markDisfluency: (index: number | null) => void;
  activeIndex: number | null;
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

const REVIEW_DURATION = 3000; // Duration (in milliseconds) before a word is marked as unrecognized

/**
 * Handles the fluency testing of words.
 * Starts a timer for each active word and automatically advances when the word is marked recognized.
 */
export const WordReadingFluency: React.FC<WordReadingFluencyProps> = ({
  words,
  onStatusChange,
  drawerOpen,
  markDisfluency,
  activeIndex,
  setActiveIndex,
}) => {
  const [timerExpired, setTimerExpired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null); // Ref for the active SwipeableItem

  // Restart the timer for the active word.
  const startFluencyTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      markDisfluency(activeIndex);
      setTimerExpired(true);
    }, REVIEW_DURATION);
  }, [activeIndex, markDisfluency]);

  useEffect(() => {
    startFluencyTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startFluencyTimer]);

  // Advances to the next word.
  const advanceToNextWord = useCallback(() => {
    setActiveIndex((prevIndex) => (prevIndex !== null ? prevIndex + 1 : null));
    setTimerExpired(false);
    startFluencyTimer();
  }, [setActiveIndex, startFluencyTimer]);

  useEffect(() => {
    if (
      activeIndex !== null &&
      activeIndex < words.length &&
      words[activeIndex]?.status === "recognized" &&
      !timerExpired
    ) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTimeout(() => {
        advanceToNextWord();
      }, 300);
    }
  }, [activeIndex, words, timerExpired, advanceToNextWord]);

  // Focus the active SwipeableItem when the activeIndex changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.focus();
    }
  }, [activeIndex]);

  // Listen for the space bar to manually advance when the timer has expired.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !drawerOpen &&
        timerExpired &&
        activeIndex !== null &&
        activeIndex < words.length &&
        e.key === " "
      ) {
        e.preventDefault();
        advanceToNextWord();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, words.length, timerExpired, advanceToNextWord, drawerOpen]);

  return (
    <>
      {activeIndex !== null && activeIndex < words.length && (
        <div className="mb-8 rounded-lg bg-blue-200 p-4">
          <SwipeableItem
            word={words[activeIndex]!}
            onStatusChange={onStatusChange}
            drawerOpen={drawerOpen}
            isFocused={true}
            onFocus={() => null}
            index={activeIndex}
            ref={activeItemRef}
          />
          <div className="mt-4">
            {timerExpired && activeIndex < words.length ? (
              <Pagination>
                <PaginationContent>
                  <PaginationNext onClick={advanceToNextWord}>
                    Next
                  </PaginationNext>
                </PaginationContent>
              </Pagination>
            ) : (
              <div className="mx-auto animate-pulse text-center text-slate-500">
                building fluency...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
