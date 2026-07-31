// middleware/lazyLoad.js

export function lazyLoad(req, res, next) {
  const originalRender = res.render.bind(res);

  res.render = (view, options, callback) => {
    originalRender(view, options, (err, html) => {
      if (err) return callback ? callback(err) : next(err);

      const optimized = html.replace(
        /<img(?![^>]*loading=)([^>]*)>/g,
        '<img loading="lazy"$1>'
      );

      // Hand the result on when another render wrapper is stacked on top of
      // this one (cacheBusting), instead of sending and cutting it out.
      if (callback) return callback(null, optimized);

      res.send(optimized);
    });
  };

  next();
}