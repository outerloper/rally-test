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

function promiseAll(array) {
    return array.length === 0 ? [] : Deft.Promise.all(array);
}


function getRallyRecordType(record) {
    return record && record.getData()._type;
}

function getRallyIdFromRef(ref, type) {
    return +ref.slice(type.length + 2);
}

function formatMilestone(milestone, context) {
    return "<span class=\"artifact-icon icon-milestone\" style=\"transform:rotate(20deg);color: " + milestone.get("DisplayColor") + ";\"></span>" +
        "<a target=\"_blank\" style=\"color:#274b6d\" href=\"" + getMilestoneLink(milestone, context) + "\">" + milestone.get("Name") + "</a>";
}

function getMilestoneLink(milestone, context) {
    return "https://rally1.rallydev.com/#/" + context.getProject().ObjectID + "d/detail" + milestone.getUri();
}

function formatRelease(release, context) {
    return "<a target=\"_blank\" style=\"color:#274b6d\" href=\"" + getReleaseLink(release, context) + "\">" + release.get("Name") + "</a>";
}

function getReleaseLink(release, context) {
    return "https://rally1.rallydev.com/slm/rl/edit.sp?cpoid=" + context.getProject().ObjectID +
        "&projectScopeUp=" + context.getProjectScopeUp() +
        "&projectScopeDown=" + context.getProjectScopeDown() +
        "&oid=" + release.getId() +
        "&typeDef=27154375554";
}

