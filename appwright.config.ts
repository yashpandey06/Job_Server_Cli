import { defineConfig, Platform } from "appwright";

export default defineConfig({
  projects: [
    {
      name: "android-browserstack",
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: "browserstack",
          // Specify device to run the tests on
          // See supported devices: https://www.browserstack.com/list-of-browsers-and-platforms/app_automate
          name: "Google Pixel 8",
          osVersion: "14.0",
        },
        buildPath: "builds/WikipediaSample.apk", // Path to Wikipedia APK
      },
    },
    {
      name: "android-emulator",
      use: {
        platform: Platform.ANDROID,
        device: {
          provider: "emulator",
        },
        buildPath: "builds/WikipediaSample.apk", // Path to Wikipedia APK for local testing
      },
    },
    {
      name: "ios-browserstack",
      use: {
        platform: Platform.IOS,
        device: {
          provider: "browserstack",
          name: "iPhone 15",
          osVersion: "17.0",
        },
        buildPath: "builds/Wikipedia.app", // Path to iOS app file
      },
    },
    {
      name: "ios-emulator",
      use: {
        platform: Platform.IOS,
        device: {
          provider: "emulator",
        },
        buildPath: "builds/Wikipedia.app", // Path to iOS app file for local testing
      },
    },
  ],
});