const config = {
  appId: "com.ottegi.sequenced-app",
  appName: "TidalTask",
  webDir: "dist",
  server: {
    // Passkeys require the WebView's origin to match the app's associated domain
    // (see ios/App/App/App.entitlements: webcredentials:dashboard.tidaltask.app).
    // Without this, the bundled app loads from the default capacitor://localhost
    // origin, which can never satisfy that RP ID check — every native passkey
    // call is rejected by the OS before it reaches the server.
    hostname: "dashboard.tidaltask.app",
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "icon", 
      iconColor: "#307acf",
      sound: "beep.wav",
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
