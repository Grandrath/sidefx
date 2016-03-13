import Effect from "./effect.js";

const expectsCallback = performer => performer.length >= 3;
const isEffect = Effect.isEffect;

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
  if (isEffect(unresolvedValue)) {
    performEffect(context, dispatcher, unresolvedValue, callback);
  }
  else {
    callback(null, unresolvedValue);
  }
}

export default function perform(context, dispatcher, effect) {
  return new Promise(function (resolve, reject) {
    performEffect(context, dispatcher, effect, handle(resolve, reject));
  });
}
