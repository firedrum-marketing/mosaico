"use strict";

var console = require("console");
var declarations = require("./declarations.js");
var utils = require('./utils.js');
var modelDef = require('./model.js');

var _getOptionsObject = function(options) {
  var result = {
    opts: {},
    order: []
  };
  var optionsCouples = options.split('|');
  for (var i = 0; i < optionsCouples.length; i++) {
    var opt = optionsCouples[i].split('=');
    var existingItemIndex = result.order.indexOf( opt[0].trim() );
    if ( existingItemIndex > -1 ) {
        result.order.splice( existingItemIndex, 1 );
    }
    result.order.push( opt[0].trim() );
    result.opts[opt[0].trim()] = opt.length > 1 ? opt[1].trim() : opt[0].trim();
  }
  return result;
};

// TODO this should not have hardcoded rules (we now have a way to declare them in the template definition)
// Category "style" is used by editType "styler"
// Category "content" is used by editType "edit"
// TODO maybe we should use a common string here, and rely only on the original category.
var _filterProps = function(model, editType, level) {
  var res = [];
  for (var prop in model)
    if (!prop.match(/^customStyle$/) && !prop.match(/^_/) && model.hasOwnProperty(prop)) {
      var isStyleProp = model[prop] !== null && typeof model[prop]._category != 'undefined' && model[prop]._category == 'style';
      if (prop == 'id' || prop == 'type' || prop.match(/Blocks$/)) {} else if (editType == 'styler') {
        if (isStyleProp || level > 0) res.push(prop);
      } else if (editType == 'edit') {
        // Editing for properties in the "content" category but not defined in the context of a block
        var isContentProp = model[prop] !== null && typeof model[prop]._category != 'undefined' && model[prop]._category == 'content' &&
          (typeof model[prop]._context == 'undefined' || model[prop]._context != 'block');
        if (isContentProp) res.push(prop);
      } else if (typeof editType == 'undefined') {
        res.push(prop);
      }
    }
  return res;
};

