import babel from 'rollup-plugin-babel';
import json from 'rollup-plugin-json';
const { dependencies } = require('./package.json');

export default {
    input: 'src/index.js',
    output: {
        file: 'lib/index.js',
        format: 'cjs'
    },
    plugins: [
        json(),
        babel({
            babelrc: false,
            presets: [['@babel/env', { modules: false }]]
        })
    ],
    external: Object.keys(dependencies).concat([
        'os', 'path', 'crypto'
    ])
};
