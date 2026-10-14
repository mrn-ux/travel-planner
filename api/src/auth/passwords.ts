import bcrypt from 'bcrypt';

const COST = 12;
const MIN_BYTES = 8;
const MAX_BYTES = 72; // bcrypt only uses the first 72 bytes

/** Returns a user-facing message when the password is not acceptable, otherwise null. */
export function validatePassword(password: string): string | null {
  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes < MIN_BYTES) return 'Password must be at least 8 characters.';
  if (bytes > MAX_BYTES) return 'Password must be at most 72 bytes long.';
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A real bcrypt hash of a throwaway value. Unknown emails are compared against it so that a failed
// login takes about as long whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('faro-dummy-password', COST);

export async function verifyAgainstDummy(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}
