import babel from 'rollup-plugin-babel';
const { dependencies } = require('./package.json');

export default {
    entry: 'src/index.js',
    dest:  'lib/index.js',
    format: 'cjs',
    plugins: [
        babel()
    ],
    external: Object.keys(dependencies).concat([
        'path'
    ])
};
