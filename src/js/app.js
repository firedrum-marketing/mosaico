"use strict";
/* global global: false */
/* global XMLHttpRequest: false */

var templateLoader = require('./template-loader.js');
var console = require("console");
var ko = require("knockout");
var $ = require("jquery");
require("./ko-bindings.js");
require('jquery-ui');
require('jquery-textselection');
require('jqueryui-touch-punch');
var performanceAwareCaller = require("./timed-call.js").timedCall;

var addUndoStackExtensionMaker = require("./undomanager/undomain.js");
var colorPlugin = require("./ext/color.js");
var utilPlugin = require("./ext/util.js");
var inlinerPlugin = require("./ext/inliner.js");

var localStorageLoader = require("./ext/localstorage.js");

if (typeof ko == 'undefined') throw "Cannot find knockout.js library!";
if (typeof $ == 'undefined') throw "Cannot find jquery library!";

function _canonicalize(url) {
  var div = global.document.createElement('div');
  div.innerHTML = "<a></a>";
  div.firstChild.href = url; // Ensures that the href is properly escaped
  div.innerHTML = div.innerHTML; // Run the current innerHTML back through the parser
  return div.firstChild.href;
}

function _appendUrlParameters(baseUrl, parameters) {
  var paramSeparator = baseUrl.indexOf('?') == -1 ? '?' : '&';
  var res = baseUrl;
  for (var param in parameters) if (parameters.hasOwnProperty(param)) {
    res += paramSeparator + param + "=" + encodeURIComponent(parameters[param]);
    paramSeparator = '&';
  }
  return res;
}

var applyBindingOptions = function(options, ko) {

  ko.bindingHandlers.wysiwygSrc.convertedUrl = function(src, method, width, height) {
    var queryParamSeparator;
    var imgProcessorBackend = options.imgProcessorBackend ? options.imgProcessorBackend : './upload';
    var backEndMatch = imgProcessorBackend.match(/^(https?:\/\/[^\/]*\/).*$/);
    var srcMatch = src.match(/^(https?:\/\/[^\/]*\/).*$/);
    if ((backEndMatch === null || srcMatch === null) || (backEndMatch[1] == srcMatch[1])) {
      queryParamSeparator = imgProcessorBackend.indexOf('?') == -1 ? '?' : '&';
      return _appendUrlParameters(imgProcessorBackend, { src: src, method: method, params: width + "," + height });
    } else {
      console.log("Cannot apply backend image resizing to non-local resources ", src, method, width, height, backEndMatch, srcMatch);
      var params = { method: method, width: width };
      if (height !== null) params['height'] = height;
      return _appendUrlParameters(src, params);
    }
  };

  ko.bindingHandlers.wysiwygSrc.placeholderUrl = function(width, height, text, overrideText) {
    var imgProcessorBackend = options.imgProcessorBackend ? options.imgProcessorBackend : './upload';
    var urlParams = {
      method: 'placeholder',
      params: width + ',' + height
    };
    if (typeof overrideText !== 'undefined') {
      urlParams.text = overrideText;
    }
    return _appendUrlParameters(imgProcessorBackend, urlParams);
  };

  // pushes custom tinymce configurations from options to the binding
  if (options && options.tinymceConfig)
    ko.bindingHandlers.wysiwyg.standardOptions = options.tinymceConfig;
  if (options && options.tinymceConfigFull)
    ko.bindingHandlers.wysiwyg.fullOptions = options.tinymceConfigFull;
};

