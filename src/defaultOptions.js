import os from 'os';
import path from 'path';

const defaults = {
    project_path: process.cwd(),
    http_path: '/',
    sass_dir: 'sass',
    css_dir: 'stylesheets',
    images_dir: 'images',
    use_cache: true,
    cache_dir: path.resolve(os.tmpdir(), 'sprite-magic-importer'),
    spritesmith: {},
    pngquant: {}
};

export default options => {
    const self = Object.assign({}, defaults, options);

    if (typeof self.generated_images_dir === 'undefined') {
        self.generated_images_dir = self.images_dir;
    }

    return Object.assign({
        sass_path:                  path.resolve(self.project_path, self.sass_dir),
        images_path:                path.resolve(self.project_path, self.images_dir),
        generated_images_path:      path.resolve(self.project_path, self.generated_images_dir),
        http_generated_images_path: path.join(self.http_path, self.generated_images_dir),
        http_stylesheets_path:      path.join(self.http_path, self.css_dir)
    }, self);
};
