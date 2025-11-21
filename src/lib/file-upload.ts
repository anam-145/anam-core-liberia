import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// 허용된 파일 타입
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);
const ALLOWED_FACE_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']);

// 파일 크기 제한 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 업로드 기본 디렉토리
const UPLOAD_BASE_DIR = process.env.UPLOAD_BASE_DIR || 'uploads';

// Node.js 환경 호환을 위해 File 대신 Blob 사용
export interface FileWithName extends Blob {
  name: string;
  type: string;
}

export interface SaveFileOptions {
  file: FileWithName;
  type: 'document' | 'face';
  userId: string;
}

export interface SaveFileResult {
  path: string; // DB 저장용 상대 경로
  absolutePath: string; // 실제 파일 경로
}

/**
 * userId를 안전하게 sanitize
 */
function sanitizeUserId(userId: string): string {
  // UUID 형식만 허용 (user_로 시작하는 UUID)
  if (!/^user_[a-f0-9-]{36}$/i.test(userId)) {
    throw new Error('Invalid userId format');
  }
  return userId;
}

/**
 * MIME 타입에서 확장자 추출
 */
function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error(`Unsupported MIME type: ${mime}`);
  }
}

/**
 * 파일의 매직 넘버를 체크하여 실제 파일 타입 검증
 */
function checkMagicNumber(buffer: Buffer, mimeType: string): void {
  const head = buffer.subarray(0, 12); // WebP needs 12 bytes

  if (mimeType === 'application/pdf') {
    // PDF: %PDF (0x25504446)
    if (!(head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46)) {
      throw new Error('File is not a valid PDF');
    }
  } else if (mimeType === 'image/jpeg') {
    // JPEG: FFD8FF
    if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) {
      throw new Error('File is not a valid JPEG');
    }
  } else if (mimeType === 'image/png') {
    // PNG: 89504E470D0A1A0A
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const isValid = pngSignature.every((byte, index) => head[index] === byte);
    if (!isValid) {
      throw new Error('File is not a valid PNG');
    }
  } else if (mimeType === 'image/webp') {
    // WebP: RIFF....WEBP (0x52494646....57454250)
    // First 4 bytes: RIFF
    const isRiff = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
    // Bytes 8-11: WEBP
    const isWebp = head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    if (!isRiff || !isWebp) {
      throw new Error('File is not a valid WebP');
    }
  } else if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    // HEIC/HEIF: ftyp box at offset 4-7 (0x66747970)
    // Followed by brand: heic, mif1, msf1, etc.
    const isFtyp = head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70;
    if (!isFtyp) {
      throw new Error('File is not a valid HEIC/HEIF');
    }
    // Optional: Check brand (bytes 8-11) for specific HEIF variants
    // For now, just checking ftyp is sufficient
  }
}

/**
 * 파일 검증 (타입, 크기)
 */
export function validateKycFile(file: FileWithName, type: 'document' | 'face'): void {
  const allowedTypes = type === 'document' ? ALLOWED_DOCUMENT_TYPES : ALLOWED_FACE_TYPES;

  // MIME 타입 검증
  if (!allowedTypes.has(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Allowed types: ${Array.from(allowedTypes).join(', ')}`);
  }

  // 파일 크기 검증
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit: ${(file.size / 1024 / 1024).toFixed(2)}MB > 10MB`);
  }

  // 빈 파일 체크
  if (file.size === 0) {
    throw new Error('File is empty');
  }
}

/**
 * 디렉토리가 없으면 생성
 */
async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * KYC 파일 저장
 */
export async function saveKycFile(options: SaveFileOptions): Promise<SaveFileResult> {
  const { file, type, userId } = options;

  // 1. userId 검증
  const safeUserId = sanitizeUserId(userId);

  // 2. 파일 검증
  validateKycFile(file, type);

  // 3. 파일 버퍼 읽기
  const buffer = Buffer.from(await file.arrayBuffer());

  // 4. 매직 넘버 체크
  checkMagicNumber(buffer, file.type);

  // 5. 저장 경로 생성
  const subDir = type === 'document' ? 'kyc-documents' : 'kyc-faces';
  const dir = path.join(process.cwd(), UPLOAD_BASE_DIR, subDir, safeUserId);
  await ensureDirectory(dir);

  // 6. 파일명 생성 (타임스탬프 + 랜덤)
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  const ext = getExtensionFromMime(file.type);
  const filename = `${timestamp}_${random}.${ext}`;

  // 7. 파일 저장
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, buffer, { flag: 'wx' }); // wx = exclusive write (중복 방지)

  // 8. DB 저장용 상대 경로 생성
  const relativePath = `/${UPLOAD_BASE_DIR}/${subDir}/${safeUserId}/${filename}`;

  return {
    path: relativePath,
    absolutePath,
  };
}

/**
 * 파일 삭제 (롤백용)
 */
export async function deleteKycFile(absolutePath: string): Promise<void> {
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    // 파일이 없으면 무시
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to delete file:', absolutePath, error);
    }
  }
}

/**
 * 사용자의 모든 KYC 파일 삭제 (사용자 삭제 시)
 */
export async function deleteAllKycFiles(userId: string): Promise<void> {
  const safeUserId = sanitizeUserId(userId);

  const dirs = [
    path.join(process.cwd(), UPLOAD_BASE_DIR, 'kyc-documents', safeUserId),
    path.join(process.cwd(), UPLOAD_BASE_DIR, 'kyc-faces', safeUserId),
  ];

  for (const dir of dirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to delete directory:', dir, error);
    }
  }
}
