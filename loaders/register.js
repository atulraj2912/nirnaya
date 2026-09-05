/**
 * Registers the @/ path alias resolver before any imports execute.
 *
 * Used via: node --import ./loaders/register.js server.js
 *
 * The --import flag runs this module BEFORE the main entry point,
 * ensuring the resolver is active when server.js's imports (which use
 * @/ aliases) are resolved by Node.js.
 */

import { register } from "node:module";

// register(specifier, parentURL) — specifier is resolved relative to parentURL.
// import.meta.url is this file's URL. So "./resolve-alias.js" resolves
// to the sibling file in the same directory.
register("./resolve-alias.js", import.meta.url);
