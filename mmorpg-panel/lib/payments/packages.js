// Catalog of purchasable packages. Edit to match your server economy.
// `key` is the stable identifier saved in Payment.packageKey.
//
// "Silk" is the standard Silkroad Online cash-shop currency. If your server
// uses a different name (gold, points, tokens), rename here.
export const PACKAGES = [
  {
    key: "silk_1000",
    name: "1,000 Silk",
    description: "Starter pouch. Get going.",
    amount: 4.99,
    currency: "USD",
    silk: 1000,
    vipDays: 0,
  },
  {
    key: "silk_5500",
    name: "5,500 Silk",
    description: "Best value for casual players (10% bonus).",
    amount: 19.99,
    currency: "USD",
    silk: 5500,
    vipDays: 0,
  },
  {
    key: "silk_17500",
    name: "17,500 Silk",
    description: "For the serious adventurer (16% bonus).",
    amount: 49.99,
    currency: "USD",
    silk: 17500,
    vipDays: 0,
  },
  {
    key: "vip_30",
    name: "VIP — 30 days",
    description: "+50% EXP, exclusive zones, daily login bonus.",
    amount: 9.99,
    currency: "USD",
    silk: 0,
    vipDays: 30,
  },
  {
    key: "vip_90",
    name: "VIP — 90 days",
    description: "Best VIP value. Save 20%.",
    amount: 24.99,
    currency: "USD",
    silk: 0,
    vipDays: 90,
  },
];

export function findPackage(key) {
  return PACKAGES.find((p) => p.key === key) || null;
}
