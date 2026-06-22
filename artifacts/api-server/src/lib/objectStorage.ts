import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const STORAGE_ROOT = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "/home/ubuntu/synthscribe-audio";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export interface ObjectFile {
  path: string;
  bucket: string;
}

export interface DownloadResponse {
  status: number;
  headers: Map<string, string>;
  body?: ReadableStream<Uint8Array>;
}

export class ObjectStorageService {
  async getObjectEntityFile(objectPath: string): Promise<ObjectFile> {
    const fullPath = path.join(STORAGE_ROOT, objectPath);
    try {
      await fs.access(fullPath);
    } catch {
      throw new ObjectNotFoundError();
    }
    return { path: fullPath, bucket: STORAGE_ROOT };
  }

  async downloadObject(file: ObjectFile): Promise<DownloadResponse> {
    const buffer = await fs.readFile(file.path);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      },
    });
    return {
      status: 200,
      headers: new Map([["Content-Type", "audio/wav"]]),
      body: stream,
    };
  }
}

export async function uploadBuffer(
  bucket: string,
  objectPath: string,
  buffer: Buffer,
): Promise<string> {
  const fullPath = path.join(STORAGE_ROOT, bucket, objectPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}

export const objectStorageClient = null;
