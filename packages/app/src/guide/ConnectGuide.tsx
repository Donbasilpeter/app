import { type FC } from "react";
import { BaseGuide } from "./BaseGuide";
import { type GuideEntryProps } from "./GuideEntry";

const entries: GuideEntryProps[] = [
  {
    image: "guide/connect/1.png",
    children: <>Hello world!</>,
  },
  {
    image: "guide/connect/2.png",
    children: <>Hello world!</>,
  },
  {
    image: "guide/connect/3.png",
    children: <>Hello world!</>,
  },
];

export const ConnectGuide: FC = () => {
  return <BaseGuide entries={entries} />;
};
