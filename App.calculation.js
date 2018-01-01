Ext.define("My.BurnUpCalculation", {

    TARGET_DATE: "Target Date",
    PROJECTED_DATE: "Projected Date",
    COMPLETED: "Completed",

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
            iteration: config.iteration,
            capacityPlan: config.capacityPlan,
            auxDates: config.auxDates,
            drawIterations: config.drawIterations,
            targetDate: config.targetDate,
            customStartDate: config.customStartDate,
            maxDaysAfterTargetDate: config.maxDaysAfterTargetDate,
            customTrendStartDate: config.customTrendStartDate,
            displayWidth: config.displayWidth
        };

        this.chartConfig = {
            xAxis: {
                plotLines: []
            },
            yAxis: {},
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
            if (series.name !== "Scope") {
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
            if (series.name !== "Scope") {
                for (var i = currentIndex; i < series.data.length; i++) {
                    series.data[i] = null;
                }
            }
        });
    },

    addVerticalLine: function (label, index, config) {
        if (index === -1) {
            return;
        }
        var plotLines = this.chartConfig.xAxis.plotLines;
        for (var i = 0; i < plotLines.length; i++) {
            if (plotLines[i].value === index) {
                label = plotLines[i].label.text + " / " + label;
                plotLines.splice(i, 1);
            }
        }
        plotLines.push(Ext.merge(
            {label: {text: label, y: 3, x: 3, useHTML: true}, value: index, width: 2, color: "#000", zIndex: 5},
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
        var targetDateIndex = this.findDateIndex(dates, this.calcConfig.targetDate);
        var todayAcceptedPoints = acceptedData[todayIndex];
        var todayPlannedPoints = plannedData[todayIndex];
        var trendStart = this.getTrendStart(dates, acceptedData);
        var trendSeries;
        var completedIndex;
        var stepProvider = this.createStepProvider({
            capacityPlan: this.calcConfig.capacityPlan,
            trendStart: trendStart
        });
        if (this.calcConfig.targetDate) {
            var idealData = stepProvider.trendData(targetDateIndex, plannedData[targetDateIndex], targetDateIndex);
            this.addSeriesLine(data, "Ideal", idealData, {dashStyle: "Dot"});
            this.addSubtitleText(this.TARGET_DATE + ": " + formatDate(this.calcConfig.targetDate));
        }
        var trendControlIndex = todayIndex;
        if (todayAcceptedPoints === todayPlannedPoints && todayPlannedPoints > 0) {
            var k = trendControlIndex - 1;
            while (acceptedData[k] === todayPlannedPoints || acceptedData[k] === null && plannedData[k] === todayPlannedPoints) {
                trendControlIndex--;
                k--;
            }
            completedIndex = trendControlIndex;
        }
        var projectedEndIndex;
        var projectedDateIndex = stepProvider.trendTargetIndex(trendControlIndex, todayAcceptedPoints, todayPlannedPoints);
        if (projectedDateIndex) {
            var maxDaysAfterTargetDate = this.calcConfig.maxDaysAfterTargetDate || 0;
            var trendEndIndex = Math.min(projectedDateIndex, (targetDateIndex === -1 ? trendControlIndex : targetDateIndex) + maxDaysAfterTargetDate);
            for (var j = Math.max(todayIndex, targetDateIndex, dates.length - 1); j < trendEndIndex; j++) {
                plannedData.push(todayPlannedPoints);
                dates.push(dateToIsoString(addBusinessDays(new Date(dates[dates.length - 1]), 1)));
            }
            trendSeries = stepProvider.trendData(trendControlIndex, todayAcceptedPoints, trendEndIndex, todayPlannedPoints);
            this.addSeriesLine(data, "Trend", trendSeries, {dashStyle: "Dash"});

            if (projectedDateIndex <= trendEndIndex) {
                projectedEndIndex = projectedDateIndex;
            }
            this.projectedEndDate = addBusinessDays(new Date(dates[0]), projectedDateIndex);
            if (!completedIndex && this.projectedEndDate) {
                this.addSubtitleText(this.PROJECTED_DATE + ": " + formatDate(this.projectedEndDate));
            }
        }
        // do not display completed columns after target date
        if (completedIndex) {
            var spliceIndex = Math.max(completedIndex, targetDateIndex) + 1;
            var deleteCount = dates.length;
            dates.splice(spliceIndex, deleteCount);
            acceptedData.splice(spliceIndex, deleteCount);
            plannedData.splice(spliceIndex, deleteCount);
            this.getSeriesData(data, "In Progress").splice(spliceIndex, deleteCount);
            this.getSeriesData(data, "Completed").splice(spliceIndex, deleteCount);
            this.addSubtitleText(this.COMPLETED + ": " + formatDate(dates[completedIndex]));
        }
        this.addPlotLines(dates, projectedEndIndex, completedIndex);
        // ignore too big historical scope for better readability of the chart
        var maxPlannedPoints = plannedData.reduce(function (e, max) {
            return e > max ? e : max;
        }, 0);
        var yMax = todayPlannedPoints * 1.3;
        if (maxPlannedPoints > yMax) {
            this.chartConfig.yAxis.max = yMax;
        }
        if (config.drawIterations) {
            this.addIterationsBands(dates);
        }
    },

    addPlotLines: function (dates, projectedEndIndex, completedIndex) {
        var config = this.calcConfig;
        if (config.auxDates && hasOwnProperties(config.auxDates, 1)) {
            for (var auxDate in config.auxDates) {
                if (config.auxDates.hasOwnProperty(auxDate)) {
                    this.addVerticalLine(config.auxDates[auxDate], this.findDateIndex(dates, auxDate, true), {width: 1, label: {x: 2}});
                }
            }
        }
        this.addVerticalLine("Today", this.findDateIndex(dates, config.today, true), {color: "#AAA", dashStyle: "ShortDash"});
        this.addVerticalLine(this.TARGET_DATE, this.findDateIndex(dates, config.targetDate, true));
        if (completedIndex) {
            this.addVerticalLine(this.COMPLETED, completedIndex, {color: "#774"});
        } else if (projectedEndIndex) {
            this.addVerticalLine(this.PROJECTED_DATE, projectedEndIndex, {dashStyle: "ShortDash"});
        }
    },

    addIterationsBands: function (dates) {
        var config = this.calcConfig;
        var iterationStartDate = config.iteration.get("StartDate");
        var iterationEndDate = config.iteration.get("EndDate");
        var iterationDuration = 0;
        var date = iterationStartDate;
        while (date < iterationEndDate) {
            date = addBusinessDays(date, 1);
            iterationDuration++;
        }
        var band = true;
        var startDate = iterationStartDate;
        while (dateToIsoString(startDate) > dates[0]) {
            startDate = addBusinessDays(startDate, -iterationDuration);
            band = !band;
        }
        do {
            startDate = addBusinessDays(startDate, iterationDuration);
            band = !band;
        } while (dateToIsoString(startDate) < dates[0]);

        var startIndex = this.findDateIndex(dates, startDate);
        if (startIndex === -1) {
            return;
        }

        var color = "#F8F9FD";
        this.chartConfig.xAxis.plotBands = [];
        var i = startIndex - (band ? iterationDuration : 0);
        do {
            this.chartConfig.xAxis.plotBands.push({color: color, from: Math.max(0, i), to: i + iterationDuration});
            i += iterationDuration * 2;
        } while (i < dates.length);
    },


    getTrendStart: function (dates, acceptedData) {
        var index;
        if (this.calcConfig.customTrendStartDate) {
            index = this.findDateIndex(dates, this.calcConfig.customTrendStartDate, false, 0);
        } else {
            for (index = 0; index < acceptedData.length; index++) {
                if (acceptedData[index] > 0) {
                    break;
                }
            }
        }
        return {index: index, value: acceptedData[index] || 0};
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
            if (s.name === name) {
                return s.data;
            }
        }
        return [];
    },

    adjustDataAndChartConfig: function (data) {
        data.categories = data.categories.map(function (date) {
            return formatDate(date);
        });
        var displayWidth = Math.max(Math.min(+this.calcConfig.displayWidth || 100, 500), 10);
        var threshold = data.categories.length * (100 / displayWidth);
        var step, lineWidth, groupPadding, markerEnabled;
        if (threshold > 360) {
            groupPadding = 0;
            lineWidth = 3;
            step = 30;
        } else if (threshold > 240) {
            groupPadding = 0.05;
            lineWidth = 3;
            step = 20;
        } else if (threshold > 120) {
            groupPadding = 0.1;
            lineWidth = 3;
            step = 10;
        } else {
            groupPadding = 0.15;
            markerEnabled = true;
            lineWidth = 3;
            step = 5;
        }
        Ext.merge(this.chartConfig, {
            xAxis: {
                labels: {
                    step: step
                }
            },
            plotOptions: {
                line: {
                    marker: {enabled: markerEnabled},
                    lineWidth: lineWidth
                },
                column: {
                    groupPadding: groupPadding
                }
            }
        });
    },

    createStepProvider: function (stepProviderConfig) {
        return stepProviderConfig.capacityPlan ?
            Ext.create("My.BurnupCalculation.FlexStepProvider", stepProviderConfig) :
            Ext.create("My.BurnupCalculation.FixedStepProvider", stepProviderConfig);
    }
});

