# sprite-magic-importer
Custom node-sass importer for create CSS Sprites like Magic Imports of the Compass.

```scss
/* Input */
@import "icons/*.png";
@include all-icons-sprites;
```

```css
/* Result */
.icons-sprite, .icons-chrome, ...snip..., .icons-safari {
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

See: [Example](https://github.com/irok/sprite-magic-importer/tree/master/example)

## Supported features
* `all-<map>-sprites`
* `<map>-sprite()`
* `<map>-<sprite>`
* [Magic Selectors](http://compass-style.org/help/tutorials/spriting/magic-selectors/)
* `$<map>-layout`
    * default: `binary-tree` (specify the value of spritesmith's algorithm option)
* `$<map>-spacing`
    * default: `0` (specify no units)
* `$<map>-sprite-dimensions`
    * default: `false`
* `$<map>-sprite-base-class`
    * default: `.<map>-sprite`
* `$<map>-class-separator`
    * default: `$default-sprite-separator`
* `$default-sprite-separator`
    * default: `-`

## Usage
Create `importer.js`

```js
var spriteMagicImporter = require('sprite-magic-importer');

module.exports = spriteMagicImporter({
    // http://compass-style.org/help/documentation/configuration-reference/
    images_dir:                 'src/images',
    generated_images_dir:       'htdocs/images',
    http_stylesheets_path:      'css',
    http_generated_images_path: 'images',

    // configuration variables
    vars: {
        '$default-sprite-separator': '_',

        // for icons/*.png
        '$icons-layout': 'diagonal',
        '$icons-spacing': 0,
        '$icons-sprite-dimensions': true,
        '$icons-sprite-base-class': '.list',
        '$icons-class-separator': '-'
    },

    // imagemin-pngquant options
    pngquant: {
        quality: 75,
        speed: 10
    }
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

### CLI
```bash
node-sass --importer ./importer.js -o dist/css src/app.scss
```

# License

The MIT License (MIT)

Copyright (c) 2016 Takayuki Irokawa
