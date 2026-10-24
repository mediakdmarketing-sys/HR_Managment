export const BANKS = ["People's Bank", "NSB", "HNB", "BOC", "Commercial Bank", "Sampath Bank"];
export const OTHER_BANK = "Others";

// The built-in banks plus names typed under "Others" earlier (saved by the server), without
// repeating a name that differs only in case.
export const bankOptions = (savedBanks = []) => {
  const names = [...BANKS];
  for (const name of savedBanks) {
    if (!names.some((existing) => existing.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  return names;
};
