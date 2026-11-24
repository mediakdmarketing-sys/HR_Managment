// Mail Inbox helpers. Messages are ordered by when they were received (not when the
// server stored them), newest first; invalid or missing dates sort last.
const timeOf = (mail) => {
  const time = Date.parse(mail?.receivedAt || mail?.createdAt || "");
  return Number.isFinite(time) ? time : -Infinity;
};

export const sortMailInbox = (rows) =>
  (Array.isArray(rows) ? [...rows] : []).sort((a, b) => timeOf(b) - timeOf(a));

export const formatMailReceived = (mail) => {
  const time = timeOf(mail);
  return Number.isFinite(time) ? new Date(time).toLocaleString() : "";
};