var _propInput = function(model, prop, propAccessor, editType, widgets, isGlobal) {
  var html = "";
  var widget;
  if (model !== null && typeof model._widget != 'undefined') widget = model._widget;

  if (typeof widget == 'undefined') {
    throw "Unknown data type for " + prop;
  }

  var eventbinding = {};
  var isfirstevent = true;
  //var isfirstoption = true;
  var i;
  var key;
  var evt;
  
  // For content editors we deal with focusing (clicking is handled by the container DIV).
  var onfocusbinding = 'focusable: true';

  if ( model !== null && typeof model._disabledOn !== 'undefined' ) {
    onfocusbinding += ', disable: ' + model._disabledOn;
  }

  if ( model !== null && typeof model._placeholder !== 'undefined' ) {
    onfocusbinding += ', attr: { placeholder: \'' + model._placeholder + '\' }';
  }

  if (editType == 'edit') {
    eventbinding['focus'] = (widget !== 'boolean' && model !== null && model._undoMode === 'merge' ? '$root.setUndoModeMerge(); ' : '') + 'Mosaico.$($element).click();' + ( model !== null && typeof model._allowSystemTags != 'undefined' ? ' $root.currentSystemTagField = Mosaico.$($element);' : '' );
  } else if ( model !== null && typeof model._allowSystemTags != 'undefined' ) {
    eventbinding['focus'] = '$root.currentSystemTagField = Mosaico.$($element);';
  }
  if ( model !== null && typeof model._clickHandler != 'undefined' ) {
    eventbinding['click'] = model._clickHandler;
  }
  if ( model !== null && typeof model._changeHandler != 'undefined' ) {
    eventbinding['change'] = model._changeHandler;
  }

  var valuebinding = 'value: ' + propAccessor;
  if ( model !== null && typeof model._emojiOneArea != 'undefined' ) {
    valuebinding = 'emojionearea: { value: ' + propAccessor;
    if ( model._emojiOneArea !== 'true' ) {
      var emojiOneOpts = _getOptionsObject(model._emojiOneArea);
      for (i = 0; i < emojiOneOpts.order.length; i++) {
        key = emojiOneOpts.order[i];
        if (emojiOneOpts.opts.hasOwnProperty(key)) {
          valuebinding += ', ' + key + ': \'' + utils.addSlashes(emojiOneOpts.opts[key]) + '\'';
        }
      }
    }
    valuebinding += ' }';
  }

  html += '<label class="data-' + widget + '"' + (widget == 'boolean' ? ' data-bind="event: { mousedown: function(ui, evt) { if (evt.button == 0) { var input = Mosaico.$($element).find(\'input\'); var ch = input.prop(\'checked\'); setTimeout(function() { ' + (model !== null && model._undoMode === 'merge' ? '$root.setUndoModeMerge(); ' : '') + 'input.click(); input.prop(\'checked\', !ch); input.trigger(\'change\'); }, 0); } } }, click: function(ui, evt) { evt.preventDefault(); }, clickBubble: false"' : '') + '>';

  if (typeof widgets !== 'undefined' && typeof widgets[widget] !== 'undefined') {
    var w = widgets[widget];
    var parameters = {};
    if (typeof w.parameters !== 'undefined')
      for (var p in w.parameters)
        if (w.parameters.hasOwnProperty(p) && typeof model['_'+p] !== 'undefined')
          parameters[p] = model['_'+p];
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
      onfocusbinding += ' }';
    }
    html += w.html(propAccessor, onfocusbinding, parameters);
  } else if (widget == 'boolean') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<input type="checkbox" value="nothing" data-bind="checked: ' + propAccessor + ', ' + onfocusbinding + '" />';
    html += '<span class="checkbox-replacer" ></span>'; /* data-bind="css: { checked: '+propAccessor+' }" */
  } else if (widget == 'color') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<input size="7" type="text" data-bind="colorpicker: { color: ' + propAccessor + ', strings: $root.t(\'Theme Colors,Standard Colors,Web Colors,Theme Colors,Back to Palette,History,No history yet.\') }, ' + ', ' + onfocusbinding + '" />';
  } else if (widget === 'datetime') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<input size="7" type="text" data-bind="dateTimePicker: ' + propAccessor + ', dateTimePickerOptions: { useCurrent: false, showClear: true, timeZone: $root.userTimeZone }, ' + onfocusbinding + '" />';
  } else if (widget == 'select') {
    if (typeof model._options != 'undefined') {
      var opts = _getOptionsObject(model._options);
      // var opts = model._options;
      //eventbinding['change'] = 'if ($data[\'' + propAccessor + 'Label\']) { $data[\'' + propAccessor + 'Label\']($(\'option:selected\', $element).text()) };';
      if (Object.keys(eventbinding).length > 0) {
        onfocusbinding += ', event: { ';
        for (evt in eventbinding) {
          if (eventbinding.hasOwnProperty(evt)) {
            onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
            isfirstevent = false;
          }
        }
       onfocusbinding += ' }';
      }
      html += '<select data-bind="' + valuebinding + ', ' + onfocusbinding + (typeof model._optionStyle !== 'undefined' ? ', style: { ' + model._optionStyle + ': ' + propAccessor + ' }' : '') + '">';
      for (i = 0; i < opts.order.length; i++) {
        key = opts.order[i];
        if (opts.opts.hasOwnProperty(key)) {
          html += '<option value="' + key + '" data-bind="text: $root.ut(\'template\', \'' + utils.addSlashes(opts.opts[key]) + '\')' + (typeof model._optionStyle !== 'undefined' ? ', style: { ' + model._optionStyle + ': \'' + key + '\' }' : '') + '">' + opts.opts[key] + '</option>';
        }
      }
      html += '</select>';
    }
  } else if (widget == 'longtext') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<textarea size="7" data-bind="' + valuebinding + ', ' + onfocusbinding + '">nothing</textarea>';
  } else if (widget == 'hidden') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<input type="hidden" value="nothing" data-bind="' + valuebinding + ', ' + onfocusbinding + '" />';
  } else if (widget == 'file') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<input type="hidden" value="nothing" data-bind="' + valuebinding + ', ' + onfocusbinding + '" /><input type="text" data-bind="value: ( ' + propAccessor + '() != null ? ' + propAccessor + '().substr( ' + propAccessor + '().lastIndexOf( \'/\' ) + 1 ) : \'\' )" disabled />';
  } else if (widget == 'font') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<select data-bind="' + valuebinding + ', ' + onfocusbinding + ', style: { fontFamily: ' + propAccessor + ' }, options: $root.allFonts, optionsText: \'label\', optionsValue: \'value\', optionsAfterRender: $root.allFontsOptionsAfterRender"></select>';
  } else if (widget == 'url') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<div class="ui-textbutton">';
    html += '<input class="ui-textbutton-input" size="7" type="url" pattern="((mailto:(.+@.+)|(\\[.*\\].*))|(tel:([0-9]+)|(\\[.*\\].*))|[a-zA-Z]+://.+\\..+|\\[.*\\].*)" value="nothing" data-bind="css: { withButton: typeof $root.linkDialog !== \'undefined\' }, validatedValue: { defaultProtocol: \'http://\', value: ' + propAccessor + ' }, ' + onfocusbinding + '" />';
    html += '<a href="javascript:void(0)" class="ui-textbutton-button" data-bind="visible: typeof $root.linkDialog === \'function\', click: typeof $root.linkDialog === \'function\' ? $root.linkDialog.bind(undefined, \'' + propAccessor + '\', \'' + (model !== null && typeof model._disabledOn !== 'undefined' ? model._disabledOn : 'false') + '\', {}) : false, button: { icon: \'material-icons material-icons-library-books\', label: $root.t(\'Opzioni\'), showLabel: false }"></a>';
    html += '</div>';
  } else if (widget == 'integer') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
      onfocusbinding += ' }';
    }
    var min = 0;
    var max = 1000;
    if (model !== null && typeof model._max !== 'undefined') max = model._max;
    if (model !== null && typeof model._min !== 'undefined') min = model._min;
    var step = (max - min) >= 100 ? 10 : 1;
    if (model !== null && typeof model._step !== 'undefined') step = model._step;
    var page = step * 5;
    if (model !== null && typeof model._page !== 'undefined') page = model._page;
    if ( isGlobal ) {
      if (model !== null && typeof model._globalMax !== 'undefined') max = model._globalMax;
    } else {
      if (model !== null && typeof model._localMax !== 'undefined') max = model._localMax;
    }
    html += '<input class="number-spinner" size="7" step="' + step + '" type="number" value="-1" data-bind="spinner: { min: ' + min + ', max: ' + max + ', page: ' + page + ', value: ' + propAccessor + ' }, valueUpdate: [\'change\', \'spin\']' + ', ' + onfocusbinding + '" />';
  } else if (widget == 'src') {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<div class="ui-textbutton">';
    html += '<input class="ui-textbutton-input" size="7" type="text" value="nothing" data-bind="' + valuebinding + ', ' + onfocusbinding + '" />';
    html += '<a href="javascript:void(0)" class="ui-textbutton-button" data-bind="visible: typeof $root.linkDialog === \'function\', click: typeof $root.linkDialog === \'function\' ? $root.linkDialog.bind(undefined, \'' + propAccessor + '\', \'' + (model !== null && typeof model._disabledOn !== 'undefined' ? model._disabledOn : 'false') + '\', ' + ( propAccessor === 'annotationLogoImage' ? '{ extensions: \'bmp,jpg,jpeg,gif,png\' }' : propAccessor === 'annotationPromotionImage' ? '{ extensions: \'bmp,jpg,jpeg,png\' }' : '{ extensions: \'bmp,jpg,jpeg,gif,png\', path: \'/Backgrounds\' }' ) + ') : false, button: { icon: \'material-icons material-icons material-icons-photo-library\', label: $root.t(\'' + ( propAccessor === 'annotationLogoImage' ? 'Select Logo Image' : propAccessor === 'annotationPromotionImage' ? 'Select Promotion Image' : 'Select Background' ) + '\'), showLabel: false }"></a>';
    html += '</div>';
  } else {
    if (Object.keys(eventbinding).length > 0) {
      onfocusbinding += ', event: { ';
      for (evt in eventbinding) {
        if (eventbinding.hasOwnProperty(evt)) {
          onfocusbinding += (isfirstevent ? '' : ', ') + evt + ': function(ui, event) { ' + eventbinding[evt] + ' }';
          isfirstevent = false;
        }
      }
     onfocusbinding += ' }';
    }
    html += '<input size="7" type="text" value="nothing"' + (model !== null && typeof model._max !== 'undefined' ? ' maxlength="' + model._max + '"' : '') + ' data-bind="' + valuebinding + ', ' + onfocusbinding + '" />';
  }

  html += '</label>';

  return html;
};

