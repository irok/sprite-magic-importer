'use strict';

var configure = require('../');

module.exports = configure({
    sass_dir:                   'example/sass',
    images_dir:                 'example/images',
    generated_images_dir:       'example/htdocs/images',
    http_stylesheets_path:      'css',
    http_generated_images_path: 'images',
    cache_dir:                  'example/.cache',
    debug: true
});
