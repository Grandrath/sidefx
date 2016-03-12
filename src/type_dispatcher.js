import Effect from "./effect.js";

export default function TypeDispatcher(mapping) {
  const map = new Map(mapping);

  return {
    getPerformer: effect => map.get(Effect.getType(effect))
  };
}
