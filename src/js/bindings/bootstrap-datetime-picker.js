"use strict";

// Creates new jQuery DateTime Picker.

var ko = require('knockout');
var $ = require('jquery');
require('eonasdan-bootstrap-datetimepicker');
var datetimepicker = $.fn.datetimepicker;

if (typeof datetimepicker === 'undefined') throw 'Cannot find bootstrap datetimepicker widget dependency!';

ko.bindingHandlers.dateTimePicker = {
  init: function(element, valueAccessor, allBindings) {
    // Initialize datetimepicker with some options
    var options = allBindings().dateTimePickerOptions || {};
    if (!options.defaultDate) {
      options.defaultDate = ko.utils.unwrapObservable(valueAccessor());
    }
    if (ko.isObservable(options.timeZone)) {
      options.timeZone = ko.utils.unwrapObservable(options.timeZone);
    }

    var picker = $(element)
      .datetimepicker(options)
      .data('DateTimePicker');
    if (!options.defaultDate) {
      // Use start of day in case our granularity is higher than seconds!
      /* jshint ignore:start */
      var zeroTime = new moment();
      picker.date((options.timeZone ? zeroTime.tz(options.timeZone) : zeroTime).startOf('day'));
      /* jshint ignore:end */
      picker.clear();
    }

    // When a user changes the date, update the view model
    var ourUpdate = false;
    ko.utils.registerEventHandler(element, 'dp.change', function(event) {
      var value = valueAccessor();
      if (ko.isObservable(value)) {
        ourUpdate = true;
        value(event.date ? event.date.clone().utc().format('YYYY-MM-DDTHH:mm:ss') + 'Z' : null);
        ourUpdate = false;
      }
    });

    ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
      picker.destroy();
    });

    // When the view model is updated, update the widget
    ko.computed(function() {
      var newValue = ko.utils.unwrapObservable(valueAccessor());
      var oldValue = picker.viewDate() ? picker.viewDate().clone().utc().format('YYYY-MM-DDTHH:mm:ss') + 'Z' : null;
      if (oldValue !== newValue && !ourUpdate) {
        if (newValue) {
          /* jshint ignore:start */
          var newMoment = moment(newValue);
          picker.date(options.timeZone ? newMoment.tz(options.timeZone) : newMoment);
          /* jshint ignore:end */
        } else {
          picker.clear();
        }
      }
    }, null, {disposeWhenNodeIsRemoved: element});
  }
};
