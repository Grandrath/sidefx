# SideFX

## Introduction

Side-effects are the primary source of complexity in our programs. They are (almost) the only reason for having to deal with asynchronous code. And they make our code hard to test. Separating side-effects from application logic is a primary goal of software architecture.

But how can we achieve that?

A while ago I watched [a talk](https://www.youtube.com/watch?v=D37dc9EoFus) about the Python library [effect](https://github.com/python-effect/effect) which blew my mind. And only recently I thought, it has to be possible to implement these ideas in JavaScript. So here we are.

## Goals

* Free your application logic completely from side-effects.
* Make your code easier to test.
* Make it easy to swap out implementations in different environments (development, tests, server, browser, &hellip;)
* Reduce dependencies to `sidefx` to a minimum.

## Install

```
npm install -S sidefx
```

## Getting started with SideFX

### Effect types

The first thing we need is an _effect type_ for each side-effect we like to perform. Effect types are defined using the `Effect` function that takes an optional name and an optional constructor / initialize function as arguments.

Here we create an effect type for logging messages:

```javascript
const sidefx = require("sidefx");
const Effect = sidefx.Effect;

const LogMessage = Effect("LogMessage", function (message) {
  this.message = message;  
});
```

`LogMessage` is a factory function that takes a message string and returns instances of our LogMessage effect type. These instances are plain objects that don't carry any behavior - just the data that _describes_ the effect that needs to be performed.

### Performers

To actually perform the side-effect we need a _performer_. A performer is a simple function that takes two arguments: an instance of our effect type and an optional NodeJS-style callback for asynchronous operations.

Let's define a performer that logs messages to the `console`:

```javascript
function performLogMessage(logMessage) {
  console.log(logMessage.message);
}
```

Notice that there is no magic going on here. The performer's name does not matter and can be anything you like and the `logMessage` argument is a return value of our `LogMessage` type we defined above.

Performing the side-effect manually would work like this:

```javascript
const logMessage_1 = LogMessage("Hello, side-effect!");
performLogMessage(logMessage_1);
// => "Hello, side-effect!"
```

This works but is not terribly useful. We have yet to separate our code that _wants_ to log a message from the code that actually _does_ log a message.

### Dispatchers

A _dispatcher_ does exactly that. It takes an effect type instance and looks up a performer for this effect.

To be able to look up performers based on the type of effect we need a `TypeDispatcher`:

```javascript
const TypeDispatcher = sidefx.TypeDispatcher;

const dispatcher = TypeDispatcher([
  [LogMessage, performLogMessage]  
]);
```

The `TypeDispatcher` factory takes a mapping from type to performer in the form of an array of `[Type, performer]` pairs.

Now we can use the `perform` function:

```javascript
const perform = sidefx.perform;
const logMessage_2 = LogMessage("Hello, dispatcher!");
perform(dispatcher, logMessage_2);
// => "Hello, dispatcher!"
```

We are almost there. To finally separate our code and side-effects we need just one more thing.

### Generators

[Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) allow us to define functions that can pass values to and from a surrounding context using `yield`. SideFX uses this mechanism to receive effect type instances and resume the generator when the effect has been performed.

That sounds a bit more complicated than it actually is, so let's look at an example:

```javascript
function* app() {
  yield LogMessage("Hello, App!");
}

perform(dispatcher, app());
// => "Hello, App!"
```

Notice that `app` can be defined within its own module and only depends on `LogMessage` which is a stateless type factory. Instantiating the dispatcher and calling `perform()` stays in the entry point (i.e. `index.js`). `app` itself is a pure function.

Congratulations! We wrote our first side-effect free app!

## A slightly more interesting example

Logging messages to the console is fine, but for a real application we need a bit more than that. We haven't talked about retrieving values from side-effects or performing asynchronous side-effects. So let's do that.

### More effect types

In this example we want to be able to read a file from disk and post its contents to a server. As before we need types that encapsulate the effects. We also want to structure our code using modules.

`effects/read_file.js`
```javascript
const Effect = require("sidefx").Effect;

module.exports = Effect("ReadFile", function (filename, encoding) {
  this.filename = filename;
  this.encoding = encoding || "utf8";
});
```

`effects/post_file.js`
```javascript
const Effect = require("sidefx").Effect;

module.exports = Effect("PostFile", function (filename, content) {
  this.filename = filename;
  this.content = content;
});
```

`effects/log_message.js`
```javascript
const Effect = require("sidefx").Effect;

module.exports = Effect("LogMessage", function (message) {
  this.message = message;  
});
```

Nothing new here. Moving on.

### Asynchronous performers

`performers/read_file.js`
```javascript
const fs = require("fs");

module.exports = function performReadFile(readFile, callback) {
  fs.readFile(readFile.filename, readFile.encoding, callback);
};
```

What's going on here? This performer is asynchronous and needs to call back with the result of the side-effect. SideFX provides a NodeJS-style callback to performers that expects an error object as first and a result object as second parameter.

`performers/post_file.js`
```javascript
const fetch = require("node-fetch");

module.exports = function performPostFile(postFile) {
  return fetch("http://example.com/api/file", {
    method: "post",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filename: postFile.filename,
      content: postFile.content
    })
  });
};
```

In this case we use `fetch` which returns a promise. Instead of requesting the callback in the performer's parameters we simply return the promise. Notice that you must not have the `callback` parameter when you want to use a promise. SideFX uses the function's signature to determine whether it should use a callback or not.

`performers/log_message.js`
```javascript
module.exports = function performLogMessage(logMessage) {
  console.log(logMessage.message);
};
```

### The application

`app.js`
```javascript
const ReadFile = require("./effects/read_file.js");
const PostFile = require("./effects/post_file.js");
const LogMessage = require("./effects/log_message.js");

module.exports = function* app() {
  try {
    const filename = "some-file.txt";
    const content = yield ReadFile(filename);
    const response = yield PostFile(filename, content);
    yield LogMessage(`The server responded with "${response.statusText}"`);
  }
  catch (error) {
    yield LogMessage(`Something went wrong: ${error.message}`);
  }
};
```

Here we have the pure application logic - without performing any side-effects itself. Sweet.

### Wiring things up

`index.js`
```javascript
const sidefx = require("sidefx");
const TypeDispatcher = sidefx.TypeDispatcher;
const perform = sidefx.perform;

const app = require("./app.js");
const ReadFile = require("./effects/read_file.js");
const PostFile = require("./effects/post_file.js");
const performReadFile = require("./performers/read_file.js");
const performPostFile = require("./performers/post_file.js");
const performLogMessage = require("./performers/log_message.js");

const dispatcher = TypeDispatcher([
  [ReadFile, performReadFile],
  [PostFile, performPostFile],
  [LogMessage, performLogMessage]
]);

perform(dispatcher, app());
```

And there you have it. Our entry point `index.js` is only responsible for wiring things up and our application logic has no dependencies to any side-effect code.

## What's next?

I'm working on a more elaborate documentation and examples. Stay tuned.

## Credits

SideFX is heavily inspired by the Python library [effect](https://github.com/python-effect/effect). Kudos to its author [Christopher Armstrong](https://github.com/radix).

## License

MIT License. See [LICENSE](LICENSE).
