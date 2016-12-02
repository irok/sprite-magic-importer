import fs from 'fs-extra';
import glob from 'glob';
import path from 'path';
import Spritesmith from 'spritesmith';
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
        const options = {
            src: this.context.images.map(_ => _.filePath)
        };

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
            .then(() => new Promise((resolve, reject) => {
                fs.writeFile(this.context.imagePath, this.context.imageData,
                    err => (err ? reject(err) : resolve())
                );
            }));
    }

    createMixins() {
        this.context.mixins = [];

        // sprite class
        const selectors = [`.${this.context.mapName}-sprite`].concat(
            this.context.images.map(image => `.${this.context.mapName}-${image.name}`)
        );
        this.context.mixins.push(`
            ${selectors.join(', ')} {
                background: url('${this.imagePath(this.context.fileName)}') no-repeat;
            }`
        );

        // create image mixins
        this.context.mixins.push(...this.context.images.map(image => `
            @mixin ${this.context.mapName}-${image.name} {
                background-position: ${cssValue(-image.x, 'px')} ${cssValue(-image.y, 'px')};
            }`
        ));

        // add sprite mixin
        this.context.mixins.push(`
            @mixin ${this.context.mapName}-sprite($name) {${
            this.context.images.map((image, index) => `
                ${index === 0 ? '@if' : '@else if'} $name == '${image.name}' {
                    @include ${this.context.mapName}-${image.name};
                }`
            ).join('')}
            }`
        );

        // add all sprites mixin
        this.context.mixins.push(`
            @mixin all-${this.context.mapName}-sprites {${
            this.context.images.map(image => `
                .${this.context.mapName}-${image.name} {
                    @include ${this.context.mapName}-${image.name};
                }`
            ).join('')}
            }`
        );
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
        return this.context.mixins.join('');
    }
}
