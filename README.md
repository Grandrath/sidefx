# SideFX

**Note:** There is no code here yet, sorry. Just a concept.

## Introduction

Side-effects suck. The primary source of complexity in our programs is side-effects. The (almost) only reason for having to deal with asynchronous code is side-effects. Code becomes ~~impossible~~ hard to test because of side-effects. And yet we need them. Without side-effects our programs can't do anything remotely useful.

Have a look at these two functions:

```javascript
function greet(subject) {
  return `Hello, ${subject}!`
}

function getJson(url) {
  return fetch(url).then(response => response.json());
}
```

The `greet` function is a breeze to test. Simply call it with certain input values and make assertions about the corresponding return values. You can easily specify how it should behave when passing `""`, `null` or an object. Should it throw an error, fall back to a default value or something else? Your call.

`getJson` is trickier. You basically have two choices: replace the global `fetch` function with a test double (and make sure to restore it once your test is done!) or spin up a server that serves specific test data you can then assert against. Both are a lot of work and both are error-prone. Which might make you decide not to test this code.

But there is a catch. Side-effects are like a virus. Every code they touch becomes a side-effect itself. So does the caller of `getJson`. And its caller.

If you ever struggled with this problem, you have certainly heard of _dependency injection_. In this example: simply pass `fetch` as a parameter into `getJson`. This makes it 	noticeable easier to replace it with a double implementation without having to manipulate the global object. The downside of this approach is that now the caller of `getJson` also has a dependency on `fetch`. Do you start to pass around all kinds of side-effects everywhere?

I know, DI frameworks exist. But none of those solves this problem (YMMV). Without going into too much detail here, the main problems with DI frameworks are that they require you to register every single piece of code at a single location and to sprinkle dependencies to the framework-of-choice all over your code. I like to write my apps in lots of tiny reusable modules, so I'm not at all excited about that.

