import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, Loader2, Lock, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import Avatar from "../components/Avatar";
import ChangePasswordDialog from "../components/ChangePasswordDialog";
import { getUserById, removeProfilePhoto, saveProfilePhoto } from "../api/userApi";
import { getUser } from "../utils/auth";
import { resizePhoto, setMyPhoto, useMyPhoto } from "../utils/profilePhoto";

const MAX_FILE_MB = 5;

const ReadOnlyField = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <Lock size={12} className="text-slate-400" aria-label="Not editable" />
    </p>
    <p className="mt-2 break-words font-medium text-slate-800">{value || "—"}</p>
  </div>
);

export default function Profile() {
  const user = getUser();
  const userId = user?._id ?? user?.id;
  const fileInputRef = useRef(null);
  const photo = useMyPhoto();
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState("");
  const [photoAction, setPhotoAction] = useState(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    getUserById(userId)
      .then((response) => setEmployee(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || "Unable to load your profile."));
  }, [userId]);

  const uploadPhoto = async (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file || photoAction) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (JPEG, PNG or WebP).", { theme: "dark" });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`The image must be smaller than ${MAX_FILE_MB} MB.`, { theme: "dark" });
      return;
    }
    setPhotoAction("upload");
    try {
      const resized = await resizePhoto(file);
      await saveProfilePhoto(resized);
      setMyPhoto(resized);
      toast.success("Profile photo updated.", { theme: "dark" });
    } catch (uploadError) {
      toast.error(uploadError.response?.data?.message || uploadError.message || "Unable to upload the photo.", {
        theme: "dark",
      });
    } finally {
      setPhotoAction(null);
    }
  };

  const deletePhoto = async () => {
    if (photoAction) return;
    setPhotoAction("remove");
    try {
      await removeProfilePhoto();
      setMyPhoto(null);
      toast.success("Profile photo removed.", { theme: "dark" });
    } catch (removeError) {
      toast.error(removeError.response?.data?.message || "Unable to remove the photo.", { theme: "dark" });
    } finally {
      setPhotoAction(null);
    }
  };

  const name = employee?.name || user?.name;

  return (
    <UserLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <h1 className="text-3xl font-bold text-slate-800">My profile</h1>

          <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative">
              <Avatar name={name} photo={photo} className="h-28 w-28 rounded-full text-4xl ring-4 ring-slate-100" />
              {photoAction === "upload" && (
                <div className="absolute inset-0 grid place-content-center rounded-full bg-slate-900/50 text-white">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              )}
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xl font-bold text-slate-800">{name}</p>
              {(employee?.role || user?.role) && (
                <p className="text-sm font-medium text-teal-700">{employee?.role || user?.role}</p>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadPhoto}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(photoAction)}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  <Camera size={16} />
                  {photo ? "Change photo" : "Upload photo"}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={deletePhoto}
                    disabled={Boolean(photoAction)}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                  >
                    {photoAction === "remove" ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">JPEG, PNG or WebP, up to {MAX_FILE_MB} MB.</p>
            </div>
          </div>

          {error && <p className="mt-6 text-red-600">{error}</p>}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ReadOnlyField label="Name" value={name} />
            </div>
            <ReadOnlyField label="Company email" value={employee?.email || user?.email} />
            <ReadOnlyField label="Personal email" value={employee?.personalEmail} />
          </div>
          <p className="mt-3 text-xs text-slate-400">To change these details, please contact HR.</p>
        </section>

        <section className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-content-center rounded-xl bg-teal-50 text-teal-700">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Password</h2>
              <p className="mt-1 text-sm text-slate-500">Change the password you use to log in.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsChangingPassword(true)}
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Change password
          </button>
        </section>
      </div>

      {isChangingPassword && <ChangePasswordDialog onClose={() => setIsChangingPassword(false)} />}
    </UserLayout>
  );
}
