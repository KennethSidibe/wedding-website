// middleware/lazyLoad.js

export function lazyLoad(req, res, next) {
  const originalRender = res.render.bind(res);

  res.render = (view, options, callback) => {
    originalRender(view, options, (err, html) => {
      if (err) return callback ? callback(err) : next(err);

      // `decoding="async"` as well as `loading="lazy"`: lazy decides *when*
      // the bytes are fetched, async decides whether decoding them blocks the
      // main thread when they arrive. On a page of large photos the second is
      // what stops scrolling from stuttering.
      //
      // Both are skipped for an <img> that already declares `loading`, so a
      // template can opt an above-the-fold image out with loading="eager" —
      // lazy-loading the LCP element delays it, which is the opposite of the
      // point. Nothing does today; the hero is a CSS background and is
      // preloaded from the head instead (see contentLocals.heroPreload).
      const optimized = html.replace(
        /<img(?![^>]*loading=)([^>]*)>/g,
        '<img loading="lazy" decoding="async"$1>'
      );

      // Hand the result on when another render wrapper is stacked on top of
      // this one (cacheBusting), instead of sending and cutting it out.
      if (callback) return callback(null, optimized);

      res.send(optimized);
    });
  };

  next();
}