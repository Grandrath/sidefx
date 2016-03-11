import Effect from "./effect.js";

describe("Effect", function () {
  it("should return a factory function that applies the given initializer function", function () {
    const MyEffect = Effect(function (name) {
      this.name = name;
    });
    const myEffect = MyEffect("Fred");
    expect(myEffect).to.have.property("name", "Fred");
  });

  it("should accept an optional name argument", function () {
    const MyEffect = Effect("MyName");
    expect(MyEffect).to.have.property("name", "MyName");
  });

  describe("isEffect", function () {
    context("when applied to an effect type instance", function () {
      it("should return true", function () {
        const MyEffect = Effect();
        const myEffect = MyEffect();
        expect(Effect.isEffect(myEffect)).to.equal(true);
      });
    });

    context("when applied to an arbitrary object", function () {
      it("should return false", function () {
        expect(Effect.isEffect({})).to.equal(false);
      });
    });
  });

  describe("getType", function () {
    it("should return the factory function that built the given effect type instance", function () {
      const MyEffect = Effect();
      const myEffect = MyEffect();
      expect(Effect.getType(myEffect)).to.equal(MyEffect);
    });

    it("should not throw when applied to undefined", function () {
      expect(function () {
        Effect.getType(undefined);
      }).not.to.throw();
    });
  });
});
