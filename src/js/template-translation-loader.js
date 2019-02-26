"use strict";
/* global global: false */
/* global self: false */

// Fix for http stream incorrectly browserified
global.window = global;
var workerAddEventListener = global.addEventListener.bind(global);
var workerPostMessage = global.postMessage.bind(global);
require('jsdom-global')();
var $ = require("jquery");
function TemplatesPlugin(existingTemplateIds) {
  this.templateSystemData = [];
  this.templateSystemIds = existingTemplateIds;
  this.adder = function(id, html) {
    if (typeof html !== 'string') throw "Template system: cannot create new template " + id;
    var trash = html.match(/(data)?-ko-[^ =:]*/g);
    if (trash) {
      global.console.error("ERROR: found unexpected -ko- attribute in compiled template", id, ", you probably mispelled it:", trash);
    }
    this.templateSystemData.push({id: id, html: html});
    this.templateSystemIds.push(id);
  };
  this.exists = function(id) {
    return this.templateSystemIds.indexOf(id) > -1;
  };
}
  
// requires only when imported
var translateTemplate = function() {
  var tt = require('./converter/parser.js');
  return tt.apply(tt, arguments);
};

var _templateUrlConverter = function(basePath, url) {
  if (!url.match(/^[^\/]*:/) && !url.match(/^\//) && !url.match(/^\[/) && !url.match(/^#?$/)) {
    // TODO this could be smarter joining the urls...
    return basePath + url;
  } else {
    return null;
  }
};

var templateCreator = function(templatePlugin, htmlOrElement, optionalName, templateMode) {
  var tmpName = optionalName;
  if (typeof optionalName != 'undefined' && typeof templateMode != 'undefined') {
    if (typeof htmlOrElement != 'object' || htmlOrElement.tagName.toLowerCase() != 'replacedhtml') tmpName += '-' + templateMode;
  }

  while (typeof tmpName == 'undefined' || tmpName === null || templatePlugin.exists(tmpName)) {
    tmpName = 'anonymous-' + Math.floor((Math.random() * 100000) + 1);
  }

  if (typeof htmlOrElement == 'object' && htmlOrElement.tagName.toLowerCase() == 'replacedhtml') {
    var $el = $(htmlOrElement);
    var $head = $('replacedhead', $el);
    var $body = $('replacedbody', $el);
    var $webFonts = '<!-- ko if: $root.customFonts().length > 0 -->';
    $webFonts += '<link class="mo-web-font-support" rel="preconnect" href="https://fonts.gstatic.com/" crossorigin="crossorigin">';
    $webFonts += '<link class="mo-web-font-support" rel="stylesheet" data-bind="attr: { href: Mosaico.ko.pureComputed(function(){var r=\'https://fonts.googleapis.com/css?family=\',i=0,f=this.customFonts();for(;i<f.length;i++)r+=(i>0?\'|\':\'\')+encodeURIComponent(f[i].label)+\':100,100i,400,400i,500,500i,700,700i,900,900i\';return r},$root) }">';
    $webFonts += '<!-- /ko -->';
    templatePlugin.adder(tmpName + '-head', $head.append($webFonts).html() || $webFonts);
    templatePlugin.adder(tmpName + '-show', $body.html() || '');
    templatePlugin.adder(tmpName + '-preview', $el.html());
    templatePlugin.adder(tmpName + '-wysiwyg', $el.html());

    // $head.attr('data-bind', 'block: content');
    $head.children().detach();
    $head.html('<base href="//' + global.location.host + '"><!-- ko block: content --><!-- /ko -->');
    $head.before('<!-- ko withProperties: { templateMode: \'head\' } -->');
    $head.after('<!-- /ko -->');
    $body.html("<!-- ko block: content --><!-- /ko -->");

    templatePlugin.adder(tmpName + '-iframe', $el[0].outerHTML);

  } else if (typeof htmlOrElement == 'object') {
    templatePlugin.adder(tmpName, htmlOrElement.outerHTML);
  } else {
    templatePlugin.adder(tmpName, htmlOrElement);
  }

  return tmpName;
};

workerAddEventListener( 'message', function(evt) {
	var myTemplatePlugin = new TemplatesPlugin(evt.data.existingTemplateIds);
	workerPostMessage( {
		'templateDefs': translateTemplate( evt.data.templateName, evt.data.html, _templateUrlConverter.bind(undefined, evt.data.templatePath), templateCreator.bind(undefined, myTemplatePlugin) ),
		'templateSystemData': myTemplatePlugin.templateSystemData
	} );
} );
