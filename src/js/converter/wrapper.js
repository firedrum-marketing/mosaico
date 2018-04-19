"use strict";

// This is complex code to handle "live" model instrumentation and dependency tracking.
// This adds _wrap and _unwrap methods to the model and also instrument the block list so to automatically
// wrap/upwrap objects on simple array methods (push, splice)

var ko = require("knockout");
var console = require("console");
var $ = require("jquery");

function wrap(v) {
  var typeOfv = typeof v;
  if (typeOfv === 'object') {
    if (v) {
      if (v.constructor == Date) typeOfv = 'date';
      else if (Object.prototype.toString.call(v) == '[object Array]') typeOfv = 'array';
    } else {
      typeOfv = 'null';
    }
  }

  if (typeOfv == "array") {

    var r = ko.observableArray();
    if (!v || v.length === 0) return r;
    for (var i = 0, l = v.length; i < l; ++i) r.push(wrap(v[i]));
    return r;

  } else if (typeOfv == "object") {

    var t = {};
    for (var k in v) {
      var wv = v[k];
      t[k] = wrap(wv);
    }
    return ko.observable(t);

  } else if (typeOfv == 'function') {

    return v;

  } else {

    var t2 = ko.observable();
    t2(v);
    return t2;

  }
}

// TODO the "select widget" uses its own _getOptionsObject to read and parse the "option" string
//      we should merge the logic.
var _getOptionsObject = function(options) {
  var result = {
    opts: {},
    order: []
  };
  var optionsCouples = options.split('|');
  for (var i = 0; i < optionsCouples.length; i++) {
    var opt = optionsCouples[i].split('=');
    var existingItemIndex = result.order.indexOf( opt[0] );
    if ( existingItemIndex > -1 ) {
        result.order.splice( existingItemIndex, 1 );
    }
    result.order.push( opt[0] );
    result.opts[opt[0]] = opt.length > 1 ? opt[1] : opt[0];
  }
  return result;
};

// generate a computed variable handling the fallback to theme variable
var _makeComputed = function(target, def, nullIfEqual, schemeSelector, themePath, themes) {
  var res = ko.computed({
    'read': function() {
      var val = target();
      if (val === null) {
        var scheme = ko.utils.unwrapObservable(schemeSelector);
        if (typeof scheme == 'undefined' || scheme == 'custom') {
          return ko.utils.unwrapObservable(def);
        } else {
          return themes[scheme][themePath];
        }
      } else {
        return val;
      }
    },
    'write': function(value) {
      var scheme = ko.utils.unwrapObservable(schemeSelector);
      var defVal;
      if (typeof scheme == 'undefined' || scheme == 'custom') {
        defVal = ko.utils.peekObservable(def);
      } else {
        defVal = themes[scheme][themePath];
      }

      if (!!nullIfEqual) {
        if (value == defVal) target(null);
        else target(value);
      } else {
        var current = ko.utils.peekObservable(target);
        if (value != defVal || current !== null) target(value);
      }

    }
  });
  return res;
};

