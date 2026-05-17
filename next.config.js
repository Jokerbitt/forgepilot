/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Disable parallel worker threads to prevent Windows FS race conditions
    workerThreads: false,
    cpus: 1,
  },
}

module.exports = nextConfig
