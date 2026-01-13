// services/admins.js
export const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
