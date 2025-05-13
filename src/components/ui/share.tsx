"use client";

import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { tryCatch } from "@/lib/util/try-catch";

// Define possible states for our fallback UI
type FallbackUIState =
  | "null"
  | "dialog-copied"
  | "dialog-error"
  | "display-link";

interface ShareData {
  title: string;
  text: string;
  url: string;
}

interface ShareButtonProps {
  data?: ShareData;
}

const shareData: ShareData = {
  title: "SARAs Books",
  text: "Check out SARAs Books, a great library for new readers!",
  url: "https://www.read-by-ear.com",
};

// const StyledButton = ({onClick}: StyledButtonProps) => (
//   <Button className="rounded-xl text-2xl p-4 bg-accent text-accent-foreground hover:bg-white/20 hover:text-white" onClick={onClick}>
//     Share
//   </Button>
// );

export const ShareButton = ({ data = shareData }: ShareButtonProps) => {
  // State to control which fallback UI is currently active
  const [fallbackUI, setFallbackUI] = useState<FallbackUIState | null>(null);
  // Define the URL to share
  const shareUrl = data.url;

  const StyledButton = () => (
    <Button
      className="bg-accent text-accent-foreground border-accent hover:bg-accent/20 rounded-xl border-4 p-4 text-2xl"
      onClick={share}
    >
      Share
    </Button>
  );

  const share = async () => {
    // 1. Try the Web Share API first
    if (navigator.share) {
      try {
        await navigator.share(data);
        console.log("Successful share");
        // Native share handles its own UI, reset any fallback UI state
        setFallbackUI(null);
      } catch (error) {
        console.log("Error using native share", error);
        // If native share fails, proceed to the next fallback attempt
        await tryCatch(handleClipboardOrDisplayFallback());
      }
    } else {
      // 2. If Web Share API is not available, try the Clipboard API
      await tryCatch(handleClipboardOrDisplayFallback());
    }
  };

  const handleClipboardOrDisplayFallback = async () => {
    // Check if Clipboard API is available
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        console.log("Link copied to clipboard");
        // Show a success dialog
        setFallbackUI("dialog-copied");
      } catch (error) {
        console.log("Error copying link to clipboard", error);
        // Show an error dialog
        setFallbackUI("dialog-error");
      }
    } else {
      // 3. If neither API is available or context is not secure, display the link
      console.log(
        "Neither share nor clipboard available/secure. Displaying link.",
      );
      setFallbackUI("display-link");
    }
  };

  // Determine the dialog message based on the state
  const dialogMessage =
    fallbackUI === "dialog-copied"
      ? "Link copied to clipboard!"
      : "Could not copy link.";
  const showDialog =
    fallbackUI === "dialog-copied" || fallbackUI === "dialog-error";

  // Handle closing the AlertDialog (controlled by AlertDialog's onOpenChange)
  const handleDialogClose = () => {
    setFallbackUI(null); // Reset the fallback UI state
  };

  return (
    <>
      <StyledButton />

      {/* AlertDialog for clipboard copy results */}
      <AlertDialog
        open={showDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            // Only close when the dialog is actually trying to close
            handleDialogClose();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Share Link</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>{dialogMessage}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDialogClose}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Display the link directly if necessary */}
      {fallbackUI === "display-link" && (
        // You might want to wrap this in a more styled container or another dialog/sheet
        // For simplicity, let's use an AlertDialog pattern but customize it.
        // A better UX might be a custom modal or inline display.
        // Using AlertDialog here for consistency, but conceptually it's just displaying info.
        <AlertDialog
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              handleDialogClose();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Copy Link</AlertDialogTitle>
              <AlertDialogDescription>
                Copy the link below manually:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-muted rounded-md border p-4">
              {/* Using a read-only Input component for easy selection */}
              <Input
                type="text"
                value={shareUrl}
                readOnly
                className="w-full"
                onClick={(e) => e.currentTarget.select()}
              />
            </div>
            <AlertDialogFooter>
              {/* Action button to close the display */}
              <AlertDialogAction onClick={handleDialogClose}>
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};
