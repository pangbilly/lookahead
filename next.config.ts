import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdfjs-dist dynamically imports pdf.worker.mjs at runtime. Turbopack can't
  // trace that import, so left bundled it fails with "cannot find module".
  // Marking it external keeps Node's native resolution in charge.
  serverExternalPackages: ['pdfjs-dist'],
  experimental: {
    serverActions: {
      // Programme PDFs can be up to 25 MiB (enforced in uploadProgramme).
      // Keep 5 MiB of headroom for multipart encoding overhead.
      bodySizeLimit: '30mb',
    },
  },
};

export default nextConfig;
