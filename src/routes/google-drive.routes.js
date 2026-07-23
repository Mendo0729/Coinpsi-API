const express = require("express");

const {
  getAuthorizationUrl,
  getDriveStatus,
  testDriveConnection
} = require("../controllers/google-drive.controller");
const {
  getFolderContents,
  streamAdminDriveImage
} = require("../controllers/google-drive-browser.controller");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);
router.get("/status", getDriveStatus);
router.get("/auth-url", getAuthorizationUrl);
router.get("/folders/:folderId", getFolderContents);
router.get("/files/:fileId/content", streamAdminDriveImage);
router.post("/test", testDriveConnection);

module.exports = router;