var _nextVariantFunction = function(ko, prop, variants) {
  var currentValue = ko.utils.unwrapObservable(prop);
  var variantValue;

  for (var i = 0; i < variants.length; i++) {
    variantValue = ko.utils.peekObservable(variants[i]);
    if (variantValue == currentValue) break;
  }

  if (i == variants.length) {
    console.warn("Didn't find a variant!", prop, currentValue, variants);
    i = variants.length - 1;
  }

  var nextVariant = i + 1;
  if (nextVariant == variants.length) nextVariant = 0;
  var nextValue = ko.utils.peekObservable(variants[nextVariant]);

  prop(nextValue);
};
var _generateBlockHelperFunctions = function(def, defs, ko, type, t, blocks, vmWrapper) {
  t.getContainerIndex = function(blocks, vmWrapper) {
    var blocksArray = blocks();
    var i = blocksArray.length - 1;
    while( i >= 0 ) {
      if ( ko.utils.unwrapObservable(ko.utils.unwrapObservable(blocksArray[i]).id) == ko.utils.unwrapObservable(t.id) ) break;
      i--;
    }
    return i;
  }.bind(t, blocks, vmWrapper);
  t.getNearestUnlockedIndex = function(blocks, vmWrapper, up, strict, includeSelf) {
    if (typeof up === 'undefined') {
      up = false;
      strict = false;
      includeSelf = true;
    } else if (up === false && typeof strict === 'undefined') {
      strict = true;
      includeSelf = false;
    }

    var lockDownMode = 0;

    var tmp = vmWrapper();
    if (tmp !== null) {
      lockDownMode = tmp.lockDownMode();
    }

    var result = -1;
    if (lockDownMode < 3) {
      var containerIndex = this.getContainerIndex();
      var blocksArray = blocks();
      var curBlock = null;

      result = containerIndex;
      if (!up) {
        if (includeSelf) {
          result--;
        }
        while (++result <= blocksArray.length - 1) {
          curBlock = blocksArray[result];
          if (lockDownMode < 2 || !curBlock()._lockedBelow()) {
            break;
          }
        }
        if (result > blocksArray.length - 1) {
          result = -1;
        } else if (includeSelf) {
          result++;
        }
      }
      if (up || (strict === false && result === -1 && (result = containerIndex))) {
        if (includeSelf) {
          result++;
        }
        while (--result >= 0) {
          curBlock = blocksArray[result];
          if (lockDownMode < 2 || !curBlock()._lockedAbove()) {
            break;
          }
        }
      }
    }
    return result;
  }.bind(t, blocks, vmWrapper);
};
var _generateBlockLocks = function(def, defs, ko, type, t, blocks, vmWrapper) {
  // Handle lock down mode data for block movement
  var locked = {};
  if (ko.isObservable(t._locks)) {
    locked.above = ko.utils.unwrapObservable(t._lockedAbove);
    locked.below = ko.utils.unwrapObservable(t._lockedBelow);
  } else {
    t._locks = ko.observable({});
    t._locked = ko.observable(false);
    locked.above = locked.below = false;
  }
  t._lockedAbove = ko.computed( {
    read: function(locked, vmWrapper) {
      var lockDownMode = 0;

      var tmp = vmWrapper();
      if (tmp !== null) {
        lockDownMode = tmp.lockDownMode();
      }
      var blocksArray = blocks();

      switch (lockDownMode) {
        case 0:
          return false;
        case 1:
          var result = false;
          if ( t._locked() ) {
            var i = t.getContainerIndex();
            result = i === -1 ? locked.above : ( i === 0 ) || ko.utils.unwrapObservable(blocksArray[i - 1])._locked();
          }
          return (locked.above = result);
        case 2:
        case 3:
          return locked.above;
      }
    }.bind(undefined, locked, vmWrapper),
    write: function(value) { /* no-op, necessary for undo/redo to work! */ }.bind(undefined)
  } );
  t._lockedBelow = ko.computed( {
    read: function(locked, vmWrapper) {
      var lockDownMode = 0;
      var tmp = vmWrapper();
      if (tmp !== null && ko.isObservable(tmp.lockDownMode)) {
        lockDownMode = tmp.lockDownMode();
      }
      var blocksArray = blocks();

      switch (lockDownMode) {
        case 0:
          return false;
        case 1:
          var result = false;
          if ( t._locked() ) {
            var i = t.getContainerIndex();
            result = i === -1 ? locked.below : ( i === (blocksArray.length - 1) ) || ko.utils.unwrapObservable(blocksArray[i + 1])._locked();
          }
          return (locked.below = result);
        case 2:
        case 3:
          return locked.below;
      }
    }.bind(undefined, locked, vmWrapper),
    write: function(value) { /* no-op, necessary for undo/redo to work! */ }.bind(undefined)
  } );
};

