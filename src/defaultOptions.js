import os from 'os';
import path from 'path';

export default {
    project_path: process.cwd(),
    http_path: '/',
    css_dir: 'stylesheets',
    images_dir: 'images',
    cache_dir: path.resolve(os.tmpdir(), 'sprite-magic-importer'),
    spritesmith: {},
    pngquant: {},

    get generated_images_dir() {
        return this.images_dir;
    },
    get http_generated_images_path() {
        return path.join(this.http_path, this.generated_images_dir);
    },
    get http_stylesheets_path() {
        return path.join(this.http_path, this.css_dir);
    }
};
