# sprite-magic-importer
Custom node-sass importer for create CSS Sprites like Magic Imports of the Comass.

```scss
/* Input */
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

See: [Example](https://github.com/irok/sprite-magic-importer/tree/master/example)

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

    // https://www.npmjs.com/package/spritesmith#spritesheetprocessimagesimages-options
    spritesmith: {
        padding: 10,            // instead of $<map>-spacing
        algorithm: 'diagonal'   // instead of $<map>-layout
    },

    // https://www.npmjs.com/package/imagemin-pngquant
    pngquant: {
        quality: 80,
        speed: 10
    }
}
});
```

### use with node-sass

```js
var sass = require('node-sass');
var importer = require('./importer');

sass.render({
    ...
    importer: importer
    ...
});
```

### use with gulp-sass

```js
var gulp = require('gulp');
var sass = require('gulp-sass');
var importer = require('./importer');

gulp.task('build:sass', function() {
    return gulp.src('path/to/sass')
        .pipe(sass({
            ...
            importer: importer
            ...
        }))
        .pipe(gulp.dest('cssdir'));
});
```

### CLI
```bash
node-sass --importer ./importer.js -o dist/css src/app.scss
```

# License

The MIT License (MIT)

Copyright (c) 2016 Takayuki Irokawa
