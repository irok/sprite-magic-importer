import fs from 'fs-extra';
import glob from 'glob';
import path from 'path';
import Spritesmith from 'spritesmith';
import imagemin from 'imagemin';
import pngquant from 'imagemin-pngquant';
import Crypto from 'crypto-js';
import createOptions from './defaultOptions';

const stateClasses = ['hover', 'target', 'active', 'focus'];
const imageProps = ['x', 'y', 'width', 'height'];

function px(value) {
    return value === 0 ? '0' : `${value}px`;
}

function cbResolver([resolve, reject], success = x => x) {
    return (err, result) => {
        if (err) {
            return reject(err);
        }
        return resolve(success(result));
    };
}

export default class SpriteMagic {
    constructor(options) {
        this.options = createOptions(options);
    }

    resolve({ url, prev }) {
        if (!/^_/.test(path.basename(prev))) {
            this.rootSassFile = prev;
        }

        if (!/\.png$/.test(url)) {
            return Promise.resolve();
        }
        return this.process({ url, prev });
    }

    process(context) {
        this.context = context;

        return Promise.resolve()
            .then(() => this.checkPixelRatio())
            .then(() => this.getImagesInfo())
            .then(() => this.createHash())
            .then(() => this.checkCache())
            .then(() => (this.context.hasCache || Promise.resolve()
                .then(() => this.runSpritesmith())
                .then(() => this.outputSpriteImage())
                .then(() => this.createSass())
                .then(() => this.outputSassFile())
            ))
            .then(() => this.createResult());
    }

    checkPixelRatio() {
        this.context.mapName = this.commonName(path.basename(path.dirname(this.context.url)));

        const pathInfo = path.parse(this.context.url);
        if (this.options.retina_mark.test(pathInfo.name)) {
            this.context.pixelRatio = parseFloat(RegExp.$1);
            this.context.suffix = RegExp.lastMatch;
        } else {
            this.context.pixelRatio = 1;
            this.context.suffix = '';
        }
    }

    getImagesInfo() {
        const src = path.resolve(this.options.images_path, this.context.url);

        return Promise.resolve()
            .then(() => new Promise((...cb) => {
                glob(src, cbResolver(cb));
            }))
            .then(matches => Promise.all(matches.map(
                filePath => new Promise((...cb) => {
                    fs.stat(filePath, cbResolver(cb, stats => ({ filePath, stats })));
                })
            )))
            .then(images => images.map(image => this.createImageInfo(image)))
            .then(images => {
                if (this.context.pixelRatio === 1) {
                    this.context.images = images.filter(image => image.name === image.basename);
                } else {
                    this.context.images = images;
                }
            });
    }

    createImageInfo(image) {
        const basename = path.basename(image.filePath, '.png');

        return {
            filePath: image.filePath,
            basename,
            name: this.commonName(basename),
            mtime: image.stats.mtime.getTime()
        };
    }

    createHash() {
        const fingerprint = this.context.images
            .map(image => `${image.filePath}#${image.mtime}`)
            .concat(JSON.stringify(this.options))
            .concat(require('../package.json').version)     // eslint-disable-line global-require
            .join('\0');
        this.context.hash = Crypto.SHA1(fingerprint).toString(Crypto.enc.HEX).substr(0, 7);
    }

    checkCache() {
        const cacheFiles = [
            this.spriteImagePath(),
            this.spriteSassPath()
        ];

        const getTimestamp = file => new Promise(resolve => {
            fs.stat(file, (err, stats) => {
                resolve(err ? 0 : stats.mtime.getTime());
            });
        });

        const hasNotChanged = ([tImg, tSass]) => new Promise((resolve, reject) => {
            const latestMtime = Math.max(...this.context.images.map(image => image.mtime));
            if (tSass === tImg && latestMtime <= tImg) {
                return resolve();
            }
            return reject();
        });

        return new Promise(resolve => {
            Promise.all(cacheFiles.map(getTimestamp))
                .then(hasNotChanged)
                .then(() => {
                    this.context.hasCache = this.options.use_cache;
                    resolve();
                })
                .catch(resolve);
        });
    }