var _generateLock = function(defs, ko, prop, newType, newTypeProp, val, t, locks) {
  // Handle lock down mode data
  var isComplex = typeof val._complex !== 'undefined';

  if (typeof locks[prop] === 'undefined') {
    locks[prop] = ko.observable(!isComplex ? false : {});
  }
  if (!isComplex) {
    t[prop]._locked = ko.computed( {
      read: function(locks, prop) {
        return locks[prop]();
      }.bind(undefined, locks, prop),
      write: function(locks, prop, value) {
        locks[prop](value);
      }.bind(undefined, locks, prop)
    } );
    t[prop]._locked._widget = val._widget;
  } else if (typeof t[prop] === 'function') {
    _generateLocks(defs[newTypeProp] || defs[prop], defs, ko, newType, t[prop](), locks[prop]());
  }
};

var _generateLocks = function(def, defs, ko, type, t, locks) {
  for (var prop in def)
    if (def.hasOwnProperty(prop)) {
      var val = def[prop];
      var newType = type + ' ' + prop;
      var newTypes = newType.split(' ');
      var newTypeProp = newType;
      var proceed = false;
      while (newTypes.length > 0) {
        proceed = defs.hasOwnProperty(newTypeProp);
        if (proceed) {
          break;
        }
        newTypes = newTypes.slice(1);
        newTypeProp = newTypes.join(' ');
      }
      if (proceed && typeof val == 'object' && val !== null) {
        _generateLock(defs, ko, prop, newType, newTypeProp, val, t, locks);
      }
    }
};

var _generateConditionalCommentData = function(def, defs, ko, type, t) {
  for (var prop in def)
    if (def.hasOwnProperty(prop)) {
      var val = def[prop];
      var newType = type + ' ' + prop;
      var newTypes = newType.split(' ');
      var newTypeProp = newType;
      var proceed = false;
      while (newTypes.length > 0) {
        proceed = defs.hasOwnProperty(newTypeProp);
        if (proceed) {
          break;
        }
        newTypes = newTypes.slice(1);
        newTypeProp = newTypes.join(' ');
      }
      if (proceed && typeof val == 'object' && val !== null) {
        if (typeof val._widget != 'undefined' && (val._widget === 'text' || val._widget === 'longtext')) {
          // Handle conditional comment versions of text and longtext widgets
          t[prop + 'MAGForConditional'] = ko.pureComputed( function(textObservable) {
            var textObservableValue = textObservable();
            return typeof textObservableValue === 'string' ? textObservableValue.replace(/<([A-Za-z:]+)/g, '<!-- cc:bo:$1 --><cc') // before open tag
              .replace(/<\/([A-Za-z:]+)>/g,'<!-- cc:bc:$1 --></cc><!-- cc:ac:$1 -->') // before/after close tag
              .replace(/\/>/g,'/><!-- cc:sc -->') : textObservableValue;
          }.bind(undefined, t[prop]) );
        } else if (typeof t[prop] === 'function') {
          _generateConditionalCommentData(defs[newTypeProp] || defs[prop], defs, ko, newType, t[prop]());
        }
      }
    }
};

var _generateSelectDefinitionLabels = function(def, defs, ko, type, t) {
  for (var prop in def)
    if (def.hasOwnProperty(prop)) {
      var val = def[prop];
      var newType = type + ' ' + prop;
      var newTypes = newType.split(' ');
      var newTypeProp = newType;
      var proceed = false;
      while (newTypes.length > 0) {
        proceed = defs.hasOwnProperty(newTypeProp);
        if (proceed) {
          break;
        }
        newTypes = newTypes.slice(1);
        newTypeProp = newTypes.join(' ');
      }
      if (proceed && typeof val == 'object' && val !== null) {
        if (typeof val._widget != 'undefined' && val._widget === 'select' && typeof val._options != 'undefined') {

          // Handle select label subscriptions/observables
          var opts = _getOptionsObject(val._options);
          t[prop + 'MAGLabel'] = ko.observable(opts.opts[t[prop]()]);
          t[prop].subscribe( function(labelObservable, selectOptions, newValue) {
            labelObservable(selectOptions.opts[newValue]);
          }.bind(undefined, t[prop + 'MAGLabel'], opts) );
        } else if (typeof t[prop] === 'function') {
          _generateSelectDefinitionLabels(defs[newTypeProp] || defs[prop], defs, ko, newType, t[prop]());
        }
      }
    }
};

