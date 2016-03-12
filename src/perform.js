import Effect from "./effect.js";

const expectsCallback = performer => performer.length >= 3;

export default function perform(context, dispatcher, effect) {
  const performer = dispatcher.getPerformer(effect);
  if (typeof performer !== "function") {
    const type = Effect.getType(effect);
    throw new Error(`No performer for "${type.name}" could be found`);
  }

  if (expectsCallback(performer)) {
    return new Promise(function (resolve, reject) {
      performer(context, effect, function (error, result) {
        if (error) {
          reject(error);
        }
        else {
          resolve(result);
        }
      });
    });
  }
  else {
    try {
      const result = performer(context, effect);
      return Promise.resolve(result);
    }
    catch (error) {
      return Promise.reject(error);
    }
  }
}