var start = function(options, templateFile, templateMetadata, jsorjson, customExtensions) {



  templateLoader.fixPageEvents();

  var fileUploadMessagesExtension = function(vm) {
    var fileuploadConfig = {
      messages: {
        unknownError: vm.t('Unknown error'),
        uploadedBytes: vm.t('Uploaded bytes exceed file size'),
        maxNumberOfFiles: vm.t('Maximum number of files exceeded'),
        acceptFileTypes: vm.t('File type not allowed'),
        maxFileSize: vm.t('File is too large'),
        minFileSize: vm.t('File is too small'),
        post_max_size: vm.t('The uploaded file exceeds the post_max_size directive in php.ini'),
        max_file_size: vm.t('File is too big'),
        min_file_size: vm.t('File is too small'),
        accept_file_types: vm.t('Filetype not allowed'),
        max_number_of_files: vm.t('Maximum number of files exceeded'),
        max_width: vm.t('Image exceeds maximum width'),
        min_width: vm.t('Image requires a minimum width'),
        max_height: vm.t('Image exceeds maximum height'),
        min_height: vm.t('Image requires a minimum height'),
        abort: vm.t('File upload aborted'),
        image_resize: vm.t('Failed to resize image'),
        generic: vm.t('Unexpected upload error')
      }
    };
    // fileUpload options.
    if (options && options.fileuploadConfig)
      fileuploadConfig = $.extend(true, fileuploadConfig, options.fileuploadConfig);

    ko.bindingHandlers['fileupload'].extendOptions = fileuploadConfig;

  };

  var simpleTranslationPlugin = function(vm) {
    if (options && options.strings) {
      vm.t = function(key, objParam) {
        var res = options.strings[key];
        if (typeof res == 'undefined') {
          // All these warnings are killing performance!!!
          //console.warn("Missing translation string for",key,": using default string");
          res = key;
        }
        return vm.tt(res, objParam);
      };
    }
  };

  // simpleTranslationPlugin must be before the undoStack to translate undo/redo labels
  var extensions = [simpleTranslationPlugin, addUndoStackExtensionMaker(performanceAwareCaller), colorPlugin, utilPlugin, inlinerPlugin];
  if (typeof customExtensions !== 'undefined')
    for (var k = 0; k < customExtensions.length; k++) extensions.push(customExtensions[k]);
  extensions.push(fileUploadMessagesExtension);

  var galleryUrl = options.fileuploadConfig ? options.fileuploadConfig.url : '/upload/';
  applyBindingOptions(options, ko);

  $("<!-- ko template: 'main' --><!-- /ko -->").appendTo(typeof options.mainElement != 'undefined' ? options.mainElement : global.document.body);

  // templateFile may override the template path in templateMetadata
  if (typeof templateFile == 'undefined' && typeof templateMetadata != 'undefined') {
    templateFile = templateMetadata.template;
  }
  // TODO canonicalize templateFile to absolute or relative depending on "relativeUrlsException" plugin

  templateLoader.load(performanceAwareCaller, templateFile, templateMetadata, jsorjson, extensions, galleryUrl, options);

};

var initFromLocalStorage = function(options, hash_key, customExtensions) {
  try {
    var lsData = localStorageLoader(hash_key, options.emailProcessorBackend);
    var extensions = typeof customExtensions !== 'undefined' ? customExtensions : [];
    extensions.push(lsData.extension);
    var template = _canonicalize(lsData.metadata.template);
    start(options, template, lsData.metadata, lsData.model, extensions);
  } catch (e) {
    console.error("TODO not found ", hash_key, e);
  }
};

var init = function(options, customExtensions) {

  var hash = global.location.hash ? global.location.href.split("#")[1] : undefined;

  // Loading from configured template or configured metadata
  if (options && (options.template || options.data)) {
    if (options.data) {
      var data = typeof data == 'string' ? JSON.parse(options.data) : options.data;
      start(options, undefined, data.metadata, data.content, customExtensions);
    } else {
      start(options, options.template, undefined, undefined, customExtensions);
    }
    // Loading from LocalStorage (if url hash has a 7chars key)
  } else if (hash && hash.length == 7) {
    initFromLocalStorage(options, hash, customExtensions);
    // Loading from template url as hash (if hash is not a valid localstorage key)
  } else if (hash) {
    start(options, _canonicalize(hash), undefined, undefined, customExtensions);
  } else {
    return false;
  }
  return true;
};

var getModelReferences = function() {
  return templateLoader.getModelReferences();
};

var isIE = function() {
  var tmp = global.document.documentMode;

  // Try to force this property to be a string. 
  try {
    global.document.documentMode = '';
  } catch(e){}

  // If document.documentMode is a number, then it is a read-only property, and so 
  // we have IE 8+.
  // Otherwise, if conditional compilation works, then we have IE < 11.
  // Otherwise, we have a non-IE browser. 
  /* jshint ignore:start */
  var isIE = typeof global.document.documentMode == 'number' || new Function('return/*@cc_on!@*/!1')( );
  /* jshint ignore:end */

  // Switch back the value to be unobtrusive for non-IE browsers. 
  try {
    global.document.documentMode = tmp;
  } catch(e){}
  
  return isIE;
};

module.exports = {
  isCompatible: templateLoader.isCompatible,
  init: init,
  start: start,
  ko: ko,
  $: $,
  url: require('url'),
  download: require('downloadjs'),
  getModelReferences: getModelReferences,
  isIE: isIE
};