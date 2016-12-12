import fs from 'fs-extra';
import glob from 'glob';
import os from 'os';
import path from 'path';
import Spritesmith from 'spritesmith';
import imagemin from 'imagemin';
import pngquant from 'imagemin-pngquant';
import CryptoJs from 'crypto-js';
import defaultOptions from './defaultOptions';
import { version } from '../package.json';

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
        this.context.srcPath = path.resolve(this.options.images_dir, this.context.url);
        this.context.mapName = path.basename(path.dirname(this.context.srcPath));
        this.context.fileName = `${this.context.mapName}.png`;
        this.context.imagePath = path.resolve(this.options.generated_images_dir, this.context.fileName);

        return Promise.resolve()
            .then(() => this.getImagesInfo())
            .then(() => this.createHash())
            .then(() => this.checkCache())
            .then(() => (this.context.hasCache ? Promise.resolve() :
                Promise.resolve()
                    .then(() => this.runSpritesmith())
                    .then(() => this.outputSpriteImage())
                    .then(() => this.createSass())
                    .then(() => this.outputSassFile())
            ))
            .then(() => this.createResult());
    }

    getImagesInfo() {
        return Promise.resolve()
            .then(() => new Promise((resolve, reject) => {
                glob(this.context.srcPath, (err, matches) => {
                    if (err) {
                        return reject(err);
                    }

                    this.context.images = matches.map(
                        filePath => Object.assign({ filePath }, path.parse(filePath))
                    );
                    return resolve();
                });
            }))
            .then(() => Promise.all(this.context.images.map(image => new Promise((resolve, reject) => {
                fs.stat(image.filePath, (err, stats) => {
                    if (err) {
                        return reject(err);
                    }

                    Object.assign(image, { mtime: stats.mtime.getTime() });
                    return resolve();
                });
            }))));
    }

    createHash() {
        const fingerprint = this.context.images.map(image => `${image.filePath}~${image.mtime}`)
            .concat(JSON.stringify(this.options.spritesmith))
            .concat(JSON.stringify(this.options.pngquant))
            .concat(version)
            .join('\0');
        this.context.hash = CryptoJs.SHA1(fingerprint).toString(CryptoJs.enc.HEX).substr(0, 7);

        const fileName = `${this.context.mapName}-${this.context.hash}.scss`;
        this.context.sassFilePath = path.resolve(os.tmpdir(), 'sprite-magic-importer', fileName);
    }

    checkCache() {
        const latestMtime = Math.max(
            ...this.context.images.map(image => image.mtime)
        );
        const promises = ['imagePath', 'sassFilePath'].map(key => new Promise((resolve, reject) => {
            fs.stat(this.context[key], (err, stats) => {
                if (err || stats.mtime.getTime() < latestMtime) {
                    return reject();
                }
                return resolve();
            });
        }));

        return new Promise(resolve => {
            Promise.all(promises).then(() => {
                this.context.hasCache = true;
                resolve();
            }).catch(resolve);
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

    outputSpriteImage() {
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

    createSass() {
        const { selectors, pseudoMap } = this.getSelectorInfo();
        const { mapName, fileName } = this.context;
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
                background: url('${this.imagePath(fileName)}') no-repeat;
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
        return new Promise((resolve, reject) => {
            fs.outputFile(this.context.sassFilePath, this.context.sass, err => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    createResult() {
        const msg = this.context.hasCache ? 'use cache' : 'create';
        // eslint-disable-next-line no-console
        console.info(`sprite-magic-importer ${msg} file: '${this.context.sassFilePath}'`);

        return { file: this.context.sassFilePath };
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
}
