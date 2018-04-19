"use strict";
/* globals global:false */

var ko = require("knockout");
var console = require("console");
var $ = require("jquery");

ko.bindingHandlers['uniqueId'] = {
  /*base26: function(value) {
    var result = '';
    while (value >= 26) {
        result = String.fromCharCode(value % 26 + 97) + result;
        value =  Math.floor(value / 26);
    }
    return String.fromCharCode(value + 97) + result;
  },*/
  currentIndex: 0,
  'init': function(element, valueAccessor) {
    var data = ko.utils.unwrapObservable(valueAccessor()) || {};
    if (data.id() === '' || data.id().indexOf('ko_') === 0) {
      var id, el, prefix = 'k_';
      // when loading an exising model, IDs could be already assigned.
      do {
        id = prefix + (++ko.bindingHandlers['uniqueId'].currentIndex).toString(36);
        el = global.document.getElementById(id);
        if (el) {
          // when loading an existing model my "currentIndex" is empty.
          // but we have existing blocks, so I must be sure I don't reuse their IDs.
          // We use different prefixes (per block type) so that a hidden block 
          // (for which we have no id in the page, e.g: preheader in versafix-1)
          // will break everthing once we reuse its name.
        }
      } while (el);
      data.id(id);
    }
  }
};
ko.virtualElements.allowedBindings['uniqueId'] = true;

ko.bindingHandlers['virtualAttr'] = {
  update: function(element) {
    if (element.nodeType !== 8) {
      ko.bindingHandlers['attr'].update.apply(this, arguments);
    }
  }
};
ko.virtualElements.allowedBindings['virtualAttr'] = true;

ko.bindingHandlers['virtualAttrStyle'] = {
  update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    if (element.nodeType !== 8) {
      // In "preview" we also set "replacedstyle" so to have an attribute to be used by IE (IE breaks the STYLE) to do the export.
      var isNotWysiwygMode = (typeof bindingContext.templateMode == 'undefined' || bindingContext.templateMode != 'wysiwyg');
      var attrs = ["style"];
      if (isNotWysiwygMode) attrs.push("replacedstyle");
      var attrValue = ko.utils.unwrapObservable(valueAccessor());
      for (var i = 0; i < attrs.length; i++) {
        var attrName = attrs[i];
        var toRemove = (attrValue === false) || (attrValue === null) || (attrValue === undefined);
        if (toRemove)
          element.removeAttribute(attrName);
        else
          element.setAttribute(attrName, attrValue.toString());
      }
    }
  }
};
ko.virtualElements.allowedBindings['virtualAttrStyle'] = true;

ko.bindingHandlers['virtualStyle'] = {
  update: function(element, valueAccessor) {
    if (element.nodeType !== 8) {
      ko.bindingHandlers['style'].update(element, valueAccessor);
    }
  }
};
ko.virtualElements.allowedBindings['virtualStyle'] = true;

ko.bindingHandlers['virtualHtml'] = {
  '_convertEMtoPX': function() {
    try {
      var fontSize = parseFloat($(this).css('font-size'));
      $(this).attr('style', $(this).attr('style').replace(/(([0-9](\.[0-9]*)?)em)/ig, function(match, p1, p2) {
        return parseFloat(p2) * fontSize + 'px';
      }));
    } catch(e) {
      console.warn('Could not convert em to px in virtualHtml binding.', e);
    }
  },
  init: ko.bindingHandlers['html'].init,
  update: function(element, valueAccessor) {
    var parsedNodes = null;
    if (element.nodeType === 8) {
      var html = ko.utils.unwrapObservable(valueAccessor());

      ko.virtualElements.emptyNode(element);
      if ((html !== null) && (html !== undefined)) {
        if (typeof html !== 'string') {
          html = html.toString();
        }

        parsedNodes = ko.utils.parseHtmlFragment(html);
        if (parsedNodes) {
          var endCommentNode = element.nextSibling;
          for (var i = 0, j = parsedNodes.length; i < j; i++)
            endCommentNode.parentNode.insertBefore(parsedNodes[i], endCommentNode);
          $(parsedNodes).filter('[style*="em"]').each(ko.bindingHandlers['virtualHtml']._convertEMtoPX);
          $(parsedNodes).find('[style*="em"]').each(ko.bindingHandlers['virtualHtml']._convertEMtoPX);
        }
      }
    } else { // plain node
      ko.bindingHandlers['html'].update(element, valueAccessor);
      $('[style*="em"]', element).each(ko.bindingHandlers['virtualHtml']._convertEMtoPX);
    }

    // Content for virtualHTML must not be parsed by KO, it is simple content.
    return {
      controlsDescendantBindings: true
    };
  }
};
ko.virtualElements.allowedBindings['virtualHtml'] = true;