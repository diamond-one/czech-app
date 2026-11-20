/** @type {import('next').NextConfig} */

import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.js',
  swDest: 'public/sw.js',
  register: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  // Add any existing config here
};

export default withSerwist(nextConfig);
