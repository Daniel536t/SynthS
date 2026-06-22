import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "/home/ubuntu/synthscribe-audio";
const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || path.join(STORAGE_ROOT, "private");

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const fullPath = path.join(PRIVATE_DIR, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return `/objects/${key}`;
}

export async function downloadToBuffer(objectPath: string): Promise<Buffer> {
  const filePath = path.join(PRIVATE_DIR, objectPath.replace("/objects/", ""));
  return fs.readFile(filePath);
}

export function objectPathToUrl(objectPath: string | null): string | null {
  if (!objectPath) return null;
  return `/api/storage${objectPath}`;
}
