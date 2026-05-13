// Shared helper: credit a user's account after a successful payment.
// Called by all three providers' webhook/capture handlers.
import { prisma } from "../prisma";
import { findPackage } from "./packages";

export async function fulfillPayment({
  userId,
  provider,
  providerTxId,
  packageKey,
  amount,
  currency = "USD",
  metadata = null,
}) {
  const pkg = findPackage(packageKey);
  if (!pkg) {
    throw new Error(`Unknown package key: ${packageKey}`);
  }

  // Idempotent: if we've already recorded this transaction, do nothing.
  const existing = await prisma.payment.findUnique({
    where: { providerTxId },
  });
  if (existing && existing.status === "completed") {
    return existing;
  }

  // Compute new VIP expiration if applicable
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`User ${userId} not found`);
  const now = new Date();
  let newVipUntil = user.vipUntil;
  if (pkg.vipDays > 0) {
    const base = newVipUntil && newVipUntil > now ? newVipUntil : now;
    newVipUntil = new Date(base.getTime() + pkg.vipDays * 86400000);
  }

  // Single transaction: record payment + credit user
  const [payment] = await prisma.$transaction([
    prisma.payment.upsert({
      where: { providerTxId },
      update: {
        status: "completed",
        completedAt: now,
      },
      create: {
        userId,
        provider,
        providerTxId,
        amount,
        currency,
        status: "completed",
        packageKey,
        silverAwarded: pkg.silver,
        vipDaysAwarded: pkg.vipDays,
        completedAt: now,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        silver: { increment: pkg.silver },
        vipUntil: newVipUntil,
      },
    }),
  ]);

  return payment;
}
