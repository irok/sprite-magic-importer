'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var del = _interopDefault(require('del'));
var path = _interopDefault(require('path'));
var imagemin = _interopDefault(require('imagemin'));
var pngquant = _interopDefault(require('imagemin-pngquant'));
var crypto = _interopDefault(require('crypto'));
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

var _create = function _create(thisArg, fn) {
    return function () {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        return new Promise(function (resolve, reject) {
            args.push(function (err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
            fn.apply(thisArg, args);
        });
    };
};

var get = function get(target, name, receiver) {
    if (/Async$/.test(name) && !Reflect.has(target, name, receiver)) {
        name = name.replace(/Async$/, '');

        if (Reflect.has(target, name, receiver)) {
            return _create(target, Reflect.get(target, name, receiver));
        }
    }

    return Reflect.get(target, name, receiver);
};

var Promisable = {
    require: function (_require) {
        function require(_x) {
            return _require.apply(this, arguments);
        }

        require.toString = function () {
            return _require.toString();
        };

        return require;
    }(function (name) {
        var isFunc = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

        var obj = require(name);
        if (isFunc) {
            return Promisable.create(obj);
        }
        return Promisable.attach(obj);
    }),
    attach: function attach(obj) {
        return new Proxy(obj, { get: get });
    },
    create: function create(fn, thisArg) {
        return _create(thisArg, fn);
    }
};

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = Promisable.require('fs-extra');
var globAsync = Promisable.require('glob', true);
var Spritesmith = Promisable.require('Spritesmith');

var stateClasses = ['hover', 'target', 'active', 'focus'];
var imageProps = ['x', 'y', 'width', 'height'];

function px(value) {
    return value === 0 ? '0' : value + 'px';
}

function isPartialFile(prev) {
    return (/^_/.test(path.basename(prev)) || /\/_/.test(prev.replace(/\\/g, '/'))
    );
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
        value: function resolve(_ref) {
            var url = _ref.url,
                prev = _ref.prev;

            if (!isPartialFile(prev) && this.rootSassFile !== prev) {
                this.rootSassFile = prev;
                this.debug('Find root: ' + prev);
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

            return Promise.resolve(path.resolve(this.options.images_path, this.context.url)).then(globAsync).then(function (matches) {
                return Promise.all(matches.map(function (filePath) {
                    return fs.statAsync(filePath).then(function (stats) {
                        return { filePath: filePath, stats: stats };
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
            this.context.hash = crypto.createHash('sha256').update(fingerprint).digest('hex').substr(0, 7);
            this.debug('hash: ' + this.context.hash);
        }
    }, {
        key: 'checkCache',
        value: function checkCache() {
            var _this3 = this;

            // always resolved
            var imageHash = void 0;
            return new Promise(function (resolve) {
                Promise.resolve().then(function () {
                    return fs.accessAsync(_this3.spriteSassPath());
                }).then(function () {
                    return fs.readJsonAsync(_this3.spriteCacheDataPath());
                }).then(function (data) {
                    imageHash = data.hash;
                }).then(function () {
                    return fs.readFileAsync(_this3.spriteImagePath());
                }).then(function (image) {
                    return crypto.createHash('sha256').update(image).digest('hex');
                }).then(function (hash) {
                    return hash === imageHash ? Promise.resolve() : Promise.reject();
                }).then(function () {
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
                return Spritesmith.runAsync(options);
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
                _this5.context.imageHash = crypto.createHash('sha256').update(buf).digest('hex');
                return fs.outputFileAsync(_this5.spriteImagePath(), buf);
            }).then(function () {
                var data = JSON.stringify({ hash: _this5.context.imageHash });
                return fs.outputFileAsync(_this5.spriteCacheDataPath(), data + '\n');
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
            return fs.outputFileAsync(this.spriteSassPath(), this.context.sass);
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
        key: 'spriteCacheDataPath',
        value: function spriteCacheDataPath() {
            return this.spriteCachePath('json');
        }
    }, {
        key: 'spriteSassPath',
        value: function spriteSassPath() {
            return this.spriteCachePath('scss');
        }
    }, {
        key: 'spriteCachePath',
        value: function spriteCachePath(ext) {
            var fileName = '' + this.context.mapName + this.context.suffix + '-' + this.context.hash + '.' + ext;
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
