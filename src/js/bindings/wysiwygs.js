"use strict";
/* global global: false */

var tinymce = require("tinymce");
var $ = require("jquery");
require('jquery-ui');
var ko = require("knockout");
var console = require("console");
require("./eventable.js");

var getPixelsFromString = function(input, fontSize) {
  var num = parseFloat(input);
  switch(input.substr(String(num).length)) {
    case '':
    case 'em':
      num *= fontSize;
      break;
    case 'pt':
      num *= 96 / 72;
      break;
    case 'px':
      break;
    default:
      break;
  }
  return num;
};

var getEffectiveLineHeightAndFontSize = function($element) {
  var fontSizeCSS = $element.css('font-size');
  var lineHeightCSS = $element.css('line-height');
  var fontSize = 14;
  var lineHeight = 14;
  var closestFontSize = $element.closest('[style*="font-size"]');
  var closestLineHeight = $element.closest('[style*="line-height"]');

  var grandParentFontSize = closestFontSize.parent().closest('[style*="font-size"]');
  grandParentFontSize = grandParentFontSize.length > 0 ? getPixelsFromString(grandParentFontSize.css('font-size'), 14) : 14;

  if (fontSizeCSS) {
    fontSize = getPixelsFromString(fontSizeCSS, grandParentFontSize);
  } else {
    fontSize = getPixelsFromString(closestFontSize.css('font-size'), grandParentFontSize);
  }

  if (lineHeightCSS) {
    lineHeight = getPixelsFromString(lineHeightCSS, fontSize);
  } else {
    lineHeight = getPixelsFromString(closestLineHeight.css('line-height'), fontSize);
  }

  return {
    fontSize: fontSize,
    lineHeight: lineHeight
  };
};

var blockLevelElementsSelector = 'address,article,aside,blockquote,canvas,dd,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,noscript,ol,output,p,pre,section,table,tfoot,ul,video';
var extractWysiwygStyles = function(html, parentId) {
  var depthSort = function(a, b) {
    var aDepth = 0, bDepth = 0, aParent = a.parent(), bParent = b.parent();

    while ( aParent.length > 0 ) {
      aDepth++;
      aParent = aParent.parent();
    }

    while ( bParent.length > 0 ) {
      bDepth++;
      bParent = bParent.parent();
    }

    if ( aDepth < bDepth ) {
      return 1;
    } else if (aDepth > bDepth) {
      return -1;
    }

    return 0;
  };

  var styledDepthSets = [];
  $('[style]', html).each(function() {
    var $siblings = $(this).siblings().addBack();
    var notAdded = true;
    for(var i = 0; i < styledDepthSets.length; i++) {
      if (styledDepthSets[i].is(this)) {
        notAdded = false;
        break;
      }
    }
    if (notAdded) {
      styledDepthSets.push($siblings);
    }
  });
  styledDepthSets.sort(depthSort);

  for (var i1 = 0; i1 < styledDepthSets.length; i1++) {
    var $siblings = styledDepthSets[i1];
    // Ensure there are no issues with cropped text in Microsoft Word-based Outlook versions
    var greatestSiblingLineHeight = 0;
    var greatestSiblingFontSize = 0;

    var $inlineSiblings = $siblings.not(blockLevelElementsSelector);
    for (var j = 0; j < $inlineSiblings.length; j++) {
      var $sibling = $($inlineSiblings[j]);
      var effectiveSiblingLineHeightAndFontSize = getEffectiveLineHeightAndFontSize($sibling);

      greatestSiblingFontSize = Math.max(greatestSiblingFontSize, effectiveSiblingLineHeightAndFontSize.fontSize);
      greatestSiblingLineHeight = Math.max(greatestSiblingLineHeight, effectiveSiblingLineHeightAndFontSize.lineHeight);
      if ($sibling.attr('style')) {
        $sibling.attr('style', $sibling.attr('style').replace(/line-height:[^;]*;?/ig, ''));
        if ($sibling.attr('style') === '') {
          $sibling.removeAttr('style');
        }
      }
    }

    if (greatestSiblingFontSize > 0 && greatestSiblingLineHeight > 0) {
      if (greatestSiblingFontSize > greatestSiblingLineHeight) {
        greatestSiblingLineHeight = greatestSiblingFontSize;
      }
      var $closestBlockLevelParentElement = $siblings.parent().closest(blockLevelElementsSelector);
      var closestBlockLevelParentLineHeight = $closestBlockLevelParentElement.css('line-height');
      var curStyle;
      if (closestBlockLevelParentLineHeight) {
        var effectiveBlockLevelParentFontSizeAndLineHeight = getEffectiveLineHeightAndFontSize($closestBlockLevelParentElement);
        if (effectiveBlockLevelParentFontSizeAndLineHeight.lineHeight < greatestSiblingLineHeight) {
          curStyle = $closestBlockLevelParentElement.attr('style') || 'line-height:';
          $closestBlockLevelParentElement.attr('style', curStyle.replace(/line-height:[^;]*(;?)/ig, 'line-height:' + greatestSiblingLineHeight + 'px$1'));
        }
      } else {
        curStyle = $closestBlockLevelParentElement.attr('style') || '';
        $closestBlockLevelParentElement.attr('style', 'line-height:' + greatestSiblingLineHeight + 'px;' + curStyle);
      }
    }
  }

  var styledElements = [];
  $('[style]', html).each(function() {
    styledElements.push($(this));
  });
  styledElements.sort(depthSort);

  var classIndex = 0;
  var styleRules = [];
  for (var i2 = 0; i2 < styledElements.length; i2++) {
    var $this = styledElements[i2];

    // Fix mso-text-raise issues with font-size or line-height set inside TinyMCE
    $this.attr('style', $this.attr('style').replace(/mso-text-raise:[^;]*;/gi, ''));
    if ($this.css('font-size')) {
      var effectiveLineHeightAndFontSize = getEffectiveLineHeightAndFontSize($this);
      $this.attr('style', 'mso-text-raise:' + Math.floor((effectiveLineHeightAndFontSize.lineHeight - effectiveLineHeightAndFontSize.fontSize) / 2) + 'px;' + $this.attr('style'));
    }

    // Add inline styles to styleRules
    var styleContent = $this.attr('style');
    if (styleContent) {
      var styleClass = 'e_' + classIndex++;
      styleRules.push('#' + parentId + ' .' + styleClass + '{' + styleContent + '}');
      $this.addClass(styleClass);
    }
  }//);

  // Detect and correct content that ends with <br>
  var lastNode = html[0].lastChild;
  while (lastNode) {
    if (lastNode.nodeName === 'BR') {
      html.append('\u200B');
    } else if (lastNode.textContent === '') {
      lastNode = lastNode.previousSibling;
      continue;
    }

    break;
  }

  return styleRules;
};