var _getVariants = function(def) {
  var variantProp = def._variant;
  var variantOptions;
  if (typeof def[variantProp] !== 'object' || typeof def[variantProp]._widget === 'undefined' || (typeof def[variantProp]._options !== 'string' && def[variantProp]._widget !== 'boolean')) {
    console.error("Unexpected variant declaration", variantProp, def[variantProp]);
    throw "Unexpected variant declaration: cannot find property " + variantProp + " or its _options string and it is not a boolean";
  }

  if (typeof def[variantProp]._options == 'string') {
    variantOptions = _getOptionsObject(def[variantProp]._options).order;
  } else {
    variantOptions = [true, false];
  }
  return variantOptions;
};

var _getImageHeights = function(t, def) {
  if (typeof def._imageHeights !== 'string') {
    console.error("Unexpected images declaration", def._imageHeights);
    throw "Unexpected images declaration";
  }

  var imageHeights = [];
  var imageHeightProps = _getOptionsObject(def._imageHeights).order;
  for (var h1 = 0; h1 < imageHeightProps.length; h1++) {
    var hpParts = imageHeightProps[h1].split('.');
    var hpTarget = t;
    for (var h2 = 0; h2 < hpParts.length; h2++) {
      hpTarget = ko.utils.unwrapObservable(hpTarget)[hpParts[h2]];
    }
    imageHeights.push(hpTarget);
  }
  return imageHeights;
};

var _getImageWidths = function(t, def) {
  if (typeof def._imageWidths !== 'string') {
    console.error("Unexpected image widths declaration", def._imageWidths);
    throw "Unexpected image widths declaration";
  }

  var imageWidths = [];
  var imageWidthProps = _getOptionsObject(def._imageWidths).order;
  for (var w1 = 0; w1 < imageWidthProps.length; w1++) {
    var wpParts = imageWidthProps[w1].split('.');
    var wpTarget = t;
    for (var w2 = 0; w2 < wpParts.length; w2++) {
      wpTarget = ko.utils.unwrapObservable(wpTarget)[wpParts[w2]];
    }
    imageWidths.push(wpTarget);
  }
  return imageWidths;
};

