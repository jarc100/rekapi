var rekapiToCSS = function (context, _) {

  'use strict';

  var Kapi = context.Kapi;


  // CONSTANTS
  //

  var DEFAULT_GRANULARITY = 100;
  var TRANSFORM_TOKEN = 'TRANSFORM';
  var VENDOR_TOKEN = 'VENDOR';
  var VENDOR_PREFIXES = Kapi.util.VENDOR_PREFIXES = {
    'microsoft': '-ms-'
    ,'mozilla': '-moz-'
    ,'opera': '-o-'
    ,'w3': ''
    ,'webkit': '-webkit-'
  };
  var BEZIERS = {
    easeInQuad: '.55,.085,.68,.53'
    ,easeInCubic: '.55,.055,.675,.19'
    ,easeInQuart: '.895,.03,.685,.22'
    ,easeInQuint: '.755,.05,.855,.06'
    ,easeInSine: '.47,0,.745,.715'
    ,easeInExpo: '.95,.05,.795,.035'
    ,easeInCirc: '.6,.04,.98, .335'
    ,easeInBack: '.6,-.28,.735,.045'
    ,easeOutQuad: '.25,.46,.45,.94'
    ,easeOutCubic: '.215,.61,.355,1'
    ,easeOutQuart: '.165,.84,.44,1'
    ,easeOutQuint: '.23,1,.32,1'
    ,easeOutSine: '.39,.575,.565,1'
    ,easeOutExpo: '.19,1,.22,1'
    ,easeOutCirc: '.075,.82,.165,1'
    ,easeOutBack: '.175,.885,.32,1.275'
    ,easeInOutQuad: '.455,.03,.515,.955'
    ,easeInOutCubic: '.645,.045,.355,1'
    ,easeInOutQuart: '.77,0,.175,1'
    ,easeInOutQuint: '.86,0.07,1'
    ,easeInOutSine: '.445,.05,.55,.95'
    ,easeInOutExpo: '1,0,0,1'
    ,easeInOutCirc: '.785,.135,.15,.86'
    ,easeInOutBack: '.68,-.55,.265,1.55'
  }


  // TEMPLATES
  //

  /**
   * [0]: vendor
   * [1]: animation name
   * [2]: keyframes
   */
  var KEYFRAME_TEMPLATE = [
    '@%skeyframes %s-keyframes {'
    ,'%s'
    ,'}'
  ].join('\n');

  /**
   * [0] class name
   * [1] class attributes
   */
  var CLASS_BOILERPLATE = [
    '.%s {'
    ,'%s'
    ,'}'
  ].join('\n');


  // PROTOTYPE EXTENSIONS
  //

  /**
   * @param {Object} opts
   */
  context.Kapi.prototype.toCSS = function (opts) {
    opts = opts || {};
    var animationCSS = [];
    var actorIds = this.getActorIds();

    _.each(actorIds, function (id) {
      animationCSS.push(this.getActor(id).toCSS(opts));
    }, this);

    return animationCSS.join('\n');
  };


  /**
   * @param {Object} opts
   */
  context.Kapi.Actor.prototype.toCSS = function (opts) {
    opts = opts || {};
    var actorCSS = [];
    var animName = opts.name || this.getCSSName();
    var granularity = opts.granularity || DEFAULT_GRANULARITY;
    var actorClass = generateCSSClass(this, animName, opts.vendors);
    actorCSS.push(actorClass);

    var optimizedEasingFormula = getOptimizedEasingFormula(this);
    var keyframes;

    // TODO: CSS optimization is _extremely_ incomplete.  It only supports
    // single-step animations with one keyframe property.
    if (typeof optimizedEasingFormula === 'string') {
      keyframes = generateOptimizedKeyframes(this, optimizedEasingFormula);
    } else {
      keyframes = generateActorKeyframes(this, granularity);
    }

    var boilerplatedKeyframes = applyVendorBoilerplates(
        keyframes, animName, opts.vendors);
    actorCSS.push(boilerplatedKeyframes);

    return actorCSS.join('\n');
  };


  // UTILITY FUNCTIONS
  //

  /**
   * @param {string} formatter
   * @param {[string]} args
   * @return {string}
   */
  var printf = Kapi.util.printf = function (formatter, args) {
    var composedStr = formatter;
    _.each(args, function (arg) {
      composedStr = composedStr.replace('%s', arg);
    });

    return composedStr;
  };


  /**
   * @param {string} toKeyframes Generated keyframes to wrap in boilerplates
   * @param {string} animName
   * @param {Array.<string>} opt_vendors Vendor boilerplates to be applied.  Should
   *     be any of the values in Kapi.util.VENDOR_PREFIXES.
   * @return {string}
   */
  function applyVendorBoilerplates (toKeyframes, animName, opt_vendors) {
    opt_vendors = opt_vendors || ['w3'];
    var renderedKeyframes = [];

    _.each(opt_vendors, function (vendor) {
      var renderedChunk = printf(KEYFRAME_TEMPLATE,
          [VENDOR_PREFIXES[vendor], animName, toKeyframes]);
      var prefixedKeyframes =
          applyVendorPropertyPrefixes(renderedChunk, vendor);
      renderedKeyframes.push(prefixedKeyframes);
    });

    return renderedKeyframes.join('\n');
  }


  /**
   * @param {string} keyframes
   * @param {vendor} vendor
   * @return {string}
   */
  function applyVendorPropertyPrefixes (keyframes, vendor) {
    var transformRegExp = new RegExp(TRANSFORM_TOKEN, 'g');
    var prefixedTransformKey = VENDOR_PREFIXES[vendor] + 'transform';
    var generalPrefixRegExp = new RegExp(VENDOR_TOKEN, 'g');
    var generalPrefixedKey = VENDOR_PREFIXES[vendor];
    var prefixedKeyframes = keyframes
        .replace(generalPrefixRegExp, generalPrefixedKey)
        .replace(transformRegExp, prefixedTransformKey);

    return prefixedKeyframes;
  }


  /**
   * @param {Kapi.Actor} actor
   * @param {string} animName
   * @param {Array.<string>} opt_vendors
   * @return {string}
   */
  function generateCSSClass (actor, animName, opt_vendors) {
    opt_vendors = opt_vendors || ['w3'];
    var classAttrs = [];
    var vendorAttrs;

    _.each(opt_vendors, function (vendor) {
      vendorAttrs = generateCSSAnimationProperties(actor, animName, vendor);
      classAttrs.push(vendorAttrs);
    });

    var boilerplatedClass = printf(CLASS_BOILERPLATE
        ,[animName, classAttrs.join('\n')]);

    return boilerplatedClass;
  }


  /**
   * @param {Kapi.Actor} actor
   * @param {string} animName
   * @param {string} vendor
   * @return {string}
   */
  function generateCSSAnimationProperties (actor, animName, vendor) {
    var generatedProperties = [];
    var prefix = VENDOR_PREFIXES[vendor];
    var start = actor.getStart();
    var duration = actor.getEnd() - start;

    var animationName = printf('  %sanimation-name: %s;'
        ,[prefix, animName + '-keyframes']);
    generatedProperties.push(animationName);

    duration = printf('  %sanimation-duration: %sms;'
        ,[prefix, duration]);
    generatedProperties.push(duration);

    var delay = printf('  %sanimation-delay: %sms;', [prefix, start]);
    generatedProperties.push(delay);

    var fillMode = printf('  %sanimation-fill-mode: forwards;', [prefix]);
    generatedProperties.push(fillMode);

    return generatedProperties.join('\n');
  }


  // OPTIMIZED GENERATOR FUNCTIONS
  //

  /**
   * @param {Kapi.Actor} actor
   * @param {string} easingFormula
   * @return {string}
   */
  function generateOptimizedKeyframes (actor, easingFormula) {
    var propName = actor.getTrackNames()[0];
    var firstKeyprop = actor.getKeyframeProperty(propName, 0);
    var lastKeyprop = actor.getKeyframeProperty(propName, 1);
    var printName = propName;

    if (propName === 'transform') {
      printName = TRANSFORM_TOKEN;
    }

    return [
        // AAAAAAHHH!
        printf('from { %s: %s; %sanimation-timing-function: %s; }',
            [printName, firstKeyprop.value, VENDOR_TOKEN,
                printf('cubic-bezier(%s)', [easingFormula])]),
        printf('to { %s: %s; %sanimation-timing-function: %s; }',
            [printName, lastKeyprop.value, VENDOR_TOKEN,
                printf('cubic-bezier(%s)', [easingFormula])]),
      ].join('\n');
  }


  /**
   * @param {Kapi.Actor} actor
   * @return {string}
   */
  function getOptimizedEasingFormula (actor) {
    var trackNames = actor.getTrackNames();
    var firstTrackName = trackNames[0];
    if (trackNames.length === 1
        && actor.getTrackLength(firstTrackName) === 2) {
      return BEZIERS[actor.getKeyframeProperty(firstTrackName, 1).easing];
    }
  }


  // GENERAL-USE GENERATOR FUNCTIONS
  //

  /**
   * @param {Kapi.Actor} actor
   * @param {number} granularity
   * @param {string} opt_track
   * @return {string}
   */
  function generateActorKeyframes (actor, granularity, opt_track) {
    var animLength = actor.getLength();
    var delay = actor.getStart();
    var serializedFrames = [];
    var percent, adjustedPercent, stepPrefix;
    var increment = animLength / granularity;
    var adjustedIncrement = Math.floor(increment);
    var animPercent = animLength / 100;
    var loopStart = delay + increment;
    var loopEnd = animLength + delay - increment;

    actor.updateState(delay);
    serializedFrames.push('  0% ' + serializeActorStep(actor, opt_track));

    var i;
    for (i = loopStart; i <= loopEnd; i += increment) {
      actor.updateState(i);
      percent = (i - delay) / animPercent;
      adjustedPercent = +percent.toFixed(2);
      stepPrefix = adjustedPercent + '% ';
      serializedFrames.push(
          '  ' + stepPrefix + serializeActorStep(actor, opt_track));
    }

    actor.updateState(animLength + delay);
    serializedFrames.push('  100% ' + serializeActorStep(actor, opt_track));

    return serializedFrames.join('\n');
  }


  /**
   * @param {Kapi.Actor} actor
   * @param {string} track
   * @param {number} granularity
   * @return {string}
   */
  function generateActorTrackKeyframes (actor, track, granularity) {
    var trackEnd = actor.getEnd(track);

    if (!trackEnd) {
      return '';
    }

    var segmentAccumulator = [];

    _.each(actor._propertyTracks[track], function (prop) {
      var nextProp = prop.nextProperty;

      var segmentLength;
      if (nextProp) {
        segmentLength = nextProp.millisecond - prop.millisecond;
      } else {
        segmentLength = trackEnd - prop.millisecond;
      }

      // increments must be at least 1 to ensure that all segments are
      // serialized.
      var increments =
          Math.ceil((segmentLength / trackEnd) * granularity) || 1;
      var trackSegment = generateActorTrackSegment(actor, prop, increments);
      segmentAccumulator = segmentAccumulator.concat(trackSegment);
    });

    return segmentAccumulator.join('\n');
  }


  /**
   * @param {Kapi.Actor} actor
   * @param {Kapi.KeyframeProperty} fromProp
   * @param {number} increments
   * @return {Array.<string>}
   */
  function generateActorTrackSegment (actor, fromProp, increments) {

    var serializedFrames = [];
    var fromPercent = (fromProp.millisecond / actor.getLength()) * 100;

    var nextProp = fromProp.nextProperty;
    var toPercent;
    if (nextProp) {
      toPercent = (nextProp.millisecond / actor.getLength()) * 100;
    } else {
      toPercent = 100;
    }

    var delta = toPercent - fromPercent;
    var incrementSize = delta / increments;

    var i, adjustedPercent, stepPrefix;
    for (i = 0; i < increments; i++) {
      adjustedPercent = fromPercent + (i * incrementSize);
      actor.updateState( (adjustedPercent / 100) * actor.getLength() );
      stepPrefix = +adjustedPercent.toFixed(2) + '% ';
      serializedFrames.push(
          '  ' + stepPrefix + serializeActorStep(actor, fromProp.name));
    }

    return serializedFrames;
  };


  /**
   * @param {Kapi.Actor} actor
   * @param {string} opt_prop
   * @return {string}
   */
  function serializeActorStep (actor, opt_prop) {
    var serializedProps = ['{'];

    var propsToSerialize;
    if (opt_prop) {
      propsToSerialize = {};
      propsToSerialize[opt_prop] = actor.get()[opt_prop];
    } else {
      propsToSerialize = actor.get();
    }

    var printVal;
    _.each(propsToSerialize, function (val, key) {
      printVal = val;
      var printKey = key;

      if (key === 'transform') {
        printKey = TRANSFORM_TOKEN;
      }

      serializedProps.push(printKey + ':' + printVal + ';');
    });

    serializedProps.push('}');
    return serializedProps.join('');
  }

  if (KAPI_DEBUG) {
    Kapi._private.toCSS = {
      'TRANSFORM_TOKEN': TRANSFORM_TOKEN
      ,'VENDOR_TOKEN': VENDOR_TOKEN
      ,'applyVendorBoilerplates': applyVendorBoilerplates
      ,'applyVendorPropertyPrefixes': applyVendorPropertyPrefixes
      ,'generateCSSClass': generateCSSClass
      ,'generateCSSAnimationProperties': generateCSSAnimationProperties
      ,'generateOptimizedKeyframes': generateOptimizedKeyframes
      ,'getOptimizedEasingFormula': getOptimizedEasingFormula
      ,'generateActorKeyframes': generateActorKeyframes
      ,'generateActorTrackSegment': generateActorTrackSegment
      ,'generateActorTrackKeyframes': generateActorTrackKeyframes
      ,'serializeActorStep': serializeActorStep
    }
  }

};
