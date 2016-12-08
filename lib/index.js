'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs-extra'));
var glob = _interopDefault(require('glob'));
var path = _interopDefault(require('path'));
var Spritesmith = _interopDefault(require('spritesmith'));
var imagemin = _interopDefault(require('imagemin'));
var pngquant = _interopDefault(require('imagemin-pngquant'));

function getClassSeparator(_ref) {
    var vars = _ref.options.vars;

    return vars['$default-sprite-separator'];
}

function getSpriteBaseClass(_ref2) {
    var mapName = _ref2.context.mapName,
        vars = _ref2.options.vars;

    var sep = vars['$' + mapName + '-class-separator'] || vars['$default-sprite-separator'];
    return '.' + mapName + sep + 'sprite';
}

var defaultOptions = {
    project_path: process.cwd(),
    http_path: '/',
    css_dir: 'stylesheets',
    images_dir: 'images',
    vars: {},
    _default_vars: {
        '$default-sprite-separator': '-'
    },
    _default_map_sprite: {
        layout: function layout() {
            return 'binary-tree';
        },
        spacing: function spacing() {
            return 0;
        },
        'sprite-dimensions': function spriteDimensions() {
            return false;
        },
        'sprite-base-class': getSpriteBaseClass,
        'class-separator': getClassSeparator
    },
    pngquant: {},

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
                return _this.setConfigVars();
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
            this.context.mapName = path.basename(path.dirname(this.context.srcPath));

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
        key: 'setConfigVars',
        value: function setConfigVars() {
            var _this3 = this;

            var _default_vars = defaultOptions._default_vars,
                _default_map_sprite = defaultOptions._default_map_sprite;

            this.options.vars = Object.assign({}, _default_vars, this.options.vars);
            this.context.vars = {};

            // set map sprite vars to context
            Object.keys(_default_map_sprite).forEach(function (key) {
                var mapKey = '$' + _this3.context.mapName + '-' + key;
                _this3.context.vars[key] = typeof _this3.options.vars[mapKey] !== 'undefined' ? _this3.options.vars[mapKey] : _default_map_sprite[key](_this3);
            });
        }
    }, {
        key: 'runSpritesmith',
        value: function runSpritesmith() {
            var _this4 = this;

            var options = {
                algorithm: this.context.vars.layout,
                padding: this.context.vars.spacing,
                src: this.context.images.map(function (image) {
                    return image.filePath;
                })
            };

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
        key: 'createSpriteImage',
        value: function createSpriteImage() {
            var _this5 = this;

            this.context.fileName = this.context.mapName + '.png';
            this.context.imagePath = path.resolve(this.options.generated_images_dir, this.context.fileName);

            return Promise.resolve().then(function () {
                return new Promise(function (resolve, reject) {
                    fs.mkdirs(path.dirname(_this5.context.imagePath), function (err) {
                        return err ? reject(err) : resolve();
                    });
                });
            }).then(function () {
                return imagemin.buffer(_this5.context.imageData, {
                    use: [pngquant(_this5.options.pngquant)]
                });
            }).then(function (buf) {
                return _this5.context.imageData = buf;
            }).then(function () {
                return new Promise(function (resolve, reject) {
                    fs.writeFile(_this5.context.imagePath, _this5.context.imageData, function (err) {
                        return err ? reject(err) : resolve();
                    });
                });
            });
        }
    }, {
        key: 'createMixins',
        value: function createMixins() {
            var _context$mixins;

            var _getSelectorInfo = this.getSelectorInfo(),
                selectors = _getSelectorInfo.selectors,
                pseudo = _getSelectorInfo.pseudo;

            var _context = this.context,
                mapName = _context.mapName,
                _context$vars = _context.vars,
                hasDimensions = _context$vars['sprite-dimensions'],
                baseClass = _context$vars['sprite-base-class'],
                sep = _context$vars['class-separator'];

            this.context.mixins = [];

            // sprite image class
            this.context.mixins.push('\n            ' + baseClass + ' {\n                background: url(\'' + this.imagePath(this.context.fileName) + '\') no-repeat;\n            }');

            // <map>-<sprite> mixins
            var createPseudoClassMixins = function createPseudoClassMixins(_ref2, cb) {
                var name = _ref2.name;
                return !pseudo[name] ? '' : ['active', 'hover', 'target'].map(function (pseudoClass) {
                    return !pseudo[name][pseudoClass] ? '' : cb('&:' + pseudoClass + ', &.' + name + '_' + pseudoClass + ', &.' + name + '-' + pseudoClass, pseudo[name][pseudoClass]);
                }).join('');
            };
            var createDimensions = function createDimensions(image, cb) {
                return hasDimensions ? cb(image) : '';
            };

            (_context$mixins = this.context.mixins).push.apply(_context$mixins, _toConsumableArray(selectors.map(function (image) {
                return '\n            @mixin ' + mapName + '-' + image.name + ' {\n                @extend ' + baseClass + ';\n                background-position: ' + cssValue(-image.x, 'px') + ' ' + cssValue(-image.y, 'px') + ';' + createDimensions(image, function (_ref3) {
                    var width = _ref3.width,
                        height = _ref3.height;
                    return '\n                width: ' + width + 'px;\n                height: ' + height + 'px;';
                }) +
                // eslint-disable-next-line no-shadow
                createPseudoClassMixins(image, function (selector, image) {
                    return '\n                ' + selector + ' {\n                    background-position: ' + cssValue(-image.x, 'px') + ' ' + cssValue(-image.y, 'px') + ';' + createDimensions(image, function (_ref4) {
                        var width = _ref4.width,
                            height = _ref4.height;
                        return '\n                    width: ' + width + 'px;\n                    height: ' + height + 'px;';
                    }) + '\n                }';
                }) + '\n            }';
            })));

            // <map>-sprite() mixin
            this.context.mixins.push('\n            @mixin ' + mapName + '-sprite($name) {' + selectors.map(function (image, index) {
                return '\n                ' + (index === 0 ? '@if' : '@else if') + ' $name == \'' + image.name + '\' {\n                    @include ' + mapName + '-' + image.name + ';\n                }';
            }).join('') + '\n            }');

            // all-<map>-sprites mixin
            this.context.mixins.push('\n            @mixin all-' + mapName + '-sprites {' + selectors.map(function (image) {
                return '\n                .' + mapName + sep + image.name + ' {\n                    @include ' + mapName + '-' + image.name + ';\n                }';
            }).join('') + '\n            }');
        }
    }, {
        key: 'getSelectorInfo',
        value: function getSelectorInfo() {
            var selectors = [],
                pseudo = {};


            this.context.images.forEach(function (image) {
                if (/^(.*[^-_])[-_](active|hover|target)$/.test(image.name)) {
                    var imageName = RegExp.$1,
                        pseudoClass = RegExp.$2;

                    (pseudo[imageName] || (pseudo[imageName] = {}))[pseudoClass] = image;
                } else {
                    selectors.push(image);
                }
            });

            return { selectors: selectors, pseudo: pseudo };
        }
    }, {
        key: 'imagePath',
        value: function imagePath(fileName) {
            return path.join(path.relative(this.options.http_stylesheets_path, this.options.http_generated_images_path), fileName).replace(/\\/g, '/');
        }
    }, {
        key: 'contents',
        value: function contents() {
            // create contents and outdent
            var contents = this.context.mixins.join('').replace(/^\x20{12}/mg, '');
            if (this.options.debug) {
                return '/*' + contents + '\n*/' + contents;
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
