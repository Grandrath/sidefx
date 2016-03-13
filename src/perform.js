import Effect from "./effect.js";

const expectsCallback = performer => performer.length >= 3;

function performEffect(context, dispatcher, effect, callback) {
  const performer = dispatcher.getPerformer(effect);
  if (typeof performer !== "function") {
    const type = Effect.getType(effect);
    throw new Error(`No performer for "${type.name}" could be found`);
  }

  if (expectsCallback(performer)) {
    performer(context, effect, callback);
  }
  else {
    callback(null, performer(context, effect));
  }
}

export default function perform(context, dispatcher, effect) {
  return new Promise(function (resolve, reject) {
    performEffect(context, dispatcher, effect, function (error, result) {
      if (error) {
        reject(error);
      }
      else {
        resolve(result);
      }
    });
  });
}
