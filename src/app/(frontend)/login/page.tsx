import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session) {
    redirect(params.next || '/mein-bereich');
  }
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 font-serif text-3xl">Anmelden</h1>
      <LoginForm next={params.next ?? ''} />
    </main>
  );
}
