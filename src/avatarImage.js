/**
 * Turning a chosen file into the square picture an avatar circle draws.
 *
 * Every avatar in the app is a small round <img> fed from a data URL held
 * inside the account record, so whatever the file selector hands over is what
 * the circle has to render. Passing the raw file through -- which is what each
 * upload used to do -- leaves that picture at the mercy of the source: a phone
 * photo arrives thousands of pixels wide and the browser squeezes it into 36
 * with a fast filter that reads as mush, while a small thumbnail is stretched
 * up and reads as worse. Normalising once, here, is what makes the circle sharp
 * on every screen, and it caps the bytes that ride along inside the record.
 */

/**
 * The stored edge length, in pixels.
 *
 * Twice the largest circle the app draws (the 80px preview on the registration
 * form), so a 2x display has a real pixel for every one it paints and the
 * common 36px row avatar has several to choose from. Larger buys nothing
 * visible and every byte is carried in the account record.
 */
export const AVATAR_PX = 160;

/** Quality for the JPEG re-encode -- above this the file grows faster than it improves. */
const JPEG_QUALITY = 0.9;

/**
 * Reads a File as a data URL.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

/**
 * Decodes a data URL into an image element.
 *
 * @param {string} dataUrl
 * @returns {Promise<HTMLImageElement>}
 */
const decode = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be decoded."));
    img.src = dataUrl;
  });

/**
 * Normalises a chosen image file into a square avatar data URL.
 *
 * Centre-cropped rather than squashed, because the circle is drawn with
 * `object-cover` and a picture that has already been cropped to square is the
 * one whose stored bytes are all bytes the viewer actually sees.
 *
 * Never enlarges: a source smaller than the target carries no extra detail, so
 * upscaling it would only add weight. A file that cannot be decoded -- an SVG
 * in a browser that refuses to draw it to a canvas, a format the canvas cannot
 * export -- is returned as it arrived, since a picture the browser can show is
 * better than an error over one it cannot improve.
 *
 * @param {File} file the file chosen in the picker.
 * @param {number} [size] the edge length to produce.
 * @returns {Promise<string>} a data URL to store on the record.
 */
export async function fileToAvatarDataUrl(file, size = AVATAR_PX) {
  const original = await readDataUrl(file);
  let img;
  try {
    img = await decode(original);
  } catch {
    return original;
  }

  const edge = Math.min(img.naturalWidth, img.naturalHeight);
  if (!edge) return original;
  const target = Math.min(size, edge);

  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    (img.naturalWidth - edge) / 2,
    (img.naturalHeight - edge) / 2,
    edge,
    edge,
    0,
    0,
    target,
    target,
  );

  // PNG only where the source may be transparent: a cut-out avatar re-encoded
  // as JPEG gains a black square behind it. Everything else is a photograph,
  // where JPEG is a fraction of the size for no visible difference.
  const transparent = file.type === "image/png" || file.type === "image/webp";
  try {
    return transparent
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return original;
  }
}
