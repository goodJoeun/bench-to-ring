import { expect, test } from "@playwright/test";
import { SCENES, open, settle } from "./scenes";

for (const [feature, scenes] of Object.entries(SCENES)) {
  test.describe(feature, () => {
    for (const scene of scenes) {
      test(scene.name, async ({ page }) => {
        await open(page, scene);
        await scene.act?.(page);
        await settle(page);
        await expect(page).toHaveScreenshot(`${feature}-${scene.name}.png`, scene.flakyPixels ? { maxDiffPixels: scene.flakyPixels } : {});
      });
    }
  });
}
