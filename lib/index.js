'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fsExtra = require('fs-extra');
var glob = require('glob');
var path = _interopDefault(require('path'));
var spritesmith = require('spritesmith');

var defaultOptions = {
    http_path: '/',
    css_dir: 'stylesheets',
    images_dir: 'images',

    get project_path() {
        return process.cwd();
    },
    get css_path() {
        return path.join(this.project_path, this.css_dir);
    },
    get http_stylesheets_path() {
        return path.join(this.http_path, this.css_dir);
    },
    get images_path() {
        return path.join(this.project_path, this.images_dir);
    },
    get http_images_path() {
        return path.join(this.http_path, this.images_dir);
    },
    get generated_images_dir() {
        return this.images_dir;
    },
    get generated_images_path() {
        return path.join(this.project_path, this.generated_images_dir);
    },
    get http_generated_images_path() {
        return path.join(this.http_path, this.generated_images_dir);
    }
};

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SpriteMagic = function () {
    function SpriteMagic(options) {
        _classCallCheck(this, SpriteMagic);

        this.options = Object.assign({}, defaultOptions, options);
    }

    _createClass(SpriteMagic, [{
        key: 'resolve',
        value: function resolve(_ref) {
            var url = _ref.url;

            if (!/\.png$/.test(url)) {
                return;
            }

            return { content: '' };
        }
    }]);

    return SpriteMagic;
}();

var index = (function () {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var spriteMagic = new SpriteMagic(options);

    return function (url, prev, done) {
        spriteMagic.resolve({ url: url, prev: prev }).then(done).catch(function (err) {
            return setImmediate(function () {
                throw err;
            });
        });
    };
});

module.exports = index;
