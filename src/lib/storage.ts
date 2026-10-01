import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type Cfg = { client: S3Client; bucket: string };
let cached: Cfg | null | undefined;

/** null quando o R2 não está configurado: o lead é salvo mesmo sem áudio. */
function cfg(): Cfg | null {
  if (cached !== undefined) return cached;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT } =
    process.env;
  const endpoint = R2_ENDPOINT || (R2_ACCOUNT_ID && `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  if (!endpoint || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    cached = null;
    return cached;
  }
  cached = {
    bucket: R2_BUCKET,
    client: new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  return cached;
}

export const storageConfigurado = () => cfg() !== null;

export async function enviarAudio(key: string, body: Uint8Array, contentType: string) {
  const c = cfg();
  if (!c) throw new Error("Armazenamento de áudio não configurado.");
  await c.client.send(
    new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function removerAudio(key: string) {
  const c = cfg();
  if (!c) return;
  await c.client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
}

/** URL temporária (5 min). O bucket é privado; a permissão é checada antes de assinar. */
export async function urlAudio(key: string, contentType?: string | null) {
  const c = cfg();
  if (!c) throw new Error("Armazenamento de áudio não configurado.");
  return getSignedUrl(
    c.client,
    new GetObjectCommand({
      Bucket: c.bucket,
      Key: key,
      ResponseContentType: contentType ?? undefined,
    }),
    { expiresIn: 300 },
  );
}
