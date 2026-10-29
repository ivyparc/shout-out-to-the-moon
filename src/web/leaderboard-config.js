// Public API URL only. Never put database credentials or signing keys here.
// May also be supplied with LEADERBOARD_ENDPOINT when serving/building iOS.
window.SHOUT_MOON_LEADERBOARD = window.SHOUT_MOON_LEADERBOARD || {
  endpoint: window.location?.protocol === "file:" || !window.location?.host
    ? "https://shout-moon-playtest-ivy.fancyolm1.chatgpt.site/api/leaderboard"
    : `${window.location.origin}/api/leaderboard`,
  namespace: "shout-out-to-the-moon",
  scope: "default",
};
