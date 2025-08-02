"use client";
import { AidedReader } from "./aided-reader";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import Markdown from "react-markdown";
import { store$ } from "@/frontend/observable/stores";
import { use$ } from "@legendapp/state/react";


export const AideDrawer = () => {
  const isEngaged = use$(store$.state.isEngaged.get());
  const currentWord = use$(store$.state.currentWord.get());
  return (
    <Drawer open={isEngaged} onClose={() => store$.state.isEngaged.set(false)}>
      <DrawerContent>
        <div className="mx-auto flex min-h-[75vh] w-full max-w-sm flex-col justify-between sm:max-w-md md:max-w-lg lg:max-w-xl">
          <DrawerHeader>
            <DrawerTitle className="mb-3 rounded-lg bg-slate-200 p-3 text-center text-[24pt] font-normal sm:text-3xl md:text-4xl lg:text-5xl">
              <Markdown>{currentWord}</Markdown>
            </DrawerTitle>
          </DrawerHeader>
          <AidedReader key={currentWord} />
          <DrawerFooter>
            <div id="waveform"></div>
            {isEngaged && (
              <div className="min-w-full pb-5 text-center">
                {/* <Button className='w-1/2 bg-mintleaf-400 hover:bg-mintleaf-600' onClick={sayIt}>
                                say it
                            </Button> */}
              </div>
            )}
            <DrawerClose asChild>
              <Button
                onClick={() => store$.state.isEngaged.set(false)}
                variant="outline"
              >
                EXIT
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
