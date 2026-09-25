import { getAccessToken, refreshAccessToken, ApiError, AuthSessionExpiredError } from '@/services/api/client';

// Web implementation of the shared file transfer machinery. The native version
// (fileTransfer.ts) relies on expo-file-system's `File` class, which is not
// implemented on web — `new File(uri).upload()` throws "validatePath is not a
// function". Metro resolves this `.web.ts` file ahead of the `.ts` when
// bundling for web, so the two platforms stay completely independent while
// exposing the same API surface.

export interface FileAttachment {
  fileName: string;
  originalName: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' }
    : { 'ngrok-skip-browser-warning': '1' };
}

// On web, the picked file's `uri` is a blob:/data: URL. `fetch`-ing it yields
// the actual bytes, which we re-wrap in multipart form data. We deliberately do
// NOT set Content-Type — the browser adds the correct multipart boundary itself.
export async function uploadFile(
  uploadUrl: string,
  localUri: string,
  mimeType?: string,
  originalName?: string
): Promise<FileAttachment> {
  const sourceBlob = await (await fetch(localUri)).blob();
  const blob = mimeType ? sourceBlob.slice(0, sourceBlob.size, mimeType) : sourceBlob;
  const fileName = originalName ?? 'upload';

  const attempt = async (): Promise<Response> => {
    const headers = await authHeader();
    const form = new FormData();
    form.append('file', blob, fileName);
    return fetch(uploadUrl, { method: 'POST', headers, body: form });
  };

  let result = await attempt();
  if (result.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new AuthSessionExpiredError();
    result = await attempt();
  }

  const text = await result.text();
  const json = text ? JSON.parse(text) : null;
  if (result.status >= 400 || !json || json.success === false) {
    throw new ApiError(
      json?.error?.code ?? 'UPLOAD_FAILED',
      json?.error?.message ?? 'Upload failed',
      result.status
    );
  }

  return { fileName: json.data.fileName, originalName: json.data.originalName };
}

// On web there's no filesystem to write to — we fetch the bytes (with auth) and
// trigger the browser's native "Save As"/download flow via a temporary anchor.
export async function downloadFile(downloadUrl: string, displayName: string): Promise<string> {
  const doDownload = async (): Promise<Response> => {
    const headers = await authHeader();
    return fetch(downloadUrl, { headers });
  };

  let result = await doDownload();
  if (result.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new AuthSessionExpiredError();
    result = await doDownload();
  }

  if (result.status >= 400) {
    throw new ApiError('DOWNLOAD_FAILED', 'Download failed', result.status);
  }

  const blob = await result.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = displayName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return objectUrl;
}
