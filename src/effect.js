const EffectType = Symbol("EffectType");
const defaultInitialize = function () {};

export default function Effect(name, initialize) {
  if (typeof name === "function") {
    initialize = name;
    name = undefined;
  }
  name = name || "Effect";
  initialize = initialize || defaultInitialize;

  const factory = function effectFactory() {
    const instance = Object.create({
      [EffectType]: factory,
      [Symbol.toStringTag]: name
    });
    initialize.apply(instance, arguments);

    return instance;
  };
  Object.defineProperty(factory, "name", {
    value: name,
    configurable: true
  });

  return factory;
}

Effect.isEffect = instance => Effect.getType(instance) !== undefined;
Effect.getType = instance => instance && instance[EffectType];