var _getGlobalStyleProp = function(globalStyles, model, prop, path) {
  var globalStyleProp;
  if (typeof model !== 'object' || model === null || typeof model._widget !== 'undefined') {
    if (typeof prop !== 'undefined' && typeof path !== 'undefined' && path.length > 0 && typeof globalStyles == 'object' && typeof globalStyles[path] != 'undefined') {
      globalStyleProp = globalStyles[path];
    }
  }
  return globalStyleProp;
};

var _propEditor = function(withBindingProvider, widgets, templateUrlConverter, model, themeModel, path, prop, editType, level, baseThreshold, globalStyles, globalStyleProp, trackUsage, rootPreviewBinding, previewBackground) {
  if (typeof level == 'undefined') level = 0;

  if (typeof prop !== 'undefined' && typeof model == 'object' && model !== null && typeof model._usecount === 'undefined') {
    if (typeof console.debug == 'function') console.debug("Ignoring", path, "property because it is not used by the template", "prop:", prop, "type:", editType, "level:", level, withBindingProvider._templateName);
    return "";
  }

  var propAccessor = typeof globalStyleProp != 'undefined' ? prop + '._defaultComputed' : prop;

  var html = "";
  var title;
  var ifSubsProp = propAccessor;
  var ifSubsGutter = 1;
  // typeof globalStyleProp != 'undefined' ? 1 : 2;
  var ifSubsThreshold = 1;

  // The visibility handling is a PITA
  // 
  // Here are some "edge cases" to test whenever we change something here:
  // LM social footer: removing shareVisibile must be reflected in the booleans sub-checks
  // FLUID social block: multiple clicks on the "wand" should not make the editor invisible
  // BIS heroMenu - By changing the menu visibility it should be reflected in style editors for the menu links
  // FLUID almost every block with a color variant sometimes keeps showing style editor for the hidden variant.
  if (typeof model == 'object' && model !== null && typeof model._widget == 'undefined') {
    // Do nothing here
  } else {
    if (typeof globalStyleProp == 'undefined') {
      ifSubsGutter += 1;
    }
  }

  // NOTE baseThreshold is added only when globalStyle is not defined because when we have globalStyle
  // we're going to bind the computed values and not the original and this way we don't add ourserf to the dependency 
  // tracking (subscriptionCount)
  // NOTE baseThreshold is an "expression" and not a fixed number, so this is a concatenation
  if (typeof globalStyleProp == 'undefined' && typeof baseThreshold !== 'undefined') ifSubsThreshold += baseThreshold;
  
  if (typeof model == 'object' && model !== null && typeof model._ifSubsThreshold !== 'undefined') {
	  ifSubsThreshold = model._ifSubsThreshold;
  }

  if (typeof prop != 'undefined' && !!trackUsage) {
    html += '<!-- ko ifSubs: { data: ' + ifSubsProp + ', threshold: ' + ifSubsThreshold + ', gutter: ' + ifSubsGutter + ' } -->';
  }

  if (typeof prop != 'undefined' && (model === null || typeof model._name == 'undefined')) {
    // TODO throw exception?
    console.log("Missing label for property ", prop);
  }
  if (typeof prop == 'undefined' && model !== null && typeof model._name == 'undefined' && model.type !== 'theme') {
    console.log("Missing label for object ", model.type /*, model */ );
  }

  if (typeof model == 'object' && model !== null && typeof model._widget == 'undefined') {
    var props = _filterProps(model, editType, level);

    var hasCustomStyle = editType == 'styler' && model !== null && typeof model.customStyle !== 'undefined' && typeof globalStyleProp !== 'undefined';
    var selectedItemBinding = '';
    var additionalClasses = '';
    if (typeof prop !== 'undefined' && editType == 'edit') {
      selectedItemBinding = 'click: function(obj, evt) { $root.selectItem(' + prop + ', $data); return false }, clickBubble: false, css: { selecteditem: $root.isSelectedItem(' + prop + ') }, scrollIntoView: $root.isSelectedItem(' + prop + '), ';
      additionalClasses += ' selectable';
    }
    if (hasCustomStyle) {
      additionalClasses += ' supportsCustomStyles';
    }
    html += '<div class="objEdit level' + level + additionalClasses + '" data-bind="' + selectedItemBinding + '">';
    var modelName = (model !== null && typeof model._name != 'undefined' ? model._name : (typeof prop !== 'undefined' ? '[' + prop + ']' : ''));
    if (hasCustomStyle) {
      var themeSectionName = 'Stile';
      if (typeof themeModel !== 'undefined' && themeModel !== null && typeof themeModel._name !== 'undefined') {
        themeSectionName = themeModel._name;
      } else {
        console.log("Missing label for theme section ", prop, model !== null ? model.type : '-');
      }

      modelName = '<span class="blockSelectionMethod" data-bind="text: customStyle() ? $root.ut(\'template\', \'' + utils.addSlashes(modelName) + '\') : $root.ut(\'template\', \'' + utils.addSlashes(themeSectionName) + '\')">Block</span>';
    } else {
      modelName = '<span data-bind="text: $root.ut(\'template\', \'' + utils.addSlashes(modelName) + '\')">' + modelName + '</span>';
    }
    title = model !== null && typeof model._help !== 'undefined' ? ' title="' + utils.addSlashes(model._help) + '" data-bind="attr: { title: $root.ut(\'template\', \'' + utils.addSlashes(model._help) + '\') }, tooltip: {show: {delay: 500}, track: true}"' : '';
    html += '<span' + title + ' class="objLabel level' + level + '">' + modelName + '</span>';

    if (editType == 'edit' && typeof model._blockDescription !== 'undefined') {
      html += '<div class="blockDescription" data-bind="html: $root.ut(\'template\', \'' + utils.addSlashes(model._blockDescription) + '\')">' + model._blockDescription + '</div>';
    }

    /* CUSTOM STYLE */
    if (hasCustomStyle) {
      html += '<label class="data-boolean blockCheck">';
      html += '<input type="checkbox" value="nothing" data-bind="focusable: true, checked: customStyle" />';
      html += '<span title="Switch between global and block level styles editing" data-bind="attr: { title: $root.t(\'Switch between global and block level styles editing\') }, tooltip: {show: {delay: 500}, track: true}" class="checkbox-replacer checkbox-replacer-onoff"></span>'; //  data-bind="tooltip: { content: \'personalizza tutti\' }"
      html += '</label>';
      html += '<!-- ko template: { name: \'customstyle\', if: customStyle } --><!-- /ko -->';
    }

    if (typeof prop != 'undefined') {
      html += '<!-- ko with: ' + prop + ' -->';

      /* PREVIEW */
      if (level == 1 && typeof prop != 'undefined') {
        if (typeof model._previewBindings != 'undefined' && typeof withBindingProvider != 'undefined') {
          if (typeof rootPreviewBinding != 'undefined' && typeof model._noPreviewBackground === 'undefined') html += '<!-- ko with: $root.content() --><div class="objPreview" data-bind="' + rootPreviewBinding + '"></div><!-- /ko -->';
          if (typeof previewBackground != 'undefined' && typeof model._noPreviewBackground === 'undefined') html += '<!-- ko with: $parent --><div class="objPreview" data-bind="' + previewBackground + '"></div><!-- /ko -->';
          var previewBindings = {};
          declarations.elaborateDeclarations({
            type: 'stylesheet',
            stylesheet: {
              rules: [{
                type: 'rule',
                selectors: ['*'],
                declarations: model._previewBindings
              }]
            }
          }, templateUrlConverter, withBindingProvider.bind(this, path + '.'), previewBindings, false);
          html += '<div class="objPreview"><div class="objPreviewInner" data-bind="' + declarations.serializeNewBindings(previewBindings) + '"></div></div>';
        }
      }
    }

    /* PREVIEW */
    var previewBG;
    if (level === 0) {
      if (typeof model._previewBindings != 'undefined') {
        var newBindings = {};
        declarations.elaborateDeclarations({
          type: 'stylesheet',
          stylesheet: {
            rules: [{
              type: 'rule',
              selectors: ['*'],
              declarations: model._previewBindings
            }]
          }
        }, templateUrlConverter, withBindingProvider.bind(this, path.length > 0 ? path + '.' : ''), newBindings, false);
        previewBG = declarations.serializeNewBindings(newBindings);
      }
    }

    var i, newPath;

    var before = html.length;

    var newThemeModel;
    var newGlobalStyleProp;

    for (i = 0; i < props.length; i++) {
      newPath = path.length > 0 ? path + "." + props[i] : props[i];
      if (typeof model[props[i]] != 'object' || model[props[i]] === null || typeof model[props[i]]._widget != 'undefined') {
        newGlobalStyleProp = undefined;
        if (level === 0 && props[i] == 'theme')
          html += _propEditor(withBindingProvider, widgets, templateUrlConverter, model[props[i]], newThemeModel, newPath, props[i], editType, 0, baseThreshold, undefined, undefined, trackUsage, rootPreviewBinding);
        else {
          newGlobalStyleProp = _getGlobalStyleProp(globalStyles, model[props[i]], props[i], newPath);
          html += _propEditor(withBindingProvider, widgets, templateUrlConverter, model[props[i]], newThemeModel, newPath, props[i], editType, level + 1, baseThreshold, globalStyles, newGlobalStyleProp, trackUsage, rootPreviewBinding, previewBG);
        }
      }
    }
    for (i = 0; i < props.length; i++) {
      newPath = path.length > 0 ? path + "." + props[i] : props[i];
      if (!(typeof model[props[i]] != 'object' || model[props[i]] === null || typeof model[props[i]]._widget != 'undefined')) {
        newGlobalStyleProp = undefined;
        if (level === 0 && props[i] == 'theme')
          html += _propEditor(withBindingProvider, widgets, templateUrlConverter, model[props[i]], newThemeModel, newPath, props[i], editType, 0, baseThreshold, undefined, undefined, trackUsage, rootPreviewBinding);
        else {
          newGlobalStyleProp = _getGlobalStyleProp(globalStyles, model[props[i]], props[i], newPath);
          html += _propEditor(withBindingProvider, widgets, templateUrlConverter, model[props[i]], newThemeModel, newPath, props[i], editType, level + 1, baseThreshold, globalStyles, newGlobalStyleProp, trackUsage, rootPreviewBinding, previewBG);
        }
      }
    }

    var added = html.length - before;
    if (added === 0) {
      // No editable content: if this is in context "template" we leave it empty, otherwise we show an help.
      if (typeof model == 'object' && model !== null && model._context == 'template') {
        return '';
      } else {
        // TODO move me to a tmpl?
        html += '<div class="objEmpty" data-bind="html: $root.t(\'Selected element has no editable properties\')">Selected element has no editable properties</div>';
      }
    }

    if (typeof prop != 'undefined') {
      html += '<!-- /ko -->';
    }
    html += '</div>';

  } else {
    var checkboxes = true;

    if (typeof globalStyles == 'undefined') checkboxes = false;

    if (model === null || typeof model != 'object' || typeof model._widget != 'undefined') {
      var globalStyleLockProp = null;
      if (typeof globalStyles != 'undefined') {
        globalStyleLockProp = globalStyles['_locks.' + path];
      }

      var bindings = ['css: { localLocked: ' + (prop.substr(0,2) !== 'fd' ? '$root.lockDownMode() > 2 || ' : '') + '($root.lockDownMode() === 2 && typeof ' + prop + '._locked !== \'undefined\' && ' + prop + '._locked())' + (globalStyleLockProp !== null ? ', globalLocked: $root.lockDownMode() > 2 || ($root.lockDownMode() === 2 && typeof ' + prop + '._locked !== \'undefined\' && ' + globalStyleLockProp + '())' : '') + (model !== null && typeof model._hideif != 'undefined' ? ', hidden: ' + model._hideif : '') + (typeof globalStyleProp !== 'undefined' ? ', notnull: ' + prop + '() !== null' : '') + ' }'];

      title = model !== null && typeof model._help !== 'undefined' ? ' title="' + utils.addSlashes(model._help) + '" data-bind="attr: { title: $root.ut(\'template\', \'' + utils.addSlashes(model._help) + '\') }, tooltip: {show: {delay: 500}, track: true}"' : '';
      var bind = bindings.length > 0 ? 'data-bind="' + bindings.join() + '"' : '';
      html += '<div class="propEditor ' + propAccessor + (checkboxes ? ' checkboxes' : '') + '"' + bind + '>';

      var modelName2 = (model !== null && typeof model._name != 'undefined' ? model._name : (typeof prop !== 'undefined' ? '[' + prop + ']' : ''));
      modelName2 = '<span data-bind="text: $root.ut(\'template\', \'' + utils.addSlashes(modelName2) + '\')">' + modelName2 + '</span>';
      html += '<span' + title + ' class="propLabel">' + modelName2 + '</span>';
      html += '<div class="propInput' + (typeof globalStyles != 'undefined' ? ' local' : '') + '" data-bind="css: { default: ' + prop + '() === null }">';
      html += _propInput(model, prop, propAccessor, editType, widgets, false);
      for (var j = ''; typeof model['_button' + j] != 'undefined'; j++) {
        var btnOpts = _getOptionsObject(model['_button' + j]);
        var btnType = ( btnOpts.opts.hasOwnProperty( 'type' ) ? btnOpts.opts.type : '' );
        var btnLabel = ( btnOpts.opts.hasOwnProperty( 'label' ) ? btnOpts.opts.label : '' );
        var btnClick = 'function(evt){' + ( btnOpts.opts.hasOwnProperty( 'click' ) ? btnOpts.opts.click : '' ) + '}';
        html += '<a href="javascript:void(0)" class="' + btnType + 'button ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only" data-bind="click: ' + btnClick + ', button: { label: $root.t(\'' + btnLabel + '\') }" role="button" aria-disabled="false"><span class="ui-button-text">' + btnLabel + '</span></a>';
        if (j === '') {
          j = 1;
        }
      }
      html += '</div>';

      if (typeof globalStyleProp != 'undefined') {
        html += '<div class="propInput global" data-bind="css: { overridden: ' + prop + '() !== null }">';
        html += _propInput(model, prop, globalStyleProp, editType, widgets, true);
        html += '</div>';

        if (checkboxes) {
          html += '<div class="propCheck"><label><input type="checkbox" data-bind="focusable: true, click: function(evt, obj) { $root.localGlobalSwitch(' + prop + ', ' + globalStyleProp + '); return true; }, checked: ' + prop + '() !== null">';
          html += '<span class="checkbox-replacer" data-bind="css: { checked: ' + prop + '() !== null }, attr: { title: $root.t(\'This style is specific for this block: click here to remove the custom style and revert to the theme value\') }, tooltip: {show: {delay: 500}, track: true}"></span>';
          html += '</label></div>';
        }
      }
      // Lock Down Mode Support
      html += '<!-- ko if: $root.lockDownMode() === 1 && typeof ' + prop + '._locked !== \'undefined\' -->';
      html += '<div class="propCheck propLock' + (typeof globalStyles != 'undefined' ? ' local' : '') + '" data-bind="css: { default: ' + prop + '._locked() === null }">';
      html += '<label data-bind="click: function(evt, obj) { ' + prop + '._locked(!' + prop + '._locked()); return false }"><input type="checkbox" data-bind="focusable: true, click: function(evt, obj) { ' + prop + '._locked(!' + prop + '._locked()); return false }, checked: ' + prop + '._locked() === true">';
      html += '<span class="checkbox-replacer" data-bind="css: { checked: ' + prop + '._locked() === true }"></span>';
      html += '</label>';
      html += '</div>';
      if (globalStyleLockProp !== null) {
        html += '<div class="propCheck propLock global" data-bind="css: { overridden: ' + prop + '._locked() !== null }">';
        html += '<label data-bind="click: function(evt, obj) { ' + globalStyleLockProp + '(!' + globalStyleLockProp + '()); return false }"><input type="checkbox" data-bind="focusable: true, click: function(evt, obj) { ' + globalStyleLockProp + '(!' + globalStyleLockProp + '()); return false }, checked: ' + globalStyleLockProp + '() === true">';
        html += '<span class="checkbox-replacer" data-bind="css: { checked: ' + globalStyleLockProp + '() === true }"></span>';
        html += '</label>';
        html += '</div>';
      }
	  html += '<!-- /ko -->';
      html += '</div>';
    } else if (model === null || typeof model != 'object') {
      // TODO remove debug output
      html += '<div class="propEditor unknown">[A|' + prop + "|" + typeof model + ']</div>';
    } else {
      // TODO remove debug output
      html += '<div class="propEditor unknown">[B|' + prop + "|" + typeof model + ']</div>';
    }


  }

  if (typeof prop != 'undefined' && !!trackUsage) {
    html += '<!-- /ko -->';
    html += '<!-- ko ifSubs: { not: true, data: ' + ifSubsProp + ', threshold: ' + ifSubsThreshold + ', gutter: 0 } -->';
    html += '<span class="label notused">(' + prop + ')</span>';
    html += '<!-- /ko -->';
  }

  return html;
};


