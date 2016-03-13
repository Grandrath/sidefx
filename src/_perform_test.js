import perform from "./perform.js";

import Effect from "./effect.js";
import TypeDispatcher from "./type_dispatcher.js";

describe("perform", function () {
  const context = {
    myContextProp: true
  };

  const MyType = Effect("MyType", function (value) {
    this.value = value;
    this.myEffectProp = true;
  });

  function checkContext(ctx) {
    if (!ctx || !ctx.myContextProp) {
      throw new Error("perform did not pass context object to performer");
    }
  }

  function checkEffect(effect) {
    if (!effect || !effect.myEffectProp) {
      throw new Error("perform did not pass effect object to performer");
    }
  }

  describe("synchronous performer", function () {
    function checkSyncPerformer(ctx, effect) {
      checkContext(ctx);
      checkEffect(effect);

      return "expected result";
    }

    function checkFailingSyncPerformer(ctx, effect) { // eslint-disable-line no-unused-vars
      throw new Error("expected error");
    }

    it("should resolve the returned promise with the result", function () {
      const dispatcher = TypeDispatcher([
        [MyType, checkSyncPerformer]
      ]);
      const effect = MyType();

      return expect(perform(context, dispatcher, effect))
        .to.eventually.equal("expected result");
    });

    it("should reject the returned promise when performer throws an error", function () {
      const dispatcher = TypeDispatcher([
        [MyType, checkFailingSyncPerformer]
      ]);
      const effect = MyType();

      return expect(perform(context, dispatcher, effect))
        .to.be.rejectedWith("expected error");
    });
  });

  describe("asynchronous performer with callback", function () {
    function checkCallbackPerformer(ctx, effect, callback) {
      checkContext(ctx);
      checkEffect(effect);

      setTimeout(() => callback(null, "expected result"), 0);
    }

    function checkFailingCallbackPerformer(ctx, effect, callback) {
      setTimeout(() => callback(new Error("expected error")), 0);
    }

    function checkThrowingCallbackPerformer(ctx, effect, callback) { // eslint-disable-line no-unused-vars
      throw new Error("expected error");
    }

    it("should resolve the returned promise with the result", function () {
      const dispatcher = TypeDispatcher([
        [MyType, checkCallbackPerformer]
      ]);
      const effect = MyType();

      return expect(perform(context, dispatcher, effect))
        .to.eventually.equal("expected result");
    });

    it("should reject the returned promise when performer calls back with an error", function () {
      const dispatcher = TypeDispatcher([
        [MyType, checkFailingCallbackPerformer]
      ]);
      const effect = MyType();

      return expect(perform(context, dispatcher, effect))
        .to.be.rejectedWith("expected error");
    });

    it("should reject the returned promise when performer throws an error", function () {
      const dispatcher = TypeDispatcher([
        [MyType, checkThrowingCallbackPerformer]
      ]);
      const effect = MyType();

      return expect(perform(context, dispatcher, effect))
        .to.be.rejectedWith("expected error");
    });
  });

  describe("asynchronous performer returning a promise", function () {
    function checkPromisePerformer(ctx, effect) {
      checkContext(ctx);
      checkEffect(effect);

      return Promise.resolve("expected result");
    }

    function checkFailingPromisePerformer(ctx, effect) { // eslint-disable-line no-unused-vars
      return Promise.reject(new Error("expected error"));
    }

    it("should resolve the returned promise with the result", function () {
      const dispatcher = TypeDispatcher([
        [MyType, checkPromisePerformer]
      ]);
      const effect = MyType();

      return expect(perform(context, dispatcher, effect))
        .to.eventually.equal("expected result");
    });

    it("should reject the returned promise when performer returns an error", function () {
      const dispatcher = TypeDispatcher([
        [MyType, checkFailingPromisePerformer]
      ]);
      const effect = MyType();

      return expect(perform(context, dispatcher, effect))
        .to.be.rejectedWith("expected error");
    });
  });

  describe("performer returns an effect", function () {
    it("should perform the returned effect (sync performer)", function () {
      const InnerType = Effect("InnerType");

      function performMyType() {
        return InnerType();
      }

      function performInnerType() {
        return "expected result";
      }

      const dispatcher = TypeDispatcher([
        [MyType, performMyType],
        [InnerType, performInnerType]
      ]);
      const outerEffect = MyType();

      return expect(perform({}, dispatcher, outerEffect))
        .to.eventually.equal("expected result");
    });

    it("should perform the returned effect (callback performer)", function () {
      const InnerType = Effect("InnerType");

      function performMyType(ctx, effect, callback) {
        setTimeout(() => callback(null, InnerType()), 0);
      }

      function performInnerType(ctx, effect, callback) {
        setTimeout(() => callback(null, "expected result"), 0);
      }

      const dispatcher = TypeDispatcher([
        [MyType, performMyType],
        [InnerType, performInnerType]
      ]);
      const outerEffect = MyType();

      return expect(perform({}, dispatcher, outerEffect))
        .to.eventually.equal("expected result");
    });
  });

  describe("a generator that yield multiple effects", function () {
    it("should perform each effect", function () {
      const generator = function* generator() {
        const first = yield MyType("expected");
        const second = yield MyType("result");

        return `${first} ${second}`;
      };

      function performMyType(ctx, myType) {
        return myType.value;
      }

      const dispatcher = TypeDispatcher([
        [MyType, performMyType]
      ]);

      return expect(perform({}, dispatcher, generator()))
        .to.eventually.equal("expected result");
    });

    it("should throw the performer's error within the generator", function () {
      const generator = function* generator() {
        try {
          yield ThrowingType("expected result");
        }
        catch (error) {
          return error.message;
        }
      };

      const ThrowingType = Effect("ThrowingType", function (message) {
        this.message = message;
      });

      function performThrowingType(ctx, throwingType) {
        throw new Error(throwingType.message);
      }

      const dispatcher = TypeDispatcher([
        [ThrowingType, performThrowingType]
      ]);

      return expect(perform({}, dispatcher, generator()))
        .to.eventually.equal("expected result");
    });
  });

  describe("generator performers", function () {
    it("should be iterated over recursively", function () {
      const InnerType = Effect("InnerType");

      function* performMyType(ctx, myType) { // eslint-disable-line no-unused-vars
        const result = yield InnerType();
        return result;
      }

      function performInnerType(ctx, innerType) { // eslint-disable-line no-unused-vars
        return "expected result";
      }

      const generator = function* generator() {
        const result = yield MyType();
        return result;
      };

      const dispatcher = TypeDispatcher([
        [MyType, performMyType],
        [InnerType, performInnerType]
      ]);

      return expect(perform({}, dispatcher, generator()))
        .to.eventually.equal("expected result");
    });
  });

  describe("overall test", function () {
    it("should pass", function () {
      const AsyncType = Effect("AsyncType", function (value) {
        this.value = value;
      });

      const ThrowingType = Effect("ThrowingType", function (message) {
        this.message = message;
      });

      function performAsyncType(ctx, asyncType, callback) {
        ctx.doAsync(() => callback(null, asyncType.value));
      }

      function performThrowingType(ctx, throwingType) {
        return Promise.reject(new Error(throwingType.message));
      }

      const _context = {
        doAsync: (f) => setTimeout(f, 0)
      };

      const dispatcher = TypeDispatcher([
        [AsyncType, performAsyncType],
        [ThrowingType, performThrowingType]
      ]);

      const generator = function* generator() {
        const first = yield AsyncType("expected");
        try {
          yield ThrowingType("result");
        }
        catch (error) {
          return `${first} ${error.message}`;
        }
      };

      return expect(perform(_context, dispatcher, generator()))
        .to.eventually.equal("expected result");
    });
  });

  it("should reject returned promise when no performer could be found", function () {
    const dispatcher = TypeDispatcher();
    const effect = MyType();

    return expect(perform({}, dispatcher, effect))
      .to.be.rejectedWith("No performer for \"MyType\" could be found");
  });
});