function hasOwnProperties(object, minNumber) {
    minNumber = minNumber ? minNumber : 1;
    for (var property in object) {
        if (object.hasOwnProperty(property)) {
            if (!--minNumber) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Use to display store errors on the console:
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

function joinNotEmpty(array, glue, prefixIfNotEmpty, suffixIfNotEmpty) {
    var joined = array.filter(function (element) {
        return !!element;
    }).join(glue);
    var prefix = prefixIfNotEmpty ? prefixIfNotEmpty : "";
    var suffix = suffixIfNotEmpty ? suffixIfNotEmpty : "";
    return joined && (prefix || suffix) ? prefix + joined + suffix : joined;
}


Ext.define("My.BurnUpCalculation", {

    /**
     * @param {Object} config
     * @param {Object} data
     {
         series: [
             {name: "Scope", data: [12, 14, 14, 15, ...] }, ...
         ],
         categories: ["2016-03-28", "2016-03-29", ...]
     }
     * @ {Object} chartConfig
     */
    calculate: function (data, config) {
        this.calcConfig = {
            today: config.today || new Date(),
            maxEndDate: config.maxEndDate,
            auxDates: config.auxDates,
            plannedEndDate: config.plannedEndDate,
            customStartDate: config.customStartDate,
            maxDaysAfterPlannedEnd: config.maxDaysAfterPlannedEnd,
            customTrendStartDate: config.customTrendStartDate,
            smallDisplay: config.smallDisplay
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
        this.addTrendLinesAndSubtitle(data);
        this.adjustDataAndChartConfig(data);

        return this.chartConfig;
    },

    adjustChartStart: function (data) {
        var firstInProgressIndex = this.findDateIndex(data.categories, this.calcConfig.today, false, data.categories.length);
        data.series.forEach(function (series) {
            if (series.name != "Scope") {
                for (var i = 0; i < series.data.length; i++) {
                    if (series.data[i] > 0 && i < firstInProgressIndex) {
                        firstInProgressIndex = i;
                        break;
                    }
                }
            }
        });
        var startIndex = this.calcConfig.customStartDate ? this.findDateIndex(data.categories, this.calcConfig.customStartDate, false, 0) : firstInProgressIndex;
        data.series.forEach(function (series) {
            series.data = series.data.slice(startIndex);
        });
        data.categories = data.categories.slice(startIndex);
    },

    stripFutureBars: function (data) {
        var currentIndex = this.findDateIndex(data.categories, this.calcConfig.today, false, data.categories.length) + 1;
        data.series.forEach(function (series) {
            if (series.name != "Scope") {
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
                label = plotLines[i].label.text + " / " + label;
                plotLines.splice(i, 1);
            }
        }
        plotLines.push(Ext.merge(
            {label: {text: label, y: 3, x: 3}, value: index, width: 2, color: "#000", zIndex: 5},
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

    addTrendLinesAndSubtitle: function (data) {
        var config = this.calcConfig;
        var acceptedData = this.getSeriesData(data, "Accepted");
        var plannedData = this.getSeriesData(data, "Scope");
        var dates = data.categories;
        var todayIndex = this.findDateIndex(dates, config.today);
        var plannedEndIndex = this.findDateIndex(dates, this.calcConfig.plannedEndDate);
        var todayAcceptedPoints = acceptedData[todayIndex];
        var todayPlannedPoints = plannedData[todayIndex];
        var trendStart = this.getTrendStart(dates, acceptedData);

        var projectedEndVerticalLineIndex;
        var projectedDateIndex = this.trendTargetIndex(trendStart.index, trendStart.points, todayIndex, todayAcceptedPoints, todayPlannedPoints);
        if (projectedDateIndex && todayAcceptedPoints < todayPlannedPoints) {
            var maxDaysAfterPlannedEnd = this.calcConfig.maxDaysAfterPlannedEnd || 0;
            var trendEndIndex = Math.min(projectedDateIndex, (plannedEndIndex == -1 ? todayIndex : plannedEndIndex) + maxDaysAfterPlannedEnd);
            for (var j = Math.max(todayIndex, plannedEndIndex, dates.length - 1); j < trendEndIndex; j++) {
                plannedData.push(todayPlannedPoints);
                dates.push(dateToIsoString(addBusinessDays(new Date(dates[dates.length - 1]), 1)));
            }
            var trendSeries = this.trendData(trendStart.index, trendStart.points, todayIndex, todayAcceptedPoints, trendEndIndex, todayPlannedPoints);
            this.addSeriesLine(data, "Trend", trendSeries, {dashStyle: "Dash"});

            if (projectedDateIndex <= trendEndIndex) {
                projectedEndVerticalLineIndex = projectedDateIndex;
            }
            this.projectedEndDate = addBusinessDays(new Date(dates[0]), projectedDateIndex);
        }
        // do not display completed columns after planned end
        if (todayAcceptedPoints == todayPlannedPoints && todayPlannedPoints > 0 && todayIndex > plannedEndIndex) {
            var i = dates.length - 1;
            while ((acceptedData[i] == todayPlannedPoints || acceptedData[i] === null) && plannedData[i] == todayPlannedPoints) {
                i--;
            }
            i += 2;
            var deleteCount = dates.length;
            dates.splice(i, deleteCount);
            acceptedData.splice(i, deleteCount);
            plannedData.splice(i, deleteCount);
            this.getSeriesData(data, "In Progress").splice(i, deleteCount);
            this.getSeriesData(data, "Completed").splice(i, deleteCount);
        }
        if (this.calcConfig.plannedEndDate) {
            var idealData = this.trendData(trendStart.index, trendStart.points, plannedEndIndex, plannedData[plannedEndIndex], plannedEndIndex);
            this.addSeriesLine(data, "Ideal", idealData, {dashStyle: "Dot"});
            this.addSubtitleText("Planned End: " + formatDate(this.calcConfig.plannedEndDate));
        }
        if (this.projectedEndDate) {
            this.addSubtitleText("Projected End: " + formatDate(this.projectedEndDate));
        }
        // plot lines
        if (config.auxDates && hasOwnProperties(config.auxDates, 2)) {
            for (var auxDate in config.auxDates) {
                if (config.auxDates.hasOwnProperty(auxDate)) {
                    this.addVerticalLine(config.auxDates[auxDate], this.findDateIndex(dates, auxDate, true), {width: 1, label: {x: 2}});
                }
            }
        }
        this.addVerticalLine("Today", this.findDateIndex(dates, config.today, true), {color: "#AAA", dashStyle: "ShortDash"});
        this.addVerticalLine("Planned End", this.findDateIndex(dates, config.plannedEndDate, true));
        if (projectedEndVerticalLineIndex) {
            this.addVerticalLine("Projected End", projectedEndVerticalLineIndex, {dashStyle: "ShortDash"});
        }
    },

    getTrendStart: function (dates, acceptedData) {
        var index;
        if (this.calcConfig.customTrendStartDate) {
            index = this.findDateIndex(dates, this.calcConfig.customTrendStartDate);
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
        if (dates.length > 0 && dates[0] <= searchedDateString) {
            for (var i = 0; i < dates.length; i++) {
                var dateString = dates[i];
                if (dateString >= searchedDateString) {
                    return dateString > searchedDateString ? i - (floating ? 0.5 : 1) : i;
                }
            }
        }
        return defaultIndex || defaultIndex === 0 ? defaultIndex : -1;
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

    adjustDataAndChartConfig: function (data) {
        data.categories = data.categories.map(function (date) {
            return formatDate(date);
        });
        var threshold = data.categories.length * (this.calcConfig.smallDisplay ? 2 : 1);
        var step, lineWidth, groupPadding;
        if (threshold > 240) {
            groupPadding = 0.05;
            lineWidth = 2;
            step = 20;
        } else if (threshold > 120) {
            groupPadding = 0.1;
            lineWidth = 3;
            step = 10;
        } else {
            return;
        }
        Ext.merge(this.chartConfig, {
            xAxis: {
                labels: {
                    step: step
                }
            },
            plotOptions: {
                line: {
                    lineWidth: lineWidth
                },
                column: {
                    groupPadding: groupPadding
                }
            }
        });
    },

    trendStep: function (startIndex, startValue, endIndex, endValue) {
        if (startIndex >= 0 && startIndex < endIndex && startValue != endValue) {
            return (endValue - startValue) / (endIndex - startIndex);
        } else {
            console.log("Unable to calculate trend step for values: (startIndex=" +
                startIndex + ", startValue=" + startValue + ", endIndex=" + endIndex + ", endValue=" + endValue + ")"
            );
            return null;
        }
    },

    trendData: function (startIndex, startValue, endIndex, endValue, indexLimit, valueLimit) {
        var trendStep = this.trendStep(startIndex, startValue, endIndex, endValue);
        if (trendStep && indexLimit !== 0) {
            var data = [];
            var i;
            for (i = 0; i < startIndex; i++) {
                data[i] = null;
            }
            data[i] = startValue;
            i++;
            var actualIndexLimit = indexLimit || Infinity;
            for (; i <= actualIndexLimit && (!valueLimit || data[i - 1] <= valueLimit); i++) {
                data[i] = data[i - 1] + trendStep;
            }
            return data;
        } else {
            return null;
        }
    },

    trendTargetIndex: function (startIndex, startValue, endIndex, endValue, targetValue) {
        var trendStep = this.trendStep(startIndex, startValue, endIndex, endValue);
        if (trendStep && (endValue - startValue) * (targetValue - endValue) >= 0) {
            return endIndex + Math.ceil((targetValue - endValue) / trendStep);
        } else {
            return null;
        }
    }
});

function addBusinessDays(date, businessDays) {
    var result = new Date(date);
    var days = result.getDate();
    var d = result.getDay();
    while (businessDays > 0) {
        ++days;
        d = (d + 1) % 7;
        if (d !== 0 && d != 6) {
            --businessDays;
        }
    }
    result.setDate(days);
    return result;
}
