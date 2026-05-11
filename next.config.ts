import { realpathSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

/**
 * Next.js 16 lance Turbopack par défaut. Dès qu’on définit `webpack()`,
 * il faut passer explicitement `--webpack` sur `next dev` et `next build`
 * (voir scripts dans package.json), sinon la build échoue ou ignore cette config.
 */
const appDir = path.dirname(fileURLToPath(import.meta.url));
const realAppRoot = realpathSync(appDir);

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /historique was replaced by /chat (conversational chat with session history).
      { source: '/historique', destination: '/chat', permanent: true },
      { source: '/historique/:path*', destination: '/chat', permanent: true },
    ]
  },

  webpack(config) {
    // Windows : le CWD peut être `...\desktop\...` alors que le disque expose
    // `...\Desktop\...`. Webpack traite alors certains chemins comme des modules
    // distincts → double instance de React et erreur « layout router ».
    // Forcer la résolution de node_modules depuis le chemin réel canonique.
    config.resolve.modules = [
      path.join(realAppRoot, "node_modules"),
      "node_modules",
    ];

    return config;
  },
};

export default nextConfig;
