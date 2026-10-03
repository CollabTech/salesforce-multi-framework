/**
 * SMF-10 upload policy and client-side validation.
 *
 * The PoC limit is fixed by SMF-3 (MF-UPLOAD-INVALID): image-only, 5 MiB. Changing it
 * needs a recorded project-owner decision before any test run. A file passes only if
 * its size, extension, declared MIME type and leading "magic" bytes all agree, so a
 * renamed .txt cannot slip through as an image.
 */
export const MIB = 1024 * 1024;

export interface AllowedType {
  label: string;
  mime: string;
  extensions: string[];
  /** True when the leading bytes match this format's signature. */
  matches: (head: Uint8Array) => boolean;
}

export interface UploadPolicy {
  id: string;
  maxBytes: number;
  allowed: AllowedType[];
}

const startsWith = (head: Uint8Array, sig: number[], offset = 0): boolean =>
  head.length >= offset + sig.length && sig.every((b, i) => head[offset + i] === b);

export const PNG: AllowedType = {
  label: 'PNG',
  mime: 'image/png',
  extensions: ['png'],
  matches: h => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

export const JPEG: AllowedType = {
  label: 'JPEG',
  mime: 'image/jpeg',
  extensions: ['jpg', 'jpeg'],
  matches: h => startsWith(h, [0xff, 0xd8, 0xff]),
};

/** SMF-3 MF-UPLOAD-INVALID contract: image-only (PNG/JPEG, as MF-IMAGE-001), max 5 MiB. */
export const IMAGE_UPLOAD_POLICY: UploadPolicy = {
  id: 'smf10-image-5mib',
  maxBytes: 5 * MIB,
  allowed: [PNG, JPEG],
};

export type RejectCode = 'empty' | 'too-large' | 'type-not-allowed' | 'content-mismatch';

export type ValidationResult =
  | { ok: true; type: AllowedType; bytes: number }
  | { ok: false; code: RejectCode; message: string; bytes: number };

export interface FileLike {
  name: string;
  type: string;
  size: number;
  slice: (start: number, end: number) => Blob;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function formatBytes(bytes: number): string {
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

async function readHead(file: FileLike, n: number): Promise<Uint8Array> {
  const blob = file.slice(0, n);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Validates one file against a policy. Never throws for user input. */
export async function validateFile(file: FileLike, policy: UploadPolicy = IMAGE_UPLOAD_POLICY): Promise<ValidationResult> {
  const bytes = file.size;
  if (bytes === 0) {
    return { ok: false, code: 'empty', message: 'The file is empty.', bytes };
  }
  if (bytes > policy.maxBytes) {
    return {
      ok: false,
      code: 'too-large',
      message: `The file is ${formatBytes(bytes)}; the limit is ${formatBytes(policy.maxBytes)}.`,
      bytes,
    };
  }
  const ext = extensionOf(file.name);
  const byExt = policy.allowed.find(t => t.extensions.includes(ext));
  const allowedList = policy.allowed.map(t => t.label).join(', ');
  if (!byExt || (file.type !== '' && file.type !== byExt.mime)) {
    return {
      ok: false,
      code: 'type-not-allowed',
      message: `Only ${allowedList} images are accepted (got ".${ext || '?'}", ${file.type || 'unknown type'}).`,
      bytes,
    };
  }
  const head = await readHead(file, 16);
  if (!byExt.matches(head)) {
    return {
      ok: false,
      code: 'content-mismatch',
      message: `The file is named .${ext} but its content is not a ${byExt.label} image.`,
      bytes,
    };
  }
  return { ok: true, type: byExt, bytes };
}
