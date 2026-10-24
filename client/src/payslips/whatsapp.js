const COUNTRY_CODE = "94";

// WhatsApp needs the number in international form without "+" (e.g. 94771234567).
// Local Sri Lankan numbers like 077 123 4567 get the country code added.
export const whatsappNumber = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `${COUNTRY_CODE}${digits.slice(1)}`;
  if (digits.length === 9) return `${COUNTRY_CODE}${digits}`;
  return digits;
};

export const payslipMessage = (payslip, companyName, link) =>
  `Hello ${payslip.name},

Your payslip for ${payslip.payPeriod} (Payslip no: ${payslip.payslipNumber}) is ready. Download it here:
${link}

Thank you,
${companyName} HR`;

// Opens the employee's chat in WhatsApp Web with the message typed in, ready to send.
export const whatsappWebUrl = (phone, message) =>
  `https://web.whatsapp.com/send?phone=${whatsappNumber(phone)}&text=${encodeURIComponent(message)}`;
