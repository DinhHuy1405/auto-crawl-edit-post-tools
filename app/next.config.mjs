/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow serving local video files
  async headers() {
    return [
      {
        source: '/api/file/:path*',
        headers: [
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
}

export default nextConfig
