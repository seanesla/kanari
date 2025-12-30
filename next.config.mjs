import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Absolute path to the onnxruntime-web wasm file
const onnxWasmPath = resolve(
  __dirname,
  "node_modules/onnxruntime-web/dist/ort.wasm.min.mjs"
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Mark onnxruntime-web as external for server-side to avoid SSR bundling issues
  serverExternalPackages: ["onnxruntime-web", "@ricky0123/vad-web"],
  // Next.js 16: turbopack config moved from experimental.turbo to top-level turbopack
  turbopack: {
    resolveAlias: {
      // Alias to the main onnxruntime-web package which has proper browser exports
      // The main package will re-export what's needed
      "onnxruntime-web/wasm": "onnxruntime-web",
    },
  },
  webpack: (config, { isServer }) => {
    // For webpack builds, also add the alias with absolute path
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-web/wasm": onnxWasmPath,
      }
    }
    return config
  },
}

export default nextConfig
