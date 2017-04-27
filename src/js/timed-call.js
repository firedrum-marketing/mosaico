"use strict";

var console = require("console");

var _call = function(whatToCall, callbackOptions) {
  if (typeof callbackOptions !== 'undefined') {
    return whatToCall.apply(callbackOptions.that, callbackOptions.args);
  } else {
    return whatToCall();
  }
};

var logs = [];

function wrapCallback(name, start, callback, that) {
  return function(name, start) {
    var res;
    if (typeof console == 'object' && console.time) console.time(name);
    res = _call(callback, {
      args: Array.prototype.slice.call(arguments, 2),
      that: this
    });
    if (typeof console == 'object' && console.time) console.timeEnd(name);
    var diff = new Date().getTime() - start;
    if (typeof console == 'object' && !console.time) console.log(name, "took", diff, "ms");
    logs.push({
      name: name,
      time: diff
    });
    // max logs
    if (logs.length > 100) logs.unshift();
    return res;
  }.bind(that, name, start);
}

var _timedCall = function(name, whatToCall, callbackOptions) {
  var start = new Date().getTime();
  if (typeof callbackOptions !== 'undefined') {
    var i;
    for (i = 0; i < callbackOptions.callbacks.length; i++) {
      callbackOptions.args[callbackOptions.callbacks[i]] = wrapCallback(name, start, callbackOptions.args[callbackOptions.callbacks[i]], callbackOptions.that);
    }
    if (typeof console == 'object' && console.time) console.time(name);
    _call(whatToCall, callbackOptions);
  } else {
    var res;
    if (typeof console == 'object' && console.time) console.time(name);
    res = _call(whatToCall);
    if (typeof console == 'object' && console.time) console.timeEnd(name);
    var diff = new Date().getTime() - start;
    if (typeof console == 'object' && !console.time) if (typeof console.debug == 'function') console.debug(name, "took", diff, "ms");
    logs.push({
      name: name,
      time: diff
    });
    // max logs
    if (logs.length > 100) logs.unshift();
    return res;
  }
};

module.exports = {
  timedCall: _timedCall,
  logs: logs
};