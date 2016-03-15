import Effect from "./effect.js";

const {isEffect, getType} = Effect;
const isPromise = value => value && isFunction(value.then) && isFunction(value.catch);
const isIterator = value => value && isFunction(value.next);
const isDone = request => request && request.done;
const isFunction = value => typeof value === "function";
const expectsCallback = performer => performer.length >= 2;

function partial(f, ...initialArgs) {
  return (...additionalArgs) => f(...initialArgs, ...additionalArgs);
}

function handle(onSuccess, onError) {
  return (error, result) => error
    ? onError(error)
    : onSuccess(result);
}

export default function perform(dispatcher, effect) {
  function resolveValue(value, callback) {
    switch (true) {
    case isIterator(value):
      iterate(value, callback);
      break;

    case isPromise(value):
      value
        .then(result => callback(null, result))
        .catch(error => callback(error));
      break;

    case isEffect(value):
      try {
        performEffect(value, callback);
      }
      catch (error) {
        callback(error);
      }
      break;

    default:
      callback(null, value);
    }
  }

  function iterate(iter, callback, error, result) {
    let request;
    try {
      request = error
        ? iter.throw(error)
        : iter.next(result);
    }
    catch (err) {
      callback(err);
    }

    const cb = isDone(request)
      ? callback
      : partial(iterate, iter, callback);

    resolveValue(request.value, cb);
  }

  function performEffect(effectInstance, callback) {
    const performer = dispatcher.getPerformer(effectInstance);
    if (!isFunction(performer)) {
      const type = getType(effectInstance);
      throw new Error(`No performer for "${type.name}" could be found`);
    }

    if (expectsCallback(performer)) {
      performer(effectInstance, handle(
        result => resolveValue(result, callback),
        error => callback(error)
      ));
    }
    else {
      const result = performer(effectInstance);
      resolveValue(result, callback);
    }
  }

  return new Promise((resolve, reject) => resolveValue(effect, handle(resolve, reject)));
}
