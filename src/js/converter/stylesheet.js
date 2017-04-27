"use strict";

// Parses CSS/stylesheets declarations -ko-blockdefs/-ko-themes
// It returns KO bindings but doesn't depend on KO
// Needs a bindingProvider
// Also uses a blockDefsUpdater to update definitions while parsing the stylesheet.

var cssParse = require("mensch/lib/parser.js");
var cssStringify = require("mensch/lib/stringify.js");
var console = require("console");
var converterUtils = require("./utils.js");
var declarations = require("./declarations.js");

/* Temporary experimental code not used
var _processStyleSheetRules_processThemes = function (bindingProvider, themeUpdater, rules) {
  var sels, decls, i, j, k;
  for( i = 0; i < rules.length; i++) {
    if (rules[i].type == 'rule') {
      sels = rules[i].selectors;
      decls = rules[i].declarations;
      for (j = 0; j < sels.length; j++) {
        for (k = 0; k < decls.length; k++) if (decls[k].type == 'property') {
          try {
            var bindVal = bindingProvider('$'+decls[k].name);
            themeUpdater(sels[j], decls[k].name, decls[k].value, bindVal);
          } catch (e) {
            console.log("Exception setting theme for", decls[k].name, decls[k].value, e);
          }
        }
      }
    }
  }
};
*/

var _removeOptionalQuotes = function(str) {
  if ((str[0] == "'" || str[0] == '"') && str[str.length-1] == str[0]) {
    // unescapeing
    var res = str.substr(1, str.length-2).replace(/\\([\s\S])/gm, '$1');
    return res;
  }
  return str;
};

var _processStyleSheetRules_processBlockDef = function(blockDefsUpdater, rules) {
  var properties, namedProps, decls;
  // name, contextName, globalStyle, themeOverride, extend, min, max, widget, options, category, variant, help, blockDescription, version, 
  for (var i = 0; i < rules.length; i++) {
    if (rules[i].type == 'rule') {
      var sels = rules[i].selectors;
      var hasDeclarations = false;
      var hasPreviews = false;
      for (var j = 0; j < sels.length; j++) {
        if (sels[j].match(/:preview$/)) {
          hasPreviews = true;
        } else {
          hasDeclarations = true;
        }
      }
      if (hasPreviews && hasDeclarations) {
        console.log("cannot mix selectors type (:preview and declarations) in @supports -ko-blockdefs ", sels);
        throw "Cannot mix selectors type (:preview and declarations) in @supports -ko-blockdefs";
      }
      if (!hasPreviews && !hasDeclarations) {
        console.log("cannot find known selectors in @supports -ko-blockdefs ", sels);
        throw "Cannot find known selectors in @supports -ko-blockdefs";
      }
      if (hasDeclarations) {
        properties = '';
        namedProps = {};

        decls = rules[i].declarations;
        for (var k = 0, val; k < decls.length; k++) if (decls[k].type == 'property') {
          val = _removeOptionalQuotes(decls[k].value);
          if (decls[k].name == 'label') namedProps.name = val;
          else if (decls[k].name == 'context') namedProps.contextName = val;
          else if (decls[k].name == 'properties') properties = val;
          else if (decls[k].name == 'theme') namedProps.globalStyle = '_theme_.' + val;
          else if (decls[k].name == 'themeOverride') namedProps.themeOverride = String(val).toLowerCase() == 'true';
          else namedProps[decls[k].name] = val;
          // NOTE in past we detected unsupported properties, while now we simple push every declaration in a namedProperty.
          // This make it harder to spot errors in declarations.
          // Named properties we supported were extend, min, max, options, widget, category, variant, help, blockDescription, version
          // console.warn("Unknown property processing @supports -ko-blockdefs ", decls[k], sels);
        }
        for (var l = 0; l < sels.length; l++) {
          blockDefsUpdater(sels[l], properties, namedProps);
        }
      }
      if (hasPreviews) {
        for (var m = 0; m < sels.length; m++) {
          var localBlockName = sels[m].substr(0, sels[m].indexOf(':'));
          var previewBindings = rules[i].declarations;
          blockDefsUpdater(localBlockName, undefined, { previewBindings: previewBindings });
        }
      }

    } else {
      // Ignoring comments or other content
    }
  }
};

