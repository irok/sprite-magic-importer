import fs from 'fs-extra';
import glob from 'glob';
import path from 'path';
import Spritesmith from 'spritesmith';
import imagemin from 'imagemin';
import pngquant from 'imagemin-pngquant';
import defaultOptions from './defaultOptions';

function cssValue(value, unit) {
    return value === 0 ? '0' : `${value}${unit}`;
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
            .then(() => this.createMixins())
            .then(() => ({ contents: this.contents() }));
    }

    getImagesInfo() {
        this.context.srcPath = path.resolve(this.options.images_dir, this.context.url);
        this.context.mapName = path.dirname(this.context.srcPath).split(path.sep).reverse()[0];

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
            .then(() => new Promise((resolve, reject) => {
                fs.mkdirs(path.dirname(this.context.imagePath),
                    err => (err ? reject(err) : resolve())
                );
            }))
            .then(() => (
                imagemin.buffer(this.context.imageData, {
                    use: [pngquant(this.options.pngquant)]
                })
            ))
            .then(buf => (this.context.imageData = buf))
            .then(() => new Promise((resolve, reject) => {
                fs.writeFile(this.context.imagePath, this.context.imageData,
                    err => (err ? reject(err) : resolve())
                );
            }));
    }

    createMixins() {
        const { selectors, pseudo } = this.getSelectorInfo();
        this.context.mixins = [];

        // sprite image class
        const selector = [`.${this.context.mapName}-sprite`]
            .concat(selectors.map(
                image => `.${this.context.mapName}-${image.name}`
            ))
            .join(', ');
        this.context.mixins.push(`
            ${selector} {
                background: url('${this.imagePath(this.context.fileName)}') no-repeat;
            }`
        );

        // <map>-<sprite> mixins
        const createPseudoClassMixins = (basename, cb) => (
            !pseudo[basename] ? '' : ['active', 'hover', 'target'].map(pseudoClass => (
                !pseudo[basename][pseudoClass] ? '' : cb(
                    `&:${pseudoClass}, &.${basename}_${pseudoClass}, &.${basename}-${pseudoClass}`,
                    pseudo[basename][pseudoClass]
                )
            )).join('')
        );
        this.context.mixins.push(...selectors.map(image => [`
            @mixin ${this.context.mapName}-${image.name} {
                background-position: ${cssValue(-image.x, 'px')} ${cssValue(-image.y, 'px')};
                width: ${image.width}px;
                height: ${image.height}px;${
            // eslint-disable-next-line no-shadow
            createPseudoClassMixins(image.name, (selector, image) => `
                ${selector} {
                    background-position: ${cssValue(-image.x, 'px')} ${cssValue(-image.y, 'px')};
                    width: ${image.width}px;
                    height: ${image.height}px;
                }`
            )}
            }`
        ].join('')));

        // <map>-sprite() mixin
        this.context.mixins.push(`
            @mixin ${this.context.mapName}-sprite($name) {${
            selectors.map((image, index) => `
                ${index === 0 ? '@if' : '@else if'} $name == '${image.name}' {
                    @include ${this.context.mapName}-${image.name};
                }`
            ).join('')}
            }`
        );

        // all-<map>-sprites mixin
        this.context.mixins.push(`
            @mixin all-${this.context.mapName}-sprites {${
            selectors.map(image => `
                .${this.context.mapName}-${image.name} {
                    @include ${this.context.mapName}-${image.name};
                }`
            ).join('')}
            }`
        );
    }

    getSelectorInfo() {
        const selectors = [];
        const pseudo = {};

        this.context.images.forEach(image => {
            if (/^(.*[^-_])[-_](active|hover|target)$/.test(image.name)) {
                const imageName = RegExp.$1;
                const pseudoClass = RegExp.$2;
                if (!pseudo[imageName]) {
                    pseudo[imageName] = {};
                }
                pseudo[imageName][pseudoClass] = image;
            } else {
                selectors.push(image);
            }
        });

        return { selectors, pseudo };
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

    contents() {
        let contents = this.context.mixins.join('');
        if (this.options.debug) {
            contents = `/*${contents}\n*/${contents}`;
        }
        return contents;
    }
}
