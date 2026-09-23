import path from 'path';
import express from 'express';

export function staticCache(publicPath) {
  return express.static(publicPath, {
    cacheControl: true,
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      // Admin uploads get a filename that is unique per upload
      // (<timestamp>-<random>.webp, see uploadImage.js), so the bytes at a
      // given /uploads URL can never change — replacing a photo produces a new
      // URL. That makes them safe to cache for a year and never revalidate,
      // which is the strongest caching available and costs nothing here.
      else if (filePath.includes(`${path.sep}uploads${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Images shipped in the repo keep a shorter life: their filenames are
      // stable, so a redeploy that changes one has to be able to take effect.
      else if (/\.(jpg|jpeg|png|gif|webp|svg|JPG|PNG)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
      else if (/\.(css|js)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
      else if (/\.(woff2|woff|ttf)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  });
}