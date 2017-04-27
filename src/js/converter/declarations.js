"use strict";

// Parses CSS declarations and supports the property language (-ko-*) found between them.
// Create KO bindings but doesn't depend on KO.
// Needs a bindingProvider.

var converterUtils = require("./utils.js");
var cssParse = require("mensch/lib/parser.js");
var console = require("console");
var domutils = require("./domutils.js");

var _declarationValueLookup = function(declarations, propertyname, templateUrlConverter) {
  for (var i = declarations.length - 1; i >= 0; i--) {
    if (declarations[i].type == 'property' && declarations[i].name == propertyname) {
      return _declarationValueUrlPrefixer(declarations[i].value, templateUrlConverter);
    }
  }
  return null;
};

var _propToCamelCase = function(propName) {
  return propName.replace(/-([a-z])/g, function(match, contents, offset, s) {
    return contents.toUpperCase();
  });
};

var _declarationValueUrlPrefixer = function(value, templateUrlConverter) {
  if (value.match(/url\(.*\)/)) {
    var replaced = value.replace(/(url\()([^\)]*)(\))/g, function(matched, prefix, url, postfix) {
      var trimmed = url.trim();
      var apice = url.trim().charAt(0);
      if (apice == '\'' || apice == '"') {
        trimmed = trimmed.substr(1, trimmed.length - 2);
      } else {
        apice = '';
      }
      var newUrl = templateUrlConverter(trimmed);
      if (newUrl !== null) {
        return prefix + apice + newUrl + apice + postfix;
      } else {
        return matched;
      }
    });
    return replaced;
  } else {
    return value;
  }
};

var declarationPreprocessingSort = function(a, b) {
  var nameA = a.name.toLowerCase();
  var nameB = b.name.toLowerCase();
  var sortOrder = 0;
  if (nameA.indexOf('-ko-') === 0 && nameB.indexOf('-ko-') !== 0) {
    sortOrder = -1;
  } else if (nameA.indexOf('-ko-') !== 0 && nameB.indexOf('-ko-') === 0) {
    sortOrder = 1;
  } else {
    if (nameA < nameB) {
      sortOrder = 1;
    } else if (nameA > nameB) {
      sortOrder = -1;
    }
  }
  return sortOrder;
};

var declarationPostprocessingSort = function(a, b) {
  var nameA = a.name.toLowerCase();
  var nameB = b.name.toLowerCase();
  var sortOrder = 0;
  if (nameA < nameB) {
    sortOrder = -1;
  } else if (nameA > nameB) {
    sortOrder = 1;
  }
  return sortOrder;
};

