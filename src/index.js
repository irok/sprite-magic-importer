import SpriteMagic from './SpriteMagic';

export default (options = {}) => {
    const spriteMagic = new SpriteMagic(options);

    return (url, prev, done) => {
        spriteMagic.resolve({ url, prev })
            .then(done)
            .catch(err => setImmediate(() => { throw err; }));
    };
};
