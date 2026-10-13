# Primetime authoring source

Edit the readable HTML, CSS and JavaScript in this directory. Run `npm ci` and
`npm run build:primetime` to regenerate `public/primetime/` and the content hashes
in its HTML. Commit both the source changes and generated files.

The pinned Terser development dependency removes JavaScript formatting/comments
and renames local variables. Compression, property renaming and top-level
renaming are disabled; function and class names are retained. Terser does not
load in the browser. The existing HTML and CSS are copied with LF line endings.
The captured `public/primetime/hha-capabilities.json` catalog is preserved.

`npm run check:primetime` fails without rewriting files if the production
artifacts do not match their source. The repository build runs this check, and
the authentication, mode, file, filter, dashboard and review tests execute the
generated production JavaScript in `public/primetime/`.