var elaborateDeclarations = function(styleSheet, templateUrlConverter, bindingProvider, newBindings, needDefaultValue, element, removeDisplayNone) {
  var hasStyle = false;
  for (var i = 0; i < styleSheet.stylesheet.rules.length; i++) {
    // Since order of processing is relevant, make sure -ko- properties are processed first
    styleSheet.stylesheet.rules[i].declarations.sort(declarationPreprocessingSort);
    for (var j = 0; j < styleSheet.stylesheet.rules[i].declarations.length; j++) {
      if (styleSheet.stylesheet.rules[i].declarations[j].type == 'property') {
        if (removeDisplayNone === true && styleSheet.stylesheet.rules[i].declarations[j].name == 'display' && styleSheet.stylesheet.rules[i].declarations[j].value == 'none') {
          hasStyle = needDefaultValue;
          styleSheet.stylesheet.rules[i].declarations.splice(j--, 1);
        } else {
          var decl = styleSheet.stylesheet.rules[i].declarations[j].name.match(/^-ko-(bind-|attr-)?([a-z0-9-]*?)(-if|-ifnot)?$/);
          if (decl !== null) {
            hasStyle = needDefaultValue;

            // rimozione dello stile -ko- dall'attributo style.
            var isAttr = decl[1] == 'attr-';
            var isBind = decl[1] == 'bind-';
            var propName = decl[2];

            var isIf = decl[3] == '-if' || decl[3] == '-ifnot';
            var condDecl;
            var bindValue;
            var propDefaultValue;

            if (isIf) {
              condDecl = styleSheet.stylesheet.rules[i].declarations[j].name.substr(0, styleSheet.stylesheet.rules[i].declarations[j].name.length - decl[3].length);
              var conditionedDeclaration = _declarationValueLookup(styleSheet.stylesheet.rules[i].declarations, condDecl, templateUrlConverter);
              if (conditionedDeclaration === null) throw "Unable to find declaration " + condDecl + " for " + styleSheet.stylesheet.rules[i].declarations[j].name;
            } else {
              if ((isAttr || isBind) && (typeof element == 'undefined' && needDefaultValue)) throw "Attributes and bind declarations are only allowed in inline styles!";

              var internalNeedDefaultValue = true;
              var appendDefaultValue = null;
              var bindType;
              if (isAttr) {
                propDefaultValue = domutils.getAttribute(element, propName);
                internalNeedDefaultValue = false;
                bindType = 'virtualAttr';
              } else if (!isBind) {
                internalNeedDefaultValue = needDefaultValue;
                if (internalNeedDefaultValue) propDefaultValue = _declarationValueLookup(styleSheet.stylesheet.rules[i].declarations, propName, templateUrlConverter);
                bindType = 'virtualStyle';
              } else {
                bindType = null;
                if (propName == 'text') {
                  if (typeof element !== 'undefined') {
                    propDefaultValue = domutils.getInnerText(element);
                  } else {
                    internalNeedDefaultValue = false;
                  }
                } else if (propName == 'html') {
                  if (typeof element !== 'undefined') {
                    propDefaultValue = domutils.getInnerHtml(element);
                  } else {
                    internalNeedDefaultValue = false;
                  }
                } else if (propName == 'ctext') {
                  propName = 'text';
                  internalNeedDefaultValue = false;
                  if (typeof element !== 'undefined') {
                    appendDefaultValue = domutils.getInnerText(element);
                  }
                } else if (propName == 'chtml') {
                  propName = 'html';
                  internalNeedDefaultValue = false;
                  if (typeof element !== 'undefined') {
                    appendDefaultValue = domutils.getInnerHtml(element);
                  }
                } else {
                  internalNeedDefaultValue = false;
                }
              }

              if (internalNeedDefaultValue && propDefaultValue === null) {
                console.error("Cannot find default value for", styleSheet.stylesheet.rules[i].declarations[j].name, styleSheet.stylesheet.rules[i].declarations);
                throw "Cannot find default value for " + styleSheet.stylesheet.rules[i].declarations[j].name + ": " + styleSheet.stylesheet.rules[i].declarations[j].value + " in " + element + " (" + propName + ")";
              }
              var bindDefaultValue = typeof propDefaultValue !== "string" || !/^(true|false)$/i.test(propDefaultValue) ? propDefaultValue : propDefaultValue.toLowerCase() === "true";

              var bindName = !isBind && !isAttr ? _propToCamelCase(propName) : (propName.indexOf('-') != -1 ? '\''+propName+'\'' : propName);

              try {
                bindValue = converterUtils.expressionBinding(styleSheet.stylesheet.rules[i].declarations[j].value, bindingProvider, bindDefaultValue);
                if (appendDefaultValue !== null) {
                  bindValue += " + '" + appendDefaultValue + "'";
                }
              } catch (e) {
                console.error("Model ensure path failed", e.stack, "name", styleSheet.stylesheet.rules[i].declarations[j].name, "value", styleSheet.stylesheet.rules[i].declarations[j].value, "default", propDefaultValue, "element", element);
                throw e;
              }

              if (bindType !== null && typeof newBindings[bindType] == 'undefined') newBindings[bindType] = {};

              // Special handling for HREFs
              if (bindType == 'virtualAttr' && bindName == 'href') {
                bindType = null;
                bindName = 'wysiwygHref';
                // We have to remove it, otherwise we ends up with 2 rules writing it.
                if (typeof element != 'undefined' && element !== null) {
                  domutils.removeAttribute(element, "href");
                }
              }

              // TODO evaluate the use of "-then" (and -else) postfixes to complete the -if instead of relaying
              // on the same basic sintax (or maybe it is better to support ternary operator COND ? THEN : ELSE).
              var declarationCondition = _declarationValueLookup(styleSheet.stylesheet.rules[i].declarations, styleSheet.stylesheet.rules[i].declarations[j].name + '-if', templateUrlConverter);
              var not = false;
              if (declarationCondition === null) {
                declarationCondition = _declarationValueLookup(styleSheet.stylesheet.rules[i].declarations, styleSheet.stylesheet.rules[i].declarations[j].name + '-ifnot', templateUrlConverter);
                not = true;
              } else {
                if (_declarationValueLookup(styleSheet.stylesheet.rules[i].declarations, styleSheet.stylesheet.rules[i].declarations[j].name + '-ifnot', templateUrlConverter) !== null) {
                  throw "Unexpected error: cannot use both -if and -ifnot property conditions";
                }
              }
              if (declarationCondition !== null) {
                try {
                  var bindingCond = converterUtils.conditionBinding(declarationCondition, bindingProvider);
                  bindValue = (not ? '!' : '') + "(" + bindingCond + ") ? " + bindValue + " : null";
                } catch (e) {
                  console.error("Unable to deal with -ko style binding condition", declarationCondition, styleSheet.stylesheet.rules[i].declarations[j].name);
                  throw e;
                }
              }

              if (bindType !== null) newBindings[bindType][bindName] = bindValue;
              else newBindings[bindName] = bindValue;
            }

            if (hasStyle) {
              // parsing @supports :preview
              try {
                // if "element" is defined then we are parsing an "inline" style and we want to remove it.
                if (typeof element != 'undefined' && element !== null) {
                  styleSheet.stylesheet.rules[i].declarations.splice(j--, 1);
                } else {
                  // otherwise we are parsing a full stylesheet.. let's rewrite the full "prop: value" without caring about the original syntax.
                  // if it is an "if" we simply have to remove it, otherwise we replace the input code with "prop: value" generating expression.
                  if (isIf) {
                    styleSheet.stylesheet.rules[i].declarations.splice(j--, 1);
                  } else {
                    styleSheet.stylesheet.rules[i].declarations[j].name = propName;
                    styleSheet.stylesheet.rules[i].declarations[j].value = '<!-- ko text: ' + bindValue + ' -->' + propDefaultValue + '<!-- /ko -->';
                  }
                }
              } catch (e) {
                console.warn("Remove style failed", e, "name", styleSheet.stylesheet.rules[i].declarations[j]);
                throw e;
              }
            }
          } else {
            // prefixing urls
            var replacedValue = _declarationValueUrlPrefixer(styleSheet.stylesheet.rules[i].declarations[j].value, templateUrlConverter);
            if (replacedValue != styleSheet.stylesheet.rules[i].declarations[j].value) {
              hasStyle = needDefaultValue;
              styleSheet.stylesheet.rules[i].declarations[j].value = replacedValue;
            }

            // Style handling by concatenated "style attribute" (worse performance but more stable than direct style handling)
            var bindName2 = _propToCamelCase(styleSheet.stylesheet.rules[i].declarations[j].name);
            var bind = 'virtualAttrStyle';
            var bindVal2 = typeof newBindings['virtualStyle'] !== 'undefined' ? newBindings['virtualStyle'][bindName2] : undefined;

            var dist = ' ';
            if (typeof newBindings[bind] == 'undefined') {
              newBindings[bind] = "''";
              dist = '';
            }

            if (typeof bindVal2 !== 'undefined') {
              newBindings[bind] = "'" + styleSheet.stylesheet.rules[i].declarations[j].name + ": '+(" + bindVal2 + ")+';" + dist + "'+" + newBindings[bind];
              delete newBindings['virtualStyle'][bindName2];
            } else {
              newBindings[bind] = "'" + styleSheet.stylesheet.rules[i].declarations[j].name + ": " + converterUtils.addSlashes(replacedValue) + ";" + dist + "'+" + newBindings[bind];
            }
          }
        }
      }
    }
    // Ensure -ko- properties are serialized last
    styleSheet.stylesheet.rules[i].declarations.reverse();
    styleSheet.stylesheet.rules[i].declarations.sort(declarationPostprocessingSort);
  }

  if (typeof element != 'undefined' && element !== null) {
    for (var prop in newBindings['virtualStyle'])
      if (newBindings['virtualStyle'].hasOwnProperty(prop)) {
        console.log("Unexpected virtualStyle binding after conversion to virtualAttr.style", prop, newBindings['virtualStyle'][prop], styleSheet);
        throw "Unexpected virtualStyle binding after conversion to virtualAttr.style for " + prop;
      }
    delete newBindings['virtualStyle'];

    var currentBindings = domutils.getAttribute(element, 'data-bind');
    var dataBind = (currentBindings !== null ? currentBindings + ", " : "") + _bindingSerializer(newBindings);
    domutils.setAttribute(element, 'data-bind', dataBind);
  }

  return styleSheet;
};

