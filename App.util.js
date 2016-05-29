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
        this.calcConfig = {
            today: config.today || new Date(),
            endDate: config.endDate,
            customStartDate: config.customStartDate,
            maxDaysAfterPlannedEnd: config.maxDaysAfterPlannedEnd,
            customProjectionStartDate: config.customProjectionStartDate
        };
        this.chartConfig = {
            xAxis: {
                plotLines: []
            },
            subtitle: {
                useHTML: true
            }
        };

        this.adjustChartStart(data);
        this.stripFutureBars(data);
        this.addProjectionsLinesAndSubtitle(data);
        this.reformatDates(data);

        return this.chartConfig;
    },

    adjustChartStart: function (data) {
        var firstInProgressIndex = this.findDateIndex(data.categories, this.calcConfig.today, false, data.categories.length);
        data.series.forEach(function (series) {
            if (series.name != "Planned") {
                for (var i = 0; i < series.data.length; i++) {
                    if (series.data[i] > 0 && i < firstInProgressIndex) {
                        firstInProgressIndex = i;
                        break;
                    }
                }
            }
        });
        var startIndex = this.calcConfig.customStartDate ? this.findDateIndex(data.categories, this.calcConfig.customStartDate, false, firstInProgressIndex) : firstInProgressIndex;
        data.series.forEach(function (series) {
            series.data = series.data.slice(startIndex);
        });
        data.categories = data.categories.slice(startIndex);
    },

    stripFutureBars: function (data) {
        var currentIndex = this.findDateIndex(data.categories, this.calcConfig.today, false, data.categories.length) + 1;
        data.series.forEach(function (series) {
            if (series.name != "Planned") {
                for (var i = currentIndex; i < series.data.length; i++) {
                    series.data[i] = null;
                }
            }
        });
    },

    addVerticalLine: function (label, index, config) {
        if (index == -1) {
            return;
        }
        var plotLines = this.chartConfig.xAxis.plotLines;
        for (var i = 0; i < plotLines.length; i++) {
            if (plotLines[i].value == index) {
                return;
            }
        }
        plotLines.push(Ext.merge(
            {label: {text: label}, value: index, width: 2, color: "#000"},
            config
        ));
    },

    addSeriesLine: function (data, name, series, config) {
        if (series) {
            data.series.push(Ext.merge(
                {name: name, data: series, type: "line", marker: {enabled: false}, enableMouseTracking: false, lineWidth: 1},
                config
            ));
        }
    },

    addSubtitleText: function (text) {
        var subtitle = this.chartConfig.subtitle;
        subtitle.text = subtitle.text ? subtitle.text + " &nbsp;&nbsp;&nbsp; " + text : text;
    },

    addProjectionsLinesAndSubtitle: function (data) {
        var acceptedData = this.getSeriesData(data, "Accepted");
        var plannedData = this.getSeriesData(data, "Planned");
        var dates = data.categories;
        var todayIndex = this.findDateIndex(dates, this.calcConfig.today);
        var plannedEndIndex = this.findDateIndex(dates, this.calcConfig.endDate);
        var todayAcceptedPoints = acceptedData[todayIndex];
        var todayPlannedPoints = plannedData[todayIndex];
        var projectionStart = this.getProjectionStart(dates, acceptedData);

        this.addVerticalLine("planned end", plannedEndIndex);
        this.addVerticalLine("today", this.findDateIndex(dates, this.calcConfig.today, true), {color: "#BBB", dashStyle: "ShortDash"});

        var projectedDateIndex = this.linearProjectionTargetIndex(projectionStart.index, projectionStart.points, todayIndex, todayAcceptedPoints, todayPlannedPoints);
        if (projectedDateIndex && todayAcceptedPoints < todayPlannedPoints) {
            var maxDaysAfterPlannedEnd = this.calcConfig.maxDaysAfterPlannedEnd || 0;
            var projectionEndIndex = Math.min(projectedDateIndex, (plannedEndIndex == -1 ? todayIndex : plannedEndIndex) + maxDaysAfterPlannedEnd);
            for (var j = Math.max(todayIndex, plannedEndIndex); j < projectionEndIndex; j++) {
                plannedData.push(todayPlannedPoints);
                data.categories.push(addBusinessDays(new Date(data.categories[data.categories.length - 1]), 1));
            }
            var projectionSeries = this.linearProjectionData(projectionStart.index, projectionStart.points, todayIndex, todayAcceptedPoints, projectionEndIndex, todayPlannedPoints);
            this.addSeriesLine(data, "Projection", projectionSeries, {dashStyle: "Dash"});

            if (projectedDateIndex <= projectionEndIndex) {
                this.addVerticalLine("projected end", projectedDateIndex, {color: "#BBB"});
            }
            this.projectedEndDate = addBusinessDays(new Date(data.categories[0]), projectedDateIndex);
        }
        if (this.calcConfig.endDate) {
            var idealData = this.linearProjectionData(projectionStart.index, projectionStart.points, plannedEndIndex, todayPlannedPoints, plannedEndIndex);
            this.addSeriesLine(data, "Ideal", idealData, {dashStyle: "Dot"});
            this.addSubtitleText("Planned End: " + formatDate(this.calcConfig.endDate));
        }
        if (this.projectedEndDate) {
            this.addSubtitleText("Projected End: " + formatDate(this.projectedEndDate));
        }
    },

    getProjectionStart: function (dates, acceptedData) {
        var index;
        if (this.calcConfig.customProjectionStartDate) {
            index = this.findDateIndex(dates, this.calcConfig.customProjectionStartDate);
        } else {
            for (index = 0; index < acceptedData.length; index++) {
                if (acceptedData[index] > 0) {
                    break;
                }
            }
        }
        return {index: index, points: acceptedData[index] || 0};
    },

    findDateIndex: function (dates, date, floating, defaultIndex) {
        var searchedDateString = (date instanceof Date) ? dateToIsoString(date) : date;
        for (var i = 0; i < dates.length; i++) {
            var dateString = dates[i];
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

    linearProjectionData: function (startIndex, startValue, endIndex, endValue, indexLimit, valueLimit) {
        var projectionStep = this.linearProjectionStep(startIndex, startValue, endIndex, endValue);
        if (projectionStep && indexLimit !== 0) {
            var data = [];
            var i;
            for (i = 0; i < startIndex; i++) {
                data[i] = null;
            }
            data[i] = startValue;
            i++;
            var actualIndexLimit = indexLimit || Infinity;
            for (; i <= actualIndexLimit && (!valueLimit || data[i - 1] <= valueLimit); i++) {
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
            return endIndex + Math.ceil((targetValue - endValue) / projectionStep);
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
