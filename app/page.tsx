import { login } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default function LoginPage() {
  async function doLogin(formData: FormData) {
    'use server';
    const ok = await login(String(formData.get('username') || ''), String(formData.get('password') || ''));
    if (ok) redirect('/dashboard');
    redirect('/?error=1');
  }

  return (
    <main className="mx-auto max-w-md p-10">
      <h1 className="mb-6 text-3xl font-bold">{process.env.NEXT_PUBLIC_APP_NAME || 'Box League'}</h1>
      <form action={doLogin} className="space-y-4 rounded border border-zinc-800 p-6">
        <input name="username" placeholder="Username" className="w-full rounded bg-zinc-900 p-2" />
        <input name="password" type="password" placeholder="Password" className="w-full rounded bg-zinc-900 p-2" />
        <button className="w-full rounded bg-sky-600 p-2 font-semibold">Sign in</button>
      </form>
    </main>
  );
}