var createBlockEditor = function(defs, widgets, themeUpdater, templateUrlConverter, rootModelName, templateName, editType, templateCreator, baseThreshold, trackGlobalStyles, trackUsage, fromLevel) {
  if (typeof trackUsage == 'undefined') trackUsage = true;
  var model = modelDef.getDef(defs, templateName);

  var rootModel = modelDef.getDef(defs, rootModelName);
  var rootPreviewBindings;
  if (typeof rootModel._previewBindings != 'undefined' && templateName != 'theme' && editType == 'styler') {
    var newBindings = {};
    declarations.elaborateDeclarations({
      type: 'stylesheet',
      stylesheet: {
        rules: [{
          type: 'rule',
          selectors: ['*'],
          declarations: rootModel._previewBindings
        }]
      }
    }, templateUrlConverter, modelDef.getBindValue.bind(undefined, defs, themeUpdater, rootModelName, rootModelName, ''), newBindings, false);
    rootPreviewBindings = declarations.serializeNewBindings(newBindings);
  }

  var globalStyles = typeof trackGlobalStyles != 'undefined' && trackGlobalStyles ? defs[templateName]._globalStyles : undefined;
  var globalStyleProp = typeof trackGlobalStyles != 'undefined' && trackGlobalStyles ? defs[templateName]._globalStyle : undefined;

  var themeModel;
  if (typeof globalStyleProp !== 'undefined') {
    var mm = modelDef.getDef(defs, 'theme');
    // TODO remove deprecated $theme
    themeModel = mm[globalStyleProp.replace(/^(\$theme|_theme_)\./, '')];
  }


  var withBindingProvider = modelDef.getBindValue.bind(undefined, defs, themeUpdater, rootModelName, templateName);
  withBindingProvider._templateName = templateName;

  var html = '<div class="editor">';
  html += "<div class=\"blockType" + (typeof globalStyles != 'undefined' ? " withdefaults" : "") + "\">" + model.type + "</div>";

  var editorContent = _propEditor(withBindingProvider, widgets, templateUrlConverter, model, themeModel, "", undefined, editType, fromLevel, baseThreshold, globalStyles, globalStyleProp, trackUsage, rootPreviewBindings);
  if (editorContent.length > 0) {
    html += editorContent;
  }

  html += '</div>';

  templateCreator(html, templateName, editType);
};

