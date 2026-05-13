import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

export function cacheBusting(req, res, next) {
  const originalRender = res.render.bind(res);

  res.render = (view, options, callback) => {
    originalRender(view, options, (err, html) => {
      if (err) return next(err);
      const busted = html.replace(
        /(href|src)="(\/[^"]+\.(css|js))"/g,
        `$1="$2?v=${version}"`
      );
      res.send(busted);
    });
  };

  next();
}