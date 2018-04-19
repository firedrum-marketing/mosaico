"use strict";
/* global global: false, Image: false */

var $ = require("jquery");
require('jquery-ui');
var ko = require("knockout");
var console = require("console");
var performanceAwareCaller = require("./timed-call.js").timedCall;
var url = require("url");
var querystring = require("querystring");

var clearFromCache = require("./clear-from-browserify-cache.js");

function initializeEditor(content, blockDefs, thumbPathConverter, galleryUrl) {

  var viewModel = {
    showGallery: ko.observable(false),
    galleryRecent: ko.observableArray([]).extend({
      paging: 16
    }),
    galleryRemote: ko.observableArray([]).extend({
      paging: 16
    }),
    selectedBlock: ko.observable(null),
    selectedItem: ko.observable(null),
    selectedEditable: ko.observable(null),
    selectedTool: ko.observable(0),
    selectedImageTab: ko.observable(0),
    dragging: ko.observable(false),
    draggingImage: ko.observable(false),
    galleryLoaded: ko.observable(false),
    showPreviewFrame: ko.observable(false),
    previewMode: ko.observable('mobile'),
    showToolbox: ko.observable(true),
    showTheme: ko.observable(false),
    debug: ko.observable(false),
    contentListeners: ko.observable(0),
    logoPath: 'rs/img/mosaico32.png',
    logoUrl: '.',
    logoAlt: 'mosaico',
	lockDownMode: ko.observable(0),
    standardFonts: ko.observableArray([
      {
        label: 'Arial',
        value: 'Arial, Helvetica, sans-serif'
      },
      {
        label: 'Arial Black',
        value: 'Arial Black, Gadget, sans-serif'
      },
      {
        label: 'Comic Sans',
        value: 'Comic Sans MS, cursive, sans-serif'
      },
      {
        label: 'Courier New',
        value: 'Courier New, Courier, monospace'
      },
      {
        label: 'Geneva',
        value: 'Geneva, Arial, Helvetica, sans-serif'
      },
      {
        label: 'Georgia',
        value: 'Georgia, serif'
      },
      {
        label: 'Impact',
        value: 'Impact, Charcoal, sans-serif'
      },
      {
        label: 'Lucida Console',
        value: 'Lucida Console, Monaco, monospace'
      },
      {
        label: 'Lucida Sans',
        value: 'Lucida Sans Unicode, Lucida Grande, sans-serif'
      },
      {
        label: 'Lucida Typewriter',
        value: 'Lucida Sans Typewriter, sans-serif'
      },
      {
        label: 'Palatino Linotype',
        value: 'Palatino Linotype, Book Antiqua, Palatino, serif'
      },
      {
        label: 'Tahoma',
        value: 'Tahoma, Geneva, sans-serif'
      },
      {
        label: 'Times New Roman',
        value: 'Times New Roman, Times, serif'
      },
      {
        label: 'Trebuchet MS',
        value: 'Trebuchet MS, Helvetica, sans-serif'
      },
      {
        label: 'Verdana',
        value: 'Verdana, Geneva, sans-serif'
      }
    ]),
	customFonts: ko.observableArray([
      {
        label: 'Arvo',
        value: 'Arvo, Courier, Georgia, serif'
      },
      {
        label: 'Cormorant Garamond',
        value: 'Cormorant Garamond, Times New Roman, serif'
      },
      {
        label: 'Dancing Script',
        value: 'Dancing Script, Comic Sans MS, Comic Sans MS5, cursive'
      },
      {
        label: 'Lato',
        value: 'Lato, Helvetica Neue, Helvetica, Arial, sans-serif'
      },
      {
        label: 'Lora',
        value: 'Lora, Georgia, Times New Roman, serif'
      },
      {
        label: 'Merriweather',
        value: 'Merriweather, Georgia, Times New Roman, serif'
      },
      {
        label: 'Merriweather Sans',
        value: 'Merriweather Sans, Helvetica Neue, Helvetica, Arial, sans-serif'
      },
      {
        label: 'Noticia Text',
        value: 'Noticia Text, Georgia, Times New Roman, serif'
      },
      {
        label: 'Open Sans',
        value: 'Open Sans, Helvetica Neue, Helvetica, Arial, sans-serif'
      },
      {
        label: 'Playfair Display',
        value: 'Playfair Display, Georgia, Times New Roman, serif'
      },
      {
        label: 'Roboto',
        value: 'Roboto, Helvetica Neue, Helvetica, Arial, sans-serif'
      },
      {
        label: 'Roboto Mono',
        value: 'Roboto Mono, Lucida Console, Monaco, monospace'
      },
      {
        label: 'Source Sans Pro',
        value: 'Source Sans Pro, Helvetica Neue, Helvetica, Arial, sans-serif'
      }
    ])
  };
  viewModel.allFonts = ko.pureComputed(function() {
    return this.standardFonts().concat(this.customFonts());
  }, viewModel);
  viewModel.allFontsOptionsAfterRender = function(option, item) {
    if (viewModel.standardFonts.indexOf(item) === 0) {
      $(option).before('<optgroup label="Standard Web Fonts"></optgroup><optgroup label="━━━━━━━━━"></optgroup>');
    } else if (viewModel.customFonts.indexOf(item) === 0) {
      $(option).before((viewModel.standardFonts().length > 0 ? '<optgroup label=""></optgroup>' : '') + '<optgroup label="Custom Web Fonts"></optgroup><optgroup label="━━━━━━━━━"></optgroup>');
    }
    ko.applyBindingsToNode(option, {style: {fontFamily: item.value}}, item);
  };

  // viewModel.content = content._instrument(ko, content, undefined, true);
  viewModel.content = content;
  viewModel.blockDefs = blockDefs;

  viewModel.notifier = require("toastr");
  viewModel.notifier.options = {
    "closeButton": false,
    "debug": false,
    "positionClass": "toast-bottom-full-width",
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "target": "#mo-body",
    "timeOut": "5000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  };
  clearFromCache( viewModel.notifier );

  // Does token substitution in i18next style
  viewModel.tt = function(key, paramObj) {
    if (typeof paramObj !== 'undefined')
      for (var prop in paramObj)
        if (paramObj.hasOwnProperty(prop)) {
          key = key.replace(new RegExp('__' + prop + '__', 'g'), paramObj[prop]);
        }
    return key;
  };

  // Simply maps to tt: language plugins can override this method to define their own language
  // handling.
  // If this method invokes an observable (e.g: viewModel.lang()) then the UI language will automatically
  // update when the "lang" observable changes.
  viewModel.t = viewModel.tt;

  // currently called by editor.html to translate template-defined keys (label, help, descriptions)
  // the editor always uses the "template" category for that strings.
  // you can override this method as you like in order to provide translation or change the strings in any way.
  viewModel.ut = function(category, key) {
    return key;
  };

  viewModel.templatePath = thumbPathConverter;

  viewModel.remoteUrlProcessor = function(url) {
    return url;
  };

  viewModel.remoteFileProcessor = function(fileObj) {
    if (typeof fileObj.url !== 'undefined') fileObj.url = viewModel.remoteUrlProcessor(fileObj.url);
    if (typeof fileObj.thumbnailUrl !== 'undefined') fileObj.thumbnailUrl = viewModel.remoteUrlProcessor(fileObj.thumbnailUrl);
    // deleteUrl?
    return fileObj;
  };

  // toolbox.tmpl.html
  viewModel.loadGallery = function() {
    viewModel.galleryLoaded('loading');
    var url = galleryUrl ? galleryUrl : '/upload/';
    // retrieve the full list of remote files
    $.getJSON(url, function(data) {
      for (var i = 0; i < data.files.length; i++) data.files[i] = viewModel.remoteFileProcessor(data.files[i]);
      viewModel.galleryLoaded(data.files.length);
      // TODO do I want this call to return relative paths? Or just absolute paths?
      viewModel.galleryRemote(data.files.reverse());
    }).fail(function() {
      viewModel.galleryLoaded(false);
      viewModel.notifier.error(viewModel.t('Unexpected error listing files'));
    });
  };

  // img-wysiwyg.tmpl.html
  viewModel.fileToImage = function(obj, event, ui) {
    // console.log("fileToImage", obj);
    return obj.url;
  };

  // block-wysiwyg.tmpl.html
  viewModel.removeBlock = function(data, parent) {
    // let's unselect the block
    if (ko.utils.unwrapObservable(viewModel.selectedBlock) == ko.utils.unwrapObservable(data)) {
      viewModel.selectBlock(null, true);
    }
    var res = parent.blocks.remove(data);
    // TODO This message should be different depending on undo plugin presence.
    viewModel.notifier.info(viewModel.t('Block removed: use undo button to restore it...'));
    return res;
  };

  // block-wysiwyg.tmpl.html
  viewModel.duplicateBlock = function(index, parent) {
    var idx = ko.utils.unwrapObservable(index);
    // Deinstrument/deobserve the object
    var unwrapped = ko.toJS(ko.utils.unwrapObservable(parent.blocks)[idx]);
    // We need to remove the id so that a new one will be assigned to the clone
    if (typeof unwrapped.id !== 'undefined') unwrapped.id = '';
    // insert the cloned block
    parent.blocks.splice(idx + 1, 0, unwrapped);
  };

  // block-wysiwyg.tmpl.html
  viewModel.moveBlock = function(index, parent, up) {
    var idx = ko.utils.unwrapObservable(index);
    var parentBlocks = ko.utils.unwrapObservable(parent.blocks);
    var lockDownMode = ko.utils.unwrapObservable(viewModel.lockDownMode);
    var curBlock = parentBlocks[idx];
    var destIndex = ko.utils.unwrapObservable(curBlock).getNearestUnlockedIndex(up);
    if (destIndex > -1) {
      viewModel.startMultiple();
      parent.blocks.splice(idx, 1);
      parent.blocks.splice(destIndex, 0, curBlock);
      viewModel.stopMultiple();
    }
  };

  // test method, command line use only
  viewModel.loadDefaultBlocks = function() {
    // cloning the whole "mainBlocks" object so that undomanager will
    // see it as a single operation (maybe I could use "startMultiple"/"stopMultiple".
    var res = ko.toJS(viewModel.content().mainBlocks);
    res.blocks = [];
    var input = ko.utils.unwrapObservable(viewModel.blockDefs);
    for (var i = 0; i < input.length; i++) {
      var obj = ko.toJS(input[i]);
      // generating ids for blocks, maybe this would work also leaving it empty.
      obj.id = 'block_' + i;
      res.blocks.push(obj);
    }
    performanceAwareCaller('setMainBlocks', viewModel.content().mainBlocks._wrap.bind(viewModel.content().mainBlocks, res));
  };

  // gallery-images.tmpl.html
  viewModel.addImage = function(img) {
    var selectedImg = $('#main-wysiwyg-area .selectable-img.selecteditem', (this.mosaicoConfig && this.mosaicoConfig.mainElement) || global.document.body);
    if (selectedImg.length == 1 && typeof img == 'object' && typeof img.url !== 'undefined') {
      var context = ko.contextFor(selectedImg[0]);
      if (viewModel.lockDownMode() < 2 || (viewModel.lockDownMode() === 2 && !context._src._locked())) {
        context._src(img.url);
      }
      return true;
    } else {
      return false;
    }
  };

  // toolbox.tmpl.html
  viewModel.addBlock = function(obj, event) {
    // if there is a selected block we try to add the block just after the selected one, otherwise we try to add to the bottom.
    var selected = viewModel.selectedBlock();
    // search the selected block position.
    if (selected === null) {
      // TODO "mainBlocks" is a hardcoded thing.
      selected = viewModel.content().mainBlocks().blocks().slice(-1)[0];
      if (typeof selected !== 'undefined') {
        // Use the block to search for unlocked regions
        selected = ko.utils.unwrapObservable(selected);
      } else {
        // Empty content area
        selected = null;
      }
    }

    var pos = 0;
    if (selected !== null) {
      pos = selected.getNearestUnlockedIndex();
    } else if (viewModel.lockDownMode() === 3) {
      pos = -1;
    }

    if (pos > -1) {
      viewModel.content().mainBlocks().blocks.splice(pos, 0, obj);
      viewModel.notifier.info(viewModel.t('New block added at position __pos__.', {
        pos: pos + 1
      }));

      // Find the newly added block and select it!
      var added = viewModel.content().mainBlocks().blocks()[pos]();
      viewModel.selectBlock(added, true);
    } else {
      viewModel.notifier.error(viewModel.t('New blocks cannot be inserted into a fully locked template.'));
    }

    // prevent click propagation (losing url hash - see #43)
    return false;
  };

  // Used by stylesheet.js to create multiple styles
  viewModel.findObjectsOfType = function(data, type) {
    var res = [];
    var obj = ko.utils.unwrapObservable(data);
    for (var prop in obj)
      if (obj.hasOwnProperty(prop)) {
        var val = ko.utils.unwrapObservable(obj[prop]);
        // TODO this is not the right way to deal with "block list" objects.
        if (prop.match(/Blocks$/)) {
          var contents = ko.utils.unwrapObservable(val.blocks);
          for (var i = 0; i < contents.length; i++) {
            var c = ko.utils.unwrapObservable(contents[i]);
            if (type === null || ko.utils.unwrapObservable(c.type) == type) res.push(c);
          }
          // TODO investigate which condition provide a null value.
        } else if (typeof val == 'object' && val !== null) {
          if (type === null || ko.utils.unwrapObservable(val.type) == type) res.push(val);
        }
      }
    return res;
  };

  /*
  viewModel.placeholderHelper = 'sortable-placeholder';
  if (false) {
    viewModel.placeholderHelper = {
      element: function(currentItem) {
        return $('<div />').removeClass('ui-draggable').addClass('sortable-placeholder').css('position', 'relative').css('width', '100%').css('height', currentItem.css('height')).css('opacity', '.8')[0];
      },
      update: function(container, p) {
       return;
      }
    };
  }
  */

  // Attempt to insert the block in the destination layout during dragging
  viewModel.placeholderHelper = {
    element: function(currentItem) {
      return $(currentItem[0].outerHTML).removeClass('ui-draggable').addClass('sortable-placeholder').css('display', 'block').css('position', 'relative').css('width', '100%').css('height', 'auto').css('opacity', '.8')[0];
    },
    update: function(container, p) {
      return;
    }
  };

  // TODO the undumanager should be pluggable.
  // Used by "moveBlock" and blocks-wysiwyg.tmpl.html to "merge" drag/drop operations into a single undo/redo op.
  viewModel.startMultiple = function() {
    if (typeof viewModel.setUndoModeMerge !== 'undefined') viewModel.setUndoModeMerge();
  };
  viewModel.stopMultiple = function() {
    if (typeof viewModel.setUndoModeOnce !== 'undefined') viewModel.setUndoModeOnce();
  };

  // Used by code generated by editor.js 
  viewModel.localGlobalSwitch = function(prop, globalProp) {
    var current = prop();
    if (current === null) prop(globalProp());
    else prop(null);
    return false;
  };

  // Used by editor and main "converter" to support item selection
  viewModel.selectItem = function(valueAccessor, item, block) {
    var blocksIndex = (typeof viewModel.envelope !== 'undefined' ? 1 : 0);
    var val = ko.utils.peekObservable(valueAccessor);
    if (typeof block !== 'undefined') viewModel.selectBlock(block, val != item, true);
    if (val != item) {
      valueAccessor(item);
      // On selectItem if we were not on either the "Content" or "Style" toolbox tab, move to either the "Content" or "Style" toolbox tab.
      if (item !== null) {
        if (viewModel.selectedTool() <= blocksIndex) {
          viewModel.selectedTool( typeof block === 'undefined' ? blocksIndex + 2 : blocksIndex + 1 );
        }
      }
    }
    return false;
  }.bind(viewModel, viewModel.selectedItem);

  // Used by editor and main "converter" to support editable selection
  viewModel.selectEditable = function(valueAccessor, editable, block) {
    var val = ko.utils.peekObservable(valueAccessor);
    if (val != editable) {
      valueAccessor(editable);
    }
    return false;
  }.bind(viewModel, viewModel.selectedEditable);

  viewModel.isSelectedItem = function(item) {
    return viewModel.selectedItem() == item;
  };

  viewModel.selectBlock = function(valueAccessor, item, doNotSelect, doNotUnselectItem) {
    var blocksIndex = (typeof viewModel.envelope !== 'undefined' ? 1 : 0);
    var val = ko.utils.peekObservable(valueAccessor);
    if (!doNotUnselectItem) viewModel.selectItem(null);
    if (val != item) {
      valueAccessor(item);
      // hide gallery on block selection
      viewModel.showGallery(false);
      if (item !== null && !doNotSelect && viewModel.selectedTool() <= blocksIndex) viewModel.selectedTool(blocksIndex + (!doNotUnselectItem ?  2 : 1));
    }
  }.bind(viewModel, viewModel.selectedBlock);

  // DEBUG
  viewModel.countSubscriptions = function(model, debug) {
    var res = 0;
    for (var prop in model)
      if (model.hasOwnProperty(prop)) {
        var p = model[prop];
        if (ko.isObservable(p)) {
          if (typeof p._defaultComputed != 'undefined') {
            if (typeof debug != 'undefined') console.log(debug + "/" + prop + "/_", p._defaultComputed.getSubscriptionsCount());
            res += p._defaultComputed.getSubscriptionsCount();
          }
          if (typeof debug != 'undefined') console.log(debug + "/" + prop + "/-", p.getSubscriptionsCount());
          res += p.getSubscriptionsCount();
          p = ko.utils.unwrapObservable(p);
        }
        if (typeof p == 'object' && p !== null) {
          var tot = viewModel.countSubscriptions(p, typeof debug != 'undefined' ? debug + '/' + prop + "@" : undefined);
          if (typeof debug != 'undefined') console.log(debug + "/" + prop + "@", tot);
          res += tot;
        }
      }
    return res;
  };

  // DEBUG
  viewModel.loopSubscriptionsCount = function() {
    var count = viewModel.countSubscriptions(viewModel.content());
    global.document.getElementById('subscriptionsCount').innerHTML = count;
    global.setTimeout(viewModel.loopSubscriptionsCount, 1000);
  };

  viewModel.export = function(callback) {
    performanceAwareCaller("exportHTML", viewModel.exportHTML, {
      callbacks: [0],
      args: [callback]
    });
  };

  function conditional_restore(html) {
    return html.replace(/<replacedcc[^>]* condition="([^"]*)"[^>]*>([\s\S]*?)<\/replacedcc>/g, function(match, condition, body) {
      var dd = '<!--[if '+condition.replace(/&amp;/, '&')+']>';
      dd += body.replace(/<!-- cc:bc:([A-Za-z:]*) -->(<\/cc>)?<!-- cc:ac:\1 -->/g, '</$1>') // restore closing tags (including lost tags)
            .replace(/><\/cc><!-- cc:sc -->/g, '/>') // restore selfclosing tags
            .replace(/<!-- cc:bo:([A-Za-z:]*) --><cc/g, '<$1') // restore open tags
            .replace(/^.*<!-- cc:start -->/,'') // remove content before start
            .replace(/<!-- cc:end -->.*$/,''); // remove content after end
      dd += '<![endif]-->';
      return dd;
    }).replace(/<!-- ccr:start:(.*?) -->([\s\S]*?)<!-- ccr:end -->/g, function(match, condition, body) {
      return '<!--[if '+condition+']><!-->'+body+'<!--<![endif]-->';
    });
  }

  viewModel.getDataUri = function(url, callback) {
    var image = new Image();
    image.onload = function () {
      var canvas = global.document.createElement('canvas');
      canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
      canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size
      canvas.getContext('2d').drawImage(this, 0, 0);
      // Get raw image data
      callback(canvas.toDataURL('image/png').replace(/^data:image\/[^;]+;base64,/, ''));
    };
    image.src = url;
  };

  viewModel.exportHTML = function(callback) {
    var beginExport = function(searchContext, id) {
      var frameEl = global.document.getElementById(id);
      if (frameEl === null) {
          $('body').append('<iframe id="' + id + '"></iframe>');
          frameEl = global.document.getElementById(id);
      }

      // Prevent issue in Chrome (and maybe other WebKit?) where removing an iframe from the DOM that has been bound to the viewmodel blanks out images in the main editor and preview panes
      frameEl.contentWindow.document.write( ko.bindingHandlers.bindIframe.tplDoctype + $('#main-preview iframe', searchContext)[0].contentWindow.document.documentElement.outerHTML );
      frameEl.contentWindow.document.close();

      if (viewModel.inline) viewModel.inline(frameEl.contentWindow.document);

      var completeExport = function() {
        // Obsolete method didn't work on IE11 when using "HTML5 doctype":
        // var docType = new XMLSerializer().serializeToString(global.document.doctype);
        var docType = "";
        var node = frameEl.contentWindow.document.doctype;
        docType = "<!DOCTYPE " + node.name +
          (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '') +
          (!node.publicId && node.systemId ? ' SYSTEM' : '') +
          (node.systemId ? ' "' + node.systemId + '"' : '') + '>';

        var webFontSupportTagsTemp = [], webFontSupportTags = $('.mo-web-font-support', frameEl.contentWindow.document.documentElement), i;
		for (i = 0; i < webFontSupportTags.length; i++) {
          webFontSupportTagsTemp.push($(frameEl.contentWindow.document.createTextNode('')));
          $(webFontSupportTags[i]).replaceWith(webFontSupportTagsTemp[i]);
        }

        var content = docType + '\n' + frameEl.contentWindow.document.documentElement.outerHTML;

        var neededWebFonts = viewModel.neededWebFonts( content );
		if (neededWebFonts.length > 0) {
          var webFontTags = '<!--[if !mso]><!--><link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin="crossorigin"><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=', contentHead = $( 'head', frameEl.contentWindow.document.documentElement );
          for (i = 0; i < neededWebFonts.length; i++) {
            webFontTags += (i > 0 ? '|' : '') + global.encodeURIComponent(neededWebFonts[i]) + ':400,400i,700,700i';
          }
          webFontTags = $(webFontTags + '"><!--<![endif]-->');
          contentHead.append(webFontTags);
          content = docType + '\n' + frameEl.contentWindow.document.documentElement.outerHTML;
          webFontTags.remove();
        }

        for (i = 0; i < webFontSupportTags.length; i++) {
          webFontSupportTagsTemp[i].replaceWith(webFontSupportTags[i]);
        }

        content = content.replace(/<script ([^>]* )?type="text\/html"[^>]*>[\s\S]*?<\/script>/gm, '');
        // content = content.replace(/<!-- ko .*? -->/g, ''); // sometimes we have expressions like (<!-- ko var > 2 -->)
        content = content.replace(/<!-- ko ((?!--).)*? -->/g, ''); // this replaces the above with a more formal (but slower) solution
        content = content.replace(/<!-- \/ko -->/g, '');
        // Remove data-bind/data-block attributes
        content = content.replace(/ data-bind="[^"]*"/gm, '');
        // Remove trash leftover by TinyMCE
        content = content.replace(/ data-mce-(href|src|style)="[^"]*"/gm, '');

        // Replace "replacedstyle" to "style" attributes (chrome puts replacedstyle after style)
        content = content.replace(/ style="[^"]*"([^>]*) replaced(style="[^"]*")/gm, '$1 $2');
        // Replace "replacedstyle" to "style" attributes (ie/ff have reverse order)
        content = content.replace(/ replaced(style="[^"]*")([^>]*) style="[^"]*"/gm, ' $1$2');
        content = content.replace(/ replaced(style="[^"]*")/gm, ' $1');

        // same as style, but for http-equiv (some browser break it if we don't replace, but then we find it duplicated)
        content = content.replace(/ http-equiv="[^"]*"([^>]*) replaced(http-equiv="[^"]*")/gm, '$1 $2');
        content = content.replace(/ replaced(http-equiv="[^"]*")([^>]*) http-equiv="[^"]*"/gm, ' $1$2');
        content = content.replace(/ replaced(http-equiv="[^"]*")/gm, ' $1');

        // We already replace style and http-equiv and we don't need this.
        // content = content.replace(/ replaced([^= ]*=)/gm, ' $1');
        // Restore conditional comments
        content = conditional_restore(content);
        var trash = content.match(/ data-[^ =]+(="[^"]+")? /) || content.match(/ replaced([^= ]*=)/);
        if (trash) {
          console.warn("Output HTML contains unexpected data- attributes or replaced attributes", trash);
        }

        return content;
      };
      
      callback(frameEl.contentWindow.document.documentElement, url, querystring, completeExport );
    };
    
    if (ko.bindingHandlers.wysiwygSrc.waitingImages() > 0) {
      var subscription = ko.bindingHandlers.wysiwygSrc.waitingImages.subscribe(function(newValue) {
        if (newValue === 0) {
          beginExport( (viewModel.mosaicoConfig && viewModel.mosaicoConfig.mainElement) || global.document.body, (viewModel.mosaicoConfig && viewModel.mosaicoConfig.mainElement && viewModel.mosaicoConfig.mainElement.id ? viewModel.mosaicoConfig.mainElement.id + '_' : '') + 'exportframe' );
          subscription.dispose();
        }
      });
    } else {
      beginExport( (viewModel.mosaicoConfig && viewModel.mosaicoConfig.mainElement) || global.document.body, (viewModel.mosaicoConfig && viewModel.mosaicoConfig.mainElement && viewModel.mosaicoConfig.mainElement.id ? viewModel.mosaicoConfig.mainElement.id + '_' : '') + 'exportframe' );
    }
  };

  viewModel.exportHTMLtoTextarea = function(textareaid, textareaReadyCallback) {
    viewModel.exportHTML(function(documentElement, url, querystring, callback) {
      $(textareaid).val(callback());
      textareaReadyCallback();
    });
  };

  viewModel.exportJSONtoTextarea = function(textareaid) {
    $(textareaid).val(viewModel.exportJSON());
  };

  viewModel.importJSONfromTextarea = function(textareaid) {
    viewModel.importJSON($(textareaid).val());
  };

  viewModel.exportMetadata = function() {
    var json = ko.toJSON(viewModel.metadata);
    return json;
  };

  viewModel.exportMetadataJS = function() {
    return ko.toJS(viewModel.metadata);
  };

  viewModel.exportJSON = function() {
    var json = ko.toJSON(viewModel.content);
    return json;
  };

  viewModel.exportJS = function() {
    return ko.toJS(viewModel.content);
  };

  viewModel.importJSON = function(json) {
    var unwrapped = ko.utils.parseJson(json);
    viewModel.content._wrap(unwrapped);
  };

  viewModel.exportTheme = function() {
    var flat = {};
    var mod = viewModel.content().theme();

    var _export = function(prefix, flat, mod) {
      for (var prop in mod)
        if (mod.hasOwnProperty(prop)) {
          var a = ko.utils.unwrapObservable(mod[prop]);
          if (a !== null && typeof a == 'object') {
            _export(prop + '.', flat, a);
          } else {
            flat[prefix + prop] = a;
          }
        }
    };

    _export('', flat, mod);

    var output = '';
    for (var prop in flat)
      if (flat.hasOwnProperty(prop) && prop != 'type') {
        output += prop + ": " + flat[prop] + ";" + "\n";
      }

    return output;
  };

  // moxiemanager (or file browser/imageeditor) extension points.
  // Just implement editImage or linkDialog methods
  // viewModel.editImage = function(src, done) {} : implement this method to enable image editing (src is a wirtableObservable).
  // viewModel.linkDialog = function() {}: implement this method using "this" to find the input element $(this).val is a writableObservable.

  viewModel.loadImage = function(img) {
    // push image at top of "recent" gallery
    viewModel.galleryRecent.unshift(img);
    // select recent gallery tab
    viewModel.selectedImageTab(0);
  };

  // you can ovverride this method if you want to browse images using an external tool
  // if you call _src(yourSrc) you will set a new source for the image.
  viewModel.selectImage = function(_src) {
    viewModel.showGallery(true);
  };

  viewModel.dialog = function(selector, options) {
    $(selector).dialog(options);
  };

  // Dummy log method overridden by extensions
  viewModel.log = function(category, msg) {
    // console.log("viewModel.log", category, msg);
  };

  // Given an array of background colors affecting the foreground color, closest to farthest away, return an appropriately readable foreground color
  viewModel.colorControl = function(foreground, backgrounds, factor) {
    if ( foreground !== null ) {
      if ( typeof factor === 'undefined' ) {
        factor = (this.mosaicoConfig && this.mosaicoConfig.colorReadabilityFactor) || 2;
	  }

      for ( var i = 0; i < backgrounds.length; i++ ) {
        if ( backgrounds[i] === null || backgrounds[i].trim().toLowerCase() === 'transparent' ) {
          continue;
        }

        if ( global.Color.readability( foreground, backgrounds[i] ) <= factor ) {
          if ( global.Color.isReadable( '#FFFFFF', backgrounds[i] ) ) {
            foreground = '#FFFFFF';
          } else {
            foreground = '#000000';
          }
        }
		break;
      }
    }

	return foreground;
  };

  viewModel.neededWebFonts = function(content) {
	var neededFonts = [], customFonts = this.customFonts(), i;
    for ( i = 0; i < customFonts.length; i++ ) {
      if ( content.match(new RegExp('font-family\\s*:\\s*\'?'+customFonts[i].value.split( ',' )[0])) !== null ) {
        neededFonts.push(customFonts[i].label);
      }
    }

    return neededFonts;
  };

  // automatically load the gallery when the gallery tab is selected
  viewModel.selectedImageTab.subscribe(function(newValue) {
    if (newValue == 1 && viewModel.galleryLoaded() === false) {
      viewModel.loadGallery();
    }
  }, viewModel, 'change');

  return viewModel;

}

module.exports = initializeEditor;