import fs from "node:fs/promises";
import path from "node:path";

function makeTempPath(destPath: string): string {
  const dir = path.dirname(destPath);
  const base = path.basename(destPath);
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(dir, `${base}.tmp-${nonce}`);
}

async function cleanupTemp(tempPath: string): Promise<void> {
  try {
    await fs.rm(tempPath, { force: true });
  } catch {
    // best effort
  }
}

export async function replaceFileAtomic(srcPath: string, destPath: string): Promise<void> {
  const destDir = path.dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });

  const tempPath = makeTempPath(destPath);
  await fs.copyFile(srcPath, tempPath);

  try {
    await fs.rm(destPath, { force: true });
  } catch (err) {
    await cleanupTemp(tempPath);
    throw err;
  }

  try {
    await fs.rename(tempPath, destPath);
  } catch (err) {
    await cleanupTemp(tempPath);
    throw err;
  }
}