ko.bindingHandlers.wysiwygOrHtml = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    if (typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg') {
      ko.bindingHandlers['virtualHtml'].init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
      var parentStyleElement = element.getAttribute ? element : element.parentNode;
      var parentElementComputedStyle = null;
      try {
        parentElementComputedStyle = element.ownerDocument.defaultView.getComputedStyle(parentStyleElement, null);
      } catch(e) {
        parentElementComputedStyle = global.getComputedStyle(parentStyleElement, null);
      }

      var parentId = parentStyleElement.getAttribute('id');
      var parentFontSize = getPixelsFromString(parentElementComputedStyle.fontSize, 14);

      var html = $('<div>' + ko.utils.unwrapObservable(valueAccessor()) + '</div>');
      html.css({
        fontSize: parentFontSize + 'px',
        lineHeight: (getPixelsFromString(parentElementComputedStyle.lineHeight, parentFontSize) / parentFontSize) + 'em'
      });

      var styleRules = extractWysiwygStyles(html, parentId);
      if (html.css('line-height')) {
        html.wrap('<div/>');
      }
      var htmlNode = element;
      while (htmlNode.tagName !== 'HTML') {
        htmlNode = htmlNode.parentNode;
      }
      var styleTag = $('style[data-e="' + parentId + '"]', htmlNode);
      if ( styleTag.length === 0 ) {
        styleTag = $('<style data-e="' + parentId + '"></style>');
        var head = $('head', htmlNode).append(styleTag);
        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
          styleTag.remove();
        });
      }
      styleTag.html(styleRules.join(''));

      return ko.bindingHandlers['virtualHtml'].init(element, function(){return ko.observable(html.prop('innerHTML'));}, allBindingsAccessor, viewModel, bindingContext);
    } else {
      return ko.bindingHandlers.wysiwyg.init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
    }
  },
  update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    if (typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg') {
      ko.bindingHandlers['virtualHtml'].update(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
      var parentStyleElement = element.getAttribute ? element : element.parentNode;
      var parentElementComputedStyle = null;
      try {
        parentElementComputedStyle = element.ownerDocument.defaultView.getComputedStyle(parentStyleElement, null);
      } catch(e) {
        parentElementComputedStyle = global.getComputedStyle(parentStyleElement, null);
      }

      var parentId = parentStyleElement.getAttribute('id');
      var parentFontSize = getPixelsFromString(parentElementComputedStyle.fontSize, 14);

      var html = $('<div>' + ko.utils.unwrapObservable(valueAccessor()) + '</div>');
      html.css({
        fontSize: parentFontSize + 'px',
        lineHeight: (getPixelsFromString(parentElementComputedStyle.lineHeight, parentFontSize) / parentFontSize) + 'em'
      });

      var styleRules = extractWysiwygStyles(html, parentId);
      if (html.css('line-height')) {
        html.wrap('<div/>');
      }
      var htmlNode = element;
      while (htmlNode.tagName !== 'HTML') {
        htmlNode = htmlNode.parentNode;
      }
      var styleTag = $('style[data-e="' + parentId + '"]', htmlNode);
      if ( styleTag.length === 0 ) {
        styleTag = $('<style data-e="' + parentId + '"></style>');
        var head = $('head', htmlNode).append(styleTag);
        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
          styleTag.remove();
        });
      }
      styleTag.html(styleRules.join(''));

      return ko.bindingHandlers['virtualHtml'].update(element, function(){return ko.observable(html.prop('innerHTML'));}, allBindingsAccessor, viewModel, bindingContext);
    }
  }
};
ko.virtualElements.allowedBindings['wysiwygOrHtml'] = true;

