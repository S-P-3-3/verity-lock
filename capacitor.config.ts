import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.sp3.lock",
  appName: "sp3 Lock",
  webDir: "dist",
  android: {
    backgroundColor: "#141c2a",
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#2db85a", // grüne Statusbar wie Mullvad
      overlaysWebView: false,
    },
  },
};

export default config;
