// Catalog of purchasable packages. Edit to match your server economy.
// `key` is the stable identifier saved in Payment.packageKey.
export const PACKAGES = [
  {
    key: "silver_1000",
    name: "1,000 Silver",
    description: "Starter pouch. Get going.",
    amount: 4.99,
    currency: "USD",
    silver: 1000,
    vipDays: 0,
  },
  {
    key: "silver_5000",
    name: "5,500 Silver",
    description: "Best value for casual players (10% bonus).",
    amount: 19.99,
    currency: "USD",
    silver: 5500,
    vipDays: 0,
  },
  {
    key: "silver_15000",
    name: "17,500 Silver",
    description: "For the serious adventurer (16% bonus).",
    amount: 49.99,
    currency: "USD",
    silver: 17500,
    vipDays: 0,
  },
  {
    key: "vip_30",
    name: "VIP — 30 days",
    description: "+50% EXP, exclusive zones, daily login bonus.",
    amount: 9.99,
    currency: "USD",
    silver: 0,
    vipDays: 30,
  },
  {
    key: "vip_90",
    name: "VIP — 90 days",
    description: "Best VIP value. Save 20%.",
    amount: 24.99,
    currency: "USD",
    silver: 0,
    vipDays: 90,
  },
];

export function findPackage(key) {
  return PACKAGES.find((p) => p.key === key) || null;
}
