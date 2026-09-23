import sharp from "sharp";
import path from "path";
import { unlink, stat } from "fs/promises";

// Re-encodes an admin's upload into something a guest can actually download.
//
// The photos that come off a phone or a camera are 4000px wide and several
// megabytes; the largest place any of them is shown on this site is a
// full-bleed hero. Uploading one unprocessed meant every guest downloading
// ~20x more image than their screen can use, on a wedding site whose audience
// is largely on mobile data.
//
// Three things happen here, and the order matters:
//
//   1. rotate() with no argument applies the EXIF orientation and then drops
//      the tag. Without it, stripping metadata (step 3) silently turns every
//      portrait phone photo on its side — the classic version of this bug.
//   2. resize() caps the long edge. `withoutEnlargement` means a small image
//      is left at its own size rather than being blown up and made worse.
//   3. The output carries no metadata at all. That is a size win, but mostly
//      it is a privacy one: phone photos carry GPS coordinates, and this is a
//      public website with the couple's home address already on the programme.
const MAX_EDGE = 2000;
const WEBP_QUALITY = 80;

// A decompression-bomb guard: a small file can declare enormous dimensions and
// cost gigabytes to decode. 50MP is far above any real camera photo here.
const MAX_INPUT_PIXELS = 50_000_000;

// Re-encoding is also a security boundary, not only a size one. The upload
// filter trusts the browser-supplied MIME type, so a file that claims to be
// image/jpeg while containing markup gets through it. Nothing survives being
// decoded to pixels and re-encoded, so a polyglot cannot reach the uploads
// directory intact. This works with the nosniff header, not instead of it.
export async function optimizeUpload(filePath) {
    const original = await stat(filePath);

    // Decode the header before anything else, and treat failure as "this is
    // not an image" rather than "optimisation did not work".
    //
    // The distinction matters. multer's filter trusts the browser-declared
    // MIME type, so a file of HTML named .jpg reaches this function. Falling
    // back to the original on *any* error stored that file and served it —
    // which the nosniff header stops a browser executing, but storing it at
    // all leaves the whole defence resting on one header. sharp decodes every
    // format the filter admits, so a decode failure means the bytes are not a
    // picture, and the upload should be refused.
    try {
        await sharp(filePath, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch {
        const error = new Error('NOT_AN_IMAGE');
        error.code = 'NOT_AN_IMAGE';
        throw error;
    }

    // Animated GIFs have to be read as animations or sharp keeps frame one and
    // silently turns a moving image into a still.
    const isGif = path.extname(filePath).toLowerCase() === '.gif';

    const target = filePath.replace(/\.[^.]+$/, '') + '.webp';

    // Writing beside the input rather than over it: sharp streams from the
    // source file, and overwriting it while it is being read truncates it.
    await sharp(filePath, {
        animated: isGif,
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: 'error'
    })
        .rotate()
        .resize({
            width: MAX_EDGE,
            height: MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true
        })
        .webp({
            quality: WEBP_QUALITY,
            effort: 5,
            // Keeps chroma detail where it shows — skin tones and the sharp
            // edges of text on a card — for a few bytes more.
            smartSubsample: true
        })
        .toFile(target);

    const optimized = await stat(target);

    // If the re-encode came out bigger, keep it anyway when the source was a
    // GIF or PNG photo (webp still decodes faster), but never keep a result
    // that is worse for no reason.
    if (optimized.size >= original.size && !isGif) {
        await unlink(target);
        return {
            filename: path.basename(filePath),
            bytesBefore: original.size,
            bytesAfter: original.size
        };
    }

    await unlink(filePath);

    return {
        filename: path.basename(target),
        bytesBefore: original.size,
        bytesAfter: optimized.size
    };
}
