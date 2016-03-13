import Effect from "./effect.js";

const expectsCallback = performer => performer.length >= 3;
const isEffect = Effect.isEffect;
const isIterator = value => value && typeof value.next === "function";
const isDone = request => request && request.done;

function handle(onSuccess, onError) {
  return function (error, result) {
    if (error) {
      onError(error);
    }
    else {
      onSuccess(result);
    }
  };
}

export default function perform(context, dispatcher, effect) {
  function iterate(iter, callback, error, result) {
    const request = error
      ? iter.throw(error)
      : iter.next(result);

    if (isDone(request)) {
      resolveValue(request.value, callback);
    }
    else {
      resolveValue(request.value, function (_error, _result) {
        iterate(iter, callback, _error, _result);
      });
    }
  }

  function performEffect(effectInstance, callback) {
    const performer = dispatcher.getPerformer(effectInstance);
    if (typeof performer !== "function") {
      const type = Effect.getType(effectInstance);
      throw new Error(`No performer for "${type.name}" could be found`);
    }

    if (expectsCallback(performer)) {
      performer(context, effectInstance, handle(
        result => resolveValue(result, callback),
        error => callback(error)
      ));
    }
    else {
      const result = performer(context, effectInstance);
      resolveValue(result, callback);
    }
  }

  function resolveValue(value, callback) {
    if (isIterator(value)) {
      iterate(value, callback);
    }
    else if (isEffect(value)) {
      try {
        performEffect(value, callback);
      }
      catch (error) {
        callback(error);
      }
    }
    else {
      callback(null, value);
    }
  }

  return new Promise((resolve, reject) => resolveValue(effect, handle(resolve, reject)));
}
