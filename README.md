# sprite-magic-importer
Custom node-sass importer for create CSS Sprites like Magic Imports of the Compass.

Input

```scss
@import "icons/*.png";
@include all-icons-sprites(true);
```

Output

```css
.icons-sprite, .icons-chrome, .icons-firefox, .icons-ie {
  background-image: url("../images/icons.png?_=d25a48e");
  background-repeat: no-repeat;
}

.icons-chrome {
  background-position: -32px 0;
  width: 32px;
  height: 32px;
}

...snip...

.icons-ie:hover, .icons-ie.ie-hover {
  background-position: -64px 0;
}

```

See: [Example](https://github.com/irok/sprite-magic-importer/tree/master/example)

## Supported Compass features

### Mixins and Functions
* `@mixin all-<map>-sprites()`
* `@mixin <map>-sprite()`
* `@mixin <map>-sprite-dimensions()`
* `@function <map>-sprite-width()`
* `@function <map>-sprite-height()`

### [Magic Selectors](http://compass-style.org/help/tutorials/spriting/magic-selectors/)
Supported are hover, target, active, and focus.

### Customization Options
* `$disable-magic-sprite-selectors`
    * default: `false`
* `$sprite-selectors`
    * default: `hover, target, active, focus`
* `$default-sprite-separator`
    * default: `-`
* `$<map>-sprite-base-class`
    * default: `.<map>-sprite`
* `$<map>-sprite-dimensions`
    * default: `false`
* `$<map>-class-separator`
    * default: `$default-sprite-separator`

## Usage
Create configure script.

```js:importer.js
var SpriteMagicImporter = require('sprite-magic-importer');

module.exports = SpriteMagicImporter({
    // http://compass-style.org/help/documentation/configuration-reference/
    sass_dir:                   'src/sass',
    images_dir:                 'src/images',
    generated_images_dir:       'htdocs/images',
    http_stylesheets_path:      'css',
    http_generated_images_path: 'images',

    // spritesmith options
    spritesmith: {
        algorithm: `binary-tree`,
        padding: 0
    },

    // imagemin-pngquant options
    pngquant: {
        quality: 75,
        speed: 10
    }
});
```

```js:build.js
var sass = require('node-sass');
var importer = require('./importer');

sass.render({
    ...
    importer: importer
    ...
});
```

### configure options
* project_path `string` - The path to the root of the project.
    * default: `process.cwd()`
* http_path `string` - The path to the project when running within the web server.
    * default: `/`
* sass_dir `string` - The directory where the sass stylesheets are kept. It is relative to the project_path.
    * default: `sass`
* css_dir `string` - The directory where the css stylesheets are kept. It is relative to the project_path.
    * default: `stylesheets`
* images_dir `string` - The directory where the images are kept. It is relative to the project_path.
    * default: `images`
* generated_images_dir `string` - The directory where generated images are kept. It is relative to the project_path.
    * default: images_dir
* http_generated_images_path `string` - The full http path to generated images on the web server.
    * default: http_path + `/` + generated_images_dir
* http_stylesheets_path `string` - The full http path to stylesheets on the web server.
    * default: http_path + `/` + css_dir
* use_cache `boolean` - Set this to true to speed up using the cache.
    * default: true
* cache_dir `string` - The full path to where cache of temporary stylesheets are kept.
    * default: os.tmpdir() + `/sprite-magic-importer`
* retina_mark `regexp` - Regular expression for detecting high resolution image from file name.
    * default: `/@(\d)x$/`
* spritesmith `object` - This option is passed to the `Spritesmith.run()`.
    * See: https://www.npmjs.com/package/spritesmith#spritesmithrunparams-callback
* pngquant `object` - This option is passed to the `Spritesmith.run()`.
    * See: https://www.npmjs.com/package/imagemin-pngquant#options

### CLI
```bash
node-sass --importer ./importer.js -o dist/css src/app.scss
```

## Retina support

```scss
@import "icons/*.png";              // '*@2x.png' will not be imported
@include all-icons-sprites(true);

@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx) {
    @import "icons/*@2x.png";
    @include all-icons-sprites();
}
```

## License

The MIT License (MIT)

Copyright (c) 2016 Takayuki Irokawa
