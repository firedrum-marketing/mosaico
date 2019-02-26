'use strict';
/* globals describe: false, it: false, expect: false */
/* globals process: false, console: false */

var elaborateDeclarations = require('../src/js/converter/declarations.js').elaborateDeclarations;
var serializeNewBindings = require('../src/js/converter/declarations.js').serializeNewBindings;
var templateUrlConverter = function(url) { return '.'+url; };

var mockedBindingProvider = function(a, b) {
  return "$" + a + "[" + b + "]";
};

describe('Style declaration processor', function() {
  var cssParse = require("mensch/lib/parser.js");
  var cssStringify = require("mensch/lib/stringify.js");

  it('should not lose simple properties after a -ko-property', function() {try{
    var styleSheet, newBindings;
    styleSheet = cssParse('#{color: red; -ko-color: @color; background-color: white}', {
      comments: true,
      position: true
    });
    elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {});
    expect(serializeNewBindings(newBindings)).toEqual("virtualAttrStyle: 'background-color: white; '+'color: '+($color[undefined]())+';'+''");

    styleSheet = cssParse('#{color: red; background-color: white; -ko-color: @color}', {
      comments: true,
      position: true
    });
    elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {});
    expect(serializeNewBindings(newBindings)).toEqual("virtualAttrStyle: 'background-color: white; '+'color: '+($color[undefined]())+';'+''");

  }catch(e){console.log(e)}});

  it('should not mix virtualStyle and virtualAttrStyle bindings', function() {
    var styleSheet, newBindings;
    styleSheet = cssParse('#{-ko-bind-text: @[\'Pulsante\']; -ko-font-family: @face; -ko-color: @color; -ko-font-size: @[size]px; -ko-background-color: @buttonColor; padding-left: 5px; -ko-border-radius: @[radius]px; padding: 5px;}', {
      comments: true,
      position: true
    });
    elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {});
    expect(serializeNewBindings(newBindings)).toEqual("virtualAttrStyle: 'padding: 5px; '+'padding-left: 5px;'+'', text: 'Pulsante', virtualStyle: { backgroundColor: $buttonColor[undefined](), borderRadius: $radius[undefined]()+'px', color: $color[undefined](), fontFamily: $face[undefined](), fontSize: $size[undefined]()+'px' }");
  });

  it('should mantain spaces and ; when removing/replacing declarations', function() {
    var styleSheet, newStyles, newBindings;
    styleSheet = cssParse('#{color: red; -ko-color: @color; background-color: white}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: $color[red]() -->red<!-- /ko -->; background-color: white");

    styleSheet = cssParse('#{color: red;-ko-color: @color;background-color: white}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {}));
    expect(newStyles).toEqual("color: red;color: <!-- ko text: $color[red]() -->red<!-- /ko -->;background-color: white");
  });


  it('should correctly parse multiline declarations', function() {
    var styleSheet, newStyles;
    styleSheet = cssParse('#{\tcolor: red;\n\t-ko-color: @color;\n\tbackground-color: white\n}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: $color[red]() -->red<!-- /ko -->; background-color: white");
  });

  it('should support modifiers', function() {
    var styleSheet, newStyles;
    styleSheet = cssParse('#{width: 10%; -ko-width: @[mywidth]%}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("width: 10%; width: <!-- ko text: $mywidth[10]()+'%' -->10%<!-- /ko -->");

    styleSheet = cssParse('#{width: 10px; -ko-width: @[mywidth]px}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("width: 10px; width: <!-- ko text: $mywidth[10]()+'px' -->10px<!-- /ko -->");

    styleSheet = cssParse('#{src: url(\'path\'); -ko-src: url(\'@myurl\')}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("src: url(\'.path\'); src: <!-- ko text: 'url(\\''+$myurl[.path]()+'\\')' -->url(\'.path\')<!-- /ko -->");

    styleSheet = cssParse('#{src: url("path"); -ko-src: url("@myurl")}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("src: url(\".path\"); src: <!-- ko text: 'url(\"'+$myurl[.path]()+'\")' -->url(\".path\")<!-- /ko -->");

    styleSheet = cssParse('#{src: url(path); -ko-src: url(@myurl)}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("src: url(.path); src: <!-- ko text: 'url('+$myurl[.path]()+')' -->url(.path)<!-- /ko -->");
  });

  it('should be able to remove display: none', function() {
    var styleSheet, newStyles;
    styleSheet = cssParse('#{a: 1; display: none; b: 2}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}, false, undefined, true));
    expect(newStyles).toEqual("a: 1; b: 2");
  });

  it('should support composed properties and hardcoded values', function() {
    var styleSheet, newStyles;
    styleSheet = cssParse('#{border: 1px 2px 3px 4px; -ko-border: @border1 @border2 3px @border4}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("border: 1px 2px 3px 4px; border: <!-- ko text: $border1[1px]()+' '+$border2[2px]()+' 3px '+$border4[4px]() -->1px 2px 3px 4px<!-- /ko -->");
  });

  it('should support conditional properties', function() {
    var styleSheet, newStyles, newBindings;
    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-if: mycondition}', {
      comments: true,
      position: true
    });
    elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {});
    expect(serializeNewBindings(newBindings)).toEqual("virtualAttrStyle: 'color: '+(($mycondition[undefined]()) ? $mycolor[undefined]() : null)+';'+''");

    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-if: mycondition}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: ($mycondition[undefined]()) ? $mycolor[red]() : null -->red<!-- /ko -->; ");
  });

  it('should support simple expressions in conditional properties', function() {
    var styleSheet, newStyles, newBindings;
    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-if: mycondition gt 1 and mycondition lt 3}', {
      comments: true,
      position: true
    });
    elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {});
    expect(serializeNewBindings(newBindings)).toEqual("virtualAttrStyle: 'color: '+(((($mycondition[undefined]() > 1) && ($mycondition[undefined]() < 3))) ? $mycolor[undefined]() : null)+';'+''");

    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-if: mycondition gt 1 and mycondition lt 3}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: ((($mycondition[undefined]() > 1) && ($mycondition[undefined]() < 3))) ? $mycolor[red]() : null -->red<!-- /ko -->; ");

    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-ifnot: mycondition gt 1 and mycondition lt 3}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: !((($mycondition[undefined]() > 1) && ($mycondition[undefined]() < 3))) ? $mycolor[red]() : null -->red<!-- /ko -->; ");

    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-ifnot: mycondition eq "ciao ciao"}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: !(($mycondition[undefined]() == \"ciao ciao\")) ? $mycolor[red]() : null -->red<!-- /ko -->; ");
  });

  it('should support complex expressions in conditional properties', function() {
    var styleSheet, newStyles;
    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-ifnot: mycondition eq "ciao ciao" and mycondition neq "miao" or mycondition lte 1 or Color.lighter(mycondition, "#00000") gte "#CCCCCC"}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: !((((($mycondition[undefined]() == \"ciao ciao\") && ($mycondition[undefined]() != \"miao\")) || ($mycondition[undefined]() <= 1)) || (Color.lighter($mycondition[undefined](), \"#00000\") >= \"#CCCCCC\"))) ? $mycolor[red]() : null -->red<!-- /ko -->; ");

    styleSheet = cssParse('#{color: red; -ko-color: @mycolor; -ko-color-ifnot: !mycondition || true ? myobj.color : "red"}', {
      comments: true,
      position: true
    });
    newStyles = cssStringify(elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, {}));
    expect(newStyles).toEqual("color: red; color: <!-- ko text: !(((!$mycondition[undefined]() || true) ? $myobj.color[undefined]() : \"red\")) ? $mycolor[red]() : null -->red<!-- /ko -->; ");
  });

  it('should expect defaults', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('#{-ko-color: red}', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {});
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Cannot find default/);

    styleSheet = cssParse('#{color: red blue; -ko-color: @a @b @c @d}', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations(styleSheet, templateUrlConverter, mockedBindingProvider, newBindings = {});
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Cannot find default/);
  });

  // TODO the first now works (we support "or") while the seconds raise a different exception.
  it('should raise an exception on unknown tokens in condition expressions', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('color: red; -ko-color: @mycolor; -ko-color-if: mycondition gt 1 xor mycondition lt 3', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Syntax error/);

    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('color: red; -ko-color: @mycolor; -ko-color-if: mycondition gtn 1', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Syntax error/);

  });

  it('should raise an exception on element styles applied with no element', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('-ko-attr-href: @myhref', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Attributes and bind declarations/);

    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('-ko-bind-text: @mytext', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Attributes and bind declarations/);

  });

  // TODO switching to JSEP raises an "'Found an unsupported expression type: Compound'"" exception, instead.
  it('should raise an exception on unbalanced string values', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('color: red; -ko-color: @mycolor; -ko-color-if: mycondition eq "ciao ciao"a', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Syntax error/);
  });

  it('should raise an exception when -if and -ifnot are used on the same property', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('color: red; -ko-color-ifnot: mycondition; -ko-color: @mycolor; -ko-color-if: mycondition eq "ciao ciao"', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Unexpected error/);
  });


  // TODO maybe this doesn't apply anymore??
  it('should raise errors on bad modifiers', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('src: url(\'path\'); -ko-src: @[myurl!mymod]', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/Syntax error /);
  });

  it('should raise errors on missing default value', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('-ko-color: @mycolor', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Cannot find default/);
  });

  it('should not alter the result when no -ko declarations are used', function() {
    var styleSheet, result;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    result = elaborateDeclarations('width: 10%; width: 20%', undefined, templateUrlConverter, mockedBindingProvider);
    expect(result).toBe(null);
  });

  it('should raise errors on unexpected default values when using modifiers', function() {
    var styleSheet, result, exception;
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('width: 10%; -ko-width: @[mywidth]px', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Cannot find default/);

    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    try {
      result = elaborateDeclarations('width: 10px; -ko-width: @[mywidth]%', undefined, templateUrlConverter, mockedBindingProvider);
    } catch (e) {
      exception = e;
    }
    expect(result).toEqual(undefined);
    expect(exception).toMatch(/^Cannot find default/);
  });

  it('should camel case styles but not attributes', function() {
    var styleSheet, result;
    var $ = require('jquery');
    $(document.body).appendHtml('<a data-attribute="ciao"></a>');
    styleSheet = cssParse('color', {
      comments: true,
      position: true
    });
    result = elaborateDeclarations('-ko-attr-data-attribute: @myvalue; background-color: red; -ko-background-color: @mycolor', undefined, templateUrlConverter, mockedBindingProvider, $('a')[0]);
    expect("virtualAttr: { 'data-attribute': $myvalue[ciao]() }, virtualAttrStyle: 'background-color: '+($mycolor[red]())+';'+''").toEqual($('a').attr('data-bind'));
  });

});