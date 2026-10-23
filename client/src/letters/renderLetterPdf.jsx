import { pdf } from "@react-pdf/renderer";
import { MAX_DENSITY, OfferLetterDocument, ServiceLetterDocument } from "./LetterPdf";

// Offer letters must fit on 2 pages and service letters on 1. If a letter runs over,
// re-render it at the next density level (tighter spacing, slightly smaller text).
const PAGE_LIMIT = { offer: 2, service: 1 };

export const renderLetterPdf = async (type, props) => {
  const LetterDocument = type === "offer" ? OfferLetterDocument : ServiceLetterDocument;
  let blob = null;
  for (let density = 0; density <= MAX_DENSITY; density += 1) {
    let pages = 0;
    blob = await pdf(
      <LetterDocument {...props} density={density} onPageCount={(count) => (pages = count)} />,
    ).toBlob();
    if (pages <= PAGE_LIMIT[type]) break;
  }
  return blob;
};
