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

function iterate(iter, context, dispatcher, callback, result, error) {
  const request = error
    ? iter.throw(error)
    : iter.next(result);

  if (isDone(request)) {
    resolveValue(context, dispatcher, request.value, callback);
  }
  else {
    resolveValue(context, dispatcher, request.value, function (err, value) {
      iterate(iter, context, dispatcher, callback, value, err);
    });
  }
}

function performEffect(context, dispatcher, effect, callback) {
  const performer = dispatcher.getPerformer(effect);
  if (typeof performer !== "function") {
    const type = Effect.getType(effect);
    throw new Error(`No performer for "${type.name}" could be found`);
  }

  if (expectsCallback(performer)) {
    performer(context, effect, handle(
      result => resolveValue(context, dispatcher, result, callback),
      error => callback(error)
    ));
  }
  else {
    const result = performer(context, effect);
    resolveValue(context, dispatcher, result, callback);
  }
}

function resolveValue(context, dispatcher, unresolvedValue, callback) {
  if (isIterator(unresolvedValue)) {
    iterate(unresolvedValue, context, dispatcher, callback);
  }
  else if (isEffect(unresolvedValue)) {
    try {
      performEffect(context, dispatcher, unresolvedValue, callback);
    }
    catch (error) {
      callback(error);
    }
  }
  else {
    callback(null, unresolvedValue);
  }
}

export default function perform(context, dispatcher, effect) {
  return new Promise(function (resolve, reject) {
    resolveValue(context, dispatcher, effect, handle(resolve, reject));
  });
}