    runSpritesmith() {
        const options = Object.assign({}, this.options.spritesmith, {
            src: this.context.images.map(image => image.filePath)
        });

        return Promise.resolve()
            .then(() => new Promise((...cb) => {
                Spritesmith.run(options, cbResolver(cb));
            }))
            .then(sprite => {
                this.context.imageData = sprite.image;
                this.context.imageProps = sprite.properties;
                this.context.images.forEach(image => {
                    Object.assign(image, sprite.coordinates[image.filePath]);
                });
            });
    }

    outputSpriteImage() {
        return Promise.resolve()
            .then(() => imagemin.buffer(this.context.imageData, {
                use: [pngquant(this.options.pngquant)]
            }))
            .then(buf => new Promise((...cb) => {
                fs.outputFile(this.spriteImagePath(), buf, cbResolver(cb));
            }));
    }

    createSass() {
        const { selectors, pseudoMap } = this.getSelectorInfo();
        const { mapName, hash } = this.context;
        const sass = [];
        const placeholder = `%${mapName}-${hash}`;

        // variables
        // core/stylesheets/compass/utilities/sprites/_base.scss
        // compass/sprite_importer/content.erb
        sass.push(`
            $sprite-selectors: ${stateClasses.join(', ')} !default;
            $disable-magic-sprite-selectors: false !default;
            $default-sprite-separator: '-' !default;
            $${mapName}-sprite-dimensions: false !default;
            $${mapName}-class-separator: $default-sprite-separator !default;
            $${mapName}-sprite-base-class: '.${mapName}#{$${mapName}-class-separator}sprite' !default;
            $${mapName}-pixel-ratio: ${this.context.pixelRatio};
            $${mapName}-image-width: ${px(this.context.imageProps.width)};
            $${mapName}-image-height: ${px(this.context.imageProps.height)};`
        );

        // sprite image class
        sass.push(`
            ${placeholder} {
                background-image: url('${this.spriteImageUrl()}?_=${hash}');
                background-repeat: no-repeat;
                @if $${mapName}-pixel-ratio != 1 {
                    background-size: #{$${mapName}-image-width / $${mapName}-pixel-ratio} #{$${mapName}-image-height / $${mapName}-pixel-ratio};
                }
            }
            #{$${mapName}-sprite-base-class} {
                @extend ${placeholder};
            }`
        );

        // sprites data
        sass.push(`
            $${mapName}-sprites: (${
            selectors.map(image => `
                ${image.name}: (
                    ${imageProps.map(prop => `${prop}: ${px(image[prop])}`).join(', ')}${
                stateClasses.map(state => (
                    !pseudoMap[image.name] || !pseudoMap[image.name][state] ? '' :
                    `, ${state}: (${
                        imageProps.map(prop => `${prop}: ${px(pseudoMap[image.name][state][prop])}`).join(', ')
                    })`
                )).join('')}
                )`
            ).join(',')}
            );`
        );

        // width and height function
        sass.push(...['width', 'height'].map(prop => `
            @function ${mapName}-sprite-${prop}($sprite) {
                @return map-get(map-get($${mapName}-sprites, $sprite), '${prop}');
            }`
        ));

        // dimensions mixin
        sass.push(`
            @mixin ${mapName}-sprite-dimensions($sprite) {
                width: #{${mapName}-sprite-width($sprite) / $${mapName}-pixel-ratio};
                height: #{${mapName}-sprite-height($sprite) / $${mapName}-pixel-ratio};
            }`
        );

        // background position mixin
        sass.push(`
            @mixin sprite-magic-background-position($sprite-data, $offset-x: 0, $offset-y: 0) {
                $x: $offset-x - map-get($sprite-data, 'x');
                $y: $offset-y - map-get($sprite-data, 'y');
                background-position: #{$x / $${mapName}-pixel-ratio} #{$y / $${mapName}-pixel-ratio};
            }`
        );

        // state selector
        sass.push(`
            @mixin ${mapName}-sprite-selectors(
                $sprite-name, $full-sprite-name, $offset-x: 0, $offset-y: 0,
                $unsupported: false, $separator: $${mapName}-class-separator
            ) {
                $sprite-data: map-get($${mapName}-sprites, $sprite-name);
                @each $state in $sprite-selectors {
                    @if map-has-key($sprite-data, $state) {
                        $sprite-class: "#{$full-sprite-name}#{$separator}#{$state}";
                        &:#{$state}, &.#{$sprite-class} {
                            @include sprite-magic-background-position(map-get($sprite-data, $state), $offset-x, $offset-y);
                        }
                    }
                }
            }`
        );

        // sprite mixin
        sass.push(`
            @mixin ${mapName}-sprite(
                $sprite, $dimensions: $${mapName}-sprite-dimensions, $offset-x: 0, $offset-y: 0, $unsupported: false,
                $use-magic-selectors: not $disable-magic-sprite-selectors, $separator: $${mapName}-class-separator
            ) {
                $sprite-data: map-get($${mapName}-sprites, $sprite);
                @extend ${placeholder};
                @include sprite-magic-background-position($sprite-data, $offset-x, $offset-y);
                @if $dimensions {
                    @include ${mapName}-sprite-dimensions($sprite);
                }
                @if $use-magic-selectors {
                    @include ${mapName}-sprite-selectors(
                        $sprite, $sprite, $offset-x, $offset-y, $unsupported, $separator
                    );
                }
            }`
        );

        // all sprites mixin
        sass.push(`
            @mixin all-${mapName}-sprites($dimensions: $${mapName}-sprite-dimensions) {${
            selectors.map(image => `
                .${mapName}-${image.name} {
                    @include ${mapName}-sprite(${image.name}, $dimensions);
                }`
            ).join('')}
            }`
        );

        this.context.sass = sass.map(_ => `${_}\n`).join('').replace(/^\x20{12}/mg, '').slice(1);
    }