var _makeComputedFunction = function(def, defs, thms, vmWrapper, ko, contentModel, isContent, t) {
  if (typeof def == 'undefined') {
    if (typeof ko.utils.unwrapObservable(t).type === 'undefined') {
      console.log("TODO ERROR Found a non-typed def ", def, t);
      throw "Found a non-typed def " + def;
    }
    var type = ko.utils.unwrapObservable(ko.utils.unwrapObservable(t).type);
    def = defs[type];
    if (typeof def !== 'object') console.log("TODO ERROR Found a non-object def ", def, "for", type);
  }

  if (typeof contentModel == 'undefined' && typeof isContent != 'undefined' && isContent) {
    contentModel = t;
  }

  var selfPath = '$root.content().';

  var pp = def._globalStyles;
  if (typeof pp != 'undefined')
    for (var p in pp)
      if (pp.hasOwnProperty(p) && p.indexOf('_locks.') !== 0) {
        var schemePathOrig = '$root.content().theme().scheme';
        var schemePath, vm, lockVm, path;

        if (pp[p].substr(0, selfPath.length) == selfPath) {
          path = pp[p].substr(selfPath.length);
          vm = contentModel;
        } else {
          throw "UNEXPECTED globalStyle path (" + pp[p] + ") outside selfPath (" + selfPath + ")";
        }
        if (schemePathOrig.substr(0, selfPath.length) == selfPath) {
          schemePath = schemePathOrig.substr(selfPath.length);
        } else {
          console.log("IS THIS CORRECT?", schemePathOrig, selfPath);
          schemePath = schemePathOrig;
        }

        var schemeSelector = vm;

        var pathParts = path.split('().');
        var themePath = '';
        var skip = true;
        for (var i = 0; i < pathParts.length; i++) {
          vm = ko.utils.unwrapObservable(vm);
          // ugly thing to find the path to the schema color property (sometimes we have theme.bodyTheme, some other we have content.theme.bodyTheme...)
          if (skip) {
            if (pathParts[i] == 'theme') skip = false;
          } else {
            if (themePath.length > 0) {
              if (themePath.indexOf('.') === -1) {
                if (typeof vm._locks === 'undefined') {
                  vm._locks = ko.observable({});
                }
                lockVm = vm._locks;
              }
              lockVm = ko.utils.unwrapObservable(lockVm);
              if (typeof lockVm[pathParts[i]] === 'undefined') {
                lockVm[pathParts[i]] = ko.observable(i === (pathParts.length - 1) ? false : {});
              }
              lockVm = lockVm[pathParts[i]];

              themePath += '.';
            }
            themePath += pathParts[i];
          }
          vm = vm[pathParts[i]];
        }

        var schemeParts = schemePath.split('().');
        for (var i3 = 0; i3 < schemeParts.length; i3++) {
          schemeSelector = ko.utils.unwrapObservable(schemeSelector)[schemeParts[i3]];
        }

        var nullIfEqual = true;
        var tParts = p.split('.');
        var target = t;
        for (var i2 = 0; i2 < tParts.length; i2++) {
          target = ko.utils.unwrapObservable(target)[tParts[i2]];
        }

        if (!ko.isObservable(target)) throw "Unexpected non observable target " + p + "/" + themePath;

        target._defaultComputed = _makeComputed(target, vm, nullIfEqual, schemeSelector, themePath, thms);
        if ( typeof target._locked === 'undefined' ) {
          target._locked = ko.observable(null);
        }
        target._locked._defaultComputed = _makeComputed(target._locked, lockVm, nullIfEqual, schemeSelector, themePath.substr(0, themePath.indexOf('.')) + '._locks' + themePath.substr(themePath.indexOf('.')), thms);
      }

  if (typeof def._variant != 'undefined') {
    var pParts = def._variant.split('.');
    // looks in t and not contentModel because variants are declared on single blocks.
    var pTarget = t;
    var pParent = ko.utils.unwrapObservable(t);
    for (var i4 = 0; i4 < pParts.length; i4++) {
      pTarget = ko.utils.unwrapObservable(pTarget)[pParts[i4]];
    }
    if (typeof pTarget._defaultComputed != 'undefined') {
      console.log("Found variant on a style property: beware variants should be only used on content properties because they don't match the theme fallback behaviour", def._variant);
      pTarget = pTarget._defaultComputed;
    }
    if (typeof pTarget == 'undefined') {
      console.log("ERROR looking for variant target", def._variant, t);
      throw "ERROR looking for variant target " + def._variant;
    }
    pParent._nextVariant = _nextVariantFunction.bind(pTarget, ko, pTarget, _getVariants(def));
    pParent._variantTarget = pTarget;
    pParent._variantText = def._variantText;
  }

  if (typeof def._automaticImageHeight != 'undefined') {
    var hParts = def._automaticImageHeight.split('.');
    // looks in t and not contentModel because variants are declared on single blocks.
    var hTarget = t;
    var hParent = ko.utils.unwrapObservable(t);
    for (var i5 = 0; i5 < hParts.length; i5++) {
      hTarget = ko.utils.unwrapObservable(hTarget)[hParts[i5]];
    }
    if (typeof hTarget._defaultComputed != 'undefined') {
      console.log("Found automatic image height on a style property: beware automatic image heights should be only used on content properties because they don't match the theme fallback behaviour", def._automaticImageHeight);
      hTarget = hTarget._defaultComputed;
    }
    if (typeof hTarget == 'undefined') {
      console.log("ERROR looking for automatic image height target", def._automaticImageHeight, t);
      throw "ERROR looking for automatic image height target " + def._automaticImageHeight;
    }
    hParent._setAutomaticImageHeight = ko.computed(function(automaticImageHeight, imageHeights, manualImageHeight) {
      var heights = [];
      for (var i6 = 0; i6 < imageHeights.length; i6++) {
        var i7 = imageHeights[i6]();
        if ($.isNumeric(i7)) {
          heights.push(i7);
        }
      }
      ko.ignoreDependencies(function(automaticImageHeights, imageHeights, manualImageHeight) {
        if (!manualImageHeight()) {
          var largestHeight = Math.max.apply(null, imageHeights);
          if (largestHeight > 0) {
            automaticImageHeight(largestHeight);
          }
        }
      }, this, [automaticImageHeight, heights, manualImageHeight]);
    }.bind(hParent, hTarget, _getImageHeights(t, def), typeof hParent['manualImageHeight'] === 'function' ? hParent['manualImageHeight'] : function() {return false;}));
  }

  for (var prop2 in def)
    if (def.hasOwnProperty(prop2)) {
      var val = def[prop2];
      if (typeof val == 'object' && val !== null) {
        if (typeof val._context != 'undefined' && val._context == 'block') {
          // This is a block instantiation!
          var propVm = contentModel[prop2]();
          var newVm = _makeComputedFunction(defs[prop2], defs, thms, vmWrapper, ko, contentModel, isContent, propVm);
          t[prop2](newVm);
          _generateSelectDefinitionLabels(defs[prop2], defs, ko, val.type, newVm);
          _generateConditionalCommentData(defs[prop2], defs, ko, val.type, newVm);
          _generateBlockHelperFunctions(defs[prop2], defs, ko, val.type, newVm, contentModel.mainBlocks().blocks, vmWrapper);
          _generateBlockLocks(defs[prop2], defs, ko, val.type, newVm, contentModel.mainBlocks().blocks, vmWrapper);
          _generateLocks(defs[prop2], defs, ko, val.type, newVm, newVm._locks());
        } else if (val.type == 'blocks') {
          // This is a block list
          var mainVm = contentModel[prop2]();
          var blocksVm = mainVm.blocks();
          var oldBlock, blockType, newBlock;
          for (var ib = 0; ib < blocksVm.length; ib++) {
            oldBlock = ko.utils.unwrapObservable(blocksVm[ib]);
            blockType = ko.utils.unwrapObservable(oldBlock.type);
            newBlock = _makeComputedFunction(defs[blockType], defs, thms, vmWrapper, ko, contentModel, isContent, oldBlock);
            blocksVm[ib](newBlock);
          }

          var blocksObs = mainVm.blocks;

          _augmentBlocksObservable(blocksObs, _blockInstrumentFunction.bind(mainVm, undefined, defs, thms, vmWrapper, ko, undefined, contentModel, isContent));

          contentModel[prop2]._wrap = _makeBlocksWrap.bind(contentModel[prop2], blocksObs._instrumentBlock);
          contentModel[prop2]._unwrap = _unwrap.bind(contentModel[prop2]);
        }
      }
    }

  if (def.type === 'template') {
    if (!ko.isObservable(contentModel._locks)) {
      contentModel._locks = ko.observable({});
    }

    for (var prop3 in def)
      if (prop3.substr(0,2) !== 'fd' && def.hasOwnProperty(prop3)) {
        var val2 = def[prop3];
        if (typeof val2 == 'object' && val2 !== null && typeof val2._complex === 'undefined' && val2._category === 'content') {
          // This is a content-tab property of the Email itself
          _generateLock(defs, ko, prop3, val2.type, val2.type, defs[prop3], contentModel, contentModel._locks());
        }
      }
  }

  if (typeof def._context != 'undefined' && def._context == 'block') {
    _generateSelectDefinitionLabels(def, defs, ko, def.type, t);
    _generateConditionalCommentData(def, defs, ko, def.type, t);
    _generateBlockHelperFunctions(def, defs, ko, def.type, t, contentModel.mainBlocks().blocks, vmWrapper);
    _generateBlockLocks(def, defs, ko, def.type, t, contentModel.mainBlocks().blocks, vmWrapper);
    _generateLocks(def, defs, ko, def.type, t, t._locks());
  }

  return t;
};

