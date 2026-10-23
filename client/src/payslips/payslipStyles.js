// Shared by the on-screen preview and the print window, so both look identical.
// Plain class names (not Tailwind) keep the sheet white like paper in dark mode too.
export const PAYSLIP_CSS = `
.ps-sheet { background: #ffffff; color: #111827; font-family: Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.45; padding: 36px 40px; }
.ps-sheet * { box-sizing: border-box; }
.ps-sheet p { margin: 0; }
.ps-head { display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 2px solid #e5efe0; }
.ps-logo { width: 84px; height: 64px; object-fit: contain; flex-shrink: 0; }
.ps-company { font-size: 22px; font-weight: 700; color: #3b7a2f; line-height: 1.2; }
.ps-company-line { font-size: 13px; font-weight: 700; color: #7cb342; }
.ps-title { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 22px 0 14px; }
.ps-title h2 { margin: 0; font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; color: #111827; }
.ps-title-meta { text-align: right; font-size: 13px; color: #4b5563; }
.ps-employee { display: grid; grid-template-columns: 1.35fr 1fr; gap: 6px 28px; background: #f8fafc; border-radius: 10px; padding: 16px 18px; }
.ps-field { display: flex; gap: 10px; font-size: 13px; }
.ps-field-label { width: 104px; flex-shrink: 0; color: #6b7280; }
.ps-field-value { min-width: 0; font-weight: 600; color: #111827; overflow-wrap: anywhere; }
.ps-table { width: 100%; border-collapse: collapse; margin-top: 24px; }
.ps-table th { padding: 8px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; text-align: left; }
.ps-table td { padding: 10px 14px; vertical-align: top; }
.ps-table .ps-count { text-align: center; width: 22%; }
.ps-table .ps-amount { text-align: right; width: 28%; font-variant-numeric: tabular-nums; }
.ps-earning { font-weight: 600; }
.ps-rate { display: block; font-size: 12px; font-weight: 400; color: #6b7280; }
.ps-gross td { background: #f0f7ec; font-size: 15px; font-weight: 700; padding-top: 14px; padding-bottom: 14px; }
.ps-gross td:first-child { border-radius: 8px 0 0 8px; }
.ps-gross td:last-child { border-radius: 0 8px 8px 0; color: #2f6b24; }
.ps-note { margin-top: 28px; text-align: center; font-size: 11px; color: #9ca3af; }
@media (max-width: 640px) {
  .ps-sheet { padding: 22px 18px; }
  .ps-employee { grid-template-columns: 1fr; }
  .ps-title { flex-direction: column; align-items: flex-start; }
  .ps-title-meta { text-align: left; }
}
`;
