"use strict";
/* global global: false */

var $ = require("jquery");
require('jquery-ui');
var ko = require("knockout");
var kojqui = require("knockout-jqueryui"); // just for the widget plugins
var templateConverter = require("./converter/main.js");
var console = require("console");
var initializeViewmodel = require("./viewmodel.js");
var templateSystem = require('./bindings/choose-template.js');

// call a given method on every plugin implementing it.
// supports a "reverse" parameter to call the methods from the last one to the first one.
var pluginsCall = function(plugins, methodName, args, reverse) {
  var start, end, diff, res, results;
  results = [];
  if (typeof reverse !== 'undefined' && reverse) {
    start = plugins.length - 1;
    end = 0;
    diff = -1;
  } else {
    start = 0;
    end = plugins.length - 1;
    diff = 1;
  }
  for (var i = start; i != end + diff; i += diff) {
    if (typeof plugins[i][methodName] !== 'undefined') {
      global.requestAnimationFrame( plugins[i][methodName].bind.apply(plugins[i][methodName], [plugins[i]].concat(args)));
    }
  }
  return results;
};

// workaround for knockout-jqueryui's buttonset/button disposal:
// https://github.com/gvas/knockout-jqueryui/issues/25
var origDisposeCallback = ko.utils.domNodeDisposal.addDisposeCallback;
ko.utils.domNodeDisposal.addDisposeCallback = function(node, callback) {
  var newCallback = function(node) {
    try {
      callback(node);
    } catch (e) {
      // this wrapper catches "expected" exceptions
      if (typeof console.debug == 'function') console.debug("Caught unexpected dispose callback exception", e);
    }
  };
  origDisposeCallback(node, newCallback);
};