A while ago I watched [a talk](https://www.youtube.com/watch?v=D37dc9EoFus) about the Python library [effect](https://github.com/python-effect/effect) which blew my mind. And recently I thought, it has to be possible to write something similar in JavaScript. So here we are.

## Goals

* Reduce dependencies to `sidefx` to a minimum.
* Make your application logic completely free of side-effects.
* Make it easy to swap out implementations in different environments (development, tests, server, browser, &hellip;)
* Make your code easier to test.

## Getting started with SideFX

### Effect types

The first thing we need is an _effect type_ for each side-effect we like to perform. Effect types are defined using the `Effect` function that takes a constructor / initialize function as argument.

Here we create an effect type for logging messages:

```javascript
const sidefx = require("sidefx");
const Effect = sidefx.Effect;

const LogMessage = Effect(function (message) {
  this.message = message;  
});
```

`LogMessage` is now a factory function that takes a message and returns instances of our LogMessage effect type. These instances are plain objects that don't carry any behavior - just the data that _describes_ the effect that needs to be performed.

### Performers

To actually perform the side-effect we need a _performer_. A performer is a simple function that takes two arguments: the _context_, which will contain low-level side-effect causing APIs, and an instance of our effect type.

Let's define a performer that logs messages to the `console`:

```javascript
function performLogMessage(context, logMessage) {
  context.console.log(logMessage.message);
}
```

Notice that there is no magic going on here. The performer's name does not matter and can be anything you like and the `logMessage` argument is a return value of our `LogMessage` type we defined above.

You might be wondering why we pass in an object with a `console` property although `console` is a global. We come back to this one. (Spoiler: it enables us to test the performer function and swap out implementations)

Performing the side-effect manually would work like this:

```javascript
const logMessage_1 = LogMessage("Hello, side-effect!");
performLogMessage(global, logMessage_1);
// => "Hello, side-effect!"
```

This works but is not terribly useful. We have yet to separate our code that _wants_ to log a message from the code that actually _does_ log a message.

### Dispatchers

A _dispatcher_ does exactly that. It takes an effect type instance, looks up a performer for this effect and calls the performer with the effect.

To be able to look up performers based on the type of effect we need a `TypeDispatcher`:

```javascript
const TypeDispatcher = sidefx.TypeDispatcher;

const dispatcher = TypeDispatcher([
  [LogMessage, performLogMessage]  
]);
```

The `TypeDispatcher` factory takes a mapping from type to performer in the form of an array of `[Type, performer]` pairs.

Now we can use the dispatcher's `perform` method:

```javascript
const context = {
  console: console
};
const logMessage_2 = LogMessage("Hello, dispatcher!");
dispatcher.perform(context, logMessage_2);
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

dispatcher.perform(context, app());
// => "Hello, App!"
```

Notice that `app` can be defined within its own module and only depends on `LogMessage` which is a stateless type factory. Instantiating the dispatcher and calling `.perform()` stays in the entry point (i.e. `index.js`).

Congratulations! We wrote our first side-effect free app!

## A slightly more interesting example

Logging messages to the console is fine, but for a real application we need a bit more than that. We haven't talked about retrieving values from side-effects or performing asynchronous side-effects. So let's do that.

### More effect types

In this example we want to be able to read a file from disk and post its contents to a server. As before we need types that encapsulate the effects. We also want to structure our code using modules.

`effects/read_file.js`
```javascript
const Effect = require("sidefx").Effect;

module.exports = Effect(function (filename, encoding) {
  this.filename = filename;
  this.encoding = encoding || "utf8";
});
```

`effects/post_file.js`
```javascript
const Effect = require("sidefx").Effect;

module.exports = Effect(function (filename, content) {
  this.filename = filename;
  this.content = content;
});
```

`effects/log_message.js`
```javascript
const Effect = require("sidefx").Effect;

module.exports = Effect(function (message) {
  this.message = message;  
});
```

Nothing new here. Moving on.

### Asynchronous performers

`performers/read_file.js`
```javascript
module.exports = function performReadFile(context, readFile, callback) {
  context.fs.readFile(readFile.filename, readFile.encoding, callback);
};
```

What's going on here? This performer is asynchronous and needs to call back with the result of the side-effect. SideFX provides a NodeJS-style callback to performers that expects an error object as first and a result object as second parameter.

`performers/post_file.js`
```javascript
module.exports = function performPostFile(context, postFile) {
  return context.fetch("http://example.com/api/file", {
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

Notice that we access `fetch` via the `context` object. This enables us to use [`node-fetch`](https://www.npmjs.com/package/node-fetch) on the server and [`window.fetch`](https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch) in the browser without changing this performer.

`performers/log_message.js`
```javascript
module.exports = function performLogMessage(context, logMessage) {
  context.console.log(logMessage.message);
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
const TypeDispatcher = require("sidefx").TypeDispatcher;

const app = require("./app.js");
const ReadFile = require("./effects/read_file.js");
const PostFile = require("./effects/post_file.js");
const performReadFile = require("./performers/read_file.js");
const performPostFile = require("./performers/post_file.js");
const performLogMessage = require("./performers/log_message.js");

const context = {
  fs: require("fs"),
  fetch: require("node-fetch"),
  console: console
};

const dispatcher = TypeDispatcher([
  [ReadFile, performReadFile],
  [PostFile, performPostFile],
  [LogMessage, performLogMessage]
]);

dispatcher.perform(context, app());
```

And there you have it. Our entry point `index.js` is only responsible for wiring things up and our application logic has no dependencies to any side-effect code.

## What's next?

As stated above there is no code to play around with yet, sorry. If you like to get notified when this unsatisfying situation changes, simply subscribe to [this issue on GitHub](https://github.com/Grandrath/sidefx/issues/1). I also welcome any ideas, suggestions and other input. Please feel free to open up a new GitHub issue.

## Credits

SideFX is heavily inspired by the Python library [effect](https://github.com/python-effect/effect). Kudos to its author [Christopher Armstrong](https://github.com/radix).

## License

MIT License. See [LICENSE](LICENSE).
