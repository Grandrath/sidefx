import TypeDispatcher from "./type_dispatcher.js";
import Effect from "./effect.js";

describe("TypeDispatcher", function () {
  describe("getPerformer", function () {
    let dispatcher;
    let myPerformer;
    let MyType;

    beforeEach(function () {
      MyType = Effect();
      myPerformer = function myPerformerFn() {};

      dispatcher = TypeDispatcher([
        [MyType, myPerformer]
      ]);
    });

    it("should return the performer associated with the given type", function () {
      const myTypeInstance = MyType();
      expect(dispatcher.getPerformer(myTypeInstance)).to.equal(myPerformer);
    });

    it("should return `undefined` for arbitrary objects", function () {
      expect(dispatcher.getPerformer({})).to.equal(undefined);
    });
  });
});