var _augmentBlocksObservable = function(blocksObs, instrument) {
  blocksObs._instrumentBlock = instrument;
  if (typeof blocksObs.origPush == 'undefined') {
    blocksObs.origPush = blocksObs.push;
    blocksObs.push = _makePush.bind(blocksObs);
    blocksObs.origSplice = blocksObs.splice;
    blocksObs.splice = _makeSplice.bind(blocksObs);
  }
};

var _makeBlocksWrap = function(instrument, inputModel) {
  var model = ko.toJS(inputModel);
  var input = model.blocks;
  model.blocks = [];
  var res = wrap(model)();
  _augmentBlocksObservable(res.blocks, instrument);
  for (var i = 0; i < input.length; i++) {
    var obj = ko.toJS(input[i]);
    // console.log("_makeBlocksWrap set blockId", obj.id, 'block_'+i);
    obj.id = 'block_' + i;
    res.blocks.push(obj);
  }
  this(res);
};

var _makePush = function() {
  if (arguments.length > 1) throw "Array push with multiple arguments not implemented";
  // unwrap observable blocks, otherwise visibility (dependency) handling breaks
  if (arguments.length > 0 && ko.isObservable(arguments[0])) {
    if (typeof arguments[0]._unwrap == 'function') {
      arguments[0] = arguments[0]._unwrap();
    } else {
      console.log("WARN: pushing observable with no _unwrap function (TODO remove me, expected condition)");
    }
  }
  if (!ko.isObservable(arguments[0])) {
    var instrumented = this._instrumentBlock(arguments[0]);
    return this.origPush.apply(this, [instrumented]);
  } else {
    return this.origPush.apply(this, arguments);
  }
};

