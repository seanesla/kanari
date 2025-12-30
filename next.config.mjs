/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Fix for onnxruntime-web/wasm module resolution with Turbopack
  experimental: {
    turbo: {
      resolveAlias: {
        // Alias onnxruntime-web/wasm to the correct path
        "onnxruntime-web/wasm": "onnxruntime-web/dist/ort.wasm.min.mjs",
      },
    },
  },
  webpack: (config, { isServer }) => {
    // For webpack builds, also add the alias
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-web/wasm": "onnxruntime-web/dist/ort.wasm.min.mjs",
      }
    }
    return config
  },
}

export default nextConfig
