import path from 'path';

export default {
    project_path: process.cwd(),
    http_path: '/',
    css_dir: 'stylesheets',
    images_dir: 'images',
    layout: 'binary-tree',
    spritesmith: {},
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
