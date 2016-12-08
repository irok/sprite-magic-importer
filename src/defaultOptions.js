import path from 'path';

function getClassSeparator({ options: { vars } }) {
    return vars['$default-sprite-separator'];
}

function getSpriteBaseClass({ context: { mapName }, options: { vars } }) {
    const sep = vars[`$${mapName}-class-separator`] ||
                vars['$default-sprite-separator'];
    return `.${mapName}${sep}sprite`;
}

export default {
    project_path: process.cwd(),
    http_path: '/',
    css_dir: 'stylesheets',
    images_dir: 'images',
    vars: {},
    _default_vars: {
        '$default-sprite-separator': '-'
    },
    _default_map_sprite: {
        layout: () => 'binary-tree',
        spacing: () => 0,
        'sprite-dimensions': () => false,
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
