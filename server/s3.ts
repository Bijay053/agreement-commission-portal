import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import crypto from "crypto";
import path from "path";

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "";

function generateS3Key(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const hash = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  return `documents/${timestamp}-${hash}${ext}`;
}

export async function uploadToS3(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<string> {
  const s3Key = generateS3Key(originalFilename);

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType,
    ServerSideEncryption: "AES256",
  }));

  return s3Key;
}

export async function getFromS3(s3Key: string): Promise<Readable> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  }));

  return response.Body as Readable;
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  }));
}

export function isS3Key(storagePath: string): boolean {
  return storagePath.startsWith("documents/") || storagePath.startsWith("s3://");
}