var serializeNewBindings = function(newBindings) {
  // clean virtualStyle if empty
  var hasVirtualStyle = false;
  for (var prop1 in newBindings['virtualStyle'])
    if (newBindings['virtualStyle'].hasOwnProperty(prop1)) {
      hasVirtualStyle = true;
      break;
    }
  if (!hasVirtualStyle) delete newBindings['virtualStyle'];
  else {
    // remove and add back virtualAttrStyle so it gets appended BEFORE virtualAttrStyle (_bindingSerializer reverse them...)
    if (typeof newBindings['virtualAttrStyle'] !== 'undefined') {
      var vs = newBindings['virtualAttrStyle'];
      delete newBindings['virtualAttrStyle'];
      newBindings['virtualAttrStyle'] = vs;
    }
  }
  // returns new serialized bindings
  return _bindingSerializer(newBindings);
};

var _bindingSerializer = function(val) {
  var res = [];
  for (var prop in val)
    if (val.hasOwnProperty(prop)) {
      if (typeof val[prop] == 'object') res.push(prop + ": " + "{ " + _bindingSerializer(val[prop]) + " }");
      else res.push(prop + ": " + val[prop]);
    }
  return res.reverse().join(', ');
};

module.exports = {
  elaborateDeclarations: elaborateDeclarations,
  serializeNewBindings: serializeNewBindings
};