# sprite-magic-importer
Custom node-sass importer for create CSS Sprites like Magic Imports of the Compass.

## Deprecation Notice

CSS Sprites was a performance optimization technique for HTTP/1.1 to reduce the number of HTTP requests. With HTTP/2 and HTTP/3, which support multiplexing, **this technique is generally no longer necessary**.

For new projects, consider using:
- Individual SVG icons (HTTP/2 handles multiple requests efficiently)
- SVG sprites using `<symbol>` and `<use>`
- Inline SVG

This library provides a **`no_sprite` migration mode** to help you transition away from CSS Sprites while keeping your existing SASS code intact. See [Migration Guide](#migration-guide) below.

Input

```scss
@import "icons/*.png";
@include all-icons-sprites(true);

.foo {
    .bar {
        @include icons-sprite(chrome);
    }
}
```

Output

```css
.icons-sprite, .icons-chrome, .icons-firefox, .icons-ie, .foo .bar {
  background-image: url("/images/icons.png?_=bfa627d");
  background-repeat: no-repeat;
}

.icons-chrome {
  background-position: -32px 0;
  width: 32px;
  height: 32px;
}

...snip...

.foo .bar {
  background-position: -32px 0;
}

.foo .bar:hover, .foo .bar.chrome-hover {
  background-position: 0 0;
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

importer.js

```js
var SpriteMagicImporter = require('sprite-magic-importer');

module.exports = SpriteMagicImporter({
    // http://compass-style.org/help/documentation/configuration-reference/
    sass_dir:                   'src/sass',
    images_dir:                 'src/images',
    generated_images_dir:       'dist/images',
    http_stylesheets_path:      '/css',
    http_generated_images_path: '/images',

    // spritesmith options
    spritesmith: {
        algorithm: `diagonal`,
        padding: 2
    },

    // imagemin-pngquant options
    pngquant: {
        quality: 75,
        speed: 10
    }
});
```

build.js

**Plese note:** You cannot use `sass.renderSync` with this importer.

```js
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
* pngquant `object` - This option is passed to the `imagemin-pngquant`.
    * See: https://www.npmjs.com/package/imagemin-pngquant#options
* no_sprite `boolean` - Set this to true to disable sprite generation. Each icon will reference its individual image file instead of a combined sprite sheet. This is useful for migrating away from CSS Sprites.
    * default: `false`

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

## Migration Guide

If you want to stop using CSS Sprites and remove the dependency on this library, follow these steps:

### Step 1: Enable no_sprite mode

Update your importer configuration:

```js
var SpriteMagicImporter = require('sprite-magic-importer');

module.exports = SpriteMagicImporter({
    sass_dir:                   'src/sass',
    images_dir:                 'src/images',
    generated_images_dir:       'dist/images',
    http_stylesheets_path:      '/css',
    http_generated_images_path: '/images',
    cache_dir:                  '.cache',  // Use a local cache directory
    no_sprite: true                        // Enable no_sprite mode
});
```

### Step 2: Build your project

Run your build process. Instead of generating a combined sprite image, the importer will generate SASS that references each image file individually.

**Sprite mode output:**
```css
.icons-chrome {
  background-image: url("/images/icons.png");
  background-position: -32px 0;
}
```

**no_sprite mode output:**
```css
.icons-chrome {
  background-image: url("/images/foobar/icons/chrome.png");
  background-repeat: no-repeat;
}
```

### Step 3: Copy generated SASS to your project

Copy the generated `.scss` file from your `cache_dir` into your project's SASS directory.

### Step 4: Remove the @import statement

Replace the magic import with a regular import:

```scss
// Before
@import "icons/*.png";
@include all-icons-sprites(true);

// After
@import "icons-generated";  // The copied SCSS file
@include all-icons-sprites(true);
```

### Step 5: Remove sprite-magic-importer

You can now remove this library from your dependencies and switch to Dart Sass or any other SASS compiler.

```bash
npm uninstall sprite-magic-importer node-sass
npm install sass
```

## License

The MIT License (MIT)

Copyright (c) 2016 Takayuki Irokawa
