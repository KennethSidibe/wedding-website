// middleware/lazyLoad.js

export function lazyLoad(req, res, next) {
  const originalRender = res.render.bind(res);

  res.render = (view, options, callback) => {
    originalRender(view, options, (err, html) => {
      if (err) return next(err);

      const optimized = html.replace(
        /<img(?![^>]*loading=)([^>]*)>/g,
        '<img loading="lazy"$1>'
      );

      res.send(optimized);
    });
  };

  next();
}