/**
 * Error validasi buatan service (mis. "Stok tidak cukup") boleh ditampilkan apa adanya ke admin.
 * Error dari Prisma/database (nama kelas diawali "PrismaClient", atau punya kode seperti P2002)
 * TIDAK boleh, karena berisi detail teknis query; error itu dicatat ke Log Error dan dibalas pesan umum.
 */
export function isUserFacingError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    !error.name.startsWith('PrismaClient') &&
    !error.constructor?.name?.startsWith('PrismaClient') &&
    !('code' in error)
  );
}
