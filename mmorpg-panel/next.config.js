/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  // Allow accessing the dev server from other origins on your LAN / WSL host.
  // Add any IPs or hostnames you use to hit the dev server here.
  allowedDevOrigins: ["172.26.160.1", "localhost", "127.0.0.1"],
};
