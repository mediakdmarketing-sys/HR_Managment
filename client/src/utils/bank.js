export const EMPLOYMENT_COUNTRIES = [
  { code: "LK", name: "Sri Lanka" },
  { code: "IN", name: "India" },
];

export const BANKS_BY_COUNTRY = {
  LK: [
    "People's Bank",
    "National Savings Bank",
    "Hatton National Bank",
    "Bank of Ceylon",
    "Commercial Bank of Ceylon",
    "Sampath Bank",
    "Seylan Bank",
    "Nations Trust Bank",
    "DFCC Bank",
    "National Development Bank",
    "Pan Asia Banking Corporation",
    "Union Bank of Colombo",
  ],
  IN: [
    "State Bank of India",
    "Bank of Baroda",
    "Punjab National Bank",
    "Canara Bank",
    "Union Bank of India",
    "Bank of India",
    "Indian Bank",
    "Central Bank of India",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Kotak Mahindra Bank",
    "IndusInd Bank",
    "IDFC FIRST Bank",
  ],
};

export const OTHER_BANK = "Others";

export const bankOptions = (countryCode, savedBanks = []) => {
  const names = [...(BANKS_BY_COUNTRY[countryCode] || [])];
  for (const name of savedBanks) {
    if (
      typeof name === "string" &&
      !names.some((existing) => existing.toLowerCase() === name.toLowerCase())
    ) {
      names.push(name);
    }
  }
  return names;
};

export const isEmployeeBankDetailsComplete = (employee) => {
  const hasCoreDetails = Boolean(
    employee.countryCode &&
    employee.countryOfEmployment &&
    employee.bankName &&
    employee.accountHolderName &&
    employee.accountNumberMasked,
  );
  return hasCoreDetails && (
    employee.countryCode !== "IN" ||
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(employee.ifscCode || "").trim().toUpperCase())
  );
};