ko.bindingHandlers.wysiwygHref = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    if (element.nodeType !== 8) {
      var v = valueAccessor();

      var isNotWysiwygMode = (typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg');
      // console.log("XXX", bindingContext.templateMode, isNotWysiwygMode, element.getAttribute("href"));
      if (isNotWysiwygMode) {
        element.setAttribute('target', '_new');
      } else {
        /*jshint scripturl:true*/
        // 20150226: removed href to work around FF issues with <a href=""><div contenteditable="true">..</div></a>
        // element.setAttribute('href', 'javascript:void(0)');
        // 20150309: on IE, an editable <a href="" data-editable=""> prevent tinymce toolbar to be shown.
        //           so I change behaviour based on the use of "wysiwygOrHtml"
        // @see: http://www.tinymce.com/develop/bugtracker_view.php?id=7432
        var allbindings = allBindingsAccessor();
        if (typeof allbindings.wysiwygOrHtml !== 'undefined') {
          element.setAttribute('href', 'javascript:void(0)');
        } else {
          element.removeAttribute('href');
          element.setAttribute('disabledhref', '#');
        }
      }
    }
  },
  update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    if (element.nodeType !== 8) {
      var isNotWysiwygMode = (typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg');
      // NOTE this unwrap is needed also in "wysiwyg" mode, otherwise dependency tracking dies.
      var attrValue = ko.utils.unwrapObservable(valueAccessor());
      if (isNotWysiwygMode) {
        if ((attrValue === false) || (attrValue === null) || (attrValue === undefined) || (attrValue === ''))
          element.setAttribute('href', 'http://www.example.com/');
        else
          element.setAttribute('href', attrValue.toString());
      }
    }
  }
};
ko.virtualElements.allowedBindings['wysiwygHref'] = true;

