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