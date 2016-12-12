'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs-extra'));
var glob = _interopDefault(require('glob'));
var path = _interopDefault(require('path'));
var Spritesmith = _interopDefault(require('spritesmith'));
var imagemin = _interopDefault(require('imagemin'));
var pngquant = _interopDefault(require('imagemin-pngquant'));
var CryptoJs = _interopDefault(require('crypto-js'));
var os = _interopDefault(require('os'));

var defaultOptions = {
    project_path: process.cwd(),
    http_path: '/',
    css_dir: 'stylesheets',
    images_dir: 'images',
    cache_dir: path.resolve(os.tmpdir(), 'sprite-magic-importer'),
    spritesmith: {},
    pngquant: {},

    get generated_images_dir() {
        return this.images_dir;
    },
    get http_generated_images_path() {
        return path.join(this.http_path, this.generated_images_dir);
    },
    get http_stylesheets_path() {
        return path.join(this.http_path, this.css_dir);
    }
};

var version = "0.6.0";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var stateClasses = ['hover', 'target', 'active', 'focus'];

function px(value) {
    return value === 0 ? '0' : value + 'px';
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
            this.context.srcPath = path.resolve(this.options.images_dir, this.context.url);
            this.context.mapName = path.basename(path.dirname(this.context.srcPath));
            this.context.fileName = this.context.mapName + '.png';
            this.context.imagePath = path.resolve(this.options.generated_images_dir, this.context.fileName);

            return Promise.resolve().then(function () {
                return _this.getImagesInfo();
            }).then(function () {
                return _this.createHash();
            }).then(function () {
                return _this.checkCache();
            }).then(function () {
                return _this.context.hasCache ? Promise.resolve() : Promise.resolve().then(function () {
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

            return Promise.resolve().then(function () {
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
            }).then(function () {
                return Promise.all(_this2.context.images.map(function (image) {
                    return new Promise(function (resolve, reject) {
                        fs.stat(image.filePath, function (err, stats) {
                            if (err) {
                                return reject(err);
                            }

                            Object.assign(image, { mtime: stats.mtime.getTime() });
                            return resolve();
                        });
                    });
                }));
            });
        }
    }, {
        key: 'createHash',
        value: function createHash() {
            var fingerprint = this.context.images.map(function (image) {
                return image.filePath + '~' + image.mtime;
            }).concat(JSON.stringify(this.options.spritesmith)).concat(JSON.stringify(this.options.pngquant)).concat(version).join('\0');
            this.context.hash = CryptoJs.SHA1(fingerprint).toString(CryptoJs.enc.HEX).substr(0, 7);

            var fileName = this.context.mapName + '-' + this.context.hash + '.scss';
            this.context.sassFilePath = path.resolve(this.options.cache_dir, fileName);
        }
    }, {
        key: 'checkCache',
        value: function checkCache() {
            var _this3 = this;

            var latestMtime = Math.max.apply(Math, _toConsumableArray(this.context.images.map(function (image) {
                return image.mtime;
            })));
            var promises = ['imagePath', 'sassFilePath'].map(function (key) {
                return new Promise(function (resolve, reject) {
                    fs.stat(_this3.context[key], function (err, stats) {
                        if (err || stats.mtime.getTime() < latestMtime) {
                            return reject();
                        }
                        return resolve();
                    });
                });
            });

            return new Promise(function (resolve) {
                Promise.all(promises).then(function () {
                    _this3.context.hasCache = true;
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

            return new Promise(function (resolve, reject) {
                Spritesmith.run(options, function (err, result) {
                    if (err) {
                        return reject(err);
                    }

                    _this4.context.imageData = result.image;
                    _this4.context.images.forEach(function (image) {
                        Object.assign(image, result.coordinates[image.filePath]);
                    });
                    return resolve();
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
                return _this5.context.imageData = buf;
            }).then(function () {
                return new Promise(function (resolve, reject) {
                    fs.outputFile(_this5.context.imagePath, _this5.context.imageData, function (err) {
                        return err ? reject(err) : resolve();
                    });
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
                fileName = _context.fileName;

            var sass = [];

            // variables
            sass.push('\n            $disable-magic-sprite-selectors: false !default;\n            $sprite-selectors: ' + stateClasses.join(', ') + ' !default;\n            $default-sprite-separator: \'-\' !default;\n            $' + mapName + '-sprite-base-class: \'.' + mapName + '-sprite\' !default;\n            $' + mapName + '-sprite-dimensions: false !default;\n            $' + mapName + '-class-separator: $default-sprite-separator !default;');

            // sprite image class
            sass.push('\n            #{$' + mapName + '-sprite-base-class} {\n                background: url(\'' + this.imagePath(fileName) + '\') no-repeat;\n            }');

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

            return new Promise(function (resolve, reject) {
                fs.outputFile(_this6.context.sassFilePath, _this6.context.sass, function (err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            });
        }
    }, {
        key: 'createResult',
        value: function createResult() {
            var msg = this.context.hasCache ? 'use cache' : 'create';
            // eslint-disable-next-line no-console
            console.info('sprite-magic-importer ' + msg + ' file: \'' + this.context.sassFilePath + '\'');

            return { file: this.context.sassFilePath };
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
        key: 'imagePath',
        value: function imagePath(fileName) {
            return path.join(path.relative(this.options.http_stylesheets_path, this.options.http_generated_images_path), fileName).replace(/\\/g, '/');
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