ko.bindingHandlers.wysiwygSrc = {
  waitingImages: ko.observable(0),
  roundHelper: function(val) {
    if (val >= 0) {
      return Math.floor(val + 0.5);
    } else {
      return Math.ceil(val - 0.5);
    }
  },
  getCoverGeometry: function(width, height, geometry) {
    var widthRatio = 1;
    var heightRatio = 1;

    if (typeof width === 'undefined' || width === 0) {
      heightRatio = geometry.height / height;
      width  = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.width / heightRatio);
      widthRatio = geometry.width / width;
    } else if (typeof height === 'undefined' || height === 0) {
      widthRatio = geometry.width / width;
      height = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.height / widthRatio);
      heightRatio = geometry.height / height;
    } else {
      widthRatio = geometry.width / width;
      heightRatio = geometry.height / height;
    }

    var resizeWidth = width;
    var resizeHeight = height;

    if ( widthRatio > heightRatio ) {
      resizeWidth  = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.width / heightRatio);
    } else {
      resizeHeight = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.height / widthRatio);
    }

    return {
      x: (( resizeWidth - width ) / 2) / resizeWidth,
      y: (( resizeHeight - height ) / 2) / resizeHeight,
      width: width,
      height: height
    };
  },
  cover: function(element, width, height, naturalDimensions, boundingDimensions, bindingContext, geometry) {
    var coverGeometry = ko.bindingHandlers.wysiwygSrc.getCoverGeometry(width, height, geometry);
    var naturalCoverGeometry = ko.bindingHandlers.wysiwygSrc.getCoverGeometry(boundingDimensions.width, boundingDimensions.height, geometry);

    if (bindingContext._item) {
      if (bindingContext._item().logoAdjustedWidth) {
        bindingContext._item().logoAdjustedWidth(coverGeometry.width);
      }
      if (bindingContext._item().logoAdjustedHeight) {
        bindingContext._item().logoAdjustedHeight(coverGeometry.height);
      }
    }

    ko.bindingHandlers.wysiwygSrc.setNaturalDimensions(naturalDimensions, {
      width: naturalCoverGeometry.width,
      height: naturalCoverGeometry.height
    });

    element.setAttribute("cropleft", coverGeometry.x);
    element.setAttribute("cropright", coverGeometry.x);
    element.setAttribute("croptop", coverGeometry.y);
    element.setAttribute("cropbottom", coverGeometry.y);
    $(element).css({
      'width': coverGeometry.width + 'px',
      'height': coverGeometry.height + 'px'
    });
  },
  getContainGeometry: function(width, height, geometry) {
    var widthRatio = 1;
    var heightRatio = 1;

    if (typeof width === 'undefined' || width === 0) {
      heightRatio = geometry.height / height;
      if (heightRatio > 1) {
        width  = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.width / heightRatio);
      } else {
        width = geometry.width;
        height = geometry.height;
      }
    } else if (typeof height === 'undefined' || height === 0) {
      widthRatio = geometry.width / width;
      if (widthRatio > 1) {
        height = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.height / widthRatio);
      } else {
        height = geometry.height;
        width = geometry.width;
      }
    } else {
      heightRatio = geometry.height / height;
      widthRatio = geometry.width / width;

      if (widthRatio > 1 || heightRatio > 1) {
        if (widthRatio > heightRatio) {
          height = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.height / widthRatio);
        } else {
          width  = ko.bindingHandlers.wysiwygSrc.roundHelper(geometry.width / heightRatio);
        }
      } else {
        width = geometry.width;
        height = geometry.height;
      }
    }

    return {
      width: width,
      height: height
    };
  },
  contain: function(element, width, height, naturalDimensions, boundingDimensions, bindingContext, geometry) {
    var containGeometry = ko.bindingHandlers.wysiwygSrc.getContainGeometry(width, height, geometry);
    var naturalContainGeometry = ko.bindingHandlers.wysiwygSrc.getContainGeometry(boundingDimensions.width, boundingDimensions.height, geometry);

    if (bindingContext._item) {
      if (bindingContext._item().logoAdjustedWidth) {
        bindingContext._item().logoAdjustedWidth(containGeometry.width);
      }
      if (bindingContext._item().logoAdjustedHeight) {
        bindingContext._item().logoAdjustedHeight(containGeometry.height);
      }
    }

    ko.bindingHandlers.wysiwygSrc.setNaturalDimensions(naturalDimensions, {
      width: naturalContainGeometry.width,
      height: naturalContainGeometry.height
    });

    $(element).attr('width', containGeometry.width).attr('height', containGeometry.height);
  },
  setNaturalDimensions: function(naturalDimensions, geometry) {
    if (typeof naturalDimensions.naturalWidth === 'function') {
      naturalDimensions.naturalWidth(geometry.width - 0);
    }
    if (typeof naturalDimensions.naturalHeight === 'function') {
      naturalDimensions.naturalHeight(geometry.height - 0);
    }
  },
  getNaturalSize: function(element, src, callback, bindingContext, attempt) {
    var tmpImage = new global.Image();
    tmpImage.src = src;
    if ( callback ) {
      var completeFunc = function() {
        if (tmpImage.naturalWidth > 0 && tmpImage.naturalHeight > 0) {
          ko.bindingHandlers.wysiwygSrc.waitingImages(ko.bindingHandlers.wysiwygSrc.waitingImages() - 1);
          callback({
            width: tmpImage.naturalWidth,
            height: tmpImage.naturalHeight
          });
        } else {
          if ( attempt < 3 ) {
            ko.bindingHandlers.wysiwygSrc.getNaturalSize(element, src, callback, bindingContext, ++attempt);
          } else {
            ko.bindingHandlers.wysiwygSrc.waitingImages(ko.bindingHandlers.wysiwygSrc.waitingImages() - 1);
            if ( bindingContext.$root.notifier && bindingContext.$root.notifier.error ) {
              bindingContext.$root.notifier.error( '<p>WARNING: Could not fetch dimensions for image:<br><br>' + src + '<br><br>Please remove the image from its container and set it again to retry.<br>Outlook may display your email incorrectly without knowing the dimensions!' );
            }
          }
        }
      };
      if (tmpImage.complete) {
        completeFunc();
      } else {
        tmpImage.onerror = tmpImage.onload = completeFunc;
      }
    }
  },
  convertedUrl: function(src, method, width, height, text) {
    var queryParamSeparator = src.indexOf('?') == -1 ? '?' : '&';
    var res = src + queryParamSeparator + "method=" + method + "&width=" + width + (height !== null ? "&height=" + height : '') + (typeof text !== 'undefined' ? "&text=" + text : '');
    return res;
  },
  placeholderUrl: function(plwidth, plheight, pltext) {
    var placeholdersrc = "'http://lorempixel.com/g/'+" + plwidth + "+'/'+" + plheight + "+'/abstract/'+encodeURIComponent(" + pltext + ")";
    // http://placehold.it/200x150.png/cccccc/333333&text=placehold.it#sthash.nA3r26vR.dpuf
    // placeholdersrc = "'http://placehold.it/'+"+width+"+'x'+"+height+"+'.png/cccccc/333333&text='+"+size;
    // placeholdersrc = "'"+converterUtils.addSlashes(defaultValue)+"'";
  },
  update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    var attrValue = ko.utils.unwrapObservable(value.src);
    var placeholderValue = ko.utils.unwrapObservable(value.placeholder);
    var width = ko.utils.unwrapObservable(value.width);
    var height = ko.utils.unwrapObservable(value.height);
    var method = ko.utils.unwrapObservable(value.method);
    var src = null;
    if (!method) method = width > 0 && height > 0 ? 'cover' : 'resize';
    if ((attrValue === false) || (attrValue === null) || (attrValue === undefined) || (attrValue === '')) {
      if (typeof placeholderValue == 'object' && placeholderValue !== null) {
        src = ko.bindingHandlers.wysiwygSrc.placeholderUrl(ko.utils.unwrapObservable(placeholderValue.width), ko.utils.unwrapObservable(placeholderValue.height), placeholderValue.text, (placeholderValue.overrideText !== null ? placeholderValue.overrideText : undefined));
        if (method === 'cover') {
          $(element).css('background', 'url(\'' + src + '\') no-repeat center / cover');
          element.setAttribute('replacedstyle', 'background: url(\'' + src + '\') no-repeat center / cover');
          element.setAttribute('background', src);
        } else {
          element.setAttribute('src', src);
        }
      } else {
        if (method === 'cover') {
          $(element).css('background', null);
          element.removeAttribute('replacedstyle');
          element.removeAttribute('background');
        } else {
          element.removeAttribute('src');
        }
      }
    } else {
      src = ko.bindingHandlers.wysiwygSrc.convertedUrl(attrValue.toString(), method, width, height, (typeof placeholderValue == 'object' && placeholderValue !== null && placeholderValue.overrideText !== null ? placeholderValue.overrideText : undefined));
      if (method === 'cover') {
        $(element).css('background', 'url(\'' + src + '\') no-repeat center / cover');
        element.setAttribute('replacedstyle', 'background: url(\'' + src + '\') no-repeat center / cover');
        element.setAttribute('background', src);
      } else {
        element.setAttribute('src', src);
      }
    }

    if (typeof width !== 'undefined' && width !== null) {
      if (method === 'cover') {
        $(element).css('width', width + 'px');
        element.setAttribute("width", width);
      } else if (method === 'resize' || method === 'mso-contain') {
        element.setAttribute("width", width);
      } else if (method === 'contain') {
        element.removeAttribute("width");
      }
    } else {
      if (method === 'cover') {
        $(element).css('width', null);
      } else if (method === 'resize' || method === 'contain' || method === 'mso-contain') {
        element.removeAttribute("width");
      }
    }

    if (typeof height !== 'undefined' && height !== null) {
      if (method === 'cover') {
        $(element).css('height', height + 'px');
        element.setAttribute("height", height);
      } else if (method === 'resize' || method === 'mso-contain') {
        element.setAttribute("height", height);
      } else if (method === 'contain') {
        element.removeAttribute("height");
      }
    } else {
      if (method === 'cover') {
        $(element).css('height', '');
      } else if (method === 'resize' || method === 'contain' || method === 'mso-contain') {
        element.removeAttribute("height");
      }
    }

    ko.ignoreDependencies(function(element, src, width, height, method, value, bindingContext) {
      var naturalDimensions = {
        naturalWidth: value.naturalWidth,
        naturalHeight: value.naturalHeight
      };
      var boundingDimensions = {
        width: ko.isObservable(value.width) ? 0 : width - 0,
        height: ko.isObservable(value.height) ? 0 : height - 0
      };
      if (method === 'mso-cover') {
        ko.bindingHandlers.wysiwygSrc.waitingImages(ko.bindingHandlers.wysiwygSrc.waitingImages() + 1);
        ko.bindingHandlers.wysiwygSrc.getNaturalSize(element, src, ko.bindingHandlers.wysiwygSrc.cover.bind(ko.bindingHandlers.wysiwygSrc, element, width, height, naturalDimensions, boundingDimensions, bindingContext), bindingContext, 1);
      } else if (method == 'mso-contain') {
        ko.bindingHandlers.wysiwygSrc.waitingImages(ko.bindingHandlers.wysiwygSrc.waitingImages() + 1);
        ko.bindingHandlers.wysiwygSrc.getNaturalSize(element, src, ko.bindingHandlers.wysiwygSrc.contain.bind(ko.bindingHandlers.wysiwygSrc, element, width, height, naturalDimensions, boundingDimensions, bindingContext), bindingContext, 1);
      } else if (method == 'resize') {
        ko.bindingHandlers.wysiwygSrc.setNaturalDimensions(naturalDimensions, boundingDimensions);
      } else {
        ko.bindingHandlers.wysiwygSrc.waitingImages(ko.bindingHandlers.wysiwygSrc.waitingImages() + 1);
        ko.bindingHandlers.wysiwygSrc.getNaturalSize(element, src, function(geometry) {
          element.setAttribute("data-width", geometry.width);
          element.setAttribute("data-height", geometry.height);
        }, bindingContext, 1);
      }
    }, viewModel, [element, src, typeof width !== 'undefined' ? width - 0 : width, typeof height !== 'undefined' ? height - 0 : height, method, value, bindingContext]);
  }
};

