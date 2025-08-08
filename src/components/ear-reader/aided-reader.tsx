import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { use, useEffect } from "react";
import { store$ } from "@/frontend/observable/stores";
import { use$ } from "@legendapp/state/react";
import type { WordObj, State } from "@/lib/types/state";
import { getAsset } from "@/frontend/dexie/cached-assets";

const getRankedAudioFormat = (audioFormat: State["audioFormat"]) => {
  const audioFormats: ("mp3" | "wav" | "ogg")[] = ["wav", "mp3", "ogg"];
  if (!audioFormat) return [...audioFormats];
  const index = audioFormats.indexOf(audioFormat);
  if (index < 0) return [...audioFormats];
  return [...audioFormats.slice(index), ...audioFormats.slice(0, index)];
};

const getAudioUrlSequence = (wordObj: WordObj) => {
  const preferredAudioFormat = store$.state.audioFormat.get();
  const rankedAudioFormats = getRankedAudioFormat(preferredAudioFormat);
  return rankedAudioFormats.reduce((acc: string[], audioFormat) => {
    const audioFormatObj = wordObj.audio[audioFormat];
    if (audioFormatObj) {
      wordObj.audio.sequence.forEach((sequence, index) => {
        const url = `${audioFormatObj.base_url}/${sequence}.${audioFormat}`;
        if (!acc[index] && audioFormatObj.available[index]) acc[index] = url;
      });
    }
    return acc;
  }, []);
};

const loadAudio = async (urls: string[]) => {
  const audioAssets = urls.map((url) => {
    const audioAsset = getAsset({ url, assetType: "audio" }).then((asset) => {
      if (asset) {
        const audio = new Audio(asset.assetUrl);
        audio.load();
        return { audio, cleanup: asset.cleanup };
      }
      return null;
    });
    return audioAsset;
  });
  const audioAssetsResolved = await Promise.all(audioAssets);
  return audioAssetsResolved.filter((asset) => asset !== null);
};

export const AidedReader = () => {
  const currentWordObj = store$.state.currentWordObj.get();
  const text = currentWordObj?.word;
  const audioUrlSequence = currentWordObj
    ? getAudioUrlSequence(currentWordObj)
    : [];
  const audioAssets = use(loadAudio(audioUrlSequence));
  useEffect(() => {
    return () => {
      for (const asset of audioAssets) {
        if (asset?.cleanup) {
          asset.cleanup();
        }
      }
    };
  }, [audioAssets]);

  if (!text) return null;

  const shuffledChoices = use$(store$.state.choices.get());
  const playAudioIndex = (index: number) => {
    if (index === 0 && store$.state.isPlaying.get()) return;
    if (index === 0) store$.state.isPlaying.set(true);
    if (index >= audioAssets.length) store$.state.isPlaying.set(false);
    const audioAsset = audioAssets[index];
    if (audioAsset) {
      audioAsset.audio.onended = () => {
        playAudioIndex(index + 1);
      };
      void audioAsset.audio.play();
    }
  };

  if (!shuffledChoices) return null;

  return (
    <Tabs>
      <div>
        <TabsList className="min-w-full">
          {shuffledChoices.map((choice) => {
            return (
              <div
                className="w-[32%] rounded-lg p-1 text-center hover:bg-slate-200"
                key={choice.index}
              >
                <TabsTrigger
                  value={choice.text}
                  className="data-[state=active]:bg-mintleaf-100 text-md p-3 sm:text-xl md:text-2xl lg:text-3xl"
                  onClick={() => store$.state.choiceIndex.set(choice.index)}
                >
                  {choice.text}
                </TabsTrigger>
              </div>
            );
          })}
        </TabsList>
      </div>
      {shuffledChoices.map((choice) => {
        return (
          <TabsContent key={choice.index} value={choice.text}>
            <div className="min-w-full space-y-3 text-center">
              <div className="mx-6 mt-6 rounded-lg bg-slate-200 p-3 text-2xl font-normal sm:text-3xl md:text-4xl lg:text-5xl">
                {choice.text}
              </div>
              <p>does it match?</p>
              <Button
                onClick={() => {
                  if (!choice.correct) {
                    store$.state.isIncorrect.set(true);
                  } else {
                    playAudioIndex(0);
                  }
                }}
                className="hover:bg-mintleaf-800 w-1/2"
              >
                YES
              </Button>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
};
