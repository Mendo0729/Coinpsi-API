const test = require("node:test");
const assert = require("node:assert/strict");
const { assertFileWithinRoot } = require("../src/services/google-drive-gallery.service");

const oldRoot = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = "coinpsiRootFolder12345";
test.after(() => {
  if (oldRoot === undefined) delete process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  else process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = oldRoot;
});

function driveTree(tree) {
  return {
    files: {
      async get({ fileId }) {
        return { data: { parents: tree[fileId] || [], trashed: false } };
      }
    }
  };
}

test("accepts the configured Google Drive root folder", async () => {
  await assert.doesNotReject(
    assertFileWithinRoot(driveTree({}), "coinpsiRootFolder12345")
  );
});

test("accepts nested images and folders inside the configured root", async () => {
  const drive = driveTree({
    image1234567890: ["nestedFolderABC"],
    nestedFolderABC: ["coinpsiRootFolder12345"]
  });
  await assert.doesNotReject(assertFileWithinRoot(drive, "image1234567890"));
});

test("rejects files outside the configured folder", async () => {
  const drive = driveTree({
    privateImage123: ["differentRoot12345"]
  });
  await assert.rejects(
    assertFileWithinRoot(drive, "privateImage123"),
    (error) => error.code === "GOOGLE_DRIVE_OUTSIDE_ROOT"
  );
});

test("rejects cycles in unexpected Drive parent metadata", async () => {
  const drive = driveTree({
    loopFolderABC1: ["loopFolderABC2"],
    loopFolderABC2: ["loopFolderABC1"]
  });
  await assert.rejects(
    assertFileWithinRoot(drive, "loopFolderABC1"),
    (error) => error.code === "GOOGLE_DRIVE_OUTSIDE_ROOT"
  );
});
