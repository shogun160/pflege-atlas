'use client';

import { useRouter } from 'next/navigation';
import { SectionCheckbox } from '@/components/SectionCheckbox';

export interface CorrectionValues {
  relatedArticleSlug: string;
  correctionReason: string;
  selectedSections: string[];
  editedDefinition: string;
  editedPraxis: string;
  editedRisiken: string;
  editedQuellen: string;
}

export interface CorrectionSetters {
  setRelatedArticleSlug: (v: string) => void;
  setCorrectionReason: (v: string) => void;
  setSelectedSections: (v: string[]) => void;
  setEditedDefinition: (v: string) => void;
  setEditedPraxis: (v: string) => void;
  setEditedRisiken: (v: string) => void;
  setEditedQuellen: (v: string) => void;
}

interface Props {
  articles: { slug: string; title: string }[];
  articleSections: {
    definition: string;
    praxis: string;
    risiken: string;
    quellen: string;
  };
  values: CorrectionValues;
  setters: CorrectionSetters;
  fieldErrors?: Record<string, string>;
}

const SECTIONS: Array<{ key: 'definition' | 'praxis' | 'risiken' | 'quellen'; label: string }> = [
  { key: 'definition', label: '1. Definition / Kurzantwort' },
  { key: 'praxis', label: '2. Praxis' },
  { key: 'risiken', label: '3. Risiken & Fallstricke' },
  { key: 'quellen', label: '4. Quellen & Weiterführendes' },
];

function FieldError({ name, errors }: { name: string; errors?: Record<string, string> }) {
  if (!errors?.[name]) return null;
  return (
    <p id={`error-${name}`} className="mt-1 text-sm text-accent">
      {errors[name]}
    </p>
  );
}

export function CorrectionFields({ articles, articleSections, values, setters, fieldErrors }: Props) {
  const router = useRouter();

  const handleArticleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const slug = e.target.value;
    setters.setRelatedArticleSlug(slug);
    if (slug) {
      router.push(`/einreichen?type=correction&article=${encodeURIComponent(slug)}`);
    }
  };

  const handleSectionCheckedChange = (sectionKey: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...values.selectedSections, sectionKey]))
      : values.selectedSections.filter((s) => s !== sectionKey);
    setters.setSelectedSections(next);
  };

  const getSetterForSection = (sectionKey: string): ((v: string) => void) => {
    switch (sectionKey) {
      case 'definition':
        return setters.setEditedDefinition;
      case 'praxis':
        return setters.setEditedPraxis;
      case 'risiken':
        return setters.setEditedRisiken;
      case 'quellen':
        return setters.setEditedQuellen;
      default:
        return () => {};
    }
  };

  const getCurrentValueForSection = (sectionKey: string): string => {
    switch (sectionKey) {
      case 'definition':
        return values.editedDefinition;
      case 'praxis':
        return values.editedPraxis;
      case 'risiken':
        return values.editedRisiken;
      case 'quellen':
        return values.editedQuellen;
      default:
        return '';
    }
  };

  return (
    <>
      <div>
        <label htmlFor="field-relatedArticleSlug" className="block font-semibold">
          Bezogen auf *
        </label>
        <select
          id="field-relatedArticleSlug"
          name="relatedArticleSlug"
          value={values.relatedArticleSlug}
          onChange={handleArticleChange}
          className="mt-1 w-full rounded-md border border-rule bg-white p-2"
        >
          <option value="">— wählen —</option>
          {articles.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.title}
            </option>
          ))}
        </select>
        <FieldError name="relatedArticleSlug" errors={fieldErrors} />
      </div>

      {values.relatedArticleSlug && (
        <fieldset className="space-y-4 border border-rule rounded-md p-4">
          <legend className="font-semibold px-1">Welche Sektionen möchtest du korrigieren?</legend>
          {SECTIONS.map((sec) => (
            <SectionCheckbox
              key={sec.key}
              sectionKey={sec.key}
              label={sec.label}
              originalValue={articleSections[sec.key]}
              currentValue={getCurrentValueForSection(sec.key)}
              onChange={getSetterForSection(sec.key)}
              onCheckedChange={(checked) => handleSectionCheckedChange(sec.key, checked)}
              checked={values.selectedSections.includes(sec.key)}
            />
          ))}
          <FieldError name="selectedSections" errors={fieldErrors} />
        </fieldset>
      )}

      <div>
        <label htmlFor="field-correctionReason" className="block font-semibold">
          Begründung (optional)
        </label>
        <textarea
          id="field-correctionReason"
          name="correctionReason"
          maxLength={2000}
          rows={4}
          value={values.correctionReason}
          onChange={(e) => setters.setCorrectionReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-rule bg-white p-2"
        />
        <FieldError name="correctionReason" errors={fieldErrors} />
      </div>
    </>
  );
}
