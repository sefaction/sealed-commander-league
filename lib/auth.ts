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
  (await cookies()).set(COOKIE_NAME, user.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return true;
}

export async function logout() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function requireAuth() {
  const session = (await cookies()).get(COOKIE_NAME)?.value;
  if (!session) redirect('/');
  const user = await prisma.user.findUnique({ where: { id: session } });
  if (!user) redirect('/');
  return user;
}
