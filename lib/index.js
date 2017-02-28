'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs-extra'));
var del = _interopDefault(require('del'));
var glob = _interopDefault(require('glob'));
var path = _interopDefault(require('path'));
var Spritesmith = _interopDefault(require('spritesmith'));
var imagemin = _interopDefault(require('imagemin'));
var pngquant = _interopDefault(require('imagemin-pngquant'));
var Crypto = _interopDefault(require('crypto-js'));
var os = _interopDefault(require('os'));

var defaults = {
    project_path: process.cwd(),
    base_uri: '',
    http_path: '/',
    sass_dir: 'sass',
    css_dir: 'stylesheets',
    images_dir: 'images',
    retina_mark: /@(\d)x$/,
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
var imageProps = ['x', 'y', 'width', 'height'];

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
        key: 'debug',
        value: function debug() {
            if (this.options.debug) {
                var _console;

                for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments[_key];
                }

                (_console = console).error.apply(_console, ['[SpriteMagic]'].concat(args));
            }
        }
    }, {
        key: 'resolve',
        value: function resolve(_ref3) {
            var url = _ref3.url,
                prev = _ref3.prev;

            if (!/^_/.test(path.basename(prev))) {
                this.debug('Find root: ' + prev);
                this.rootSassFile = prev;
            }

            if (!/\.png$/.test(url)) {
                return Promise.resolve();
            }

            this.debug('@import "' + url + '"');
            return this.process({ url: url, prev: prev });
        }
    }, {
        key: 'process',
        value: function process(context) {
            var _this = this;

            this.context = context;

            return Promise.resolve().then(function () {
                return _this.checkPixelRatio();
            }).then(function () {
                return _this.getImagesInfo();
            }).then(function () {
                return _this.createHash();
            }).then(function () {
                return _this.checkCache();
            }).then(function () {
                return _this.context.hasCache || Promise.resolve().then(function () {
                    return _this.clearCache();
                }).then(function () {
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
        key: 'checkPixelRatio',
        value: function checkPixelRatio() {
            this.context.mapName = this.commonName(path.basename(path.dirname(this.context.url)));

            var pathInfo = path.parse(this.context.url);
            if (this.options.retina_mark.test(pathInfo.name)) {
                this.context.pixelRatio = parseFloat(RegExp.$1);
                this.context.suffix = RegExp.lastMatch;
            } else {
                this.context.pixelRatio = 1;
                this.context.suffix = '';
            }
        }
    }, {
        key: 'getImagesInfo',
        value: function getImagesInfo() {
            var _this2 = this;

            var src = path.resolve(this.options.images_path, this.context.url);

            return Promise.resolve().then(function () {
                return new Promise(function () {
                    for (var _len2 = arguments.length, cb = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                        cb[_key2] = arguments[_key2];
                    }

                    glob(src, cbResolver(cb));
                });
            }).then(function (matches) {
                return Promise.all(matches.map(function (filePath) {
                    return new Promise(function () {
                        for (var _len3 = arguments.length, cb = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                            cb[_key3] = arguments[_key3];
                        }

                        fs.stat(filePath, cbResolver(cb, function (stats) {
                            return { filePath: filePath, stats: stats };
                        }));
                    });
                }));
            }).then(function (images) {
                return images.map(function (image) {
                    return _this2.createImageInfo(image);
                });
            }).then(function (images) {
                if (_this2.context.pixelRatio === 1) {
                    _this2.context.images = images.filter(function (image) {
                        return image.name === image.basename;
                    });
                } else {
                    _this2.context.images = images;
                }
            });
        }
    }, {
        key: 'createImageInfo',
        value: function createImageInfo(image) {
            var basename = path.basename(image.filePath, '.png');

            return {
                filePath: image.filePath,
                basename: basename,
                name: this.commonName(basename),
                size: image.stats.size
            };
        }
    }, {
        key: 'createHash',
        value: function createHash() {
            var fingerprint = this.context.images.map(function (image) {
                return image.filePath + '#' + image.size;
            }).concat(JSON.stringify(this.options)).concat(require('../package.json').version) // eslint-disable-line global-require
            .join('\0');
            this.context.hash = Crypto.SHA1(fingerprint).toString(Crypto.enc.HEX).substr(0, 7);
            this.debug('hash: ' + this.context.hash);
        }
    }, {
        key: 'checkCache',
        value: function checkCache() {
            var _this3 = this;

            var cacheFiles = [this.spriteImagePath(), this.spriteSassPath()];

            var getTimestamp = function getTimestamp(file) {
                return new Promise(function (resolve) {
                    fs.stat(file, function (err, stats) {
                        resolve(err ? 0 : stats.mtime.getTime());
                    });
                });
            };

            var hasNotChanged = function hasNotChanged(_ref4) {
                var _ref5 = _slicedToArray(_ref4, 2),
                    tImg = _ref5[0],
                    tSass = _ref5[1];

                return new Promise(function (resolve, reject) {
                    _this3.debug('mtime: img=' + tImg + ', sass=' + tSass);
                    if (tSass === tImg) {
                        return resolve();
                    }
                    return reject();
                });
            };

            return new Promise(function (resolve) {
                Promise.all(cacheFiles.map(getTimestamp)).then(hasNotChanged).then(function () {
                    _this3.context.hasCache = _this3.options.use_cache;
                    _this3.debug('Find cache! (' + _this3.context.hasCache + ')');
                    resolve();
                }).catch(resolve);
            });
        }
    }, {
        key: 'clearCache',
        value: function clearCache() {
            var pattern = this.spriteSassPath().replace(/[0-9a-f]+\.scss$/, '*');
            this.debug('delete: ' + pattern);
            return del(pattern);
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
                    for (var _len4 = arguments.length, cb = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                        cb[_key4] = arguments[_key4];
                    }

                    Spritesmith.run(options, cbResolver(cb));
                });
            }).then(function (sprite) {
                _this4.context.imageData = sprite.image;
                _this4.context.imageProps = sprite.properties;
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
                    for (var _len5 = arguments.length, cb = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
                        cb[_key5] = arguments[_key5];
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
            var placeholder = '%' + mapName + '-' + hash;

            // variables
            // core/stylesheets/compass/utilities/sprites/_base.scss
            // compass/sprite_importer/content.erb
            sass.push('\n            $sprite-selectors: ' + stateClasses.join(', ') + ' !default;\n            $disable-magic-sprite-selectors: false !default;\n            $default-sprite-separator: \'-\' !default;\n            $' + mapName + '-sprite-dimensions: false !default;\n            $' + mapName + '-class-separator: $default-sprite-separator !default;\n            $' + mapName + '-sprite-base-class: \'.' + mapName + '#{$' + mapName + '-class-separator}sprite\' !default;\n            $' + mapName + '-pixel-ratio: ' + this.context.pixelRatio + ';\n            $' + mapName + '-image-width: ' + px(this.context.imageProps.width) + ';\n            $' + mapName + '-image-height: ' + px(this.context.imageProps.height) + ';');

            // sprite image class
            sass.push('\n            ' + placeholder + ' {\n                background-image: url(\'' + this.spriteImageUrl() + '?_=' + hash + '\');\n                background-repeat: no-repeat;\n                @if $' + mapName + '-pixel-ratio != 1 {\n                    background-size: #{$' + mapName + '-image-width / $' + mapName + '-pixel-ratio} #{$' + mapName + '-image-height / $' + mapName + '-pixel-ratio};\n                }\n            }\n            #{$' + mapName + '-sprite-base-class} {\n                @extend ' + placeholder + ';\n            }');

            // sprites data
            sass.push('\n            $' + mapName + '-sprites: (' + selectors.map(function (image) {
                return '\n                ' + image.name + ': (\n                    ' + imageProps.map(function (prop) {
                    return prop + ': ' + px(image[prop]);
                }).join(', ') + stateClasses.map(function (state) {
                    return !pseudoMap[image.name] || !pseudoMap[image.name][state] ? '' : ', ' + state + ': (' + imageProps.map(function (prop) {
                        return prop + ': ' + px(pseudoMap[image.name][state][prop]);
                    }).join(', ') + ')';
                }).join('') + '\n                )';
            }).join(',') + '\n            );');

            // width and height function
            sass.push.apply(sass, _toConsumableArray(['width', 'height'].map(function (prop) {
                return '\n            @function ' + mapName + '-sprite-' + prop + '($sprite) {\n                @return map-get(map-get($' + mapName + '-sprites, $sprite), \'' + prop + '\');\n            }';
            })));

            // dimensions mixin
            sass.push('\n            @mixin ' + mapName + '-sprite-dimensions($sprite) {\n                width: #{' + mapName + '-sprite-width($sprite) / $' + mapName + '-pixel-ratio};\n                height: #{' + mapName + '-sprite-height($sprite) / $' + mapName + '-pixel-ratio};\n            }');

            // background position mixin
            sass.push('\n            @mixin sprite-magic-background-position($sprite-data, $offset-x: 0, $offset-y: 0) {\n                $x: $offset-x - map-get($sprite-data, \'x\');\n                $y: $offset-y - map-get($sprite-data, \'y\');\n                background-position: #{$x / $' + mapName + '-pixel-ratio} #{$y / $' + mapName + '-pixel-ratio};\n            }');

            // state selector
            sass.push('\n            @mixin ' + mapName + '-sprite-selectors(\n                $sprite-name, $full-sprite-name, $offset-x: 0, $offset-y: 0,\n                $unsupported: false, $separator: $' + mapName + '-class-separator\n            ) {\n                $sprite-data: map-get($' + mapName + '-sprites, $sprite-name);\n                @each $state in $sprite-selectors {\n                    @if map-has-key($sprite-data, $state) {\n                        $sprite-class: "#{$full-sprite-name}#{$separator}#{$state}";\n                        &:#{$state}, &.#{$sprite-class} {\n                            @include sprite-magic-background-position(map-get($sprite-data, $state), $offset-x, $offset-y);\n                        }\n                    }\n                }\n            }');

            // sprite mixin
            sass.push('\n            @mixin ' + mapName + '-sprite(\n                $sprite, $dimensions: $' + mapName + '-sprite-dimensions, $offset-x: 0, $offset-y: 0, $unsupported: false,\n                $use-magic-selectors: not $disable-magic-sprite-selectors, $separator: $' + mapName + '-class-separator\n            ) {\n                $sprite-data: map-get($' + mapName + '-sprites, $sprite);\n                @extend ' + placeholder + ';\n                @include sprite-magic-background-position($sprite-data, $offset-x, $offset-y);\n                @if $dimensions {\n                    @include ' + mapName + '-sprite-dimensions($sprite);\n                }\n                @if $use-magic-selectors {\n                    @include ' + mapName + '-sprite-selectors(\n                        $sprite, $sprite, $offset-x, $offset-y, $unsupported, $separator\n                    );\n                }\n            }');

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
                for (var _len6 = arguments.length, cb = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
                    cb[_key6] = arguments[_key6];
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
            var imagePath = '' + path.dirname(path.normalize(path.join(this.options.http_generated_images_path, this.context.url))) + this.context.suffix + '.png';

            // absolute path
            if (imagePath[0] === path.sep) {
                return '' + this.options.base_uri + imagePath.replace(/\\/g, '/');
            }

            // relative path
            var cssDir = path.dirname(path.normalize(path.join(this.options.http_stylesheets_path, path.relative(this.options.sass_dir, this.rootSassFile))));
            return path.relative(cssDir, imagePath).replace(/\\/g, '/');
        }
    }, {
        key: 'spriteImagePath',
        value: function spriteImagePath() {
            var imageFileBase = path.dirname(path.resolve(this.options.generated_images_dir, this.context.url));
            return '' + imageFileBase + this.context.suffix + '.png';
        }
    }, {
        key: 'spriteSassPath',
        value: function spriteSassPath() {
            var fileName = '' + this.context.mapName + this.context.suffix + '-' + this.context.hash + '.scss';
            return path.resolve(this.options.cache_dir, fileName);
        }
    }, {
        key: 'commonName',
        value: function commonName(name) {
            return name.replace(this.options.retina_mark, '');
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
