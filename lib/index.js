'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs-extra'));
var glob = _interopDefault(require('glob'));
var path = _interopDefault(require('path'));
var Spritesmith = _interopDefault(require('spritesmith'));
var imagemin = _interopDefault(require('imagemin'));
var pngquant = _interopDefault(require('imagemin-pngquant'));
var Crypto = _interopDefault(require('crypto-js'));
var os = _interopDefault(require('os'));

var defaults = {
    project_path: process.cwd(),
    http_path: '/',
    sass_dir: 'sass',
    css_dir: 'stylesheets',
    images_dir: 'images',
    use_cache: true,
    cache_dir: path.resolve(os.tmpdir(), 'sprite-magic-importer'),
    spritesmith: {},
    pngquant: {}
};

var createOptions = (function (options) {
    var self = Object.assign({}, defaults, options);

    if (typeof self.generated_images_dir === 'undefined') {
        self.generated_images_dir = self.images_dir;
    }

    return Object.assign({
        sass_path: path.resolve(self.project_path, self.sass_dir),
        images_path: path.resolve(self.project_path, self.images_dir),
        generated_images_path: path.resolve(self.project_path, self.generated_images_dir),
        http_generated_images_path: path.join(self.http_path, self.generated_images_dir),
        http_stylesheets_path: path.join(self.http_path, self.css_dir)
    }, self);
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var stateClasses = ['hover', 'target', 'active', 'focus'];

function px(value) {
    return value === 0 ? '0' : value + 'px';
}

function cbResolver(_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        resolve = _ref2[0],
        reject = _ref2[1];

    var success = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (x) {
        return x;
    };

    return function (err, result) {
        if (err) {
            return reject(err);
        }
        return resolve(success(result));
    };
}

var SpriteMagic = function () {
    function SpriteMagic(options) {
        _classCallCheck(this, SpriteMagic);

        this.options = createOptions(options);
    }

    _createClass(SpriteMagic, [{
        key: 'resolve',
        value: function resolve(_ref3) {
            var url = _ref3.url,
                prev = _ref3.prev;

            if (!/\.png$/.test(url)) {
                return Promise.resolve();
            }

            var mapName = path.basename(path.dirname(url));
            return this.process({ url: url, prev: prev, mapName: mapName });
        }
    }, {
        key: 'process',
        value: function process(context) {
            var _this = this;

            this.context = context;

            return Promise.resolve().then(function () {
                return _this.getImagesInfo();
            }).then(function () {
                return _this.createHash();
            }).then(function () {
                return _this.checkCache();
            }).then(function () {
                return _this.context.hasCache || Promise.resolve().then(function () {
                    return _this.runSpritesmith();
                }).then(function () {
                    return _this.outputSpriteImage();
                }).then(function () {
                    return _this.createSass();
                }).then(function () {
                    return _this.outputSassFile();
                });
            }).then(function () {
                return _this.createResult();
            });
        }
    }, {
        key: 'getImagesInfo',
        value: function getImagesInfo() {
            var _this2 = this;

            var src = path.resolve(this.options.images_path, this.context.url);

            return Promise.resolve().then(function () {
                return new Promise(function () {
                    for (var _len = arguments.length, cb = Array(_len), _key = 0; _key < _len; _key++) {
                        cb[_key] = arguments[_key];
                    }

                    glob(src, cbResolver(cb));
                });
            }).then(function (matches) {
                return Promise.all(matches.map(function (filePath) {
                    return new Promise(function () {
                        for (var _len2 = arguments.length, cb = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                            cb[_key2] = arguments[_key2];
                        }

                        fs.stat(filePath, cbResolver(cb, function (stats) {
                            return { filePath: filePath, stats: stats };
                        }));
                    });
                }));
            }).then(function (images) {
                _this2.context.images = images.map(function (image) {
                    return {
                        filePath: image.filePath,
                        name: path.basename(image.filePath, '.png'),
                        mtime: image.stats.mtime.getTime()
                    };
                });
            });
        }
    }, {
        key: 'createHash',
        value: function createHash() {
            var fingerprint = this.context.images.map(function (image) {
                return image.filePath + '#' + image.mtime;
            }).concat(JSON.stringify(this.options)).concat(require('../package.json').version) // eslint-disable-line global-require
            .join('\0');
            this.context.hash = Crypto.SHA1(fingerprint).toString(Crypto.enc.HEX).substr(0, 7);
        }
    }, {
        key: 'checkCache',
        value: function checkCache() {
            var _this3 = this;

            var latestMtime = Math.max.apply(Math, _toConsumableArray(this.context.images.map(function (image) {
                return image.mtime;
            })));
            var cacheFiles = [this.spriteImagePath(), this.spriteSassPath()];
            var hasNotChanged = function hasNotChanged(file) {
                return new Promise(function (resolve, reject) {
                    fs.stat(file, function (err, stats) {
                        if (err || stats.mtime.getTime() < latestMtime) {
                            return reject();
                        }
                        return resolve();
                    });
                });
            };

            return new Promise(function (resolve) {
                Promise.all(cacheFiles.map(hasNotChanged)).then(function () {
                    _this3.context.hasCache = _this3.options.use_cache;
                    resolve();
                }).catch(resolve);
            });
        }
    }, {
        key: 'runSpritesmith',
        value: function runSpritesmith() {
            var _this4 = this;

            var options = Object.assign({}, this.options.spritesmith, {
                src: this.context.images.map(function (image) {
                    return image.filePath;
                })
            });

            return Promise.resolve().then(function () {
                return new Promise(function () {
                    for (var _len3 = arguments.length, cb = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                        cb[_key3] = arguments[_key3];
                    }

                    Spritesmith.run(options, cbResolver(cb));
                });
            }).then(function (sprite) {
                _this4.context.imageData = sprite.image;
                _this4.context.images.forEach(function (image) {
                    Object.assign(image, sprite.coordinates[image.filePath]);
                });
            });
        }
    }, {
        key: 'outputSpriteImage',
        value: function outputSpriteImage() {
            var _this5 = this;

            return Promise.resolve().then(function () {
                return imagemin.buffer(_this5.context.imageData, {
                    use: [pngquant(_this5.options.pngquant)]
                });
            }).then(function (buf) {
                return new Promise(function () {
                    for (var _len4 = arguments.length, cb = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                        cb[_key4] = arguments[_key4];
                    }

                    fs.outputFile(_this5.spriteImagePath(), buf, cbResolver(cb));
                });
            });
        }
    }, {
        key: 'createSass',
        value: function createSass() {
            var _getSelectorInfo = this.getSelectorInfo(),
                selectors = _getSelectorInfo.selectors,
                pseudoMap = _getSelectorInfo.pseudoMap;

            var _context = this.context,
                mapName = _context.mapName,
                hash = _context.hash;

            var sass = [];

            // variables
            sass.push('\n            $disable-magic-sprite-selectors: false !default;\n            $sprite-selectors: ' + stateClasses.join(', ') + ' !default;\n            $default-sprite-separator: \'-\' !default;\n            $' + mapName + '-sprite-base-class: \'.' + mapName + '-sprite\' !default;\n            $' + mapName + '-sprite-dimensions: false !default;\n            $' + mapName + '-class-separator: $default-sprite-separator !default;');

            // sprite image class
            sass.push('\n            #{$' + mapName + '-sprite-base-class} {\n                background: url(\'' + this.spriteImageUrl() + '?_=' + hash + '\') no-repeat;\n            }');

            // sprites data
            sass.push('\n            $sprite-magic-' + mapName + ': (' + selectors.map(function (image) {
                return '\n                ' + image.name + ': (\n                    x: ' + px(image.x) + ', y: ' + px(image.y) + ', width: ' + px(image.width) + ', height: ' + px(image.height) + stateClasses.map(function (state) {
                    return !pseudoMap[image.name] || !pseudoMap[image.name][state] ? '' : ', ' + state + ': (' + ['x', 'y'].map(function (prop) {
                        return prop + ': ' + px(pseudoMap[image.name][state][prop]);
                    }).join(', ') + ')';
                }).join('') + '\n                )';
            }).join(',') + '\n            );');

            // width and height function
            sass.push.apply(sass, _toConsumableArray(['width', 'height'].map(function (prop) {
                return '\n            @function ' + mapName + '-sprite-' + prop + '($sprite) {\n                @return map-get(map-get($sprite-magic-' + mapName + ', $sprite), \'' + prop + '\');\n            }';
            })));

            // dimensions mixin
            sass.push('\n            @mixin ' + mapName + '-sprite-dimensions($sprite) {\n                width: ' + mapName + '-sprite-width($sprite);\n                height: ' + mapName + '-sprite-height($sprite);\n            }');

            // background position mixin
            sass.push('\n            @mixin sprite-magic-background-position($sprite-data, $offset-x: 0, $offset-y: 0) {\n                $x: $offset-x - map-get($sprite-data, \'x\');\n                $y: $offset-y - map-get($sprite-data, \'y\');\n                background-position: $x $y;\n            }');

            // state selector
            sass.push('\n            @mixin ' + mapName + '-sprite-selectors(\n                $sprite-name, $full-sprite-name, $offset-x: 0, $offset-y: 0,\n                $unsupported: false, $separator: $' + mapName + '-class-separator\n            ) {\n                $sprite-data: map-get($sprite-magic-' + mapName + ', $sprite-name);\n                @each $state in $sprite-selectors {\n                    @if map-has-key($sprite-data, $state) {\n                        $sprite-class: "#{$full-sprite-name}#{$separator}#{$state}";\n                        &:#{$state}, &.#{$sprite-class} {\n                            @include sprite-magic-background-position(map-get($sprite-data, $state), $offset-x, $offset-y);\n                        }\n                    }\n                }\n            }');

            // sprite mixin
            sass.push('\n            @mixin ' + mapName + '-sprite(\n                $sprite, $dimensions: $' + mapName + '-sprite-dimensions, $offset-x: 0, $offset-y: 0, $unsupported: false,\n                $use-magic-selectors: not $disable-magic-sprite-selectors, $separator: $' + mapName + '-class-separator\n            ) {\n                $sprite-data: map-get($sprite-magic-' + mapName + ', $sprite);\n                @extend #{$' + mapName + '-sprite-base-class};\n                @include sprite-magic-background-position($sprite-data, $offset-x, $offset-y);\n                @if $dimensions {\n                    @include ' + mapName + '-sprite-dimensions($sprite);\n                }\n                @if $use-magic-selectors {\n                    @include ' + mapName + '-sprite-selectors(\n                        $sprite, $sprite, $offset-x, $offset-y, $unsupported, $separator\n                    );\n                }\n            }');

            // all sprites mixin
            sass.push('\n            @mixin all-' + mapName + '-sprites($dimensions: $' + mapName + '-sprite-dimensions) {' + selectors.map(function (image) {
                return '\n                .' + mapName + '-' + image.name + ' {\n                    @include ' + mapName + '-sprite(' + image.name + ', $dimensions);\n                }';
            }).join('') + '\n            }');

            this.context.sass = sass.map(function (_) {
                return _ + '\n';
            }).join('').replace(/^\x20{12}/mg, '').slice(1);
        }
    }, {
        key: 'outputSassFile',
        value: function outputSassFile() {
            var _this6 = this;

            return new Promise(function () {
                for (var _len5 = arguments.length, cb = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
                    cb[_key5] = arguments[_key5];
                }

                fs.outputFile(_this6.spriteSassPath(), _this6.context.sass, cbResolver(cb));
            });
        }
    }, {
        key: 'createResult',
        value: function createResult() {
            if (!this.context.hasCache) {
                var spriteFilePath = path.relative(this.options.project_path, this.spriteImagePath());
                // eslint-disable-next-line no-console
                console.info('Create CSS Sprites: ' + spriteFilePath + '#' + this.context.hash);
            }

            return { file: this.spriteSassPath() };
        }
    }, {
        key: 'getSelectorInfo',
        value: function getSelectorInfo() {
            var selectors = [],
                pseudoMap = {};

            var regex = new RegExp('^(.*[^-_])[-_](' + stateClasses.join('|') + ')$');

            this.context.images.forEach(function (image) {
                if (regex.test(image.name)) {
                    var imageName = RegExp.$1,
                        pseudoClass = RegExp.$2;

                    (pseudoMap[imageName] || (pseudoMap[imageName] = {}))[pseudoClass] = image;
                } else {
                    selectors.push(image);
                }
            });

            return { selectors: selectors, pseudoMap: pseudoMap };
        }
    }, {
        key: 'spriteImageUrl',
        value: function spriteImageUrl() {
            var imageUrl = path.dirname(path.normalize(path.join(this.options.http_generated_images_path, this.context.url))) + '.png';

            if (imageUrl[0] === path.sep) {
                return imageUrl.replace(/\\/g, '/');
            }

            var cssUrlDir = path.dirname(path.join(this.options.http_stylesheets_path, path.relative(this.options.sass_path, this.context.prev)));
            return path.relative(cssUrlDir, imageUrl).replace(/\\/g, '/');
        }
    }, {
        key: 'spriteImagePath',
        value: function spriteImagePath() {
            var imageFileBase = path.dirname(path.resolve(this.options.generated_images_dir, this.context.url));
            return imageFileBase + '.png';
        }
    }, {
        key: 'spriteSassPath',
        value: function spriteSassPath() {
            var fileName = this.context.mapName + '-' + this.context.hash + '.scss';
            return path.resolve(this.options.cache_dir, fileName);
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
