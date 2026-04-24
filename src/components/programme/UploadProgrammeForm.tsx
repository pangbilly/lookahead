'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadProgramme } from '@/actions/programme';

type Props = {
  projectId: string;
};

export function UploadProgrammeForm({ projectId }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError('Pick a PDF to upload.');
      return;
    }
    const formData = new FormData();
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadProgramme(projectId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(
        `/orgs/${result.orgSlug}/projects/${result.projectId}/programmes/${result.programmeId}`,
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="file">Programme PDF</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-[color:var(--foreground)] file:mr-4 file:border file:border-[color:var(--border)] file:bg-transparent file:px-4 file:py-2 file:text-[color:var(--foreground-strong)] file:text-xs file:uppercase file:tracking-[0.08em] file:font-bold hover:file:border-[color:var(--accent)] hover:file:text-[color:var(--foreground-strong)]"
        />
        <p className="text-xs text-[color:var(--foreground)]/60">
          MS Project &ldquo;Gantt Chart&rdquo; or Primavera P6 &ldquo;Classic
          Schedule&rdquo; exports. 25 MiB maximum.
        </p>
      </div>

      {file && (
        <p className="text-xs text-[color:var(--foreground)]/70">
          Selected: <span className="text-[color:var(--foreground-strong)]">{file.name}</span>{' '}
          ({Math.round(file.size / 1024).toLocaleString()} KB)
        </p>
      )}

      {error && (
        <p className="text-sm text-[color:var(--accent)]" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending || !file} size="lg">
        {isPending ? 'Uploading and extracting…' : 'Upload programme'}
      </Button>
    </form>
  );
}
