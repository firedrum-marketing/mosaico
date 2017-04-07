/* globals document: false */

"use strict";

// Creates an emojiarea.

var ko = require("knockout");
var $ = require('jquery');
require('jquery-textcomplete');
require('jquery-textselection');
require('emojionearea');

ko.bindingHandlers['emojionearea'] = {
  init: function(element, valueAccessor) {
    var options = valueAccessor() || {};

    var $area = $(element);

    // TODO remove hardcoded url
    ko.utils.extend(options, {
      tonesStyle: 'checkbox',
      pickerPosition: 'right',
      autocomplete: true
    });

    $area.emojioneArea(options);

    var focusEventHandler = function() {
      var changeEvent = document.createEvent('Event');
      changeEvent.initEvent('focus', false, false);
      $area[0].dispatchEvent(changeEvent);
    };
    var changeEventHandler = function() {
      var changeEvent = document.createEvent('Event');
      changeEvent.initEvent('change', false, false);
      $area[0].dispatchEvent(changeEvent);
    };

    $area[0].emojioneArea.on('change', changeEventHandler);
    $area[0].emojioneArea.on('focus', focusEventHandler);
  }
};