/**
 * HTTP header values must be ASCII (RFC 7230). Common typographic Unicode
 * characters that sneak in from workflow names, node display names, or copy-pasted
 * prompts (em-dash, en-dash, interpunct, smart quotes, ellipsis, NBSP) cause
 * opaque failures at the request layer — Node fetch throws "ByteString" errors,
 * upstream APIs return 400 with no body. This helper folds those down to ASCII
 * before they hit any xProxy-* header.
 *
 * Source uses \uXXXX escapes for every non-ASCII codepoint so a reviewer never
 * has to guess whether two glyphs that look identical (e.g. NBSP vs space) are
 * the same byte.
 */

const REPLACEMENTS: Record<string, string> = {
	'‐': '-', // U+2010 hyphen
	'‑': '-', // U+2011 non-breaking hyphen
	'‒': '-', // U+2012 figure dash
	'–': '-', // U+2013 en dash
	'—': '-', // U+2014 em dash
	'―': '-', // U+2015 horizontal bar
	'·': '-', // U+00B7 middle dot / interpunct
	'•': '-', // U+2022 bullet
	'‘': "'", // U+2018 left single quote
	'’': "'", // U+2019 right single quote / typographic apostrophe
	'“': '"', // U+201C left double quote
	'”': '"', // U+201D right double quote
	'…': '...', // U+2026 horizontal ellipsis
	' ': ' ', // U+00A0 non-breaking space → regular space
};

export function sanitizeHeaderValue(value: string): string {
	if (!value) return value;
	let out = '';
	for (const ch of value) {
		if (REPLACEMENTS[ch] !== undefined) {
			out += REPLACEMENTS[ch];
			continue;
		}
		const code = ch.codePointAt(0)!;
		// Keep printable ASCII (32-126) and tab (9). Drop everything else.
		if (code === 9 || (code >= 32 && code <= 126)) {
			out += ch;
		}
	}
	return out;
}
