// Public API URL only. Never put database credentials or signing keys here.
// May also be supplied with LEADERBOARD_ENDPOINT when serving/building iOS.
const nativeMoonClient = window.location?.protocol === "file:" || !window.location?.host;
window.SHOUT_MOON_LEADERBOARD = window.SHOUT_MOON_LEADERBOARD || {
  // Installed clients keep their original identity and pending-flight keys.
  storageEndpoint: nativeMoonClient ? "https://shout-moon-playtest-ivy.fancyolm1.chatgpt.site/api/leaderboard" : undefined,
  endpoint: nativeMoonClient
    ? "https://shout-moon-playtest-ivy.kang12365111075.chatgpt.site/api/leaderboard"
    : `${window.location.origin}/api/leaderboard`,
  namespace: "shout-out-to-the-moon",
  scope: "default",
};
