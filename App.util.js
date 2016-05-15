(function () {
    window.dev = window.dev || undefined;
    window.debug = window.debug || undefined;
    var originalDebug = console.debug;
    console.debug = function () {
        if (window.debug) {
            originalDebug.apply(this, arguments);
        }
    };
})();


function resolvedPromise(value) {
    return Deft.promise.Promise.when(value);
}

function rejectedPromise(error) {
    var deferred = Ext.create("Deft.Deferred");
    deferred.reject(error);
    return deferred.promise;
}


/**
 * Ext.create('Rally.data.lookback.SnapshotStore', {
 *      exceptionHandler: loggingSnapshotStoreExceptionHandler
 *      ...
 * });
 * @param proxy
 * @param response
 * @param operation
 */
function loggingSnapshotStoreExceptionHandler(proxy, response, operation) {
    var messages = JSON.parse(response.responseText);
    var log = function (message) {
        console.log(message);
    };
    console.log("Problem when obtaining snapshot data:");

    messages.Errors.forEach(log);
    messages.Warnings.forEach(log);

    console.log("proxy:", proxy, "response:", response, "operation:", operation);
}

function formatDate(date) {
    return Rally.util.DateTime.format((date instanceof Date) ? date : new Date(date), "dMy");
}

function dateToIsoString(date) {
    return date.toISOString().substring(0, 10);
}


function linearProjectionStep(startIndex, startValue, endIndex, endValue) {
    if (startIndex >= 0 && startIndex < endIndex && startValue != endValue) {
        return (endValue - startValue) / (endIndex - startIndex);
    } else {
        console.log("Unable to calculate projection step for values: (startIndex=" +
            startIndex + ", startValue=" + startValue + ", endIndex=" + endIndex + ", endValue=" + endValue + ")"
        );
        return null;
    }
}

function linearProjectionData(startIndex, startValue, endIndex, endValue, length, targetValue) {
    var projectionStep = linearProjectionStep(startIndex, startValue, endIndex, endValue);
    if (projectionStep) {
        var data = [];
        var i;
        for (i = 0; i < startIndex; i++) {
            data[i] = null;
        }
        data[i] = startValue;
        i++;
        var targetIndex = startIndex + length;
        for (; i < targetIndex && (!targetValue || data[i - 1] <= targetValue); i++) {
            data[i] = data[i - 1] + projectionStep;
        }
        return data;
    } else {
        return null;
    }
}

function linearProjectionTargetIndex(startIndex, startValue, endIndex, endValue, targetValue) {
    var projectionStep = linearProjectionStep(startIndex, startValue, endIndex, endValue);
    if (projectionStep && (endValue - startValue) * (targetValue - endValue) >= 0) {
        return endIndex + Math.round((targetValue - endValue) / projectionStep);
    } else {
        return null;
    }
}

function addBusinessDays(date, businessDays) {
    var days = date.getDate();
    var d = date.getDay();
    while (businessDays > 0) {
        ++days;
        d = (d + 1) % 7;
        if (d !== 0 && d != 6) {
            --businessDays;
        }
    }
    date.setDate(days);
    return date;
}
