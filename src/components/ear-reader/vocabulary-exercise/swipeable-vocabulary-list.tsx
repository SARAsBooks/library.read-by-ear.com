"use client";
import React, { useEffect } from "react";
import { SwipeableItem, type Word } from "./swipeable-item";

// Props for the vocabulary list component.
export interface SwipeableVocabularyListProps {
  words: Word[];
  onStatusChange: (
    id: number,
    status: "recognized" | "unrecognized" | "unreviewed",
  ) => void;
  drawerOpen: boolean;
  focused: boolean;
  activeIndex: number | null;
  reviewIndex: number | null;
  setReviewIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Displays a list of swipeable word items.
 * The words array is reversed so that the active word is rendered appropriately.
 */
export const SwipeableVocabularyList: React.FC<
  SwipeableVocabularyListProps
> = ({
  words,
  onStatusChange,
  drawerOpen,
  focused,
  activeIndex,
  reviewIndex,
  setReviewIndex,
}) => {
  useEffect(() => {
    if (!drawerOpen && focused && reviewIndex !== null) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setReviewIndex((prevIndex) =>
            prevIndex !== null ? Math.max(prevIndex - 1, 0) : null,
          );
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          setReviewIndex((prevIndex) =>
            prevIndex !== null
              ? Math.min(prevIndex + 1, words.length - 1)
              : null,
          );
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [focused, reviewIndex, setReviewIndex, words.length, drawerOpen]);

  return (
    <div className="space-y-2">
      {words
        .slice()
        .reverse()
        .map((word, index) =>
          activeIndex !== null && index > words.length - activeIndex - 1 ? (
            <SwipeableItem
              key={word.id}
              word={word}
              onStatusChange={onStatusChange}
              drawerOpen={drawerOpen}
              isFocused={reviewIndex === index}
              onFocus={() => setReviewIndex(index)}
              index={index}
              ref={null}
            />
          ) : null,
        )}
    </div>
  );
};
