# sprite-magic-importer
Custom node-sass importer for create CSS Sprites like Magic Imports of the Comass.

```scss
@import "icons/*.png";
@include all-icons-sprites;
```

```css
/* Result */
.icons-sprite, .icons-chrome, .icons-edge, .icons-firefox, .icons-ie11, .icons-ie9, .icons-opera, .icons-safari {
  background: url("../images/icons.png") no-repeat;
}

.icons-chrome {
  background-position: 0 0;
}

...snip...

.icons-safari {
  background-position: 0 -80px;
}
```

## Usage
Create `importer.js`.

```js
var spriteMagicImporter = require('sprite-magic-importer');

module.exports = spriteMagicImporter({
    images_dir:                 'src/images',
    generated_images_dir:       'htdocs/images',
    http_stylesheets_path:      'css',
    http_generated_images_path: 'images'
});
```

```js
var sass = require('node-sass');
var importer = require('./importer');

sass.render({
    ...
    importer: importer
    ...
});
```

## Options
See: [Configuration Reference | Compass Documentation](http://compass-style.org/help/documentation/configuration-reference/)

## CLI
```bash
node-sass --importer ./importer.js -o htdocs/css src/app.scss
```