    outputSassFile() {
        return new Promise((...cb) => {
            fs.outputFile(this.spriteSassPath(), this.context.sass, cbResolver(cb));
        });
    }

    createResult() {
        if (!this.context.hasCache) {
            const spriteFilePath = path.relative(
                this.options.project_path,
                this.spriteImagePath()
            );
            // eslint-disable-next-line no-console
            console.info(`Create CSS Sprites: ${spriteFilePath}#${this.context.hash}`);
        }

        return { file: this.spriteSassPath() };
    }

    getSelectorInfo() {
        const [selectors, pseudoMap] = [[], {}];
        const regex = new RegExp(`^(.*[^-_])[-_](${stateClasses.join('|')})$`);

        this.context.images.forEach(image => {
            if (regex.test(image.name)) {
                const { $1: imageName, $2: pseudoClass } = RegExp;
                (pseudoMap[imageName] || (pseudoMap[imageName] = {}))[pseudoClass] = image;
            } else {
                selectors.push(image);
            }
        });

        return { selectors, pseudoMap };
    }

    spriteImageUrl() {
        const imagePath = `${
            path.dirname(path.normalize(path.join(
                this.options.http_generated_images_path,
                this.context.url
            )))
        }${this.context.suffix}.png`;

        // absolute path
        if (imagePath[0] === path.sep) {
            return `${this.options.base_uri}${imagePath.replace(/\\/g, '/')}`;
        }

        // relative path
        const cssDir = path.dirname(path.normalize(path.join(
            this.options.http_stylesheets_path,
            path.relative(this.options.sass_dir, this.rootSassFile)
        )));
        return path.relative(cssDir, imagePath).replace(/\\/g, '/');
    }

    spriteImagePath() {
        const imageFileBase = path.dirname(
            path.resolve(
                this.options.generated_images_dir,
                this.context.url
            )
        );
        return `${imageFileBase}${this.context.suffix}.png`;
    }

    spriteSassPath() {
        const fileName = `${this.context.mapName}-${this.context.hash}.scss`;
        return path.resolve(this.options.cache_dir, fileName);
    }

    commonName(name) {
        return name.replace(this.options.retina_mark, '');
    }
}
