import { AwsClient } from "aws4fetch";

// Сервер-лише — читає секрети R2, ніколи не імпортується в клієнтський код
// (немає "use client" ніде вище по ланцюгу імпортів; викликається лише з
// src/app/api/r2-upload-url/route.ts).
//
// aws4fetch, а не @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner —
// свідомий вибір: нам потрібна рівно одна операція (підписати PUT URL),
// aws4fetch для цього має 0 залежностей проти 11 прямих (і ~100+
// транзитивних) у офіційного AWS SDK v3 (перевірено напряму через
// `npm view ... dependencies` перед вибором).
//
// Структура запиту (ендпоінт, X-Amz-Expires, Content-Type у заголовках
// перед підписом) — скопійована 1:1 з офіційного прикладу Cloudflare
// (developers.cloudflare.com/r2/examples/aws/aws4fetch), а не зібрана з
// пам'яті чи інших джерел: у процесі дослідження трапилась суперечлива
// інформація (нібито Content-Type не можна підписувати з aws4fetch+R2),
// що прямо суперечить офіційному прикладу. Тому contentType, використаний
// тут при підписі, ОБОВ'ЯЗКОВО має бути буквально тим самим значенням,
// яке браузер потім надішле в заголовку PUT-запиту — саме так побудований
// виклик у route.ts нижче (те саме significant, що прийшло від клієнта).
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY не задані");
  }

  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" }),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export async function buildPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> {
  const { client, endpoint } = getR2Client();
  const url = `${endpoint}/${bucket}/${key}?X-Amz-Expires=${expiresInSeconds}`;

  const signedRequest = await client.sign(
    new Request(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
    }),
    { aws: { signQuery: true } }
  );

  return signedRequest.url.toString();
}
