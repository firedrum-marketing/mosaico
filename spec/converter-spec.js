'use strict';
/* globals describe: false, it: false, expect: false */
/* globals process: false, console: false */

var templateUrlConverter = function(url) {
  return url;
}

describe('Template converter', function() {

  it('should handle basic template conversion', function() {
    var domutils = require('../src/js/converter/domutils.js');

    var modelDef = require('../src/js/converter/model.js');
    var translateTemplate = require('../src/js/converter/parser.js');
    var templates = [];

    var myTemplateCreator = function(htmlOrElement, optionalName, templateMode) {
      templates.push({
        optionalName: optionalName,
        templateMode: templateMode,
        html: typeof htmlOrElement == 'object' ? domutils.getOuterHtml(htmlOrElement) : htmlOrElement
      });
    };

    var html = '<replacedhtml><replacedhead></replacedhead><repleacedbody><div data-ko-container="main"><div data-ko-block="simpleBlock"><div data-ko-editable="text">block1</div></div></div></replacedbody></replacedhtml>';
    var templateDef = translateTemplate('template', html, './basepath/', myTemplateCreator);

    var expectedTemplates = [{
      optionalName: 'template',
      templateMode: 'show',
      html: '<replacedhtml data-bind=""><replacedhead></replacedhead><repleacedbody><div data-bind="block: mainBlocks"></div></repleacedbody></replacedhtml>'
    }, {
      optionalName: 'simpleBlock',
      templateMode: 'show',
      html: '<!-- fd:remove:whitespace --><div data-bind="attr: { id: id }, uniqueId: $data"><div data-bind="wysiwygId: \'e_\'+(++Mosaico.ko.bindingHandlers.wysiwyg.currentIndex), wysiwygClick: function(obj, evt) { $root.selectItem(text, $data); return false }, clickBubble: false, wysiwygCss: { selecteditem: $root.isSelectedItem(text) }, scrollIntoView: $root.isSelectedItem(text), wysiwygOrHtml: text"></div></div><!-- fd:remove:whitespace -->'
    }];

    expect(templates).toEqual(expectedTemplates);

    var model = modelDef.generateResultModel(templateDef);

    var expectedModel = {
      type: 'template',
      mainBlocks: {
        type: 'blocks',
        blocks: []
      },
      theme: {
        type: 'theme',
        bodyTheme: null
      }
    };

    expect(model).toEqual(expectedModel);

    // TODO verify template "defs" output
    // console.log("RESULT", templateDef);
  });

  it('should handle versafix-1 template conversion', function() {
    var domutils = require('../src/js/converter/domutils.js');

    var modelDef = require('../src/js/converter/model.js');
    var translateTemplate = require('../src/js/converter/parser.js');
    var templates = [];

    var myTemplateCreator = function(htmlOrElement, optionalName, templateMode) {
      templates.push({
        optionalName: optionalName,
        templateMode: templateMode,
        html: typeof htmlOrElement == 'object' ? domutils.getOuterHtml(htmlOrElement) : htmlOrElement
      });
    };

    var fs = require('fs');

    var templatecode = "" + fs.readFileSync("spec/data/template-versafix-1.html");
    var res = templatecode.match(/^([\S\s]*)([<]html[^>]*>[\S\s]*<\/html>)([\S\s]*)$/i);
    if (res === null) throw "Unable to find <html> opening and closing tags in the template";
    var html = res[2].replace(/(<\/?)(html|head|body)([^>]*>)/gi, function(match, p1, p2, p3) {
      return p1 + 'replaced' + p2 + p3;
    });

    var templateDef = translateTemplate('template', html, templateUrlConverter, myTemplateCreator);
    var model = modelDef.generateResultModel(templateDef);

    var expectedModel = JSON.parse("" + fs.readFileSync("spec/data/template-versafix-1.model.json"));

    expect(model).toEqual(expectedModel);
  });

});