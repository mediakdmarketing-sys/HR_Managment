import { firestore, storageBucket } from "../config/firebase.js";
import { createRecruitmentFirestoreService } from "./recruitmentService.js";

export const recruitmentFirestore = createRecruitmentFirestoreService({
  database: firestore,
  bucket: storageBucket,
});