var bindingPluginMaker = function(performanceAwareCaller, options) {
  return {
    viewModel: function(viewModel) {
      try {
        performanceAwareCaller('applyBindings', ko.applyBindings.bind(undefined, viewModel, typeof options.mainElement !== 'undefined' ? options.mainElement : global.document.body));
      } catch (err) {
        console.warn(err, err.stack);
        throw err;
      }
    },
    dispose: function() {
      try {
        performanceAwareCaller('unapplyBindings', ko.cleanNode.bind(this, typeof options.mainElement !== 'undefined' ? options.mainElement : global.document.body));
      } catch (err) {
        console.warn(err, err.stack);
        throw err;
      }
    }
  };
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

// Adapter to transform "viewModel plugins" into more generic plugins.
function _viewModelPluginInstance(pluginFunction) {
  var instance;
  return {
    viewModel: function(viewModel) {
      instance = pluginFunction(viewModel);
    },
    init: function() {
      if (typeof instance !== 'undefined' && typeof instance.init !== 'undefined') instance.init();
    },
    dispose: function() {
      if (typeof instance !== 'undefined' && typeof instance.dispose !== 'undefined') instance.dispose();
    }
  };
}

var _templateUrlConverter = function(basePath, url) {
  if (!url.match(/^[^\/]*:/) && !url.match(/^\//) && !url.match(/^\[/) && !url.match(/^#?$/)) {
    // TODO this could be smarter joining the urls...
    return basePath + url;
  } else {
    return null;
  }
};

var templateLoader = function(performanceAwareCaller, templateFileName, templateMetadata, jsorjson, extensions, galleryUrl, options) {
  var templateFile = typeof templateFileName == 'string' ? templateFileName : templateMetadata.template;
  var templatePath = "./";
  var p = templateFile.lastIndexOf('/');
  if (p != -1) {
    templatePath = templateFile.substr(0, p + 1);
  }

  var templateUrlConverter = _templateUrlConverter.bind(undefined, templatePath);

  var metadata;
  if (typeof templateMetadata == 'undefined') {
    metadata = {
      template: templateFile,
      // TODO l10n?
      name: 'No name',
      created: Date.now()
    };
  } else {
    metadata = templateMetadata;
  }

  $.get(templateFile, function(templatecode) {
    var res = templateCompiler(performanceAwareCaller, templateUrlConverter, "template", templatecode, jsorjson, metadata, extensions, galleryUrl, options, {init: true, templatePath: templatePath});
    //res.init();
  });
};

var modelReferences = null;

var templateCompiler = function(performanceAwareCaller, templateUrlConverter, templateName, templatecode, jsorjson, metadata, extensions, galleryUrl, options, finalOptions) {
  // we strip content before <html> tag and after </html> because jquery doesn't parse it.
  // we'll keep it "raw" and use it in the preview/output methods.
  var res = templatecode.match(/^([\S\s]*)([<]html[^>]*>[\S\s]*<\/html>)([\S\s]*)$/i);
  if (res === null) throw "Unable to find <html> opening and closing tags in the template";
  var prefix = res[1];
  // we parse the html content after replacing the tag name for html/head/body so to avoid jquery issues in parsing.
  var basicStructure = { '<html': 0, '<head': 0, '<body': 0, '</html': 0, '</body': 0, '</head': 0 };
  var html = res[2].replace(/(<\/?)(html|head|body)([^>]*>)/gi, function(match, p1, p2, p3) {
    basicStructure[(p1+p2).toLowerCase()] += 1;
    return p1 + 'replaced' + p2 + p3;
  });
  for (var ele in basicStructure) if (basicStructure.hasOwnProperty(ele)) if (basicStructure[ele] != 1) {
    if (basicStructure[ele] === 0) throw "ERROR: missing mandatory element "+ele+">";
    if (basicStructure[ele] > 1) throw "ERROR: multiple element "+ele+"> occourences are not supported (found "+basicStructure[ele]+" occourences)";
  }
  var postfix = res[3];
  var blockDefs = [];
  var enableUndo = true;
  var enableRecorder = true;
  var baseThreshold = '+$root.contentListeners()';
  
  var onAfterBinding = null;
  if (options && typeof options.onAfterBinding == "function") 
    onAfterBinding = options.onAfterBinding;
  else if (options && typeof options.onAfterBinding == "string" && typeof global[options.onAfterBinding] == "function")
    onAfterBinding = global[options.onAfterBinding];

  var plugins = [];

  if (typeof extensions !== 'undefined') {
    for (var i = 0; i < extensions.length; i++) {
      if (typeof extensions[i] == 'function') {
        plugins.push(_viewModelPluginInstance(extensions[i]));
      } else {
        plugins.push(extensions[i]);
      }
    }
  }

  var createdTemplates = [];
  var templatesPlugin = {
    adder: function(id, html) {
      if (typeof html !== 'string') throw "Template system: cannot create new template " + id;
      var trash = html.match(/(data)?-ko-[^ =:]*/g);
      if (trash) {
        console.error("ERROR: found unexpected -ko- attribute in compiled template", id, ", you probably mispelled it:", trash);
      }
      templateSystem.addTemplate(id, html);
      createdTemplates.push(id);
    },
    exists: function(id) {
      var el = templateSystem.getTemplateContent(id);
      if (typeof el !== 'undefined') return true;
      else return false;
    },
    dispose: function() {
      for (var i = createdTemplates.length - 1; i >= 0; i--) {
        templateSystem.removeTemplate(createdTemplates[i]);
      }
    }
  };

  ko.bindingHandlers['block'].templateExists = templatesPlugin.exists;

  // templatecreator tracks created template (via templateAdder) so to be able to dispose them later
  var myTemplateCreator = templateCreator.bind(undefined, templatesPlugin);

  // first pass: we "compile" the template into a templateDef object
  var workerMessage = function(evt) {
    var templateDef = evt.data.templateDefs;
    for( var i = 0; i < evt.data.templateSystemData.length; i++) {
      templateSystem.addTemplate(evt.data.templateSystemData[i].id, evt.data.templateSystemData[i].html);
      createdTemplates.push(evt.data.templateSystemData[i].id);
    }

    var vmWrapper = ko.observable(null);
    // second pass: given the templateDef we create a base content model object for this template.
    var content = performanceAwareCaller('generateModel', templateConverter.wrappedResultModel.bind(undefined, templateDef, vmWrapper));
    modelReferences = content._unwrap();

    // third pass: we create "style/content editors" for every block
    var widgets = {};
    var widgetPlugins = pluginsCall(plugins, 'widget', [$, ko, kojqui]);
    for (var wi = 0; wi < widgetPlugins.length; wi++) {
      widgets[widgetPlugins[wi].widget] = widgetPlugins[wi];
    }
    blockDefs.push.apply(blockDefs, performanceAwareCaller('generateEditors', templateConverter.generateEditors.bind(undefined, templateDef, widgets, templateUrlConverter, myTemplateCreator, baseThreshold)));

    var incompatibleTemplate = false;
    if (typeof jsorjson !== 'undefined' && jsorjson !== null) {
      var unwrapped;
      if (typeof jsorjson == 'string') {
        unwrapped = ko.utils.parseJson(jsorjson);
      } else {
        unwrapped = jsorjson;
      }

      if (typeof unwrapped.dynamicContent === 'undefined') {
        unwrapped.dynamicContent = {};
      }

      // we run a basic compatibility check between the content-model we expect and the initialization model
      var checkModelRes = performanceAwareCaller('checkModel', templateConverter.checkModel.bind(undefined, content._unwrap(), blockDefs, unwrapped));
      // if checkModelRes is 1 then the model is not fully compatible but we fixed it
      if (checkModelRes == 2) {
        console.error("Trying to compile an incompatible template version!", content._unwrap(), blockDefs, unwrapped);
        incompatibleTemplate = true;
      }

      try {
        content._wrap(unwrapped);
      } catch (ex) {
        console.error("Unable to inject model content!", ex);
        incompatibleTemplate = true;
      }
    }

    // This builds the template for the preview/output by concatenating prefix, template and content and stripping the "replaced" prefix added to "problematic" tags (i.e. html/head/body)
    var iframeTplDoctype = prefix;
    var iframeTplDocument = templateSystem.getTemplateContent(templateName + '-iframe').replace(/(<\/?)replaced(html|head|body)([^>]*>)/gi, function(match, p1, p2, p3) {
      return p1 + p2 + p3;
    }) + postfix;

    // store this so to restore it on disposal
    var origiFrameTplDoctype = ko.bindingHandlers.bindIframe.tplDoctype;
    var origiFrameTplDocument = ko.bindingHandlers.bindIframe.tplDocument;
    ko.bindingHandlers.bindIframe.tplDoctype = iframeTplDoctype;
    ko.bindingHandlers.bindIframe.tplDocument = iframeTplDocument;
    var iFramePlugin = {
      dispose: function() {
        ko.bindingHandlers.bindIframe.tplDoctype = origiFrameTplDoctype;
        ko.bindingHandlers.bindIframe.tplDocument = origiFrameTplDocument;
      }
    };

    plugins.push(iFramePlugin);
    plugins.push(templatesPlugin);

    // initialize the viewModel object based on the content model.
    var viewModel = performanceAwareCaller('initializeViewmodel', initializeViewmodel.bind(this, content, blockDefs, templateUrlConverter, galleryUrl));
    viewModel.mosaicoConfig = options;
    if (typeof options.additionalModel === 'string' && typeof templateDef._defs[options.additionalModel] != 'undefined') {
      templateDef._defs[options.additionalModel]._props.split(' ').forEach(function(additionalProp) {
        viewModel[additionalProp] = performanceAwareCaller('generateAdditionalModel', templateConverter.wrappedModel.bind(undefined, templateDef, additionalProp, vmWrapper));
      });
    }
    
    viewModel.metadata = metadata;
    // let's run some version check on template and editor used to build the model being loaded.
    // This will be replaced by browserify-versionify during the build
    var editver = '__VERSION__';
    if (typeof viewModel.metadata.editorversion !== 'undefined' && viewModel.metadata.editorversion !== editver) {
      console.log("The model being loaded has been created with a different editor version", viewModel.metadata.editorversion, "runtime:", editver);
    }
    viewModel.metadata.editorversion = editver;

    // Store templateDef name mapping and templateDef category mapping somewhere accessible to ko templateSystem
    viewModel.blockNameMap = {};
	var blockCategoriesMap = {};
    for( var bi = 0; bi < templateDef._blocks.length; bi++ ) {
      if( templateDef._defs.hasOwnProperty(templateDef._blocks[bi].block) ) {
        viewModel.blockNameMap[templateDef._blocks[bi].block] = templateDef._defs[templateDef._blocks[bi].block]._name;
        blockCategoriesMap[templateDef._blocks[bi].block] = {
          'category': templateDef._defs[templateDef._blocks[bi].block]._categoryText,
          'order': templateDef._defs[templateDef._blocks[bi].block]._categoryOrder
        };
      }
    }

    viewModel.blockCategories = [];
    var categories = {};
    for (var ci = 0; ci < viewModel.blockDefs.length; ci++) {
      if (typeof categories[blockCategoriesMap[blockDefs[ci].type].category] === 'undefined') {
          categories[blockCategoriesMap[blockDefs[ci].type].category] = {
            'category': blockCategoriesMap[blockDefs[ci].type].category,
            'order': blockCategoriesMap[blockDefs[ci].type].order,
            'blockDefs': []
          };
        }
        categories[blockCategoriesMap[blockDefs[ci].type].category].blockDefs.push(blockDefs[ci]);
    }
    for (var categoriesProp in categories) {
      if (categories.hasOwnProperty(categoriesProp)) {
        viewModel.blockCategories.push(categories[categoriesProp]);
      }
    }
    viewModel.blockCategories.sort(function(a,b) {
      if (a.order < b.order) {
        return -1;
      } else if (a.order > b.order) {
        return 1;
      }
      return 0;
    });

    if (typeof templateDef.version !== 'undefined') {
      if (typeof viewModel.metadata.templateversion !== 'undefined' && viewModel.metadata.templateversion !== templateDef.version) {
      console.log("The model being loaded has been created with a different template version", viewModel.metadata.templateversion, "runtime:", templateDef.version);
      }
      viewModel.metadata.templateversion = templateDef.version;
    }

    templateSystem.init();

    if (typeof viewModel.envelope !== 'undefined') {
      viewModel.selectedTool(1);
    }
    // everything's ready, start knockout bindings.
    plugins.push(bindingPluginMaker(performanceAwareCaller, options));
  
    // make sure to call the afterBinding callback plugin, if it exists
    if (onAfterBinding !== null) {
      if (typeof onAfterBinding == 'function') {
        plugins.push(_viewModelPluginInstance(onAfterBinding));
      } else {
        plugins.push(onAfterBinding);
      }
    }

    pluginsCall(plugins, 'viewModel', [viewModel]);

    if (incompatibleTemplate) {
      $('#incompatible-template', typeof options.mainElement !== 'undefined' ? options.mainElement : global.document.body).dialog({
        modal: true,
        appendTo: typeof options.mainElement !== 'undefined' ? options.mainElement : global.document.body,
        buttons: {
          Ok: function() {
            $(this).dialog("close");
          }
        }
      });
    }

    vmWrapper(viewModel);

    if (typeof finalOptions !== 'undefined') {
      if (finalOptions.init) {
        pluginsCall(plugins, 'init', undefined, true);
      }
    }
  };

  if ( options.templateTranslationWorker === null ) {
    // This is IE... sadly, we have to process in the main thread
    workerMessage( {
      data: {
        templateDefs: performanceAwareCaller('translateTemplate', templateConverter.translateTemplate.bind(undefined, templateName, html, templateUrlConverter, myTemplateCreator)),
        templateSystemData: []
      } 
    } );
  } else {
    var templateTranslationWorker = options.templateTranslationWorker || new global.Worker("/template-translation-loader.js");
    templateTranslationWorker.onmessage = workerMessage;
    templateTranslationWorker.postMessage({
      templateName: templateName,
      html: html,
      templatePath: finalOptions.templatePath,
      existingTemplateIds: templateSystem.getTemplateIds()
    });
  }

  return {
    //model: viewModel,
    init: function() {
      pluginsCall(plugins, 'init', undefined, true);
    },
    dispose: function() {
      pluginsCall(plugins, 'dispose', undefined, true);
    }
  };
};


var checkFeature = function(feature, func) {
  if (!func()) {
    console.warn("Missing feature", feature);
    throw "Missing feature " + feature;
  }
};

var isCompatible = function() {
  try {
    // window.msMatchMedia would match also IE9
    // IE9 wouldn't be so hard to support, but it doesn't worth it. (preview iframe and automatic scroll are 2 things not working in IE9)
    checkFeature('matchMedia', function() {
      return typeof global.matchMedia != 'undefined';
    });
    checkFeature('XMLHttpRequest 2', function() {
      return 'XMLHttpRequest' in global && 'withCredentials' in new global.XMLHttpRequest();
    });
    checkFeature('ES5 strict', function() {
      return function() { /* "use strict";*/
        return typeof this == 'undefined';
      }();
    });
    checkFeature('CSS borderRadius', function() {
      return typeof global.document.body.style['borderRadius'] != 'undefined';
    });
    checkFeature('CSS boxShadow', function() {
      return typeof global.document.body.style['boxShadow'] != 'undefined';
    });
    checkFeature('CSS boxSizing', function() {
      return typeof global.document.body.style['boxSizing'] != 'undefined';
    });
    checkFeature('CSS backgroundSize', function() {
      return typeof global.document.body.style['backgroundSize'] != 'undefined';
    });
    checkFeature('CSS backgroundOrigin', function() {
      return typeof global.document.body.style['backgroundOrigin'] != 'undefined';
    });
    checkBadBrowserExtensions();
    return true;
  } catch (exception) {
    return false;
  }
};

var checkBadBrowserExtensions = function() {
  var id = 'checkbadbrowsersframe';
  var origTplDoctype = ko.bindingHandlers.bindIframe.tplDoctype;
  var origTplDocument = ko.bindingHandlers.bindIframe.tplDocument;
  ko.bindingHandlers.bindIframe.tplDoctype = "<!DOCTYPE html>\r\n";
  ko.bindingHandlers.bindIframe.tplDocument = "<html>\r\n<head><title>A</title>\r\n</head>\r\n<body><p style=\"color: blue\" align=\"right\" data-bind=\"style: { color: 'red' }\">B</p><div data-bind=\"text: content\"></div></body>\r\n</html>\r\n";
  $('body').append('<iframe id="' + id + '" data-bind="bindIframe: $data"></iframe>');
  var frameEl = global.document.getElementById(id);
  ko.applyBindings({ content: "dummy content" }, frameEl);
  // Obsolete method didn't work on IE11 when using "HTML5 doctype":
  // var docType = new XMLSerializer().serializeToString(global.document.doctype);
  var node = frameEl.contentWindow.document.doctype;
  var docType = "<!DOCTYPE " + node.name +
    (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '') +
    (!node.publicId && node.systemId ? ' SYSTEM' : '') +
    (node.systemId ? ' "' + node.systemId + '"' : '') + '>';
  var content = docType + "\n" + frameEl.contentWindow.document.documentElement.outerHTML;
  ko.cleanNode(frameEl);
  ko.removeNode(frameEl);
  ko.bindingHandlers.bindIframe.tplDoctype = origTplDoctype;
  ko.bindingHandlers.bindIframe.tplDocument = origTplDocument;

  var expected = "<!DOCTYPE html>\n<html><head><title>A</title>\n</head>\n<body><p align=\"right\" style=\"color: rgb(255, 0, 0);\" data-bind=\"style: { color: 'red' }\">B</p><div data-bind=\"text: content\">dummy content</div>\n\n</body></html>";
  var expected2 = "<!DOCTYPE html>\n<html><head><title>A</title>\n</head>\n<body><p style=\"color: rgb(255, 0, 0);\" data-bind=\"style: { color: 'red' }\" align=\"right\">B</p><div data-bind=\"text: content\">dummy content</div>\n\n</body></html>";
  var expected3 = "<!DOCTYPE html>\n<html><head><title>A</title>\n</head>\n<body><p style=\"color: rgb(255, 0, 0);\" align=\"right\" data-bind=\"style: { color: 'red' }\">B</p><div data-bind=\"text: content\">dummy content</div>\n\n</body></html>";
  if (expected !== content && expected2 !== content && expected3 !== content) {
    console.info("BadBrowser.FrameContentCheck", content.length, expected.length, expected2.length, expected3.length, content == expected, content == expected2, content == expected3);
    console.info(content);
    throw "Unexpected frame content. Misbehaving browser: "+content.length+"/"+expected.length+"/"+expected2.length+"/"+expected3.length;
  }
};

var fixPageEvents = function() {
  // This is global code to prevent dragging/dropping in the page where we don't deal with it.
  // IE8 doesn't have window.addEventListener, but doesn't support drag&drop too.
  if (global.addEventListener) {
    // prevent generic file droppping in the page
    global.addEventListener("drag", function(e) {
      // console.log("browser is using drag listener on window");
      e = e || global.event;
      e.preventDefault();
    }, false);
    global.addEventListener("dragstart", function(e) {
      // console.log("browser is using dragstart listener on window");
      e = e || global.event;
      e.preventDefault();
    }, false);
    global.addEventListener("dragover", function(e) {
      // this is called on mouse move on every supported browser.
      // console.log("browser is using dragover listener on window");
      e = e || global.event;
      e.preventDefault();
    }, false);
    global.addEventListener("drop", function(e) {
      // console.log("browser is using drop listener on window");
      e = e || global.event;
      e.preventDefault();
    }, false);
    global.document.body.addEventListener('drop', function(e) {
      // I browser supportati entrato tutti qui quando si droppa qualcosa sul body
      // console.log("browser is using drop listener on body tag");
      e.preventDefault();
    }, false);
  }
  if (global.document.ondragstart) {
    global.document.ondragstart = function() {
      // console.log("browser called ondragstart. return false!");
      return false;
    };
  }
};

var getModelReferences = function() {
  return modelReferences;
};

module.exports = {
  compile: templateCompiler,
  load: templateLoader,
  isCompatible: isCompatible,
  fixPageEvents: fixPageEvents,
  getModelReferences: getModelReferences
};