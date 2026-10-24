import { pdf } from "@react-pdf/renderer";
import PayslipDocument from "./PayslipPdf";

export const renderPayslipPdf = (payslip, letterhead) =>
  pdf(<PayslipDocument payslip={payslip} letterhead={letterhead} />).toBlob();