var _makeSplice = function() {
  if (arguments.length > 3) throw "Array splice with multiple objects not implemented";
  if (arguments.length > 2 && ko.isObservable(arguments[2])) {
    if (typeof arguments[2]._unwrap == 'function') {
      arguments[2] = arguments[2]._unwrap();
    } else {
      console.log("WARN: splicing observable with no _unwrap function (TODO remove me, expected condition)");
    }
  }
  if (arguments.length > 2 && !ko.isObservable(arguments[2])) {
    var instrumented = this._instrumentBlock(arguments[2]);
    return this.origSplice.apply(this, [arguments[0], arguments[1], instrumented]);
  } else {
    return this.origSplice.apply(this, arguments);
  }
};

// def, defs, themes and vmWrapper are bound in "_modelInstrument" while the next parameters are exposed by this module
var _blockInstrumentFunction = function(def, defs, themes, vmWrapper, knockout, self, modelContent, isContent, self2) {
  // ugly: sometimes we have to bind content but not self, so we repeat self at the end as "self2"
  if (typeof self == 'undefined') self = self2;

  var res = wrap(self);
  // Augment observables with custom code
  res(_makeComputedFunction(def, defs, themes, vmWrapper, knockout, modelContent, isContent, res()));

  res._unwrap = _unwrap.bind(res);
  return res;
};

var _wrap = function(instrument, unwrapped) {
  var newContent = ko.utils.unwrapObservable(instrument(ko, unwrapped, undefined, true));
  this(newContent);
};

var _unwrap = function() {
  return ko.toJS(this);
};

var _modelInstrument = function(model, modelDef, defs, vmWrapper) {
  var _instrument = _blockInstrumentFunction.bind(undefined, modelDef, defs, defs['themes'], vmWrapper);
  var res = _instrument(ko, model, undefined, true);
  // res._instrument = _instrument;
  res._wrap = _wrap.bind(res, _instrument);
  res._unwrap = _unwrap.bind(res);
  return res;
};

module.exports = _modelInstrument;