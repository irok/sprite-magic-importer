import fs from 'fs-extra';
import glob from 'glob';
import path from 'path';
import Spritesmith from 'spritesmith';
import imagemin from 'imagemin';
import pngquant from 'imagemin-pngquant';
import Crypto from 'crypto-js';
import createOptions from './defaultOptions';

const stateClasses = ['hover', 'target', 'active', 'focus'];

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
        if (!/\.png$/.test(url)) {
            return Promise.resolve();
        }

        const mapName = path.basename(path.dirname(url));
        return this.process({ url, prev, mapName });
    }

    process(context) {
        this.context = context;

        return Promise.resolve()
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
            .then(images => {
                this.context.images = images.map(image => ({
                    filePath: image.filePath,
                    name: path.basename(image.filePath, '.png'),
                    mtime: image.stats.mtime.getTime()
                }));
            });
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
        const latestMtime = Math.max(...this.context.images.map(image => image.mtime));
        const cacheFiles = [
            this.spriteImagePath(),
            this.spriteSassPath()
        ];
        const hasNotChanged = file => new Promise((resolve, reject) => {
            fs.stat(file, (err, stats) => {
                if (err || stats.mtime.getTime() < latestMtime) {
                    return reject();
                }
                return resolve();
            });
        });

        return new Promise(resolve => {
            Promise.all(cacheFiles.map(hasNotChanged))
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

        // variables
        sass.push(`
            $disable-magic-sprite-selectors: false !default;
            $sprite-selectors: ${stateClasses.join(', ')} !default;
            $default-sprite-separator: '-' !default;
            $${mapName}-sprite-base-class: '.${mapName}-sprite' !default;
            $${mapName}-sprite-dimensions: false !default;
            $${mapName}-class-separator: $default-sprite-separator !default;`
        );

        // sprite image class
        sass.push(`
            #{$${mapName}-sprite-base-class} {
                background: url('${this.spriteImageUrl()}?_=${hash}') no-repeat;
            }`
        );

        // sprites data
        sass.push(`
            $sprite-magic-${mapName}: (${
            selectors.map(image => `
                ${image.name}: (
                    x: ${px(image.x)}, y: ${px(image.y)}, width: ${px(image.width)}, height: ${px(image.height)}${
                stateClasses.map(state => (
                    !pseudoMap[image.name] || !pseudoMap[image.name][state] ? '' :
                    `, ${state}: (${
                        ['x', 'y'].map(prop => `${prop}: ${px(pseudoMap[image.name][state][prop])}`).join(', ')
                    })`
                )).join('')}
                )`
            ).join(',')}
            );`
        );

        // width and height function
        sass.push(...['width', 'height'].map(prop => `
            @function ${mapName}-sprite-${prop}($sprite) {
                @return map-get(map-get($sprite-magic-${mapName}, $sprite), '${prop}');
            }`
        ));

        // dimensions mixin
        sass.push(`
            @mixin ${mapName}-sprite-dimensions($sprite) {
                width: ${mapName}-sprite-width($sprite);
                height: ${mapName}-sprite-height($sprite);
            }`
        );

        // background position mixin
        sass.push(`
            @mixin sprite-magic-background-position($sprite-data, $offset-x: 0, $offset-y: 0) {
                $x: $offset-x - map-get($sprite-data, 'x');
                $y: $offset-y - map-get($sprite-data, 'y');
                background-position: $x $y;
            }`
        );

        // state selector
        sass.push(`
            @mixin ${mapName}-sprite-selectors(
                $sprite-name, $full-sprite-name, $offset-x: 0, $offset-y: 0,
                $unsupported: false, $separator: $${mapName}-class-separator
            ) {
                $sprite-data: map-get($sprite-magic-${mapName}, $sprite-name);
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
                $sprite-data: map-get($sprite-magic-${mapName}, $sprite);
                @extend #{$${mapName}-sprite-base-class};
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
        const imageUrl = `${
            path.dirname(path.normalize(path.join(
                this.options.http_generated_images_path,
                this.context.url
            )))
        }.png`;

        if (imageUrl[0] === path.sep) {
            return imageUrl.replace(/\\/g, '/');
        }

        const cssUrlDir = path.dirname(path.join(
            this.options.http_stylesheets_path,
            path.relative(this.options.sass_path, this.context.prev)
        ));
        return path.relative(cssUrlDir, imageUrl).replace(/\\/g, '/');
    }

    spriteImagePath() {
        const imageFileBase = path.dirname(
            path.resolve(
                this.options.generated_images_dir,
                this.context.url
            )
        );
        return `${imageFileBase}.png`;
    }

    spriteSassPath() {
        const fileName = `${this.context.mapName}-${this.context.hash}.scss`;
        return path.resolve(this.options.cache_dir, fileName);
    }
}
