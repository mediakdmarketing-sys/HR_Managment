import {
  AlignmentType,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

// Text in [square brackets] is a placeholder that HR fills in once the letter is in Google Docs.
export const PLACEHOLDER_PATTERN = /(\[[^\]]+\])/g;

const signature = [
  { type: "p", text: "Sincerely," },
  { type: "spacer" },
  { type: "p", text: "[HR Manager Name]", bold: true },
  { type: "p", text: "[Designation]" },
  { type: "p", text: "[Company Name]" },
];

export const letterTemplates = [
  {
    id: "offer-letter",
    name: "Offer Letter",
    description: "Formal job offer with position, start date, compensation and acceptance section.",
    blocks: [
      { type: "p", text: "Date: [Date]", align: "right" },
      { type: "p", text: "[Candidate Full Name]", bold: true },
      { type: "p", text: "[Candidate Address]" },
      { type: "spacer" },
      { type: "p", text: "Subject: Offer of Employment – [Job Title]", bold: true },
      { type: "spacer" },
      { type: "p", text: "Dear [Candidate Name]," },
      {
        type: "p",
        text: "We are pleased to offer you the position of [Job Title] in the [Department] department at [Company Name]. We were impressed with your skills and experience, and we believe you will be a valuable addition to our team.",
      },
      { type: "p", text: "The key terms of your employment are as follows:" },
      {
        type: "fields",
        rows: [
          ["Position", "[Job Title]"],
          ["Department", "[Department]"],
          ["Reporting to", "[Manager Name]"],
          ["Start date", "[Start Date]"],
          ["Employment type", "[Full-time / Part-time / Contract]"],
          ["Work location", "[Work Location]"],
          ["Working hours", "[Working Hours]"],
          ["Compensation", "[Salary Amount] per [month / year]"],
          ["Probation period", "[Probation Period]"],
        ],
      },
      {
        type: "p",
        text: "You will be entitled to the benefits and leave policies applicable to your position as described in the company handbook. This offer is subject to the successful verification of your documents and references.",
      },
      {
        type: "p",
        text: "Please confirm your acceptance by signing and returning a copy of this letter on or before [Acceptance Deadline]. We look forward to welcoming you to [Company Name].",
      },
      ...signature,
      { type: "spacer" },
      { type: "heading", text: "Acceptance" },
      {
        type: "p",
        text: "I, [Candidate Full Name], accept the offer of employment on the terms and conditions stated above.",
      },
      { type: "p", text: "Signature: ______________________          Date: ______________" },
    ],
  },
  {
    id: "service-letter",
    name: "Service Letter",
    description: "Certificate of service confirming an employee's tenure, designation and conduct.",
    blocks: [
      { type: "p", text: "Date: [Date]", align: "right" },
      { type: "p", text: "Ref: [Reference Number]" },
      { type: "spacer" },
      { type: "heading", text: "TO WHOM IT MAY CONCERN", align: "center" },
      { type: "spacer" },
      {
        type: "p",
        text: "This is to certify that [Employee Full Name] (Employee ID: [Employee ID]) has been employed with [Company Name] from [Joining Date] to [Last Working Date / present].",
      },
      {
        type: "fields",
        rows: [
          ["Designation", "[Designation]"],
          ["Department", "[Department]"],
          ["Employment type", "[Full-time / Part-time / Contract]"],
        ],
      },
      {
        type: "p",
        text: "During this period, [he / she / they] was responsible for [Key Responsibilities]. [Employee Name] has shown dedication, professionalism and a strong commitment to [his / her / their] work.",
      },
      {
        type: "p",
        text: "[His / Her / Their] conduct and character during the period of service were found to be [Good / Excellent].",
      },
      {
        type: "p",
        text: "This letter is issued at the request of the employee for the purpose of [Purpose].",
      },
      ...signature,
    ],
  },
];

const footerText = "[Company Name] · [Company Address] · [Phone] · [Email]";

const toRuns = (text, options = {}) =>
  text
    .split(PLACEHOLDER_PATTERN)
    .filter(Boolean)
    .map(
      (part) =>
        new TextRun({
          text: part,
          font: "Calibri",
          size: options.size || 22,
          bold: options.bold,
          ...(part.startsWith("[") ? { highlight: "yellow" } : {}),
        }),
    );

const alignment = {
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
};

const blockToParagraphs = (block) => {
  if (block.type === "spacer") return [new Paragraph({ children: [] })];
  if (block.type === "fields") {
    return block.rows.map(
      ([label, value]) =>
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: `${label}: `, bold: true, font: "Calibri", size: 22 }),
            ...toRuns(value),
          ],
        }),
    );
  }
  return [
    new Paragraph({
      alignment: alignment[block.align],
      spacing: { after: block.type === "heading" ? 160 : 120, line: 300 },
      children: toRuns(block.text, {
        bold: block.bold || block.type === "heading",
        size: block.type === "heading" ? 26 : 22,
      }),
    }),
  ];
};

const dataUrlToBytes = (dataUrl) => {
  const binary = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export const getImageSize = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = dataUrl;
  });

const buildLogoHeader = async (logo) => {
  if (!logo) return undefined;
  const dataUrl = `data:${logo.mime};base64,${logo.data}`;
  const { width, height } = await getImageSize(dataUrl);
  // Fit inside 180 x 64 px while keeping the aspect ratio.
  const scale = Math.min(180 / width, 64 / height, 1);
  return new Header({
    children: [
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new ImageRun({
            type: logo.mime === "image/png" ? "png" : "jpg",
            data: dataUrlToBytes(dataUrl),
            transformation: {
              width: Math.round(width * scale),
              height: Math.round(height * scale),
            },
          }),
        ],
      }),
    ],
  });
};

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const buildLetterDocx = async (template, logo) => {
  const header = await buildLogoHeader(logo);
  const document = new Document({
    creator: "HRMS",
    title: template.name,
    sections: [
      {
        properties: {
          page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } },
        },
        headers: header ? { default: header } : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: toRuns(footerText, { size: 16 }),
              }),
            ],
          }),
        },
        children: template.blocks.flatMap(blockToParagraphs),
      },
    ],
  });
  return Packer.toBlob(document);
};

export { footerText };
