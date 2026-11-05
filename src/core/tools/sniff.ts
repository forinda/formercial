// What kind of file this is, from its first bytes: a renamed file can't pass as
// another kind. Office files are ZIPs, told apart by the names inside.

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v)
const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, Math.min(to, b.length)))

/** ZIP-based office formats, from the entries a ZIP's first kilobytes mention. */
function office(b: Uint8Array): string | null {
  const head = ascii(b, 0, 4096)
  if (head.includes('mimetypeapplication/vnd.oasis.opendocument.text')) return 'odt'
  if (head.includes('mimetypeapplication/vnd.oasis.opendocument.spreadsheet')) return 'ods'
  if (head.includes('mimetypeapplication/vnd.oasis.opendocument.presentation')) return 'odp'
  if (head.includes('word/')) return 'docx'
  if (head.includes('xl/')) return 'xlsx'
  if (head.includes('ppt/')) return 'pptx'
  // [Content_Types].xml first, with the parts further in: look at the name of the main part.
  if (head.includes('[Content_Types].xml')) return 'ooxml'
  return null
}

export function sniff(bytes: Uint8Array): string | null {
  const b = bytes
  if (starts(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'
  if (starts(b, [0x50, 0x4b, 0x03, 0x04])) return office(b)
  if (starts(b, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return 'rtf'
  if (starts(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm'
  if (ascii(b, 4, 8) === 'ftyp') return ascii(b, 8, 10) === 'qt' ? 'mov' : 'mp4'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return 'wav'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'AVI ') return 'avi'
  if (ascii(b, 0, 4) === 'OggS') return 'ogg'
  if (ascii(b, 0, 4) === 'fLaC') return 'flac'
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'mp3'
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return 'gif'
  if (starts(b, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (starts(b, [0xff, 0xd8, 0xff])) return 'jpg'
  // Text: HTML if it looks like markup, after an optional byte-order mark and spaces.
  const text = ascii(b, starts(b, [0xef, 0xbb, 0xbf]) ? 3 : 0, 1024)
    .trimStart()
    .toLowerCase()
  if (/^(<!doctype html|<html|<head|<body|<meta|<div|<p[ >]|<h[1-6])/.test(text)) return 'html'
  return null
}
