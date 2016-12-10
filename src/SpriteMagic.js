import fs from 'fs-extra';
import glob from 'glob';
import os from 'os';
import path from 'path';
import Spritesmith from 'spritesmith';
import imagemin from 'imagemin';
import pngquant from 'imagemin-pngquant';
import CryptoJs from 'crypto-js';
import defaultOptions from './defaultOptions';

const stateClasses = ['hover', 'target', 'active', 'focus'];

function px(value) {
    return value === 0 ? '0' : `${value}px`;
}

export default class SpriteMagic {
    constructor(options) {
        this.options = Object.assign({}, defaultOptions, options);
    }

    resolve({ url, prev }) {
        if (!/\.png$/.test(url)) {
            return Promise.resolve();
        }
        return this.process({ url, prev });
    }

    process(context) {
        this.context = context;

        return Promise.resolve()
            .then(() => this.getImagesInfo())
            .then(() => this.runSpritesmith())
            .then(() => this.createSpriteImage())
            .then(() => this.createContents())
            .then(() => this.output());
    }

    getImagesInfo() {
        this.context.srcPath = path.resolve(this.options.images_dir, this.context.url);
        this.context.mapName = path.basename(path.dirname(this.context.srcPath));

        return new Promise((resolve, reject) => {
            glob(this.context.srcPath, (err, matches) => {
                if (err) {
                    return reject(err);
                }

                this.context.images = matches.map(
                    filePath => Object.assign({ filePath }, path.parse(filePath))
                );
                return resolve();
            });
        });
    }

    runSpritesmith() {
        const options = Object.assign({}, this.options.spritesmith, {
            src: this.context.images.map(image => image.filePath)
        });

        return new Promise((resolve, reject) => {
            Spritesmith.run(options, (err, result) => {
                if (err) {
                    return reject(err);
                }

                this.context.imageData = result.image;
                this.context.images.forEach(image => {
                    Object.assign(image, result.coordinates[image.filePath]);
                });
                return resolve();
            });
        });
    }

    createSpriteImage() {
        this.context.fileName = `${this.context.mapName}.png`;
        this.context.imagePath = path.resolve(this.options.generated_images_dir, this.context.fileName);

        return Promise.resolve()
            .then(() => (
                imagemin.buffer(this.context.imageData, {
                    use: [pngquant(this.options.pngquant)]
                })
            ))
            .then(buf => (this.context.imageData = buf))
            .then(() => new Promise((resolve, reject) => {
                fs.outputFile(this.context.imagePath, this.context.imageData,
                    err => (err ? reject(err) : resolve())
                );
            }));
    }

    createContents() {
        const { selectors, pseudoMap } = this.getSelectorInfo();
        const { mapName, fileName } = this.context;
        const contents = [];

        // variables
        contents.push(`
            $disable-magic-sprite-selectors: false !default;
            $sprite-selectors: ${stateClasses.join(', ')} !default;
            $default-sprite-separator: '-' !default;
            $${mapName}-sprite-base-class: '.${mapName}-sprite' !default;
            $${mapName}-sprite-dimensions: false !default;
            $${mapName}-class-separator: $default-sprite-separator !default;`
        );

        // sprite image class
        contents.push(`
            #{$${mapName}-sprite-base-class} {
                background: url('${this.imagePath(fileName)}') no-repeat;
            }`
        );

        // sprites data
        contents.push(`
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
        contents.push(...['width', 'height'].map(prop => `
            @function ${mapName}-sprite-${prop}($sprite) {
                @return map-get(map-get($sprite-magic-${mapName}, $sprite), '${prop}');
            }`
        ));

        // dimensions mixin
        contents.push(`
            @mixin ${mapName}-sprite-dimensions($sprite) {
                width: ${mapName}-sprite-width($sprite);
                height: ${mapName}-sprite-height($sprite);
            }`
        );

        // background position mixin
        contents.push(`
            @mixin sprite-magic-background-position($sprite-data, $offset-x: 0, $offset-y: 0) {
                $x: $offset-x - map-get($sprite-data, 'x');
                $y: $offset-y - map-get($sprite-data, 'y');
                background-position: $x $y;
            }`
        );

        // state selector
        contents.push(`
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
        contents.push(`
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
        contents.push(`
            @mixin all-${mapName}-sprites($dimensions: $${mapName}-sprite-dimensions) {${
            selectors.map(image => `
                .${mapName}-${image.name} {
                    @include ${mapName}-sprite(${image.name}, $dimensions);
                }`
            ).join('')}
            }`
        );

        this.context.contents = contents.map(_ => `${_}\n`).join('').replace(/^\x20{12}/mg, '').slice(1);
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

    imagePath(fileName) {
        return path.join(
            path.relative(
                this.options.http_stylesheets_path,
                this.options.http_generated_images_path
            ),
            fileName
        ).replace(/\\/g, '/');
    }

    output() {
        const hash = CryptoJs.SHA1(this.context.contents).toString(CryptoJs.enc.HEX);
        const fileName = `${this.context.mapName}-${hash.substr(0, 7)}.scss`;
        const filePath = path.resolve(os.tmpdir(), 'sprite-magic-importer', fileName);

        return new Promise((resolve, reject) => {
            fs.outputFile(filePath, this.context.contents, err => {
                if (err) {
                    return reject(err);
                }
                // eslint-disable-next-line no-console
                console.info(`Create importer file: '${filePath}'`);
                return resolve({ file: filePath });
            });
        });
    }
}