Ext.define("My.BurnupCalculation.FixedStepProvider", {
    constructor: function (config) {
        this.callParent(arguments);
        this.startIndex = config.trendStart.index;
        this.startValue = config.trendStart.value;
    },

    trendStep: function (endIndex, endValue) {
        if (this.startIndex >= 0 && this.startIndex < endIndex && this.startValue !== endValue) {
            return (endValue - this.startValue) / (endIndex - this.startIndex);
        } else {
            console.log("Unable to calculate trend step for values: (startIndex=" +
                this.startIndex + ", startValue=" + this.startValue + ", endIndex=" + endIndex + ", endValue=" + endValue + ")"
            );
            return null;
        }
    },

    trendData: function (endIndex, endValue, indexLimit, valueLimit) {
        var trendStep = this.trendStep(endIndex, endValue);
        if (trendStep && indexLimit !== 0) {
            var data = [];
            var i;
            for (i = 0; i < this.startIndex; i++) {
                data[i] = null;
            }
            data[i] = this.startValue;
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

    trendTargetIndex: function (endIndex, endValue, targetValue) {
        var trendStep = this.trendStep(endIndex, endValue);
        if (trendStep && (endValue - this.startValue) * (targetValue - endValue) >= 0) {
            return endIndex + Math.ceil((targetValue - endValue) / trendStep);
        } else {
            return null;
        }
    }
});

Ext.define("My.BurnupCalculation.FlexStepProvider", {
    extend: "My.BurnupCalculation.FixedStepProvider",

    constructor: function (config) {
        this.callParent(arguments);
    }
});
