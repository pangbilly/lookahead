import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Programme PDFs can be up to 25 MiB (enforced in uploadProgramme).
      // Keep 5 MiB of headroom for multipart encoding overhead.
      bodySizeLimit: '30mb',
    },
  },
};

export default nextConfig;
