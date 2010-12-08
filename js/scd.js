var Scd = function(videoEl, options) {
    // Public properties.
    // Contains detected scene changes timecodes.
    this.sceneTimecodes = [];

    // Public methods.
    this.start = function(callback) {
		videoSeekedEvent = videoEl.addEventListener("seeked", function() {
			detectSceneChange();
		}, false);

        if(callback !== undefined) {
            _callback = callback;
        }

        // Remove controls from video during process.
        videoEl.controls = 0;

        detectSceneChange();
    };

    this.pause = function() {
        _stop = 1;
    };

    // Private properties.
    var that = this;
    var document = window.document;
    var Math = window.Math;

    // The width and height at which the frames will be resized down to for comparison.
    var _step = 50;

    // The minimal duration of a scene in s. 2 consecutive scene changes can be detected within this interval.
    var _minSceneDuration = 0.25;

    // Percentage color difference above which a scene change is detected (0 <= threshold <= 100).
    var _threshold = 25;

    // Display detected scenes first frame.
    var _debug = 0;
  
    /**
     * Maximum color difference possible.
     * @const
     * @type {number}
     */
    var maxDiff = Math.sqrt(Math.pow(255, 2) * 3);

    var _currentTime = 0;

    var _width = 0;
    var _height = 0;

    var _controls = videoEl.controls;

    var _canvasA = document.createElement("canvas");
    var _canvasB = document.createElement("canvas");
    var _ctxA = _canvasA.getContext("2d");
    var _ctxB = _canvasB.getContext("2d");

    var _stop = 0;
    var _callback = 0;
    var videoOriginalEvent;
    var videoSeekedEvent;

    // Options.
    if(typeof options !== undefined) {
        if(options.step) {
            _step = parseInt(options.step, 10);
        }
        if(options.minSceneDuration) {
            _minSceneDuration = parseFloat(options.minSceneDuration);
        }
        if(options.threshold) {
            _threshold = parseFloat(options.threshold);
        }
        if(options.debug) {
            _debug = Boolean(options.debug);
        }
    }
    // _threshold is set between 0 and maxDiff interval to save calculations later.
    _threshold = _threshold * maxDiff / 100;
    // The number of pixels of resized frames. Used to speed up average calculation.
    var _step_sq = Math.pow(_step, 2);

    // @todo: Call this function is Scd is instantiated after durationchange was triggered.
    videoOriginalEvent = videoEl.addEventListener("durationchange", function() {
        // durationchange appears to be the first event triggered by video that exposes width and height.
        _width = this.videoWidth;
        _height = this.videoHeight;
        _canvasA.width = _step;
        _canvasA.height = _step;
        _canvasB.width = _step;
        _canvasB.height = _step;
        //_ctxA.drawImage(this, 0, 0, _width, _height, 0, 0, _step, _step);

		videoEl.removeEventListener("durationchange", videoOriginalEvent, true);
    }, false);

    // Debug
    if(_debug) {
        var _debugContainer = document.createElement("div");
        _debugContainer.className = "scd-debug";
        document.getElementsByTagName("body")[0].appendChild(_debugContainer);
    }

    var detectSceneChange = function() {
        if(_stop) {
            return;
        }

        // @fixme: Bug on Opera. duration is not always defined.
        if(videoEl.ended || _currentTime > videoEl.duration) {
            if(_callback) {
                _callback();

                // Restore video element controls to its original state.
                videoEl.controls = _controls;
            }
            return;
        }

        _ctxA.drawImage(videoEl, 0, 0, _width, _height, 0, 0, _step, _step);
        var diff = computeDifferences(_ctxA, _ctxB);

        if(diff[1] > _threshold) {
            that.sceneTimecodes.push(videoEl.currentTime);

            if(_debug) {
                var tmpContainer = document.createElement("div");
                var tmpCanvasA = document.createElement("canvas");
                tmpCanvasA.width = _width / 2;
                tmpCanvasA.height = _height / 2;
                tmpCanvasA.getContext("2d").drawImage(videoEl, 0, 0, _width, _height, 0, 0, _width / 2, _height / 2);
                tmpContainer.appendChild(tmpCanvasA);
                tmpContainer.appendChild(document.createElement("br"));
                tmpContainer.appendChild(document.createTextNode("max: " + Math.round(diff[0] / maxDiff * 100) + "%, avg: " + Math.round(diff[1] / maxDiff * 100) + "%, min: " + Math.round(diff[2] / maxDiff * 100) + "%"));
                _debugContainer.appendChild(tmpContainer);
            }
        }

        _ctxB.drawImage(_canvasA, 0, 0, _step, _step, 0, 0, _step, _step);
        _currentTime += _minSceneDuration;
        videoEl.currentTime = _currentTime;
    };

    var computeDifferences = function(ctxA, ctxB) {
        var colorsA = ctxA.getImageData(0, 0, _step, _step).data;
        var colorsB = ctxB.getImageData(0, 0, _step, _step).data;
        var diff = [];
        var i = colorsA.length;

        do {
            diff.push(getColorDistance(colorsA[i-4], colorsA[i+1-4], colorsA[i+2-4], colorsB[i-4], colorsB[i+1-4], colorsB[i+2-4]));
        } while(i = i - 4);

        var avg = getAverage(diff);
        if(_debug) {
            var max = getMaxOfArray(diff);
            var min = getMinOfArray(diff);
            return [max, avg, min];
        }else {
            return ["0", avg];
        }
    };

    /**
     * Calculates the distance between 2 colors RGB compounds.
     * @param {number} RA Red compound value of color A.
     * @param {number} GA Green compound value of color A.
     * @param {number} BA Blue compound value of color A.
     * @param {number} RB Red compound value of color B.
     * @param {number} GB Green compound value of color B.
     * @param {number} BB Blue compound value of color B.
     * @return {number} The distance.
     */
    var getColorDistance = function(RA, GA, BA, RB, GB, BB) {
        return Math.sqrt(Math.pow(RA - RB, 2) + Math.pow(GA - GB, 2) + Math.pow(BA - BB, 2));
    };

    /**
     * Calculates the maximum value of an array.
     * @param {Array.<number>} numArray An array of values.
     * @return {number} The maximum value.
     */
    var getMaxOfArray = function(numArray) {
        return Math.max.apply(null, numArray);
    };

    /**
     * Calculates the minimum value of an array.
     * @param {Array.<number>} numArray An array of values.
     * @return {number} The minimum value.
     */
    var getMinOfArray = function(numArray) {
        return Math.min.apply(null, numArray);
    };

    /**
     * Calculates the average value of an array.
     * @param {Array.<number>} numArray An array of values.
     * @return {number} The average value.
     */
    var getAverage = function(numArray) {
        return numArray.reduce(function(a, b) {
            return a + b;
        }) / _step_sq;
    };
};
