/**
 * Custom Node.js ESM loader that resolves the @/ path alias.
 *
 * The @/ alias (mapped to ./src/) is configured in jsconfig.json for
 * Next.js/Turbopack, but raw Node.js ESM cannot resolve it. This loader
 * hooks into Node's module resolution to translate @/ imports into
 * relative file URLs under the project's src/ directory.
 *
 * Also auto-resolves extensionless specifiers (e.g., "@/lib/env" →
 * "@/lib/env.js") since bundlers handle this transparently but
 * Node.js ESM requires explicit extensions.
 */

import { resolve as pathResolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = pathResolve(__dirname, "..");

const EXTENSIONS = [".js", ".json", ".mjs"];

/**
 * ESM resolve hook — intercepts specifier resolution.
 *
 * @param {string} specifier - The import specifier (e.g., "@/lib/auth/jwt.js")
 * @param {object} context - Resolution context (parentURL, etc.)
 * @param {function} nextResolve - Continue to the next resolver in the chain
 * @returns {object} Resolved { url: string, format?: string }
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    // Strip @/ prefix and resolve relative to src/
    const relativePath = specifier.slice(2); // remove "@/"
    let filePath = pathResolve(PROJECT_ROOT, "src", relativePath);

    // If the resolved path doesn't exist, try appending extensions
    // (bundlers resolve extensionless imports automatically)
    if (!existsSync(filePath)) {
      for (const ext of EXTENSIONS) {
        if (existsSync(filePath + ext)) {
          filePath = filePath + ext;
          break;
        }
      }
    }

    const fileUrl = pathToFileURL(filePath).href;
    return { url: fileUrl, shortCircuit: true };
  }

  // Delegate to Node's default resolver for everything else
  return nextResolve(specifier, context);
}
