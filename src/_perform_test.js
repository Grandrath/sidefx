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

    it("should resolve the returned promise with the result", function (done) {
      const dispatcher = TypeDispatcher([
        [MyType, checkSyncPerformer]
      ]);
      const effect = MyType();

      perform(context, dispatcher, effect)
        .then(function (result) {
          expect(result).to.equal("expected result");
        })
        .then(done)
        .catch(done);
    });

    it("should reject the returned promise when performer throws an error", function (done) {
      const dispatcher = TypeDispatcher([
        [MyType, checkFailingSyncPerformer]
      ]);
      const effect = MyType();

      perform(context, dispatcher, effect)
        .then(function (result) {
          throw new Error(`Expected promise to be rejected but got "${result}"`);
        })
        .catch(function (error) {
          expect(error).to.have.property("message", "expected error");
        })
        .then(done)
        .catch(done);
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

    it("should resolve the returned promise with the result", function (done) {
      const dispatcher = TypeDispatcher([
        [MyType, checkCallbackPerformer]
      ]);
      const effect = MyType();

      perform(context, dispatcher, effect)
        .then(function (result) {
          expect(result).to.equal("expected result");
        })
        .then(done)
        .catch(done);
    });

    it("should reject the returned promise when performer calls back with an error", function (done) {
      const dispatcher = TypeDispatcher([
        [MyType, checkFailingCallbackPerformer]
      ]);
      const effect = MyType();

      perform(context, dispatcher, effect)
        .then(function (result) {
          throw new Error(`Expected promise to be rejected but got "${result}"`);
        })
        .catch(function (error) {
          expect(error).to.have.property("message", "expected error");
        })
        .then(done)
        .catch(done);
    });

    it("should reject the returned promise when performer throws an error", function (done) {
      const dispatcher = TypeDispatcher([
        [MyType, checkThrowingCallbackPerformer]
      ]);
      const effect = MyType();

      perform(context, dispatcher, effect)
        .then(function (result) {
          throw new Error(`Expected promise to be rejected but got "${result}"`);
        })
        .catch(function (error) {
          expect(error).to.have.property("message", "expected error");
        })
        .then(done)
        .catch(done);
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

    it("should resolve the returned promise with the result", function (done) {
      const dispatcher = TypeDispatcher([
        [MyType, checkPromisePerformer]
      ]);
      const effect = MyType();

      perform(context, dispatcher, effect)
        .then(function (result) {
          expect(result).to.equal("expected result");
        })
        .then(done)
        .catch(done);
    });

    it("should reject the returned promise when performer returns an error", function (done) {
      const dispatcher = TypeDispatcher([
        [MyType, checkFailingPromisePerformer]
      ]);
      const effect = MyType();

      perform(context, dispatcher, effect)
        .then(function (result) {
          throw new Error(`Expected promise to be rejected but got "${result}"`);
        })
        .catch(function (error) {
          expect(error).to.have.property("message", "expected error");
        })
        .then(done)
        .catch(done);
    });
  });

  describe("performer returns an effect", function () {
    it("should perform the returned effect (sync performer)", function (done) {
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

      perform({}, dispatcher, outerEffect)
        .then(function (result) {
          expect(result).to.equal("expected result");
        })
        .then(done)
        .catch(done);
    });

    it("should perform the returned effect (callback performer)", function (done) {
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

      perform({}, dispatcher, outerEffect)
        .then(function (result) {
          expect(result).to.equal("expected result");
        })
        .then(done)
        .catch(done);
    });
  });

  it("should reject returned promise when no performer could be found", function (done) {
    const dispatcher = TypeDispatcher();
    const effect = MyType();

    perform({}, dispatcher, effect)
      .then(function (result) {
        throw new Error(`Expected promise to be rejected but got "${result}"`);
      })
      .catch(function (error) {
        expect(error).to.have.property("message", "No performer for \"MyType\" could be found");
      })
      .then(done)
      .catch(done);
  });
});
