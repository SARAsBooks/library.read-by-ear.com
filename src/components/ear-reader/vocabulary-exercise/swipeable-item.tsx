"use client";
import React, { useRef, useEffect, useState, forwardRef } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { store$ } from "@/frontend/observable/stores";
import { use$ } from "@legendapp/state/react";

// Define the type for a word item.
export type Word = {
  id: number;
  text: string;
  slug: string;
  status?: "unreviewed" | "recognized" | "unrecognized";
};

// Props for the swipeable item components.
export interface SwipeableItemProps {
  word: Word;
  onStatusChange: (
    id: number,
    newStatus: "recognized" | "unrecognized" | "unreviewed",
  ) => void;
  drawerOpen: boolean;
  isFocused: boolean;
  onFocus: () => void;
  index: number;
  ref: React.Ref<HTMLDivElement> | null; // Ref for the carousel item
}

const SWIPE_THRESHOLD = 100; // Minimum drag distance (in pixels) to trigger a swipe action

/**
 * The inner component that implements pointer events and UI.
 * It uses the carousel context (via useCarousel) so it must be rendered as a child of <Carousel>.
 */
export const SwipeableItemContent = forwardRef<
  HTMLDivElement,
  SwipeableItemProps
>(({ word, onStatusChange, drawerOpen, isFocused, onFocus, index }, ref) => {
  const { api } = useCarousel();
  const dragDistance = useRef(0);
  const startX = useRef(0);
  const itemRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  const inputType = use$(store$.state.inputType.get());

  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.focus();
    }
  }, [isFocused]);

  // Setup pointer event listeners on the carousel container.
  useEffect(() => {
    if (!api) return;

    const handlePointerDown = (e: PointerEvent) => {
      startX.current = e.clientX;
      dragDistance.current = 0;
    };

    const handlePointerUp = (e: PointerEvent) => {
      dragDistance.current = e.clientX - startX.current;
      if (dragDistance.current > SWIPE_THRESHOLD) {
        onStatusChange(word.id, "recognized");
      } else if (dragDistance.current < -SWIPE_THRESHOLD) {
        onStatusChange(word.id, "unrecognized");
      }
      dragDistance.current = 0;
    };

    const container = api.containerNode();
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointerup", handlePointerUp);

    // Cleanup event listeners on component unmount.
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointerup", handlePointerUp);
    };
  }, [api, onStatusChange, word.id]);

  // Returns a background style string based on the word status.
  const getBackgroundStyle = () => {
    switch (word.status) {
      case "recognized":
        return "bg-green-100 border-green-300";
      case "unrecognized":
        return "bg-slate-200 border-red-200";
      default:
        return "bg-white border-gray-200";
    }
  };

  // Keyboard event handler to allow arrow-key marking.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (drawerOpen) return; // Ignore key events if the drawer is open
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onStatusChange(word.id, "recognized");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onStatusChange(word.id, "unrecognized");
    }
  };

  return (
    <div
      className={`relative mb-4 w-full overflow-hidden transition-all duration-150 ${
        isFocused ? "rounded-lg ring-2 ring-blue-400" : ""
      }`}
      onClick={onFocus}
      ref={(ref as React.RefObject<HTMLDivElement>) || itemRef} // Use the forwarded ref here
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      aria-label={`Word: ${word.text}, status: ${word.status}. Use right arrow to mark as recognized, left arrow to mark as not recognized.`}
      data-index={index}
    >
      {/* Background success indicator */}
      <div
        className="absolute inset-0 left-0 flex w-1/2 items-center rounded-lg bg-green-500 px-6"
        aria-hidden="true"
      >
        <Check className="h-8 w-8 text-white" />
      </div>

      {/* Background failure indicator */}
      <div
        className="absolute inset-0 left-1/2 flex w-1/2 items-center justify-end rounded-lg bg-slate-500 px-6"
        aria-hidden="true"
      >
        <X className="h-8 w-8 text-white" />
      </div>
      <CarouselContent>
        <CarouselItem>
          <div
            className={`relative rounded-lg border-2 p-6 shadow-sm ${getBackgroundStyle()} flex items-center justify-between transition-all duration-200`}
          >
            {/* Left indicator icon */}
            {inputType === "touch" && (
              <div
                className="absolute left-6"
                onClick={() => onStatusChange(word.id, "unrecognized")}
                aria-hidden="true"
              >
                <X className="h-6 w-6 text-red-500" />
              </div>
            )}
            {/* Action buttons for mouse users */}
            {inputType === "mouse" && isHovering && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute left-2 border-red-300 bg-white text-red-500 hover:bg-red-50"
                  onClick={() => onStatusChange(word.id, "unrecognized")}
                  aria-label="Mark as not recognized"
                >
                  <X className="mr-1 h-4 w-4" /> Don’t Know
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-2 border-green-300 bg-white text-green-500 hover:bg-green-50"
                  onClick={() => onStatusChange(word.id, "recognized")}
                  aria-label="Mark as recognized"
                >
                  Know <Check className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
            {/* Main word display */}
            <div className="w-full text-center">
              <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
                {word.text}
              </h3>
            </div>
            {/* Right indicator icon */}
            {inputType === "touch" && (
              <div
                className="absolute right-6"
                onClick={() => onStatusChange(word.id, "recognized")}
                aria-hidden="true"
              >
                <Check className="h-6 w-6 text-green-500" />
              </div>
            )}
            {/* Reset control if word has been reviewed */}
            {word.status !== "unreviewed" && (
              <div
                className="absolute top-3 right-3 cursor-pointer rounded-full bg-white p-1 shadow-sm"
                onClick={() => onStatusChange(word.id, "unreviewed")}
                aria-label="Reset status"
                role="button"
              >
                <X className="h-4 w-4 text-gray-500" />
              </div>
            )}
          </div>
        </CarouselItem>
      </CarouselContent>
    </div>
  );
});

SwipeableItemContent.displayName = "SwipeableItemContent";

/**
 * Outer component that wraps the inner content with a <Carousel> provider.
 * This ensures that useCarousel is called only in a child of <Carousel>.
 */
export const SwipeableItem: React.FC<SwipeableItemProps> = (props) => {
  return (
    <Carousel>
      <SwipeableItemContent {...props} />
    </Carousel>
  );
};
