const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");

// Never unlink the destination to work around a failed replacement. A failed
// rename preserves both the old project and the completed recovery file.
async function writeProjectFile(destination, content, io = fs) {
  const temporary = `${destination}.saving-${randomUUID()}`;
  let handle;
  try {
    handle = await io.open(temporary, "wx");
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } catch (error) {
    await handle?.close().catch(() => {});
    if (handle) await io.unlink(temporary).catch(() => {});
    throw error;
  }
  await handle.close();
  try {
    await io.rename(temporary, destination);
  } catch (error) {
    error.recoveryPath = temporary;
    throw error;
  }
}

module.exports = { writeProjectFile };
