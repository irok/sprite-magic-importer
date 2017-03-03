const create = (thisArg, fn) => (...args) => new Promise((resolve, reject) => {
    args.push((err, result) => {
        if (err) {
            reject(err);
        } else {
            resolve(result);
        }
    });
    fn.apply(thisArg, args);
});

const get = (target, name, receiver) => {
    if (/Async$/.test(name) && !Reflect.has(target, name, receiver)) {
        name = name.replace(/Async$/, '');

        if (Reflect.has(target, name, receiver)) {
            return create(target, Reflect.get(target, name, receiver));
        }
    }

    return Reflect.get(target, name, receiver);
};

const Promisable = {
    require(name, isFunc = false) {
        var obj = require(name);
        if (isFunc) {
            return Promisable.create(obj);
        }
        return Promisable.attach(obj);
    },
    attach(obj) {
        return new Proxy(obj, {get});
    },
    create(fn, thisArg) {
        return create(thisArg, fn);
    }
};

export default Promisable;
