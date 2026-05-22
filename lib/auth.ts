import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';

const COOKIE_NAME = 'boxleague_session';

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return false;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return false;
  const cookieSecure = process.env.COOKIE_SECURE === 'true';
  (await cookies()).set(COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete({ name: COOKIE_NAME, path: '/' });
}

export async function requireAuth() {
  const session = (await cookies()).get(COOKIE_NAME)?.value;
  if (!session) redirect('/');
  const user = await prisma.user.findUnique({ where: { id: session } });
  if (!user) redirect('/');
  return user;
}
