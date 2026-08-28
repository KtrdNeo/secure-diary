/**
 * tests/jsx-loader-hooks.mjs
 *
 * Node has no built-in way to import .jsx or CSS files. This lets the
 * test suite import the *real* source files directly (RadioGroup.jsx,
 * DrawingBlock.jsx, VoiceNoteBlock.jsx, and anything they transitively
 * import) rather than maintaining a separate parallel copy for testing,
 * so the schema smoke test can never silently drift from what actually
 * ships.
 *
 * - .jsx -> transformed to plain JS via esbuild (automatic JSX runtime)
 * - .css/.module.css -> stubbed to an empty module; tests here check
 *   schema/logic, not class names, so real CSS values aren't needed
 */
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return {
      format: 'module',
      source: 'export default new Proxy({}, { get: (_, prop) => String(prop) });',
      shortCircuit: true,
    };
  }

  if (url.endsWith('.jsx')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const { code } = await transform(source, {
      loader: 'jsx',
      jsx: 'automatic',
      jsxImportSource: 'react',
      format: 'esm',
      sourcefile: fileURLToPath(url),
    });
    return { format: 'module', source: code, shortCircuit: true };
  }

  return nextLoad(url, context);
}
