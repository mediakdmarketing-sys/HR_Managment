import { useEffect, useSyncExternalStore } from "react";
import { getProfilePhoto } from "../api/userApi";
import { getUser } from "./auth";

// The signed-in user's photo, shared by the sidebar, dashboard and profile page. It is
// loaded once per user and updated in place when they upload or remove a photo.
let state = { userId: null, photo: null, status: "idle" };
const listeners = new Set();

const setState = (next) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const currentUserId = () => {
  const user = getUser();
  return user?._id ?? user?.id ?? null;
};

export const setMyPhoto = (photo) => setState({ userId: currentUserId(), photo, status: "loaded" });

export const useMyPhoto = () => {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const userId = currentUserId();

  useEffect(() => {
    if (!userId || (state.userId === userId && state.status !== "idle")) return;
    setState({ userId, photo: null, status: "loading" });
    getProfilePhoto(userId)
      .then((response) => {
        if (state.userId === userId) setState({ photo: response.data.data, status: "loaded" });
      })
      .catch(() => {
        if (state.userId === userId) setState({ status: "loaded" });
      });
  }, [userId]);

  return snapshot.userId === userId ? snapshot.photo : null;
};

export const photoSource = (photo) => (photo ? `data:${photo.mime};base64,${photo.data}` : null);

// Center-crops and shrinks an image file to a square JPEG, returned as { mime, data }.
export const resizePhoto = (file, size = 256) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve({ mime: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not an image we can read."));
    };
    image.src = url;
  });
