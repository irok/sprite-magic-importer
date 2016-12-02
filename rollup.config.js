import babel from 'rollup-plugin-babel';

export default {
    entry: 'src/index.js',
    dest:  'lib/index.js',
    format: 'cjs',
    external: [
        'fs-extra',
        'glob',
        'path',
        'spritesmith'
    ],
    plugins: [
        babel()
    ]
};
