/** @type {import('next').NextConfig} */

import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  // Add any existing config here
};

export default withPWA(nextConfig);
