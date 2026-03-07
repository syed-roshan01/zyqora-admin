/** @type {import('next').NextConfig} */
const nextConfig = {
    // Not using Next Image — disable the optimizer to remove GHSA-9g9p-9gw9-jx7f surface
    images: { unoptimized: true },
};
export default nextConfig;