ko.bindingHandlers.wysiwygId = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    if ((typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg') && (!element.getAttribute || element.getAttribute('data-ko-wrap') === 'false')) {
      element.parentNode.setAttribute('id', ko.utils.unwrapObservable(valueAccessor()));
    } else {
      element.setAttribute('id', ko.utils.unwrapObservable(valueAccessor()));
    }
  },
  update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    if ((typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg') && (!element.getAttribute || element.getAttribute('data-ko-wrap') === 'false')) {
      element.parentNode.setAttribute('id', ko.utils.unwrapObservable(valueAccessor()));
    } else {
      element.setAttribute('id', ko.utils.unwrapObservable(valueAccessor()));
    }
  }
};
ko.virtualElements.allowedBindings['wysiwygId'] = true;

// used on editable "item" so to bind clicks only in wysiwyg mode.
ko.bindingHandlers.wysiwygClick = {
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var isNotWysiwygMode = (typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg');
    if (!isNotWysiwygMode)
      ko.bindingHandlers.click.init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
  }
};
ko.virtualElements.allowedBindings['wysiwygClick'] = true;

// used on editable "item" so to bind css only in wysiwyg mode.
ko.bindingHandlers.wysiwygCss = {
  update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    var isNotWysiwygMode = (typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg');
    if (!isNotWysiwygMode)
      ko.bindingHandlers.css.update(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
  }
};
ko.virtualElements.allowedBindings['wysiwygCss'] = true;

ko.bindingHandlers.wysiwygImg = {
  makeTemplateValueAccessor: function(valueAccessor, bindingContext) {
    return function() {
      var isWysiwygMode = (typeof bindingContext.templateMode != 'undefined' && bindingContext.templateMode == 'wysiwyg');

      var modelValue = valueAccessor(),
        unwrappedValue = ko.utils.peekObservable(modelValue); // Unwrap without setting a dependency here

      // If unwrappedValue.data is the array, preserve all relevant options and unwrap again value so we get updates
      ko.utils.unwrapObservable(modelValue);

      return {
        'name': isWysiwygMode ? unwrappedValue['_editTemplate'] : unwrappedValue['_template'],
        'templateEngine': ko.nativeTemplateEngine.instance
      };
    };
  },
  'init': function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    return ko.bindingHandlers['template']['init'](element, ko.bindingHandlers['wysiwygImg'].makeTemplateValueAccessor(valueAccessor, bindingContext));
  },
  'update': function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    bindingContext = bindingContext['extend'](valueAccessor());
    return ko.bindingHandlers['template']['update'](element, ko.bindingHandlers['wysiwygImg'].makeTemplateValueAccessor(valueAccessor, bindingContext), allBindings, viewModel, bindingContext);
  }
};
ko.virtualElements.allowedBindings['wysiwygImg'] = true;

