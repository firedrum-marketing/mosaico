"use strict";

var ko = require('knockout');
var console = require('console');

// equals to "value" binding but apply "invalid" class if "pattern" attribute is defined and value matches the rule
ko.bindingHandlers['validatedValue'] = {
	init: function(element, valueAccessor, allBindings) {
		var options = valueAccessor();
		var newValueAccessor = options.value;
		if (typeof element.pattern !== 'undefined') {
			var re = new RegExp('^(?:' + element.pattern + ')$');
			var schemeRe = /^[^:]+:/;
			var computed = ko.computed({
				read: function() {
					var res = ko.utils.unwrapObservable(options.value);
					if (typeof options.defaultProtocol !== 'undefined' && options.defaultProtocol !== null) {
						if (res !== null && res !== '' && !re.test(res) && !schemeRe.test(res)) {
							if (res.indexOf('@') > 0 && res.indexOf('//') === -1 && res.indexOf('mailto:') === -1) {
								res = 'mailto:' + res;
							} else {
								res = options.defaultProtocol + res;
							}
						}
					}
					
					// TODO support for element.required ?
					var valid = res === null || res === '' || re.test(res);
					// IE11 doesn't support classList.toggle('invalid', state)
					if (valid) {
						element.classList.remove('invalid');
					} else {
						element.classList.add('invalid');
					}
					return res;
				},
				write: ko.isWriteableObservable(options.value) && function(value) {
					if (typeof options.defaultProtocol !== 'undefined' && options.defaultProtocol !== null) {
						if (value !== null && value !== '' && !re.test(value) && !schemeRe.test(value)) {
							if (value.indexOf('@') > 0 && value.indexOf('//') === -1 && value.indexOf('mailto:') === -1) {
								value = 'mailto:' + value;
							} else {
								value = options.defaultProtocol + value;
							}
						}
					}
					
					// @see https://github.com/voidlabs/mosaico/issues/103
					ko.selectExtensions.writeValue(element, value);
					var updValue = ko.selectExtensions.readValue(element);
					options.value(updValue);
				},
				disposeWhenNodeIsRemoved: element
			});
			newValueAccessor = function() {
				return computed;
			};
		}
		ko.bindingHandlers['value'].init(element, newValueAccessor, allBindings);
	}
};
ko.expressionRewriting._twoWayBindings['validatedValue'] = true;
