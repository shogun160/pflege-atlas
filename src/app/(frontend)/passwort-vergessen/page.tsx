import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';

export default function PasswortVergessenPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 font-serif text-3xl">Passwort vergessen?</h1>
      <p className="mb-4">
        Gib deine E-Mail ein. Wir schicken dir einen Link zum Setzen eines neuen
        Passworts.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
