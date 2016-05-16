(function () {
    window.dev = window.dev || undefined;
    window.debug = window.debug || undefined;
    if (!window.debug) {
        console.debug = function () {
        };
    }
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


Ext.define("My.BurnUpCalculation", {

    /**
     * @param {Object} config
     * @param {Object} data
     {
         series: [
             {name: "Planned", data: [12, 14, 14, 15, ...] }, ...
         ],
         categories: ["2016-03-28", "2016-03-29", ...]
     }
     * @ {Object} chartConfig
     */
    calculate: function (data, config) {
        this.calcConfig.today = config.today || new Date();
        this.calcConfig.endDate = config.endDate;

        this.truncateBeforeWorkStart(data);
        this.stripFutureBars(data);
        this.addPlotLines(data);
        this.addProjectionAndIdealLine(data);
        this.addSubtitle();
        this.reformatDates(data);

        return this.chartConfig;
    },

    calcConfig: {},
    chartConfig: {},

    truncateBeforeWorkStart: function (data) {
        var actualStartIndex = this.findDateIndex(data, this.calcConfig.today, false, data.categories.length);
        data.series.forEach(function (series) {
            if (series.name != "Planned") {
                for (var i = 0; i < series.data.length; i++) {
                    if (series.data[i] > 0 && i < actualStartIndex) {
                        actualStartIndex = i;
                        break;
                    }
                }
            }
        });
        data.series.forEach(function (series) {
            series.data = series.data.slice(actualStartIndex);
        });
        data.categories = data.categories.slice(actualStartIndex);
    },

    stripFutureBars: function (data) {
        var currentIndex = this.findDateIndex(data, this.calcConfig.today, false, data.categories.length) + 1;
        data.series.forEach(function (series) {
            if (series.name != "Planned") {
                for (var i = currentIndex; i < series.data.length; i++) {
                    series.data[i] = null;
                }
            }
        });
    },

    addPlotLines: function (data) {
        this.chartConfig.xAxis = this.chartConfig.xAxis || {};
        this.chartConfig.xAxis.plotLines = [
            {
                value: this.findDateIndex(data, this.calcConfig.endDate),
                color: "#000", width: 2, label: {text: "planned end"}
            },
            {
                value: this.findDateIndex(data, this.calcConfig.today, true),
                color: "#AAA", width: 2, label: {text: "today"}, dashStyle: "ShortDash"
            }
        ];
    },

    addProjectionAndIdealLine: function (data) {
        var acceptedData = this.getSeriesData(data, "Accepted");
        var todayIndex = this.findDateIndex(data, this.calcConfig.today);
        var todayAcceptedPoints = acceptedData[todayIndex];
        var todayPlannedPoints = this.getSeriesData(data, "Planned")[todayIndex];
        var length = acceptedData.length;

        var projectionData = this.linearProjectionData(0, 0, todayIndex, todayAcceptedPoints, length, todayPlannedPoints);
        if (projectionData) {
            data.series.push({
                name: "Projection",
                data: projectionData,
                type: "line",
                dashStyle: "Dash",
                marker: {enabled: false},
                enableMouseTracking: false,
                lineWidth: 1
            });

            var projectedDaysRemaining = this.linearProjectionTargetIndex(0, 0, todayIndex, todayAcceptedPoints, todayPlannedPoints);
            this.projectedEndDate = addBusinessDays(new Date(data.categories[0]), projectedDaysRemaining);
        }
        if (this.calcConfig.endDate) {
            var endIndex = this.findDateIndex(data, this.calcConfig.endDate);
            var idealData = this.linearProjectionData(0, 0, endIndex, todayPlannedPoints, endIndex + 1);
            if (idealData) {
                data.series.push({
                    name: "Ideal",
                    data: idealData,
                    type: "line",
                    dashStyle: "Dot",
                    marker: {enabled: false},
                    enableMouseTracking: false,
                    lineWidth: 1
                });
            }
        }
    },

    addSubtitle: function () {
        var parts = [];
        if (this.calcConfig.endDate) {
            parts.push("Planned End: " + formatDate(this.calcConfig.endDate));
        }
        if (this.projectedEndDate) {
            parts.push("Projected End: " + formatDate(this.projectedEndDate));
        }
        this.chartConfig.subtitle = {text: parts.join(" &nbsp;&nbsp;&nbsp; "), useHTML: true};
    },

    findDateIndex: function (data, date, floating, defaultIndex) {
        var searchedDateString = (date instanceof Date) ? dateToIsoString(date) : date;
        for (var i = 0; i < data.categories.length; i++) {
            var dateString = data.categories[i];
            if (dateString >= searchedDateString) {
                return dateString > searchedDateString ? i - (floating ? 0.5 : 1) : i;
            }
        }
        return defaultIndex || -1;
    },

    getSeriesData: function (data, name) {
        for (var i = 0; i < data.series.length; i++) {
            var s = data.series[i];
            if (s.name == name) {
                return s.data;
            }
        }
        return [];
    },

    reformatDates: function (data) {
        data.categories = data.categories.map(function (date) {
            return formatDate(date);
        });
    },

    linearProjectionStep: function (startIndex, startValue, endIndex, endValue) {
        if (startIndex >= 0 && startIndex < endIndex && startValue != endValue) {
            return (endValue - startValue) / (endIndex - startIndex);
        } else {
            console.log("Unable to calculate projection step for values: (startIndex=" +
                startIndex + ", startValue=" + startValue + ", endIndex=" + endIndex + ", endValue=" + endValue + ")"
            );
            return null;
        }
    },

    linearProjectionData: function (startIndex, startValue, endIndex, endValue, length, targetValue) {
        var projectionStep = this.linearProjectionStep(startIndex, startValue, endIndex, endValue);
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
    },

    linearProjectionTargetIndex: function (startIndex, startValue, endIndex, endValue, targetValue) {
        var projectionStep = this.linearProjectionStep(startIndex, startValue, endIndex, endValue);
        if (projectionStep && (endValue - startValue) * (targetValue - endValue) >= 0) {
            return endIndex + Math.round((targetValue - endValue) / projectionStep);
        } else {
            return null;
        }
    }
});

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
