import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { store$ } from "@/frontend/observable/stores";
import { use$ } from "@legendapp/state/react";

export const IncorrectAlert = () => {
  const index = store$.state.choiceIndex.get();
  if (!index) return null;
  const choice = store$.state.choices.get()?.[index];
  if (!choice || choice.correct) return null;
  const currentChoice = choice.text;
  const text = store$.state.currentWordObj.word.get();
  if (!text || !currentChoice) return null;
  const isIncorrect = use$(store$.state.isIncorrect.get());

  const match = text.match(/\*\*(.+)\*\*/g);
  const currentWord = match ? match[0].replace(/\*\*/g, "") : text;

  return (
    <AlertDialog open={isIncorrect}>
      <AlertDialogContent className="bg-red-200">
        <AlertDialogHeader className="text-slate-500">
          <AlertDialogTitle>Try again</AlertDialogTitle>
          <AlertDialogDescription className="text-3xl text-slate-700">
            - {currentWord} - is not the same as - {currentChoice} -
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => store$.state.isIncorrect.set(false)}
          >
            exit
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
