import { NextResponse } from 'next/server';
import { getProgrammeForUser } from '@/actions/programme';
import { requireUser } from '@/lib/auth-helpers';
import { getProgrammePdf } from '@/lib/blob';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ programmeId: string }> },
) {
  const { programmeId } = await params;
  const user = await requireUser();

  const programme = await getProgrammeForUser(programmeId, user.id);
  if (!programme) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const blob = await getProgrammePdf(programme.sourceFileUrl);
  if (!blob) {
    return NextResponse.json({ error: 'File missing' }, { status: 404 });
  }

  return new NextResponse(blob.stream as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${programme.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
