import type { CollectionConfig } from 'payload';
import { renderForgotPasswordMail } from '@/lib/mail-templates/forgot-password';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 24,   // 24h
    maxLoginAttempts: 5,
    lockTime: 600 * 1000,             // 10min
    verify: false,                    // V1.6: Magic-Set-Password statt Verify-Email
    forgotPassword: {
      generateEmailHTML: (args) => {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const token = (args as { token: string }).token;
        const email = (args as { user: { email: string } }).user.email;
        const resetLink = `${baseUrl}/passwort-setzen?token=${encodeURIComponent(token)}`;
        return renderForgotPasswordMail({ to: email, resetLink }).html;
      },
      generateEmailSubject: () => 'Passwort-Reset für deinen PflegeAtlas-Account',
    },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'displayName', 'role', 'disabled', 'invitedAt'],
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if ((user as { disabled?: boolean }).disabled) {
          throw new Error('Account ist gesperrt (disabled).');
        }
      },
    ],
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      label: 'Anzeigename',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Rolle',
      required: true,
      defaultValue: 'contributor',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Redakteur:in', value: 'editor' },
        { label: 'Reviewer:in', value: 'reviewer' },
        { label: 'Beitragende:r', value: 'contributor' },
      ],
    },
    {
      name: 'disabled',
      type: 'checkbox',
      label: 'Gesperrt',
      defaultValue: false,
      admin: {
        description: 'Wenn aktiv, ist Login blockiert. Datensatz bleibt für Audit + Relationships.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Kurzprofil',
    },
    {
      name: 'pflegerischeRolle',
      type: 'select',
      label: 'Pflegerische Rolle (optional)',
      options: [
        { label: 'Pflegefachkraft', value: 'pflegefachkraft' },
        { label: 'PDL (Pflegedienstleitung)', value: 'pdl' },
        { label: 'WBL (Wohnbereichsleitung)', value: 'wbl' },
        { label: 'Auszubildende:r', value: 'auszubildende' },
        { label: 'Sonstiges', value: 'sonstiges' },
      ],
    },
    {
      name: 'bundesland',
      type: 'select',
      label: 'Bundesland / Region (optional)',
      options: [
        { label: 'Baden-Württemberg', value: 'baden_wuerttemberg' },
        { label: 'Bayern', value: 'bayern' },
        { label: 'Berlin', value: 'berlin' },
        { label: 'Brandenburg', value: 'brandenburg' },
        { label: 'Bremen', value: 'bremen' },
        { label: 'Hamburg', value: 'hamburg' },
        { label: 'Hessen', value: 'hessen' },
        { label: 'Mecklenburg-Vorpommern', value: 'mecklenburg_vorpommern' },
        { label: 'Niedersachsen', value: 'niedersachsen' },
        { label: 'Nordrhein-Westfalen', value: 'nordrhein_westfalen' },
        { label: 'Rheinland-Pfalz', value: 'rheinland_pfalz' },
        { label: 'Saarland', value: 'saarland' },
        { label: 'Sachsen', value: 'sachsen' },
        { label: 'Sachsen-Anhalt', value: 'sachsen_anhalt' },
        { label: 'Schleswig-Holstein', value: 'schleswig_holstein' },
        { label: 'Thüringen', value: 'thueringen' },
        { label: 'Österreich', value: 'oesterreich' },
        { label: 'Schweiz', value: 'schweiz' },
        { label: 'Sonstiges', value: 'sonstiges' },
      ],
    },
    {
      name: 'avatar',
      type: 'relationship',
      relationTo: 'media',
      label: 'Profilbild',
      hasMany: false,
    },
    {
      name: 'setPasswordToken',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'setPasswordTokenExpiresAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Eingeladen durch',
      hasMany: false,
      admin: { readOnly: true },
    },
    {
      name: 'invitedAt',
      type: 'date',
      label: 'Eingeladen am',
      admin: { readOnly: true },
    },
  ],
};
