'use client';

import { useState } from 'react';
import type { Role } from '@/lib/auth-permissions';
import { inviteUserFromAdminAction } from '@/app/(payload)/admin/invite-action';

const ROLES_FOR: Record<Role, Array<{ value: Role; label: string }>> = {
  admin: [
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Redakteur:in' },
    { value: 'reviewer', label: 'Reviewer:in' },
    { value: 'contributor', label: 'Beitragende:r' },
  ],
  editor: [
    { value: 'reviewer', label: 'Reviewer:in' },
    { value: 'contributor', label: 'Beitragende:r' },
  ],
  reviewer: [],
  contributor: [],
};

export function InviteUserButton({ sessionRole }: { sessionRole: Role }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const options = ROLES_FOR[sessionRole];
  if (options.length === 0) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const result = await inviteUserFromAdminAction(
      String(formData.get('email') ?? ''),
      formData.get('role') as Role,
      String(formData.get('displayName') ?? ''),
    );
    setBusy(false);
    setMessage(result.ok ? '✓ Einladung verschickt.' : `Fehler: ${result.error}`);
    if (result.ok) setOpen(false);
  }

  return (
    <div style={{ padding: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '6px 12px',
          background: '#1f5e6d',
          color: '#fff',
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Neue:n User einladen
      </button>
      {open && (
        <form
          action={submit}
          style={{
            marginTop: 12,
            padding: 16,
            border: '1px solid #ddd',
            borderRadius: 6,
            background: '#fff',
            maxWidth: 480,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="invite-email" style={{ display: 'block', fontSize: 12 }}>
              E-Mail
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="invite-displayName" style={{ display: 'block', fontSize: 12 }}>
              Anzeigename
            </label>
            <input
              id="invite-displayName"
              name="displayName"
              type="text"
              required
              style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="invite-role" style={{ display: 'block', fontSize: 12 }}>
              Rolle
            </label>
            <select
              id="invite-role"
              name="role"
              required
              defaultValue={options[0].value}
              style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '6px 12px',
              background: '#1f5e6d',
              color: '#fff',
              borderRadius: 4,
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Lade…' : 'Einladen'}
          </button>
        </form>
      )}
      {message && <p style={{ marginTop: 8, fontSize: 13 }}>{message}</p>}
    </div>
  );
}
