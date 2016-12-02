import defaultOptions from './defaultOptions';

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

    process({ url, prev }) {
        this.context = { url, prev };

        return Promise.resolve({ content: '' });
    }
}