var processStylesheetRules = function(style, localWithBindingProvider, blockDefsUpdater, themeUpdater, templateUrlConverter, rootModelName, templateName) {
  var styleSheet = cssParse(style, {
    comments: true
  });
  if (styleSheet.type != 'stylesheet' || typeof styleSheet.stylesheet == 'undefined') {
    console.log("unable to process styleSheet", styleSheet);
    throw "Unable to parse stylesheet";
  }

  var foundBlockMatch;
  var match;
  for (var i = 0; i < styleSheet.stylesheet.rules.length; i++) {
    if (styleSheet.stylesheet.rules[i].type == 'supports' && styleSheet.stylesheet.rules[i].name == '-ko-blockdefs') {
      _processStyleSheetRules_processBlockDef(blockDefsUpdater, styleSheet.stylesheet.rules[i].rules);
      styleSheet.stylesheet.rules.splice(i--, 1);
    } else if (styleSheet.stylesheet.rules[i].type == 'supports' && styleSheet.stylesheet.rules[i].name.indexOf('-ko-blockloop') === 0) {
      var internalStyleSheet = {
        type: 'stylesheet',
        stylesheet: {
          rules: styleSheet.stylesheet.rules[i].rules
        }
      };

      foundBlockMatch = null;
      match = styleSheet.stylesheet.rules[i].name.match(/\-ko-blockloop-([^ ]*)/);
      if (match !== null) {
        foundBlockMatch = match[1];
      }

      styleSheet.stylesheet.rules.splice(i, 1);

      if (foundBlockMatch) {
        internalStyleSheet = declarations.elaborateDeclarations(internalStyleSheet, templateUrlConverter, localWithBindingProvider.bind(this, foundBlockMatch, ''), {}, true);
        var j;
        for (j = 0; j < internalStyleSheet.stylesheet.rules.length; j++) {
          for (var k = 0; k < internalStyleSheet.stylesheet.rules[j].selectors.length; k++) {
           internalStyleSheet.stylesheet.rules[j].selectors[k] = '<!-- ko text: (templateMode ==\'wysiwyg\' ? ($root.mosaicoConfig.mainElement && $root.mosaicoConfig.mainElement.id ? \'#\' + $root.mosaicoConfig.mainElement.id + \' \' : \'\') + \'#main-wysiwyg-area \' : \'\')+\'#\'+id()+\' \' --><!-- /ko -->' + internalStyleSheet.stylesheet.rules[j].selectors[k];
          }
        }

        var addedPrefix = false;
        for (j = 0; j < internalStyleSheet.stylesheet.rules.length; j++) {
          if (internalStyleSheet.stylesheet.rules[j].type === 'rule' && typeof internalStyleSheet.stylesheet.rules[j].selectors !== 'undefined' && internalStyleSheet.stylesheet.rules[j].selectors.length >= 1) {
            internalStyleSheet.stylesheet.rules[j].selectors[0] = '<!-- ko foreach: $root.findObjectsOfType($data, \'' + foundBlockMatch + '\') -->' + internalStyleSheet.stylesheet.rules[j].selectors[0];
            addedPrefix = true;
            break;
          }
        }

        if (addedPrefix) {
          internalStyleSheet.stylesheet.rules.push({
            type: 'comment',
            text: ' */<!-- /ko -->/* '
          });
          for (j = internalStyleSheet.stylesheet.rules.length - 1; j >= 0; j--)
          styleSheet.stylesheet.rules.splice(i, 0, internalStyleSheet.stylesheet.rules[j]);

          i += internalStyleSheet.stylesheet.rules.length;
        }
      }

      i--;
    } else if (styleSheet.stylesheet.rules[i].type == 'media' || styleSheet.stylesheet.rules[i].type == 'supports') {
      styleSheet.stylesheet.rules[i].rules = cssParse(
        processStylesheetRules(
          cssStringify({
            type: 'stylesheet',
            stylesheet: {
              rules: styleSheet.stylesheet.rules[i].rules
            }
          }), localWithBindingProvider, blockDefsUpdater, themeUpdater, templateUrlConverter, rootModelName, templateName
        ), {
          comments: true
        }
      ).stylesheet.rules;
    } else if (styleSheet.stylesheet.rules[i].type == 'comment') {
      // ignore comments
    } else if (styleSheet.stylesheet.rules[i].type == 'rule') {
      foundBlockMatch = null;
      var l;
      for (l = 0; l < styleSheet.stylesheet.rules[i].selectors.length; l++) {
        match = styleSheet.stylesheet.rules[i].selectors[l].match(/\[data-ko-block=([^ ]*)\]/);
        if (match !== null) {
          if (foundBlockMatch !== null && foundBlockMatch != match[1]) throw "Found multiple block-match attribute selectors: cannot translate it (" + foundBlockMatch + " vs " + match[1] + ")";
          foundBlockMatch = match[1];
        }
        styleSheet.stylesheet.rules[i].selectors[l] = '<!-- ko text: templateMode ==\'wysiwyg\' ? ($root.mosaicoConfig.mainElement && $root.mosaicoConfig.mainElement.id ? \'#\' + $root.mosaicoConfig.mainElement.id + \' \' : \'\') + \'#main-wysiwyg-area \' : \'\' --><!-- /ko -->' + styleSheet.stylesheet.rules[i].selectors[l];
      }

      if (foundBlockMatch) {
        var regex = new RegExp('\\[data-ko-block=' + foundBlockMatch + '\\]', 'g');
        for (l = 0; l < styleSheet.stylesheet.rules[i].selectors.length; l++) {
          styleSheet.stylesheet.rules[i].selectors[l] = styleSheet.stylesheet.rules[i].selectors[l].replace(regex, '<!-- ko text: \'#\'+id() --><!-- /ko -->');
        }
        styleSheet.stylesheet.rules[i].selectors[0] = '<!-- ko foreach: $root.findObjectsOfType($data, \'' + foundBlockMatch + '\') -->' + styleSheet.stylesheet.rules[i].selectors[0];
        styleSheet.stylesheet.rules.splice(i + 1, 0, {
          type: 'comment',
          text: ' */<!-- /ko -->/* '
        });
        blockDefsUpdater(foundBlockMatch, '', { contextName: 'block' });
      }

      styleSheet.stylesheet.rules[i] = declarations.elaborateDeclarations({
        type: 'stylesheet',
        stylesheet: {
          rules: [styleSheet.stylesheet.rules[i]]
        }
      }, templateUrlConverter, localWithBindingProvider.bind(this, foundBlockMatch ? foundBlockMatch : templateName, ''), {}, true).stylesheet.rules[0];
    } else {
      console.log("Unknown rule type", styleSheet.stylesheet.rules[i].type, "while parsing <style> rules");
    }
  }
  return cssStringify(styleSheet, {
    comments: true
  }).replace(/\/\* \*\//g, '');
};

module.exports = processStylesheetRules;