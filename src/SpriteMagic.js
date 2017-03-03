import crypto from 'crypto';
import del from 'del';
import _fs from 'fs-extra';
import glob from 'glob';
import path from 'path';
import _Spritesmith from 'spritesmith';
import imagemin from 'imagemin';
import pngquant from 'imagemin-pngquant';
import createOptions from './defaultOptions';
import Promisable from './Promisable';

const fs = Promisable.attach(_fs);
const globAsync = Promisable.create(glob);
const Spritesmith = Promisable.attach(_Spritesmith);

const stateClasses = ['hover', 'target', 'active', 'focus'];
const imageProps = ['x', 'y', 'width', 'height'];

function px(value) {
    return value === 0 ? '0' : `${value}px`;
}

function isPartialFile(prev) {
    return (
        /^_/.test(path.basename(prev)) ||
        /\/_/.test(prev.replace(/\\/g, '/'))
    );
}


export default class SpriteMagic {
    constructor(options) {
        this.options = createOptions(options);
    }

    debug(...args) {
        if (this.options.debug) {
            console.error('[SpriteMagic]', ...args);
        }
    }

    resolve({ url, prev }) {
        if (!isPartialFile(prev) && this.rootSassFile !== prev) {
            this.rootSassFile = prev;
            this.debug(`Find root: ${prev}`);
        }

        if (!/\.png$/.test(url)) {
            return Promise.resolve();
        }

        this.debug(`@import "${url}"`);
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
                .then(() => this.clearCache())
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
        return Promise.resolve(path.resolve(this.options.images_path, this.context.url))
            .then(globAsync)
            .then(matches => Promise.all(matches.map(
                filePath => fs.statAsync(filePath).then(stats => ({ filePath, stats }))
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
            size: image.stats.size
        };
    }

    createHash() {
        const fingerprint = this.context.images
            .map(image => `${this.projectRelPath(image.filePath)}#${image.size}`)
            .concat(JSON.stringify(this.options))
            .concat(require('../package.json').version)     // eslint-disable-line global-require
            .join('\0');
        this.context.hash = crypto.createHash('sha256').update(fingerprint).digest('hex').substr(0, 7);
        this.debug(`hash: ${this.context.hash}`);
    }

    checkCache() {
        // always resolved
        let imageHash;
        return new Promise(resolve => {
            Promise.resolve()
                .then(() => fs.accessAsync(this.spriteSassPath()))
                .then(() => fs.readJsonAsync(this.spriteCacheDataPath()))
                .then(data => { imageHash = data.hash; })
                .then(() => fs.readFileAsync(this.spriteImagePath()))
                .then(image => crypto.createHash('sha256').update(image).digest('hex'))
                .then(hash => (hash === imageHash ? Promise.resolve() : Promise.reject()))
                .then(() => {
                    this.context.hasCache = this.options.use_cache;
                    this.debug(`Find cache! (${this.context.hasCache})`);
                    resolve();
                })
                .catch(resolve);
        });
    }

    clearCache() {
        const pattern = this.spriteSassPath().replace(/[0-9a-f]+\.scss$/, '*');
        this.debug(`delete: ${pattern}`);
        return del(pattern);
    }

    runSpritesmith() {
        const options = Object.assign({}, this.options.spritesmith, {
            src: this.context.images.map(image => image.filePath)
        });

        return Promise.resolve()
            .then(() => Spritesmith.runAsync(options))
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
            .then(buf => {
                this.context.imageHash = crypto.createHash('sha256').update(buf).digest('hex');
                return fs.outputFileAsync(this.spriteImagePath(), buf);
            })
            .then(() => {
                const data = JSON.stringify({ hash: this.context.imageHash });
                return fs.outputFileAsync(this.spriteCacheDataPath(), `${data}\n`);
            });
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
        return fs.outputFileAsync(this.spriteSassPath(), this.context.sass);
    }

    createResult() {
        if (!this.context.hasCache) {
            const spriteFilePath = this.projectRelPath(this.spriteImagePath());
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

    spriteCacheDataPath() {
        return this.spriteCachePath('json');
    }

    spriteSassPath() {
        return this.spriteCachePath('scss');
    }

    spriteCachePath(ext) {
        const fileName = `${this.context.mapName}${this.context.suffix}-${this.context.hash}.${ext}`;
        return path.resolve(this.options.cache_dir, fileName);
    }

    projectRelPath(filePath) {
        return path.relative(this.options.project_path, filePath).replace(/\\/g, '/');
    }

    commonName(name) {
        return name.replace(this.options.retina_mark, '');
    }
}
