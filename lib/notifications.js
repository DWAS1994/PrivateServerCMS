// Helper for creating notifications. Other code calls these functions instead
// of writing to the Notification table directly, so we can change behavior in
// one place (e.g. push to a websocket later, send emails for important ones).
import { prisma } from "./prisma";

/**
 * Notify a single user.
 * @param {{ userId: number, type?: string, title: string, body?: string, link?: string }} opts
 */
export async function notifyUser({ userId, type = "system", title, body, link }) {
  return prisma.notification.create({
    data: { userId, type, title, body: body || null, link: link || null },
  });
}

/**
 * Broadcast a global notification to all users.
 * Stored as a single row with userId=null; the read state is per-user via
 * a separate read-receipts approach is overkill — for simplicity, global
 * notifications are shown to everyone but can't be marked read individually.
 * (The "read" flag on a global row marks it dismissed for everyone.)
 */
export async function notifyEveryone({ type = "system", title, body, link }) {
  return prisma.notification.create({
    data: { userId: null, type, title, body: body || null, link: link || null },
  });
}

/** Create a "you have a new DM" notification for the recipient. */
export async function notifyNewDM({ senderId, senderName, recipientId, dmId }) {
  return notifyUser({
    userId: recipientId,
    type: "dm",
    title: `New message from ${senderName}`,
    link: `/inbox?with=${senderId}`,
  });
}

/** Forum reply → notify thread author (skip self-replies). */
export async function notifyForumReply({ threadId, threadTitle, authorId, replierName, replierId }) {
  if (authorId === replierId) return null;
  return notifyUser({
    userId: authorId,
    type: "forum_reply",
    title: `${replierName} replied to "${threadTitle}"`,
    link: `/forum/thread/${threadId}`,
  });
}

/** Profile wall post → notify wall owner. */
export async function notifyWallPost({ profileUserId, authorId, authorName }) {
  if (profileUserId === authorId) return null;
  return notifyUser({
    userId: profileUserId,
    type: "system",
    title: `${authorName} posted on your profile`,
    link: `/u/${profileUserId}`,
  });
}