var createBlockEditors = function(defs, widgets, themeUpdater, templateUrlConverter, rootModelName, templateName, templateCreator, baseThreshold) {
  createBlockEditor(defs, widgets, themeUpdater, templateUrlConverter, rootModelName, templateName, 'edit', templateCreator, baseThreshold);
  createBlockEditor(defs, widgets, themeUpdater, templateUrlConverter, rootModelName, templateName, 'styler', templateCreator, baseThreshold, true);
};

var generateEditors = function(templateDef, widgets, templateUrlConverter, templateCreator, baseThreshold) {
  var defs = templateDef._defs;
  var templateName = templateDef.templateName;
  var blocks = templateDef._blocks;
  var idx;
  var blockDefs = [];
  for (idx = 0; idx < blocks.length; idx++) {
    if (typeof blocks[idx].container !== 'undefined') {
      blockDefs.push(modelDef.generateModel(defs, blocks[idx].block));
    }
    createBlockEditors(defs, widgets, undefined, templateUrlConverter, blocks[idx].root, blocks[idx].block, templateCreator, baseThreshold);
  }

  if (typeof defs['theme'] != 'undefined') createBlockEditor(defs, widgets, undefined, templateUrlConverter, templateName, 'theme', 'styler', templateCreator, undefined, false, false, -1);
  if (typeof defs['envelope'] != 'undefined') createBlockEditor(defs, widgets, undefined, templateUrlConverter, templateName, 'envelope', 'edit', templateCreator, 0, false, true, 0);
  if (typeof defs['socialSharing'] != 'undefined') createBlockEditor(defs, widgets, undefined, templateUrlConverter, templateName, 'socialSharing', 'edit', templateCreator, 0, false, true, 0);
  return blockDefs;
};

module.exports = generateEditors;
