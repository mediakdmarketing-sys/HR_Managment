import { photoSource } from "../utils/profilePhoto";

// Profile photo, or the first letter of the name on the brand gradient.
function Avatar({ name, photo, className = "h-10 w-10 rounded-full text-lg" }) {
  const source = photoSource(photo);
  if (source) {
    return <img src={source} alt={name || "Profile photo"} className={`shrink-0 object-cover ${className}`} />;
  }
  return (
    <div
      className={`grid shrink-0 place-content-center bg-linear-to-br from-slate-800 to-teal-600 font-bold text-white ${className}`}
    >
      {name?.trim()?.charAt(0)?.toUpperCase() || "U"}
    </div>
  );
}

export default Avatar;
