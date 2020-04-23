import { createWorkerAddon } from "@watchedcom/sdk";
import { directoryHandler, itemHandler } from "./handlers";
const { scrapers } = require('source-scraper');
export const diziay = createWorkerAddon({
  id: "diziay.me",
  name: "diziay",
  version: "0.0.1",
  homepage: "https://diziay.me/",
  description: "Addon for diziay",
  flags: {adult: false},
  actions: ["directory", "item"],
  itemTypes: ["movie","series"],
  defaultDirectoryOptions: {
    imageShape: "regular",
    displayName: true
  },
  defaultDirectoryFeatures: {
    search: { enabled: true}
  },
  dashboards: [
    {
      id: "orderpopular",
      name: "Film: En Popüler"
    },
    {
      id: "orderimdb",
      name: "Film: IMDB Puana Göre"
    },
    {
      id: "orderyear",
      name: "Film: Yilina Göre"
    },

  ]
});


diziay.registerActionHandler("directory", directoryHandler);
diziay.registerActionHandler("item", itemHandler);

