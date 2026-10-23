import { renderToStaticMarkup } from "react-dom/server";
import PayslipSheet from "./PayslipSheet";
import { PAYSLIP_CSS } from "./payslipStyles";

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

// Opens the same payslip markup as the preview in a new window and prints it.
export const printPayslip = (payslip, letterhead) => {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) return false;

  const markup = renderToStaticMarkup(<PayslipSheet payslip={payslip} letterhead={letterhead} />);
  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(`${payslip.payslipNumber} - ${payslip.name}`)}</title>
    <style>
      body { margin: 0; background: #f1f5f9; }
      .ps-page { max-width: 820px; margin: 24px auto; box-shadow: 0 10px 30px rgb(15 23 42 / 0.12); }
      @page { size: A4; margin: 12mm; }
      @media print {
        body { background: #ffffff; }
        .ps-page { margin: 0; max-width: none; box-shadow: none; }
        .ps-sheet { padding: 0; }
        .ps-employee, .ps-gross td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      ${PAYSLIP_CSS}
    </style>
  </head>
  <body>
    <div class="ps-page">${markup}</div>
    <script>window.onload = function () { window.focus(); window.print(); };</script>
  </body>
</html>`);
  printWindow.document.close();
  return true;
};
