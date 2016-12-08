'use strict';

var configure = require('../');

module.exports = configure({
    debug: true,
    images_dir:                 'example/images',
    generated_images_dir:       'example/htdocs/images',
    http_stylesheets_path:      'css',
    http_generated_images_path: 'images',

    vars: {
        '$default-sprite-separator': '_',
        '$icons-sprite-dimensions': true,
        '$icons-class-separator': '-'
    }
});
