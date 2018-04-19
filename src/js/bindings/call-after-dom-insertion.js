"use strict";
/* global global: false */

var ko = require("knockout");
var console = require("console");
var $ = require("jquery");

ko.bindingHandlers['callAfterDOMInsertion'] = {
  'init': function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    ko.bindingEvent.subscribe(element, 'childrenComplete', function() {
      global.requestAnimationFrame(function() {
        var value = valueAccessor();
        var valueUnwrapped = ko.unwrap(value);
        if ( $.isArray(valueUnwrapped) ) {
          for (var i = 0; i < valueUnwrapped.length; i++) {
            var bindingHandler = valueUnwrapped[i];
            if (typeof bindingHandler === 'string') {
              ko.bindingHandlers[bindingHandler].update(element, ko.observable(allBindings.get(bindingHandler)), allBindings, viewModel, bindingContext);
            }
          }
        }
      });
    });
  }
};
ko.virtualElements.allowedBindings['callAfterDOMInsertion'] = true;
