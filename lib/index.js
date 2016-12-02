'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs-extra'));
var glob = _interopDefault(require('glob'));
var path = _interopDefault(require('path'));
var Spritesmith = _interopDefault(require('spritesmith'));

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

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function cssValue(value, unit) {
    return value === 0 ? '0' : '' + value + unit;
}

var SpriteMagic = function () {
    function SpriteMagic(options) {
        _classCallCheck(this, SpriteMagic);

        this.options = Object.assign({}, defaultOptions, options);
    }

    _createClass(SpriteMagic, [{
        key: 'resolve',
        value: function resolve(_ref) {
            var url = _ref.url,
                prev = _ref.prev;

            if (!/\.png$/.test(url)) {
                return Promise.resolve();
            }
            return this.process({ url: url, prev: prev });
        }
    }, {
        key: 'process',
        value: function process(context) {
            var _this = this;

            this.context = context;

            return Promise.resolve().then(function () {
                return _this.getImagesInfo();
            }).then(function () {
                return _this.runSpritesmith();
            }).then(function () {
                return _this.createSpriteImage();
            }).then(function () {
                return _this.createMixins();
            }).then(function () {
                return { contents: _this.contents() };
            });
        }
    }, {
        key: 'getImagesInfo',
        value: function getImagesInfo() {
            var _this2 = this;

            this.context.srcPath = path.resolve(this.options.images_dir, this.context.url);
            this.context.mapName = path.dirname(this.context.srcPath).split(path.sep).reverse()[0];

            return new Promise(function (resolve, reject) {
                glob(_this2.context.srcPath, function (err, matches) {
                    if (err) {
                        return reject(err);
                    }

                    _this2.context.images = matches.map(function (filePath) {
                        return Object.assign({ filePath: filePath }, path.parse(filePath));
                    });
                    return resolve();
                });
            });
        }
    }, {
        key: 'runSpritesmith',
        value: function runSpritesmith() {
            var _this3 = this;

            var options = {
                src: this.context.images.map(function (_) {
                    return _.filePath;
                })
            };

            return new Promise(function (resolve, reject) {
                Spritesmith.run(options, function (err, result) {
                    if (err) {
                        return reject(err);
                    }

                    _this3.context.imageData = result.image;
                    _this3.context.images.forEach(function (image) {
                        Object.assign(image, result.coordinates[image.filePath]);
                    });
                    return resolve();
                });
            });
        }
    }, {
        key: 'createSpriteImage',
        value: function createSpriteImage() {
            var _this4 = this;

            this.context.fileName = this.context.mapName + '.png';
            this.context.imagePath = path.resolve(this.options.generated_images_dir, this.context.fileName);

            return Promise.resolve().then(function () {
                return new Promise(function (resolve, reject) {
                    fs.mkdirs(path.dirname(_this4.context.imagePath), function (err) {
                        return err ? reject(err) : resolve();
                    });
                });
            }).then(function () {
                return new Promise(function (resolve, reject) {
                    fs.writeFile(_this4.context.imagePath, _this4.context.imageData, function (err) {
                        return err ? reject(err) : resolve();
                    });
                });
            });
        }
    }, {
        key: 'createMixins',
        value: function createMixins() {
            var _this5 = this,
                _context$mixins;

            this.context.mixins = [];

            // sprite class
            var selectors = ['.' + this.context.mapName + '-sprite'].concat(this.context.images.map(function (image) {
                return '.' + _this5.context.mapName + '-' + image.name;
            }));
            this.context.mixins.push('\n            ' + selectors.join(', ') + ' {\n                background: url(\'' + this.imagePath(this.context.fileName) + '\') no-repeat;\n            }');

            // create image mixins
            (_context$mixins = this.context.mixins).push.apply(_context$mixins, _toConsumableArray(this.context.images.map(function (image) {
                return '\n            @mixin ' + _this5.context.mapName + '-' + image.name + ' {\n                background-position: ' + cssValue(-image.x, 'px') + ' ' + cssValue(-image.y, 'px') + ';\n            }';
            })));

            // add sprite mixin
            this.context.mixins.push('\n            @mixin ' + this.context.mapName + '-sprite($name) {' + this.context.images.map(function (image, index) {
                return '\n                ' + (index === 0 ? '@if' : '@else if') + ' $name == \'' + image.name + '\' {\n                    @include ' + _this5.context.mapName + '-' + image.name + ';\n                }';
            }).join('') + '\n            }');

            // add all sprites mixin
            this.context.mixins.push('\n            @mixin all-' + this.context.mapName + '-sprites {' + this.context.images.map(function (image) {
                return '\n                .' + _this5.context.mapName + '-' + image.name + ' {\n                    @include ' + _this5.context.mapName + '-' + image.name + ';\n                }';
            }).join('') + '\n            }');
        }
    }, {
        key: 'imagePath',
        value: function imagePath(fileName) {
            return path.join(path.relative(this.options.http_stylesheets_path, this.options.http_generated_images_path), fileName).replace(/\\/g, '/');
        }
    }, {
        key: 'contents',
        value: function contents() {
            var contents = this.context.mixins.join('');
            if (this.options.debug) {
                contents = '/*' + contents + '\n*/' + contents;
            }
            return contents;
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