// A replacement for tinymce fire method, so to catch annoying exceptions, @see wysiwyg binding code in editor setup-
var _catchingFire = function(event, args) {
  try {
    return this.originalFire.apply(this, arguments);
  } catch (e) {
    console.warn("Cought tinymce exception while firing editor event", event, e);
  }
};


// NOTE: there are issues with the "raw" format and trash left around by tinymce workarounds for contenteditable issues.
// setting "forced_root_block: false" disable the default behaviour of adding a wrapper <p> when needed and this seems to fix many issues in IE.
// also, maybe we should use the "raw" only for the "before SetContent" and instead read the "non-raw" content (the raw content sometimes have data- attributes and too many ending <br> in the code)
ko.bindingHandlers.wysiwyg = {
  debug: false,
  getContentOptions: {},
  useTarget: true,
  currentIndex: 0,
  standardOptions: {},
  // add this class to the element while initializing the editor, by default we show a fade anymation and prevent clicks on that.
  initializingClass: 'wysiwyg-loading',
  removeSelectionOnBlur: true,
  // You can set this to have a wysiwyg-empty class set in your editable element when the text content is empty (strip tags + trim to check this)
  // emptyClass: 'wysiwyg-empty',
  emptyClass: undefined,
  fullOptions: {
    toolbar1: 'bold italic forecolor backcolor hr styleselect removeformat | link unlink | pastetext code',
    //toolbar1: "bold italic | forecolor backcolor | link unlink | hr | pastetext code", // | newsletter_profile newsletter_optlink newsletter_unsubscribe newsletter_showlink";
    //toolbar2: "formatselect fontselect fontsizeselect | alignleft aligncenter alignright alignjustify | bullist numlist",
    // valid_elements: 'strong/b,em/i,*[*]',
    // extended_valid_elements: 'strong/b,em/i,*[*]',
    // Removed: image fullscreen contextmenu 
    // download custom:
    // jquery version con legacyoutput, anchor, code, importcss, link, paste, textcolor, hr, lists
  },
  init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    // TODO ugly, but works...
    ko.bindingHandlers.focusable.init(element);

    // 2018/03/07 investigating on TinyMCE exceptions.
    var doDebug = ko.bindingHandlers.wysiwyg.debug && typeof console.debug == 'function';

    var selectorId;
    if (ko.bindingHandlers.wysiwyg.useTarget) {
      selectorId = '@target_' + (++ko.bindingHandlers['wysiwyg'].currentIndex);
    } else {
      selectorId = element.getAttribute('id');
      if (!selectorId) {
        selectorId = 'wysiwyg_' + (++ko.bindingHandlers['wysiwyg'].currentIndex);
        element.setAttribute('id', selectorId);
      }
    }

    if (ko.bindingHandlers.wysiwyg.initializingClass) {
      element.classList.add(ko.bindingHandlers.wysiwyg.initializingClass);
    }

    ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
      tinymce.remove(thisEditor);
    });

    var value = valueAccessor();

    if (!ko.isObservable(value)) throw "Wysiwyg binding called with non observable";
    if (element.nodeType === 8) throw "Wysiwyg binding called on virtual node, ignoring...." + element.innerHTML;

    var fullEditor = (element.tagName === 'DIV' && $(element).parent().prop("tagName") !== 'A') || element.tagName === 'TD';
    var isSubscriberChange = false;
    var thisEditor;
    var isEditorChange = false;

    var options = {
      inline: true,
      // maybe not needed, but won't hurt.
      hidden_input: false,
      toolbar1: "bold italic",
      // we have to disable preview_styles otherwise tinymce push inline every style it thinks will be applied and this makes the style menu to inherit color/font-family and more.
      preview_styles: false,
      paste_as_text: true,
      language: 'en',
      schema: "html5",
      extended_valid_elements: 'strong/b,em/i,*[*]',
      invalid_styles: {
        'span': 'line-height'
      },
      menubar: false,
      skin: 'gray-flat',
      forced_root_block: false,
      // 2018-03-07: the force_*_newlines are not effective. force_root_block is the property dealing with newlines, now.
      // force_br_newlines: !fullEditor, // we force BR as newline when NOT in full editor
      // force_p_newlines: fullEditor,
      init_instance_callback : function(editor) {
        if (doDebug) console.debug("Editor for selector", selectorId, "is now initialized.");
        if (ko.bindingHandlers.wysiwyg.initializingClass) {
          element.classList.remove(ko.bindingHandlers.wysiwyg.initializingClass);
        }

        // Warn about editing inline elements. Please note that we force wellknown HTML inline element to display as inline-block 
        // in our default style, so this should not happen unless you use unknown elements or you force the display: inline.
        // NOTE: we do this in a setTimeout to let the browser apply the CSS styles to the elements!
        if (typeof console.debug == 'function') {
          var elementStyle = element.currentStyle ? element.currentStyle.display : global.getComputedStyle(element, null).display;
          if (elementStyle == 'inline') {
            console.debug("Initializing an editor on an inline element: please note that while it may work, this is unsupported because of a multitude of browser issues", element.tagName, elementStyle, selectorId);
          }
        }

      },
      setup: function(editor) {
        if (doDebug) console.debug("Editor for selector", selectorId, "is now in the setup phase.");

        var emptyClassHandler = function() {
          var textContent = (element.textContent || element.innerText || "").trim();
          if (textContent.length == 0) {
            element.classList.add(ko.bindingHandlers.wysiwyg.emptyClass);
          } else {
            element.classList.remove(ko.bindingHandlers.wysiwyg.emptyClass);
          }
        };

        var changeHandler = function(curContent) {
          if (!isSubscriberChange) {
            try {
              if (ko.utils.unwrapObservable(value) !== curContent) {
                isEditorChange = true;
                value(curContent);
              }
            } catch (e) {
              console.warn("Unexpected error setting content value for", selectorId, e);
            } finally {
              isEditorChange = false;
            }
          }
          if (ko.bindingHandlers.wysiwyg.emptyClass) emptyClassHandler();
        };

        editor.on('setcontent', function(event) {
          if (event.format === 'html' && event.content) {
            changeHandler(event.content);
          }
        });

        editor.on('change keyup undo redo', function() {
          // This used to be 'raw' trying to keep simmetry with the setContent (see BeforeSetContent below)
          // We moved this to a binding option so that this can be changed. We found that using 'raw' the field is often
          // not emptied and full of tags used by tinymce as workaround.
          // In future we'll probably change the default to "non raw", but at this time we keep this as an option
          // in order to keep backward compatibility.
          changeHandler(editor.getContent(ko.bindingHandlers.wysiwyg.getContentOptions));
        });

        // Clicking on the element on focus change allow the "click" code to be triggered and propagate the selection.
        // Not elegant, maybe we have better options.
        editor.on('focus', function() {
          var wysiwygClick = allBindingsAccessor.get('wysiwygClick');
          if (typeof wysiwygClick === 'function') {
            wysiwygClick();
          }
          bindingContext.$root.selectEditable(value);
        });

        editor.on('blur', function() {
          bindingContext.$root.selectEditable(null);
          // Make this an option, default to true, but we let users revert the behaviour to pre 0.17.2 release by
          // setting ko.bindingHandlers.wysiwyg.removeSelectionOnBlur to false
          if (ko.bindingHandlers.wysiwyg.removeSelectionOnBlur) {
            global.getSelection().removeAllRanges();
          }
        });

        // NOTE: this fixes issue with "leading spaces" in default content that were lost during initialization.
        editor.on('BeforeSetContent', function(args) {
          if (args.initial) args.format = 'raw';
        });

        editor.on('init', function() {
          ko.computed(function() {
            if (thisEditor.getDoc() !== null) {
              switch (bindingContext.$root.lockDownMode()) {
                case 2:
                  if (value._locked()) {
                    thisEditor.hide();
                  } else {
                    thisEditor.show();
                  }
                  break;
                case 3:
                  thisEditor.hide();
                  break;
                default:
                  thisEditor.show();
                  break;
              }
            }
          }, null, {
            disposeWhenNodeIsRemoved: element
          });
        });

        // Tinymce doesn't catch exceptions, let's wrap the fire.
        if (typeof editor.originalFire == 'undefined') {
          editor.originalFire = editor.fire;
          editor.fire = _catchingFire;
        }

        thisEditor = editor;

      }
    };

    // we used to use selector but now we also support target (so to not require an ID) as init method.
    if (ko.bindingHandlers.wysiwyg.useTarget) {
      options.target = element;
    } else {
      options.selector = '#' + selectorId;
    }

    ko.utils.extend(options, ko.bindingHandlers.wysiwyg.standardOptions);
    if (fullEditor) ko.utils.extend(options, ko.bindingHandlers.wysiwyg.fullOptions);

    // we have to put initialization in a settimeout, otherwise switching from "1" to "2" columns blocks
    // will start the new editors before disposing the old ones and IDs get temporarily duplicated.
    // using setTimeout the dispose/create order is correct on every browser tested.
    global.setTimeout(function() {
      if (doDebug) console.debug("Editor for selector", selectorId, "is being inizialized ...");
      var res = tinymce.init(options);
      if (doDebug) console.debug("Editor for selector", selectorId, "init has just been called returning", res);
      res.then(function() {
        if (doDebug) console.debug("Editor for selector", selectorId, "init promise has resolved.");
      }, function(failure) {
        console.log("Editor for selector", selectorId, "init promise has failed.", failure);
    });
    });

    ko.computed(function() {
      var content = ko.utils.unwrapObservable(valueAccessor());
      if (!isEditorChange) {
        try {
          isSubscriberChange = true;
          if (typeof thisEditor !== 'undefined') {
            thisEditor.setContent(content, {});
          } else {
            ko.utils.setHtml(element, content);
          }
        } catch (e) {
          console.warn("Exception setting content to editable element", typeof thisEditor, e);
        }
        isSubscriberChange = false;
      }
    }, null, {
      disposeWhenNodeIsRemoved: element
    });

    // do not parse html content for KO bindings!!
    return {
      controlsDescendantBindings: true
    };

  }
};