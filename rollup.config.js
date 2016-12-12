import babel from 'rollup-plugin-babel';
import json from 'rollup-plugin-json';
const { dependencies } = require('./package.json');

export default {
    entry: 'src/index.js',
    dest:  'lib/index.js',
    format: 'cjs',
    plugins: [
        json(),
        babel()
    ],
    external: Object.keys(dependencies).concat([
        'os', 'path'
    ])
};
