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

const get = (target, property, receiver) => {
    let name = property;
    if (/Async$/.test(name) && !Reflect.has(target, name, receiver)) {
        name = name.replace(/Async$/, '');

        if (Reflect.has(target, name, receiver)) {
            return create(target, Reflect.get(target, name, receiver));
        }
    }

    return Reflect.get(target, name, receiver);
};

const Promisable = {
    attach(obj) {
        return new Proxy(obj, { get });
    },
    create(fn, thisArg) {
        return create(thisArg, fn);
    }
};

export default Promisable;
