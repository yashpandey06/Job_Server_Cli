import { test, expect } from "appwright";

test("Wikipedia search for Playwright and verify Microsoft", async ({ device }) => {
  try {
    await device.getByText("Skip").tap({ timeout: 3000 });
  } catch (e) {
    console.log('No splash screen found');
  }

  const searchInput = device.getByText("Search Wikipedia", { exact: true });
  await searchInput.tap();
  await searchInput.fill("playwright");

  await device.getByText("Playwright (software)").tap();
  await expect(device.getByText("Microsoft")).toBeVisible();
});

test("Wikipedia main navigation", async ({ device }) => {
  try {
    await device.getByText("Skip").tap({ timeout: 2000 });
  } catch (e) {
    // Continue if no splash
  }

  await expect(device.getByText("Featured")).toBeVisible();
  await expect(device.getByText("History")).toBeVisible();
  await expect(device.getByText("Nearby")).toBeVisible();

  await device.getByText("History").tap();
  await expect(device.getByText("Recently viewed")).toBeVisible();
});
