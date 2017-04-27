"use strict";

// This deals with Cheerio/jQuery issues.
// Most of this could be done without jQuery, too, but jQuery is easier to be mocked with Cheerio
// Otherwise we would need jsDom to run the compiler in the server (without a real browser)

var $ = require("jquery");
require('jquery-ui');

function _extend(target, source) {
  if (source) {
    for (var prop in source) {
      if (source.hasOwnProperty(prop)) {
        target[prop] = source[prop];
      }
    }
  }
  return target;
}

var objExtend = function(obj, extender) {
  if (typeof $.extend == 'function') {
    return $.extend(true, obj, extender);
  } else {
    return _extend(obj, JSON.parse(JSON.stringify(extender)));
  }
};

var getAttribute = function(element, attribute) {
  var res = $(element).attr(attribute);
  if (typeof res == 'undefined') res = null;
  return res;
  // return element.getAttribute(attribute);
};

var setAttribute = function(element, attribute, value) {
  $(element).attr(attribute, value);
  // element.setAttribute(attribute, value);
};

var removeAttribute = function(element, attribute) {
  $(element).removeAttr(attribute);
  // element.removeAttribute(attribute);
};

var getInnerText = function(element) {
  return $(element).text();
  // if (typeof element.innerText != 'undefined') return element.innerText;
  // else return element.textContent;
};

var getOuterHtml = function(element) {
  return $('<div></div>').append($(element).clone()).html();
  // return element.outerHTML;
};

var getInnerHtml = function(element) {
  return $(element).html();
  // return element.innerHTML;
};

var getLowerTagName = function(element) {
  // sometimes cheerio doesn't have tagName but "name".
  // Browsers have "name" with empty string
  // Sometimes cheerio has tagName but no prop function.
  if (element.tagName === '' && typeof element.name == 'string') return element.name.toLowerCase();
  if (element.tagName !== '') return element.tagName.toLowerCase();
  return $(element).prop("tagName").toLowerCase();
  // return element.tagName.toLowerCase();
};

var setContent = function(element, content) {
  $(element).html(content);
  // element.innerHTML = content;
};

var replaceHtml = function(element, html) {
  $(element).replaceWith(html);
  // element.outerHTML = html;
};

var createElement = function(html) {
  var newElement = $(html);
  if (newElement.length === 1) {
    return newElement[0];
  } else {
    return null;
  }
};

var setCss = function(element, css) {
  $(element).css(css);
};

var getCss = function(element, attr) {
  return $(element).css(attr);
};

var removeElements = function($elements, tryDetach) {
  if (tryDetach && typeof $elements.detach !== 'undefined') $elements.detach();
  // NOTE: we don't need an else, as detach is simply an optimization
  $elements.remove();
};

var appendElements = function(element, $elements) {
  if ($elements && $elements.length) {
    var $element = $(element);
    for(var i = 0; i < $elements.length; i++) {
      $element.append($elements[i]);
    }
  }
};

var cloneAttributes = function(src, dest) {
  var $dest = $(dest);
  var attributes = $(src).prop('attributes');
  $.each(attributes, function() {
    $dest.attr(this.name, this.value);
  });
};

module.exports = {
  getAttribute: getAttribute,
  setAttribute: setAttribute,
  removeAttribute: removeAttribute,
  cloneAttributes: cloneAttributes,
  getInnerText: getInnerText,
  getInnerHtml: getInnerHtml,
  getOuterHtml: getOuterHtml,
  getLowerTagName: getLowerTagName,
  setContent: setContent,
  replaceHtml: replaceHtml,
  removeElements: removeElements,
  createElement: createElement,
  setCss: setCss,
  getCss: getCss,
  appendElements: appendElements,
  objExtend: objExtend
};