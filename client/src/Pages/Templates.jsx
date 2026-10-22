import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import { getUser } from "../utils/auth";
import { getTemplateLogo, saveTemplateLogo } from "../api/templateApi";
import {
  PLACEHOLDER_PATTERN,
  buildLetterDocx,
  footerText,
  letterTemplates,
} from "../utils/letterTemplates";
import {
  createGoogleDoc,
  hasValidGoogleToken,
  isGoogleDocsConfigured,
} from "../utils/googleDocs";

const MAX_LOGO_BYTES = 500 * 1024;

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

const PlaceholderText = ({ text }) =>
  text.split(PLACEHOLDER_PATTERN).filter(Boolean).map((part, index) =>
    part.startsWith("[") ? (
      <mark key={index} className="rounded bg-amber-100 px-0.5 text-amber-800">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );

const LetterPreview = ({ template, logoUrl }) => (
  <div className="h-80 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-[9px] leading-relaxed text-slate-600 shadow-inner">
    <div className="mb-3 flex h-10 items-center border-b border-slate-100 pb-2">
      {logoUrl ? (
        <img src={logoUrl} alt="Company logo" className="max-h-8 max-w-28 object-contain" />
      ) : (
        <span className="rounded border border-dashed border-slate-300 px-2 py-1 text-[8px] text-slate-400">
          Your logo
        </span>
      )}
    </div>
    <div className="space-y-1.5">
      {template.blocks.map((block, index) => {
        if (block.type === "spacer") return <div key={index} className="h-1" />;
        if (block.type === "fields") {
          return (
            <div key={index} className="space-y-0.5 pl-3">
              {block.rows.map(([label, value]) => (
                <p key={label}>
                  <span className="font-semibold text-slate-700">{label}: </span>
                  <PlaceholderText text={value} />
                </p>
              ))}
            </div>
          );
        }
        return (
          <p
            key={index}
            className={`${block.bold || block.type === "heading" ? "font-semibold text-slate-800" : ""} ${
              block.align === "right" ? "text-right" : block.align === "center" ? "text-center" : ""
            }`}
          >
            <PlaceholderText text={block.text} />
          </p>
        );
      })}
    </div>
    <p className="mt-4 border-t border-slate-100 pt-2 text-center text-[8px] text-slate-400">
      {footerText}
    </p>
  </div>
);

function Templates() {
  const user = getUser();
  const isHr = user?.role === "HR";
  const fileInputRef = useRef(null);
  const [logo, setLogo] = useState(null);
  const [isLogoLoading, setIsLogoLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [createdDoc, setCreatedDoc] = useState(null);
  const googleDocsReady = isGoogleDocsConfigured();
  const logoUrl = logo ? `data:${logo.mime};base64,${logo.data}` : "";

  useEffect(() => {
    if (!isHr) return;
    let active = true;
    getTemplateLogo()
      .then((response) => {
        if (active) setLogo(response.data.data);
      })
      .catch(() => {
        if (active) toast.error("Unable to load the letter logo.", { theme: "dark" });
      })
      .finally(() => {
        if (active) setIsLogoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isHr]);

  const uploadLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Logo must be a PNG or JPEG image", { theme: "dark" });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo must be 500 KB or smaller", { theme: "dark" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setIsUploading(true);
      try {
        const response = await saveTemplateLogo({
          fileName: file.name,
          mime: file.type,
          data: String(reader.result).split(",")[1] || "",
        });
        setLogo(response.data.data);
        toast.success(logo ? "Logo replaced" : "Logo added", { theme: "dark" });
      } catch (error) {
        toast.error(error.response?.data?.message || "Unable to save the logo.", {
          theme: "dark",
        });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const documentName = (template) =>
    `${template.name} - ${new Date().toISOString().slice(0, 10)}`;

  const downloadDocx = async (template) => {
    setBusyAction(`${template.id}-download`);
    try {
      const blob = await buildLetterDocx(template, logo);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documentName(template)}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Unable to generate the document.", { theme: "dark" });
    } finally {
      setBusyAction("");
    }
  };

  const openInGoogleDocs = async (template) => {
    if (!googleDocsReady) {
      toast.info("Google Docs is not configured yet. Download the .docx instead.", {
        theme: "dark",
      });
      return;
    }
    // With a cached Google token no sign-in popup is needed, so open the tab now
    // while the click still counts as a user gesture.
    const pendingTab = hasValidGoogleToken() ? window.open("", "_blank") : null;
    setBusyAction(`${template.id}-docs`);
    try {
      const blob = await buildLetterDocx(template, logo);
      const url = await createGoogleDoc(documentName(template), blob);
      setCreatedDoc({ name: template.name, url });
      if (pendingTab) pendingTab.location.href = url;
      else window.open(url, "_blank");
      toast.success(`${template.name} created in Google Docs`, { theme: "dark" });
    } catch (error) {
      pendingTab?.close();
      toast.error(error.message || "Unable to open in Google Docs.", { theme: "dark" });
    } finally {
      setBusyAction("");
    }
  };

  if (!isHr) {
    return (
      <UserLayout>
        <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70">
          <ShieldAlert className="text-red-500" size={36} />
          <h1 className="mt-4 text-2xl font-bold text-slate-800">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Letter templates are available to HR only.</p>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="space-y-6">
        <section className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <p className="text-sm font-medium text-teal-200">HR operations</p>
          <h1 className="mt-2 text-4xl font-bold">Letter Templates</h1>
          <p className="mt-3 text-slate-200">
            Open a template in Google Docs and fill in the highlighted placeholders such as name and date.
          </p>
        </section>

        <section className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="grid h-20 w-40 shrink-0 place-content-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2">
              {isLogoLoading ? (
                <Loader2 className="animate-spin text-slate-400" size={22} />
              ) : logoUrl ? (
                <img src={logoUrl} alt="Company logo" className="max-h-16 max-w-36 object-contain" />
              ) : (
                <ImagePlus className="text-slate-400" size={26} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Letterhead logo</h2>
              <p className="mt-1 text-sm text-slate-500">
                {logo
                  ? `${logo.fileName} · updated ${formatDateTime(logo.updatedAt)}${logo.updatedBy ? ` by ${logo.updatedBy}` : ""}`
                  : "Add a logo to show it at the top of every letter. PNG or JPEG, up to 500 KB."}
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={uploadLogo}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading || isLogoLoading}
            onClick={() => fileInputRef.current?.click()}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60 ${
              logo
                ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
                : "bg-teal-700 text-white hover:bg-teal-800"
            }`}
          >
            {isUploading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : logo ? (
              <RefreshCw size={18} />
            ) : (
              <ImagePlus size={18} />
            )}
            {logo ? "Replace logo" : "Add logo"}
          </button>
        </section>

        {!googleDocsReady && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
            Google Docs is not configured. Set <code className="font-semibold">VITE_GOOGLE_CLIENT_ID</code> in
            the client environment to enable opening templates in Google Docs. You can still download them as .docx.
          </p>
        )}

        {createdDoc && (
          <div className="flex flex-col gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{createdDoc.name} was created in your Google Drive.</span>
            <a
              href={createdDoc.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold hover:underline"
            >
              Open document <ExternalLink size={15} />
            </a>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {letterTemplates.map((template) => {
            const isOpening = busyAction === `${template.id}-docs`;
            const isDownloading = busyAction === `${template.id}-download`;
            return (
              <section
                key={template.id}
                className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{template.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{template.description}</p>
                  </div>
                  <FileText className="shrink-0 text-teal-600" size={22} />
                </div>
                <button
                  type="button"
                  onClick={() => openInGoogleDocs(template)}
                  disabled={Boolean(busyAction)}
                  className="text-left transition hover:opacity-90 disabled:cursor-wait"
                  aria-label={`Open ${template.name} in Google Docs`}
                >
                  <LetterPreview template={template} logoUrl={logoUrl} />
                </button>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openInGoogleDocs(template)}
                    disabled={Boolean(busyAction)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    {isOpening ? <Loader2 className="animate-spin" size={18} /> : <ExternalLink size={18} />}
                    Open in Google Docs
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadDocx(template)}
                    disabled={Boolean(busyAction)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                    Download .docx
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </UserLayout>
  );
}

export default Templates;
