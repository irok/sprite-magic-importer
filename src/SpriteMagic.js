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
            .then(() => this.setConfigVars())
            .then(() => this.runSpritesmith())
            .then(() => this.createSpriteImage())
            .then(() => this.createMixins())
            .then(() => ({ contents: this.contents() }));
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

    setConfigVars() {
        const { _default_vars, _default_map_sprite } = defaultOptions;
        this.options.vars = Object.assign({}, _default_vars, this.options.vars);
        this.context.vars = {};

        // set map sprite vars to context
        Object.keys(_default_map_sprite).forEach(key => {
            const mapKey = `$${this.context.mapName}-${key}`;
            this.context.vars[key] = typeof this.options.vars[mapKey] !== 'undefined'
                ? this.options.vars[mapKey]
                : _default_map_sprite[key](this);
        });
    }

    runSpritesmith() {
        const options = {
            algorithm: this.context.vars.layout,
            padding: this.context.vars.spacing,
            src: this.context.images.map(image => image.filePath)
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
        const {
            mapName,
            vars: {
                'sprite-dimensions': hasDimensions,
                'sprite-base-class': baseClass,
                'class-separator': sep
            }
        } = this.context;
        this.context.mixins = [];

        // sprite image class
        this.context.mixins.push(`
            ${baseClass} {
                background: url('${this.imagePath(this.context.fileName)}') no-repeat;
            }`
        );

        // <map>-<sprite> mixins
        const createPseudoClassMixins = ({ name }, cb) => (
            !pseudo[name] ? '' : ['active', 'hover', 'target'].map(pseudoClass => (
                !pseudo[name][pseudoClass] ? '' : cb(
                    `&:${pseudoClass}, &.${name}_${pseudoClass}, &.${name}-${pseudoClass}`,
                    pseudo[name][pseudoClass]
                )
            )).join('')
        );
        const createDimensions = (image, cb) => (hasDimensions ? cb(image) : '');

        this.context.mixins.push(...selectors.map(image => `
            @mixin ${mapName}-${image.name} {
                @extend ${baseClass};
                background-position: ${cssValue(-image.x, 'px')} ${cssValue(-image.y, 'px')};${
            createDimensions(image, ({ width, height }) => `
                width: ${width}px;
                height: ${height}px;`
            )}${
            // eslint-disable-next-line no-shadow
            createPseudoClassMixins(image, (selector, image) => `
                ${selector} {
                    background-position: ${cssValue(-image.x, 'px')} ${cssValue(-image.y, 'px')};${
                createDimensions(image, ({ width, height }) => `
                    width: ${width}px;
                    height: ${height}px;`
                )}
                }`
            )}
            }`
        ));

        // <map>-sprite() mixin
        this.context.mixins.push(`
            @mixin ${mapName}-sprite($name) {${
            selectors.map((image, index) => `
                ${index === 0 ? '@if' : '@else if'} $name == '${image.name}' {
                    @include ${mapName}-${image.name};
                }`
            ).join('')}
            }`
        );

        // all-<map>-sprites mixin
        this.context.mixins.push(`
            @mixin all-${mapName}-sprites {${
            selectors.map(image => `
                .${mapName}${sep}${image.name} {
                    @include ${mapName}-${image.name};
                }`
            ).join('')}
            }`
        );
    }

    getSelectorInfo() {
        const [selectors, pseudo] = [[], {}];

        this.context.images.forEach(image => {
            if (/^(.*[^-_])[-_](active|hover|target)$/.test(image.name)) {
                const { $1: imageName, $2: pseudoClass } = RegExp;
                (pseudo[imageName] || (pseudo[imageName] = {}))[pseudoClass] = image;
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
        // create contents and outdent
        const contents = this.context.mixins.join('').replace(/^\x20{12}/mg, '');
        if (this.options.debug) {
            return `/*${contents}\n*/${contents}`;
        }
        return contents;
    }
}
